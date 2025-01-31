import { CustomError } from '../../Utils/src/utils.js';
import { EventEmitter } from 'events';
import { parse } from 'url';

/*
*  Builds options for a request to X platform 
*/
class XRequestOptions extends EventEmitter {
   constructor(options, vault, args) {
      super();

      vault.consumer_key = '', // app's consumer key
      vault.consumer_secret = '',
      vault.cert = "", // certificate (used in https - can be selfsigned)
      vault.key = "";  // private key (used for https)


      var reqHeaders = {
         'accept': '',
         'accept-language': '',
         'content-length': ''
      };

      function addParams() {
         this.apiSBS = ''; // Signature Base String for api calls
         this.apiAH = '';  // Autorization Header for api calls
         this.apiHost = ''; // host we hit for api calls
         this.apiPath = '';
         this.apiMethod = '';
         this.apiBody = ''; // body for api call is received from request body, body of each leg is legSBS (signature base string)        


         this.legSBS = ''; // SBS for OAuth legs (steps)
         this.legAH = '';  // AH string
         this.legHost = '';
         this.legPath = '';
         this.legMethod = '';

         this.verSBS = ''; // SBS for verify credentials
         this.verAH = '';
         this.verHost = '';
         this.verPath = '';
         this.verMethod = '';
      }

      function addFinalParams() {
         addParams.call(this);
         this.host = "";
         this.path = "";
         this.method = "";
         this.headers = "";
         this.body = "";
         this.key = "";
         this.cert = "";
      }

      addFinalParams.call(options);

      CustomError.call(this);
      this.addCustomErrors({
         twiz: '[twiz-server] ',
         consumerKeyNotSet: "You must provide consumer_key which identifies your app",
         consumerSecretNotSet: "You must provide consumer_secret which identifies your app",
         requestNotSet: "You must provide request (read) stream",
         responseNotSet: "You must provide response (write) stream"
      });

      this.initOptions = function init(req, res, next) {
         args.request = req;
         args.response = res;
         args.next = next;

         this.setUserParams(args, vault); // Params needed for this lib to work
         this.getRequestParamsAndHeaders(reqHeaders); // get url parameters and headers
         this.setOptions(vault, reqHeaders, options); // sets options used in X request
         this.getApiBody(req, options); // get the body for api request (request with access token)
         this.setAppContext();
      };

   }

   // set needed user parameters
   setUserParams(args, vault) {

      for (var name in args) {
         switch (name) {
            case "next":
               this.next = args[name];
               break;
            case "request":
               this.request = args[name]; // set request stream
               break;
            case "response":
               this.response = args[name]; // set response stream
               break;
            case "consumer_key": // confidential app data
               vault.consumer_key = args[name];
               break;
            case "consumer_secret":
               vault.consumer_secret = args[name];
               break;
            case "key":
               vault.key = args[name]; // reference to private key used in https encription 
               break;
            case "cert":
               vault.cert = args[name]; // reference to certificate used in https encription
               break;
         }
      }

      this.checkAllParams(vault); // checks that all important params are in place

   }

   // check for needed user parameters
   checkAllParams(vault) {

      for (var name in vault) {

         switch (name) {
            case "consumer_key":
               if (!vault[name]) throw this.CustomError('consumerKeyNotSet');
               break;
            case "consumer_secret":
               if (!vault[name]) throw this.CustomError('consumerSecretNotSet');
               break;
            //for now we dont check for this.next (for compatibility with other frameworks)
         }
      }
      if (!this.request) throw this.CustomError('requestNotSet');
      if (!this.response) throw this.CustomError('responseNotSet');
   }

   // extract query parameters and headers
   getRequestParamsAndHeaders(reqHeaders) {

      this.requestQueryParams = parse(this.request.url, true).query; // parses options sent in client request url
      this.getRequestHeaders(reqHeaders);
   }

   // get the needed headers from client request
   getRequestHeaders(reqHeaders) {

      var sentHeaders = this.request.headers;
      for (var name in reqHeaders) {
         if (sentHeaders.hasOwnProperty(name)) reqHeaders[name] = sentHeaders[name];
      }
   }

   // set options for a request
   setOptions(vault, reqHeaders, options) {

      for (var name in options) {
         if (this.requestQueryParams[name])
            options[name] = this.requestQueryParams[name];
      }

      options.headers = reqHeaders; // sets headers
      options.cert = vault.cert;    // sets certificate (https) 
      options.key = vault.key;      // sets private_key used for https encription
   }

   // gets the body for X API request (with access token)
   getApiBody(req, options) {

      req.on('data', (chunk) => {
         options.apiBody = options.apiBody ? `${options.apiBody}${chunk}` : chunk;
      });

   }

   setAppContext() {
      this.app; // can be reference to 'this.req.app' when in Express, or 'this' when in Connect

      if (this.request.app) { // check express context

         this.app = this.request.app;
      }
      else if (this.next) { // for connect context just check if there is 'next' function

         EventEmitter.init.call(this); 
         this.app = this;  
      }
   }
}


export default XRequestOptions;
