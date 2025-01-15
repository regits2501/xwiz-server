var CustomError   = require('twiz-client-utils').CustomError;
var percentEncode = require('twiz-client-utils').percentEncode;
var EventEmitter  = require('events').EventEmitter;
var url           = require('url');

function Options (options, vault, args){ // builds request options and confugures user supplied parameters

      vault.consumer_key =  "",   // app's consumer key
      vault.consumer_secret = "",
      vault.cert = "",            // certificate (can be selfsigned)
      vault.key = ""              // private key (used for https encription)
      
      
      var reqHeaders = {          // holds headers of a request
         'accept': "",
         'accept-language': "",
         'content-length': ''    // must be zero when method is POST with no body
      }  
  
      function addParams(){               // Adds parametars for each possible type (phase) of request  
         this.apiSBS = '';                // SBS for api calls
         this.apiAH = '';                 // Ah for api calls
         this.apiHost = '';               // host we hit for api calls
         this.apiPath = '';                    
         this.apiMethod = '';          
      

         this.legSBS = '';                // Signature base string for OAuth legs (steps)
         this.legAH = '';                 // Authorization header string
         this.legHost = '';                    
         this.legPath = '';
         this.legMethod = '';
         
         this.verSBS = ''                 // SBS for verify credentials
         this.verAH = '';
         this.verHost = '';
         this.verPath = '';
         this.verMethod = '';
      }
     
     function addFinalParams(){           // Adds final parameters that core http uses when sending a request
        addParams.call(this)         
        this.host = "";
        this.path = "";
        this.method = "";
        this.headers = "";
        this.key = "";
        this.cert = "";
     }                                   

     addFinalParams.call(options); 
      
     CustomError.call(this);
     this.addCustomErrors({
       twiz: '[twiz-server] ',
       consumerKeyNotSet: "You must provide consumer_key which identifies your app",
       consumerSecretNotSet: "You must provide consumer_secret which identifies your app",
       certNotSet: "You must provide cert (certificate) used in https encription when connecting to twitter.",
       keyNotSet: "You must provide key (private key) used in https encription when connecting to twitter",
       requestNotSet: "You must provide request (read) stream",
       responseNotSet: "You must provide response (write) stream"
     })
     
     this.initOptions = function init(req, res, next){ 
         // console.log("in INIT")
                                             // Encompases server logic 
         args.request  = req;
         args.response = res;
         args.next     = next;

         this.setUserParams(args, vault);    // Params needed for this lib to work
       //  if(this.isPreflight()) return;    // on preflighted requests stop here
         this.getOptions(reqHeaders);        // Options sent in query portion of client request url and headers
         this.setOptions(vault, reqHeaders, options);    // sets options used for twitter request

         this.setAppContext();
     }

   };
   
   Options.prototype = Object.create(EventEmitter.prototype) // link EE prototype
   
   Options.prototype.setUserParams = function(args, vault){
      for(var name in args){
         switch(name){
            case "request":
              this.request = args[name];    // set request stream
            break;
            case "response":
              this.response = args[name];   // set response stream
            break;
            case "next":
              this.next = args[name];
            break;
            case "consumer_key":            // confidential app data
              vault.consumer_key = args[name];
            break;
            case "consumer_secret":
              vault.consumer_secret = args[name];
            break;
            case "key":
              vault.key = args[name];       // reference to private key used in https encription 
            break;
            case "cert":
              vault.cert = args[name];      // reference to certificate used in https encription
            break;
         }
      }
      
      this.checkAllParams(vault); // checks that all important params are in place
      
   };

   Options.prototype.checkAllParams = function (vault){
     
      for(var name in vault){
         
         switch(name){
            case "key":
               if(!vault[name]) throw this.CustomError('keyNotSet');
            break;
            case "cert":
               if(!vault[name]) throw this.CustomError('certNotSet');
            break;
            case "consumer_key":
               if(!vault[name]) throw this.CustomError('consumerKeyNotSet');
            break;
            case "consumer_secret":
               if(!vault[name]) throw this.CustomError('consumerSecretNotSet');
            break;
            //for now we dont check for this.next (for compatibility with other frameworks)
         }
      }
         if(!this.request)  throw this.CustomError('requestNotSet');
         if(!this.response) throw this.CustomError('responseNotSet');
   }
   
   Options.prototype.getOptions = function(reqHeaders){ // gets params from query portion of request url
      this.sentOptions = url.parse(this.request.url, true).query // parses options sent in client request url
      // console.log('sentOptions: ', this.sentOptions);
      
      this.getRequestHeaders(reqHeaders); // gets headers from client request and puts them in reqHeaders
   };

   Options.prototype.getRequestHeaders = function(reqHeaders){ // takes headers from request if header
                                                               // is supported ( is in reqHeaders)
      var sentHeaders = this.request.headers // headers from request stream
      for(var name in reqHeaders){           // omiting content-length, since it must be 0, for POST with no body
         if(sentHeaders.hasOwnProperty(name) && name !== 'content-length') reqHeaders[name] = sentHeaders[name];
      }
      //console.log("reqHeaders: " , reqHeaders);
   };

   Options.prototype.setOptions = function(vault, reqHeaders, options){ // Uses params sent in url to set
                                                                        // them along options' prototype
                                                                        // chain if those
                                                                        // param names exists in prototype 
      for(var name in options){
         if(this.sentOptions[name])
         options[name] = this.sentOptions[name];  // If sentOptions has that 
                                                  // property and it is not undefined.
                                                  // Querystring object is not 
                                                  // connected to Object from node 6.0
                                                  // It doesnt have hasOwnProperty(..)
      }

      options.headers = reqHeaders    // sets headers
      options.cert    = vault.cert;   // sets certificate (https) 
      options.key     = vault.key;    // sets private_key used for https encription
      
      // console.log(" OPTIONS: ", options);
   };

     
  Options.prototype.setAppContext = function(){ // check the framework
      this.app;               // Can be reference to 'this.req.app' when in Express, or 'this' when in Connect
       
      if(this.request.app){            // check express context
         this.app = this.request.app; 
        // console.log('express confirmed');
      }
      else if(this.next){              // For connect context just check if there is 'next' function
         EventEmitter.init.call(this); // Call emitter constructor on this object
         this.app = this;              // app is 'this', since we are linked to EventEmitter 
        // console.log('Connect confirmed')         
      }
  };

   module.exports = Options;
