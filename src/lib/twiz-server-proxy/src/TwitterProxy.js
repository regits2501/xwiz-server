import { request } from 'https';
import { parse } from 'url';


class TwitterProxy { // TODO rename to XProxy
   constructor(res, next) {

      this.response = res; // client response
      this.next = next;

      this.headerFix = {
         textHtml: 'application/x-www-url-formencoded;charset=utf-8'
      };

      this.twtRequest;
      this.twtResponse;

   }

   createTwtRequest(options, twtResponseHandler) {

      console.log('createTwitterRequest(): options:', options);


      this.twtRequest = request(options, function (res) {
         this.twtResponse = res;
         twtResponseHandler();
      }.bind(this));

      if (options.body) {
         this.twtRequest.write(options.body);
      }


   }

   twtRequestOnError() {

      this.twtRequest.on('error', function (err) { this.next(err); }.bind(this));
   }

   twtRequestSend() {
      this.twtRequest.end(); // sends request to twitter
   }

   twtResponseOnFailure(phase) { // TODO rename this to isXRequestFailed
      

      if (this.twtResponse.statusCode >= 200 && this.twtResponse.statusCode < 300) return false;

      if (phase === 'leg') { // when error is on some oauth leg, twitter sends content-type=application/json but body is actually form encoded
         this.twtResponse.headers['content-type'] = this.headerFix.textHtml; // Fix twitter's incorect content-type
      }

      // set response's status line and headers
      this.setResponseHeaders();
      this.twtResponse.pipe(this.response); // pipe response to clent response

      return true;
   }

   twtResponsePipeBack(action) {

      if (action === 'request_token') this.setRequestTokenHeaders(); // apply content-type fix

      this.setResponseHeaders();

      this.twtResponse.pipe(this.response);
   }

   setRequestTokenHeaders() {

      var headers = this.twtResponse.headers;
      headers['content-type'] = this.headerFix.textHtml; // aplly header fix for twitter's incorect content-type
   }

   setResponseHeaders() {

      this.response.statusCode = this.twtResponse.statusCode;
      this.response.statusMessage = this.twtResponse.statusMessage;
      var headers = this.twtResponse.headers;

      for (var header in headers) {
         /* istanbul ignore else */
         if (headers.hasOwnProperty(header)) this.response.setHeader(header, headers[header]);
      }


   }

   twtResponseOnError(reject) {

      this.twtResponse.on('error', function (err) {

         this.next(err);
         if (reject) reject(err); // promise aware error handling 
      }.bind(this));


   }
   twtResponseReceiveBody(vault, encoding) {
      
      vault.twtData = '';
      this.twtResponse.on('data', function (data) {
         vault.twtData += data.toString(encoding); // makes 
      });
   }

   twtResponseOnEnd(func) {
      this.twtResponse.on('end', func);
   }

   twtResponseParseBody(vault) { 

      var data = vault.twtData; 
      try { // try parsing access token
         data = JSON.parse(data);
      }
      catch (er) {
         data = parse("?" + data, true).query; // simple hack for parsing twitter's access token 
      }

      vault.twtData = data;

   }
}   


export default TwitterProxy;

