/**
  Adds set of activities (runs) for access_token leg
*/  
export default class AccessTokenConfigurator {

    static set({ alternator, stream }, vault) {

        const {
            legPhase: accesTokenPhase,
            apiPhase,
            resolve,
            reject,
        } = alternator

        // define finish of the request for access token
        accesTokenPhase.proxyRequest.finish = function () {
            this.twtResponseParseBody(vault);
            /* istanbul ignore else */
            if (!stream) { alternator.run(vault.twtData); } // Alternator runs again with possible access token,

            // makes (builtin) api call.
            resolve(vault.twtData); // Resolves a promise where access token = twtData
        };

        // define finish on failure of the request for access token
        accesTokenPhase.proxyRequest.finishOnFail = function () {
            this.twtResponseParseBody(vault); // Parse body
            reject(vault.twtData); // Reject promise with data received from failed request

        };


        // define how to handle the response from X for access token phase
        accesTokenPhase.proxyRequest.handleResponse = function (phase) {

            this.twtResponseOnError(reject); // reject promise also when error happens
            this.twtResponseReceiveBody(vault, 'utf8'); // receives response body (memory hit)

            if (this.twtResponseOnFailure(phase)) { // invoke on failure ending 

                this.twtResponseOnEnd(this.finishOnFail.bind(this));
                return;
            }

            this.twtResponseOnEnd(this.finish.bind(this)); // successful end
        }

        // add user finish for the 'token_found' event
        AccessTokenConfigurator.userFinish = function (onEnd) {

            apiPhase.proxyRequest.finish = function () {

                this.twtResponseParseBody(vault); // parse returned data
                onEnd(vault.twtData, this.response, this.next); // call user handler with data 

                // (user MUST terminate response)
            };

            apiPhase.proxyRequest.finishOnFail = accesTokenPhase.proxyRequest.finishOnFail; // we need same 'onFail' handler 
            apiPhase.proxyRequest.handleResponse = accesTokenPhase.proxyRequest.handleResponse; // set same response handler
        };
    }
}