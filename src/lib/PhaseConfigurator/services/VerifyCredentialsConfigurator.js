import { CustomError } from "../../Utils/src/utils.js";
import { parse } from 'url';

/** 
  Adds set of activities (runs) that change the request options for verify credentials
*/
export default class VerifyCredentialsConfigurator {
    
    static set({
        legPhase,
        apiPhase: verCredentialsPhase,
        resolve,
        reject,
        saved
    }, options, vault, params) {

        const savedApiPhase = saved.apiPhase; // the old (saved) apiPhase

        verCredentialsPhase.run = savedApiPhase.run; // much of the actions(runs) are same as in saved phase

        verCredentialsPhase.signRequest.run = function (phase) {

            this.setCredentialParams(phase, options, params); // set params that user specified
            savedApiPhase.signRequest.run.call(this, phase); // sign the request
        };

        verCredentialsPhase.signRequest.setCredentialParams = function (phase, options, params) {

            const sentParams = parse(options[phase + 'Path'], true).query; // take params for this phase;
            let verSBS = options[phase + 'SBS'];
            let verPath = options[phase + 'Path'];

            for (const prop in sentParams) {
                /* istanbul ignore else */
                if (!params.hasOwnProperty(prop)) { // user didn't specify param, remove it
                    verPath = VerifyCredentialsConfigurator.removeSubstr(verPath, prop + '=[a-z]*&?'); // remove query param from path
                    verSBS = VerifyCredentialsConfigurator.removeSubstr(verSBS, prop + '%3D[a-z]*(%26)?'); // do the same for SBS string
                }
            }

            verPath = VerifyCredentialsConfigurator.trimEnd(verPath, '&'); // trim any artefacts (from removeSubstr) at end of the string
            verPath = VerifyCredentialsConfigurator.trimEnd(verPath, '?'); // if there are no query params remove indicator
            verSBS = VerifyCredentialsConfigurator.trimEnd(verSBS, '%26'); // same for SBS string

            options[phase + 'Path'] = verPath; // set verPath 
            options[phase + 'SBS'] = verSBS; // set verSBS

        };

        CustomError.call(verCredentialsPhase.proxyRequest); // add custom error to credentials proxy request
        verCredentialsPhase.proxyRequest.addCustomErrors({
            'accessTokenNotVerified': ''
        });

        verCredentialsPhase.proxyRequest.run = savedApiPhase.proxyRequest.run; // same as savedApiPhase.proxyRequest
        verCredentialsPhase.proxyRequest.sendRequest = savedApiPhase.proxyRequest.sendRequest;

        verCredentialsPhase.proxyRequest.handleResponse = function () {

            this.twtResponseOnError(); // handle error
            this.twtResponseReceiveBody(vault, 'utf8'); // place body in vault       

            this.verCredentialsEnd = function () {

                this.twtResponseParseBody(vault); // parse the body to json
                const credentials = vault.twtData; // take credentials data
                if (!credentials.errors) {
                    resolve(credentials); // resolve credentials 
                    return;
                }

                this.messages.accessTokenNotVerified = JSON.stringify(credentials); // set value to stringified response
                const error = this.CustomError('accessTokenNotVerified');

                this.next(error); // call error handler
                reject(error); // reject promise      

            }.bind(this);

            this.twtResponseOnEnd(this.verCredentialsEnd);
        };

        legPhase.run = function () {
            // when access token is  misssing (see alternator.switch_)
            throw this.CustomError('accessTokenMissing');
        }.bind(this);
    }

    static removeSubstr(str, regstr) {

        const regexp = new RegExp(regstr); // create regexp object from string
        const removed = str.replace(regexp, ''); // replace regexp pattern with empty string (remove it)

        return removed;
    };

    static trimEnd(str, endChars) {

        const endlength = endChars.length; // Length of characters we search at the end
        const strlength = str.length; // Length of the string
        const end = str.slice(strlength - endlength, strlength); // Take end of the string

        if (end === endChars) return str.slice(0, strlength - endlength); // Chars are at the end, slice them 
        else return str; // Or return unchanged string  

    };
}