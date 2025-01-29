import Options from '../Options/src/Options.js'
import XProxy from '../XProxy/src/XProxy.js';
import OAuth from '../OAuth/src/OAuth.js';



/*
   Used to create Phases, a phase can be:
     * An OAuth 1.0a leg - request token, access token leg
     * Verify credentials - verification of user's access token
     * (X) API phase - accessing an X platform api with access token (in behalf of user)
*/
export default class PhaseBuilder extends Options {
    constructor(options, vault, args) {
                              
       super(options, vault, args);
 
       this.leg = ['request_token', '', 'access_token']; // Oauth leg (step) names
 
       this.phases = {

          leg: {
             toString: function () { return 'leg'; },
             requestToken: this.leg[0],
             accessToken: this.leg[2]
          },
 
          api: {
             toString: function () { return 'api'; },
             plain: 'api',
             accessProtectedResorces: 'APR'
          },
 
          verCredentials: {
             toString: function () { return 'ver'; },
             plain: 'ver'
          }
       };
 
       this.Phase = function Phase(name, action, res, next) {
          this.name = name.toString();
          this.action = action;
          this.signRequest = new OAuth(options);
          this.proxyRequest = new XProxy(res, next);

       };
 
       this.legPhase;
       this.apiPhase;
 
       this.initPhases = function (req, res, next) {
 
          this.initOptions(req, res, next);

          console.log('options:', options);
          this.legPhase = new this.Phase(this.phases.leg, this.getLegAction(options.legPath), this.response, this.next); // set current oauth leg phase
          this.apiPhase = new this.Phase(this.phases.api, this.phases.api.plain, this.response, this.next); // set phase that will run if we have an access token
       };
 
       this.CustomError.call(this);
       this.addCustomErrors({
          'legNotRecognized': 'OAuth leg sent by client is not recognized'
       });
    }
 
    // get supported leg action
    getLegAction(legPath) {
       
       let action = this.parseLegAction(legPath);

       this.verifyLegAction(action);
       
       console.log(`action: |${action}|`)
       return action;
    }

    // extract action from request path
    parseLegAction(path){

       let action;
 
       for (var i = path.length; i >= 0; i--) { // from end of string search for "/", then substring rest
          if (path.charAt(i) === '/') {
             action = path.substring(i + 1);
             break;
          }
       }

       return action;
    }
    
    // verify that action is a supported OAuth leg
    verifyLegAction(action) {
 
       var valid = (action === this.leg[0] || action === this.leg[2]);
       if (!valid) this.next(this.CustomError('legNotRecognized')); // call next(..) with error
 
    }
 }

 