/** 
  Adds set of activities (runs) that change the request options for request_token leg 
*/
export default class RequestTokenConfigurator {

    static set({ legPhase: requestTokenPhase , apiPhase}, options, vault) {
    
        // define steps for request token
        requestTokenPhase.run = function () {

            this.signRequest.run(this.name);
            this.proxyRequest.run(this.name, this.action);
        };

        // define steps for singing the request for request_token
        requestTokenPhase.signRequest.run = function (phase) {

            this.insertConsumerKey(vault, options, phase);
            this.insertSignature(vault, options, phase);
            this.finalizeLegPhaseOptions(options, phase);
        };

        // define finish of the request for request_token
        requestTokenPhase.proxyRequest.run = function (phase, action) {

            this.sendRequest(this.handleResponse.bind(this, phase, action));
        };

        // define how to handle the response from X for request token phase
        requestTokenPhase.proxyRequest.handleResponse = function (phase, action) {

            this.twtResponseOnError(); // Handle any response errors
            if (this.twtResponseOnFailure(phase)) return; // if response didn't have desired outcome

            this.twtResponsePipeBack(action); // ends response after piping
        };


        // define steps for sending the request to X for request token
        requestTokenPhase.proxyRequest.sendRequest = function (twtResponseHandler) {

            this.createTwtRequest(options, twtResponseHandler); // Create request we send to twitter
            this.twtRequestOnError(); // Handle any request error
            this.twtRequestSend(); // Send request 
        };

        apiPhase.run = requestTokenPhase.run; // same phase run

        // define steps for OAuth signing the request to X for API phase
        apiPhase.signRequest.run = function (phase) {

            this.insertConsumerKey(vault, options, phase);
            this.insertAccessToken(vault, options, phase);
            this.insertSignature(vault, options, phase);
            this.finalizeApiPhaseOptions(options, phase);
        };

        apiPhase.proxyRequest.run = requestTokenPhase.proxyRequest.run; // same run as in leg phase
        apiPhase.proxyRequest.handleResponse = requestTokenPhase.proxyRequest.handleResponse; // same response handler 
        apiPhase.proxyRequest.sendRequest = requestTokenPhase.proxyRequest.sendRequest; // same send request 

    }
}
