import { CustomError } from '../Utils/src/utils.js'//
import { parse } from 'url';
import OAuth from '../OAuth/src/OAuth.js';
import Upgrade from '../PhaseUtils/src/PhaseUtils.js';

import RequestTokenConfigurator from './services/RequestTokenConfigurator.js'
import AccessTokenConfigurator from './services/AccessTokenConfigurator.js';
import VerifyCredentialsConfigurator from './services/VerifyCredentialsConfigurator.js';

import PhaseBuilder from '../PhaseBuilder/PhaseBuilder.js';

/**
   Configures phases created with PhaseBuilder (see PhaseBulder phases info).
   With emmited events it exposes the interface to the user for each phase.
*/
class PhaseConfigurator extends PhaseBuilder {
    constructor(args) {

        const vault = {}; // sensitive user info
        const options = {}; // request options for X API's

        super(options, vault, args);

        // define alternator as a tools for running/switching (between) the phases
        this.alternator = {

            run: function (tokenObj) {

                try {
                    OAuth.safeKeepAccessToken(tokenObj, vault); // safe keep token in vault
                    this.switch_(); // choose a phase 
                }
                catch (err) {
                    this.errorHandler(err); // handle any errors
                }
            },

            switch_: function () {
                if (vault.accessToken) this.apiPhase.run(); // straightforward to twitter api (access token present)
                else this.legPhase.run(); // go for OAuth leg (no access token present)
            },

            legPhase: '', // OAuth leg
            apiPhase: '', // Twitter api phase 

            errorHandler: function (err) {
                this.next(err); // call error handler (if any)
                if (this.reject) this.reject(err); // if a phase uses promise dont let it hang 
            },

            next: '', // reference to express' next() 
            resolve: '', // reference to current promise resolvers
            reject: ''
        };

        Upgrade.addWorkSpace.call(this.alternator); // adding state (phase) menagment tools to alternator

        this.startAlternator = function (req, res, next) {

            try {

                this.initPhases(req, res, next); // initiate phases

            } catch (err) {

                this.alternator.errorHandler.bind(this, err); // catch errors
            }

            this.initAlternator(); // set alternator
            this.configurePhases(this.alternator.legPhase.action, options, vault); // define what phases do    
            this.emitPhaseEvents(options, vault); // notify user
        };


        CustomError.call(this); // add custom errors 
        this.addCustomErrors({
            'accessTokenMissing': 'To verify access token, function must be called with an access token object'
        });

        PhaseConfigurator.vault = vault; // convinience refs
        PhaseConfigurator.options = options;
    }

    // load alternator with phases
    initAlternator() {
        this.alternator.load({ legPhase: this.legPhase, apiPhase: this.apiPhase });
        this.alternator.next = this.next; // get next reference 
    }

    // configure each phase
    configurePhases(action, options, vault) {

        if (action === this.leg[0]) // request_token phase
            this.configureRequestTokenPhase(options, vault);

        if (action === this.leg[2]) // access_token phase
            this.accessTokenPromise = this.promisify(this.configureAccessTokenPhase.bind(this, options, vault));

    }

    // configure alternator for request token phase
    configureRequestTokenPhase(options, vault) {
   
        RequestTokenConfigurator.set(this.alternator, options, vault);
    }
  
    // configure alternator for access token phase
    configureAccessTokenPhase(options, vault) {

        this.configureRequestTokenPhase(options, vault);

        const alternator = this.alternator;
        const stream = this.requestQueryParams.stream; // flag that indicates stream usage

        AccessTokenConfigurator.set({ alternator, stream }, vault);
       
    }

    //configure alternator for verify credentials phase
    configureVerifyCredentialsPhase(options, vault, params) {
   
        VerifyCredentialsConfigurator.set({ ...this.alternator }, options, vault, params)
    }

    promisify(func) {
        const alternator = this.alternator;
        return new Promise(function (resolve, reject) {
            alternator.resolve = resolve;
            alternator.reject = reject;
            func();
        });
    }

    // use event emmiter to expose interface to the user for each phase
    emitPhaseEvents() {

        switch (this.alternator.legPhase.action) {

            case this.leg[0]:
                this.app.emit(this.eventNames.loadAccessToken,
                    this.getRequestTokenInterface(), // get user facing interface for this leg
                    this.verifyAccessToken.bind(this) // to check access token 'freshness' 
                );
                break;
            case this.leg[2]: // access token leg
                this.app.emit(this.eventNames.tokenFound,
                    this.accessTokenPromise, // promise for accesss token run
                    this.getAccessTokenInterface());
                this.alternator.run(); // run the access token leg which resolves promise 
                break;
        }
    }

    // get user interface for the 'hasteOrOAuth' event (decision point after request_token leg) 
    getRequestTokenInterface() {

        const inf = {
            OAuth: this.alternator.run.bind(this.alternator, ''), // Run with no access token
            continueOAuth: this.alternator.run.bind(this.alternator, ''), // Alias of the 'OAuth'
            haste: this.alternator.run.bind(this.alternator) // Run with possible access token
        };

        this.setStreamSupport(inf);
        return inf;
    }


    // get user interface for the 'tokenFound' event 
    getAccessTokenInterface() {

        const inf = {
            onEnd: AccessTokenConfigurator.userFinish
        };

        this.setStreamSupport(inf);
        return inf;
    }

    // set support for stream (X) API's
    setStreamSupport(inf) {
        if (this.requestQueryParams.stream) { // check that user indicated stream behaviour
            inf.stream = true; // set stream indicator
            inf.next = this.next; // goes to the next middleware 
            inf.twitterOptions = this.getXRequestOptions(); // gets X options user sent in request
        }
    }

    // get request options we sent to X 
    getXRequestOptions() {
        return {
            restHost: this.requestQueryParams.apiHost, // rest api domain
            streamHost: 'stream.x.com', // stream api domain
            method: this.requestQueryParams.apiMethod, // set method    
            path: parse(this.requestQueryParams.apiPath, true).pathname, // path without query string
            params: parse(this.requestQueryParams.apiPath, true).query // object with query params
        };
    }

    verifyAccessToken(tokenObj, params) {
        return this.promisify(this.verCredentials.bind(this, tokenObj, params));
    }

    verCredentials(tokenObj, params = {}) {
        const { options, vault } = PhaseConfigurator;

        this.alternator.save({ legRun: this.legPhase.run, apiPhase: this.apiPhase }); // save apiPhase and legRun

        this.verCredentialsPhase = new this.Phase(this.phases.verCredentials,
            this.phases.verCredentials.plain,
            this.response,
            this.next); // make new phase

        this.alternator.changePhase({ apiPhase: this.verCredentialsPhase }); // add verCredentials as apiPhase

        this.configureVerifyCredentialsPhase(options, vault, params); // configure phase for verifying credentials
        this.alternator.run(tokenObj); // run the verCredentials phase

        const saved = this.alternator.saved; // things we saved
        this.alternator.load({ apiPhase: saved.apiPhase, legRun: saved.legRun }); // load back before any changes
    }
}

PhaseConfigurator.prototype.eventNames = {   // Names of events that are emitted
    loadAccessToken: 'hasteOrOAuth',         // Handler for inserting (loading) access token  
    tokenFound: 'tokenFound'                 // Handler that passes access token to user
}

export default PhaseConfigurator;