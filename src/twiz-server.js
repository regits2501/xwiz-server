var CustomError  = require('twiz-client-utils').CustomError;  // borrow util from client
var url          = require('url');
var Options      = require('twiz-server-options');
var OAuth        = require('twiz-server-oauth');
var TwitterProxy = require('twiz-server-proxy');
var Upgrade      = require('twiz-server-phaseutils')       


  function PhaseBuilder(options, vault, args){  // Phase is a set of parameters (sent in url) used for a oauth,
                                                // api requests. For example, OAuth leg params, Api params ect...                          
     
     Options.call(this, options, vault, args);

     this.leg = ['request_token', '', 'access_token'] // Oauth leg (step) names
     
     this.phases = {
       leg: {                                    // OAuth leg phase with each leg (step), when we dont have
                                                 // access token 
          toString: function(){ return 'leg' }, 
          requestToken: this.leg[0],
          accessToken : this.leg[2] 
       },
       
       api:{                                     // Twitter api calls phase (when we have access token)
          toString: function(){ return 'api' },
          plain: 'api',
          accessProtectedResorces: 'APR'  
       },

       verCredentials:{                          
         toString: function(){ return 'ver'}, 
         plain: 'ver'
       }   
     }

     this.Phase = function Phase(name, action, res, next){
       this.name   = name.toString();
       this.action = action;
       this.signRequest  = new OAuth(options);
       this.proxyRequest = new TwitterProxy(res, next);
     }

     this.legPhase;
     this.apiPhase;

     this.initPhases = function (req, res, next){
     
        this.initOptions(req, res, next); // initOptions
      
        this.legPhase = new this.Phase(this.phases.leg, this.getCurrentLegAction(options), this.response, this.next) // set current oauth leg phase
        this.apiPhase = new this.Phase(this.phases.api, this.phases.api.plain, this.response, this.next)         // set phase that will run if we alredy have have an access token
     }

     this.CustomError.call(this);
     this.addCustomErrors({
        'legNotRecognized':'OAuth leg sent by client is not recognized'
     });
   }

   PhaseBuilder.prototype = Object.create(Options.prototype); 

   PhaseBuilder.prototype.getCurrentLegAction = function(options){// reads oauth leg from sent quary params (path)
      // console.log('legPath: ', options.legPath); 
      var path = options.legPath;
      var action;
  
      for(var i = path.length; i >= 0; i--){  // from end of string search for "/", then substring rest
        if(path.charAt(i) === '/'){
          action = path.substring(i+1);
          break;
        }
      }
  
      this.isLegActionValid(action); // console.log('action:', action)
      return action;
   }
   
   PhaseBuilder.prototype.isLegActionValid = function(action){   // checks wheater sent oauth leg is supported   

      var valid =  (action === this.leg[0] || action === this.leg[2]);
      if(!valid) this.next(this.CustomError('legNotRecognized')); // call next(..) with error
  
   }

 
    //*/
   function PhaseConfigurator (args){

      var vault = {};              // create private object for sensitive user info
      var options = {};            // create priv object also for possible sensitive info from front end
     
      this.addUtils.call(options); // extend functionality

      PhaseBuilder.call(this, options, vault, args)

      this.alternator = {            // Menages phases as abstractions of different sets of request's url params
                                                                     
         run: function(tokenObj){ //console.log('alternator.run +====')
            try{

              OAuth.safeKeepAccessToken(tokenObj, vault); // safe keep token in vault
              this.switch_()                              // choose a phase 
            }
            catch(err){
              this.errorHandler(err);                    // handle any errors
            }
         },
         switch_: function(){                            // check for access token and pick a phase
    //        console.log('SWITCH ----');
            if(vault.accessToken) this.apiPhase.run();   // straightforward to twitter api (access token present)
            else this.legPhase.run() ;                   // go for OAuth leg (no access token present)
         },
    
         legPhase: '',                                   // OAuth leg
         apiPhase: '',                                   // Twitter api phase 
         
         errorHandler: function(err){  //console.log('error handler alternator run -----');
            this.next(err);                              // call error handler (if any)
            if(this.reject) this.reject(err)             // if a phase uses promise dont let it hang 
         },
         
         next: '',                                       // reference to express' next() 
         resolve:'' ,                                    // reference to current promise resolvers
         reject: ''                                     
      }

      Upgrade.addWorkSpace.call(this.alternator);       // adding state (phase) menagment tools to alternator

      this.startAlternator  = function(req, res, next){ // console.time('t')
         // console.log('Alternator.started')
         try {
            this.initPhases(req, res, next);             // initiate phases
         }catch(err){
            this.alternator.errorHandler.bind(this,err);
         }                                         

         this.initAlternator();                                                    // set alternator
         this.configurePhases(this.alternator.legPhase.action, options, vault);    // define what phases do    
         this.emitPhaseEvents(options, vault);                                     // notify user
      }
     
     
      CustomError.call(this);  // add custom errors 
      this.addCustomErrors({
         'accessTokenMissing': 'To verify access token, function must be called with an access token object'
      })

      PhaseConfigurator.vault   = vault;   // convinience refs
      PhaseConfigurator.options = options;
   }

   PhaseConfigurator.prototype = Object.create(PhaseBuilder.prototype)
   
   PhaseConfigurator.prototype.addUtils = function(){

     this.removeSubstr = function removeSubstr(str, regstr){ // removes subtring from a string
        var regexp = new RegExp(regstr);              // create regexp object from string
        var removed = str.replace(regexp,'');         // replace regexp pattern with empty string (remove it)
   
        return removed;                          
     }
        
     this.trimEnd = function (str, endChars){                  // Trims ending chars we specify, from a string
        var endlength = endChars.length;                       // Lenght of characters we search at the end
        var strlength = str.length                             // Lenght of the string
        var end = str.slice(strlength - endlength, strlength); // Take end of the string
     //   console.log('end', end)
        if(end === endChars) return str.slice(0, strlength - endlength); // Chars are at the end, slice them 
           else return str;                                              // Or return unchanged string  
  
     }

   }

   PhaseConfigurator.prototype.initAlternator = function(){
      this.alternator.load({ legPhase: this.legPhase, apiPhase: this.apiPhase })     // load it with phases
      this.alternator.next = this.next;                                              // get next reference 
   } 

   PhaseConfigurator.prototype.configurePhases = function (action, options, vault){

      if(action === this.leg[0])                  // request_token 
        this.addRequestTokenRun(options, vault);  
 
      if(action === this.leg[2])                  // access_token
        this.accessTokenPromise = this.promisify(this.addAccessTokenRun.bind(this, options, vault));
      
   }      
      
   PhaseConfigurator.prototype.addRequestTokenRun = function(options, vault){ 

      var legPhase = this.alternator.legPhase;
      var apiPhase = this.alternator.apiPhase;

      legPhase.run = function(){                                 // adding set of jobs (runs) for this phase
         // console.log('leg.phase run: ', this.name, this.action)
         this.signRequest.run(this.name);
         this.proxyRequest.run(this.name, this.action);
      } 
      //console.log('legPhase.signRequest:', legPhase.signRequest)
      legPhase.signRequest.run = function(phase){
                                                    // new OAuth
  
         this.insertConsumerKey(vault, options, phase);
         this.insertSignature(vault, options, phase);
         this.finalizeOptions(options, phase);
      }
 
      legPhase.proxyRequest.run = function(phase, action){         
          // console.log('proxyRequest run()') 
         this.sendRequest(this.handleResponse.bind(this, phase, action));
      }
   
      legPhase.proxyRequest.handleResponse =  function(phase, action){   // Handle response from twitter
          /*   console.log('twtResponse content-type: ', this.twtResponse.headers['content-type']);
               console.log('twtResponse statusCode: ', this.twtResponse.statusCode);
               console.log('twtResponse statusMessage: ', this.twtResponse.statusMessage);
               console.log('twtResponse headers: ', this.twtResponse.headers);
               this.twtResponse.on('data',function(data){
                   console.log('in data Event - |phase|: '+ phase + " |action|: " +action )
                   console.log(data.toString('utf8'))
             })
          */   
             this.twtResponseOnError();                            // Handle any response errors
             if(this.twtResponseOnFailure(phase)) return;          // if response didn't have desired outcome
         
             // console.log('before PipeBack')
             this.twtResponsePipeBack(action); // ends response after piping
             this.twtResponse.on('end', function(){//console.log(action + ' ENDED'); console.timeEnd('t')}.bind(this))
              })
      }
  
      legPhase.proxyRequest.sendRequest = function(twtResponseHandler){
        // console.log('request sent with Options:', options);
         this.createTwtRequest(options, twtResponseHandler); // Create request we send to twitter
         this.twtRequestOnError();                                // Handle any request error
         this.twtRequestSend();                                   // Send request 
      }           
         
      apiPhase.run = legPhase.run; // same phase run
            
      apiPhase.signRequest.run = function(phase){
           
         this.insertConsumerKey(vault, options, phase);
         this.insertAccessToken(vault, options, phase);
         this.insertSignature(vault, options, phase);
         this.finalizeOptions(options, phase);
      }      
 
      apiPhase.proxyRequest.run = legPhase.proxyRequest.run
      apiPhase.proxyRequest.handleResponse = legPhase.proxyRequest.handleResponse // same response handler 
      apiPhase.proxyRequest.sendRequest = legPhase.proxyRequest.sendRequest // same response handler 
   
  }

  PhaseConfigurator.prototype.addAccessTokenRun = function(options, vault){

     this.addRequestTokenRun(options, vault);

     var alternator = this.alternator;
     var legPhase   = alternator.legPhase;
     var apiPhase   = alternator.apiPhase;
     var resolve    = alternator.resolve;               // reference to promise resolver
     var reject     = alternator.reject;
     var stream     = this.sentOptions.stream;
    // console.log('access_token run')

     legPhase.proxyRequest.finish =  function(){ // on succsefull request this handler is invoked
         this.twtResponseParseBody(vault);
         /* istanbul ignore else */
         if(!stream){ alternator.run(vault.twtData);}  // Alternator runs again with possible access token,
                                                     // makes (bultin) api call
         resolve(vault.twtData);                     // Resolves a promise where access token = twtData
     }

     legPhase.proxyRequest.finishOnFail = function(){ // on request failure (status code != 200) invoke this
         this.twtResponseParseBody(vault);            // parse body
         reject(vault.twtData)                        // reject promise with data received from failed request
         
     }
     
     legPhase.proxyRequest.handleResponse = function(phase){ // redefine handle response for legPhase
           //  console.log('phase: ', phase, 'action', action);
          //   console.log('twtResponse content-type: ', this.twtResponse.headers['content-type']);
          //   console.log('twtResponse statusCode: ', this.twtResponse.statusCode);
          //   console.log('twtResponse statusMessage: ', this.twtResponse.statusMessage);
          // console.log('twtResponse headers: ', this.twtResponse.headers);
         this.twtResponseOnError(reject);            // reject promise also when error happens
         this.twtResponseReceiveBody(vault, 'utf8')
         
         if(this.twtResponseOnFailure(phase)){  console.log('||  failure finishOnFail :', this.finishOnFail)
                                           console.log('|| failure finish:', this.finish)
             this.twtResponseOnEnd(this.finishOnFail.bind(this))           
             return;
         }
        
       
         console.log('handleResponse [ok] >>>> finish:', this.finish)
         this.twtResponseOnEnd(this.finish.bind(this));
        
      }
   
      this.userFinish = function(onEnd){                // set optional onEnd() handler as finish for apiPhase 

         apiPhase.proxyRequest.finish = function (){         // invoke user function when response ends
 
            this.twtResponseParseBody(vault);                // parse returned data
            onEnd(vault.twtData, this.response, this.next);  // call user handler with data 
                                                             // (user MUST terminate response)
         }
 
         apiPhase.proxyRequest.finishOnFail   = legPhase.proxyRequest.finishOnFail;  // we need same 'onFail' handler 
         apiPhase.proxyRequest.handleResponse = legPhase.proxyRequest.handleResponse; // set same response handler
          
      
      }
   }
  // function that rewires api phase of access_token with user provided finish
  PhaseConfigurator.prototype.addVerCredentialsRun = function(options, vault, params){
    
     var legPhase            = this.alternator.legPhase;              // take current leg phase 
     var verCredentialsPhase = this.alternator.apiPhase;              // the new (changed) apiPhase
     var apiPhase            = this.alternator.saved.apiPhase;        // the old (saved) apiPhase
     var resolve             = this.alternator.resolve;               // reference to promise resolver
     var reject              = this.alternator.reject;
                    
     verCredentialsPhase.run = apiPhase.run;              // much of the actions(runs) are same as in saved phase

     verCredentialsPhase.signRequest.run = function(phase){ // new signRequest that sets credential params before
                                                            // signing it

        this.setCredentialParams(phase, options, params);   // set params that user specified
        apiPhase.signRequest.run.call(this, phase);         // sign the request
     }

     verCredentialsPhase.signRequest.setCredentialParams = function(phase, options, params){ // sets params for
                                                                                    // 'verify credentials' phase

        var sentParams =  url.parse(options[phase + 'Path'], true).query; // take params for this phase;
        var verSBS  = options[phase + 'SBS'];
        var verPath = options[phase + 'Path'];
    
        for(var prop in sentParams){
           /* istanbul ignore else */                     
           if(!params.hasOwnProperty(prop)){                              // user didn't specify param, remove it
              verPath = options.removeSubstr(verPath, prop + '=[a-z]*&?');     // remove query param from path
              verSBS  = options.removeSubstr(verSBS, prop + '%3D[a-z]*(%26)?') // do the same for SBS string
           } 
        }

        verPath = options.trimEnd(verPath, '&');  // trim any artefacts (from removeSubstr) at end of the string
        verPath = options.trimEnd(verPath, '?')   // if there are no query params remove indicator
        verSBS  = options.trimEnd(verSBS, '%26'); // same for SBS string

        options[phase + 'Path'] = verPath; // set verPath 
        options[phase + 'SBS']  = verSBS;  // set verSBS
       
     }

     CustomError.call(verCredentialsPhase.proxyRequest); // add custom error to credentials proxy request
     verCredentialsPhase.proxyRequest.addCustomErrors({
        'accessTokenNotVerified':''                
     })     

     verCredentialsPhase.proxyRequest.run = apiPhase.proxyRequest.run;   // again same as apiPhase.proxyRequest
     verCredentialsPhase.proxyRequest.sendRequest = apiPhase.proxyRequest.sendRequest;

     verCredentialsPhase.proxyRequest.handleResponse = function(){ // we need new handleResponse 
                          
         this.twtResponseOnError();                       // handle error
         this.twtResponseReceiveBody(vault, 'utf8');      // place body in vault       
                 
         this.verCredentialsEnd = function (){            // when response is received
             
            this.twtResponseParseBody(vault);             // parse the body to json
            var credentials = vault.twtData;              // take credentials data
            if(!credentials.errors){ 
              resolve(credentials);                       // resolve credentials 
              return;
            }

            this.messages.accessTokenNotVerified = JSON.stringify(credentials); // set value to strigified response
            var error = this.CustomError('accessTokenNotVerified');
 
            this.next(error);                             // call error handler
            reject(error);                                // reject promise      
         
         }.bind(this) 
       
         this.twtResponseOnEnd(this.verCredentialsEnd)
     }  
     
     legPhase.run = function(){     // new legPhase run, as we dont go to legPhase (when in verifyCredentials)
                                    // when access token is  misssing (see alternator.switch_)
        throw this.CustomError('accessTokenMissing')
     }.bind(this);
  }

  PhaseConfigurator.prototype.promisify = function(func){ //
     var alternator = this.alternator
     return  new Promise(function(resolve, reject){
         alternator.resolve = resolve;
         alternator.reject  = reject; 
         func();
     })
  }

  PhaseConfigurator.prototype.emitPhaseEvents =  function(){ 
   //  console.log('this.alternator.legPhase.action: ', this.alternator.legPhase.action);

     
      switch(this.alternator.legPhase.action){            
        case this.leg[0] : // console.log('loadAccessToken') //  request token leg
          this.app.emit(this.eventNames.loadAccessToken, 
                        this.getRequestTokenInterface(),     // get user facing interface for this leg
                        this.verifyAccessToken.bind(this)    // to check accesst token 'freshness' 
          );
        break;
        case this.leg[2] :  // console.log('tokenFound')     // access token leg
          this.app.emit(this.eventNames.tokenFound, 
                        this.accessTokenPromise,             // promise for accesss token run
                        this.getAccessTokenInterface())        
          this.alternator.run();                             // run the access token leg which resolves promise 
        break;
      }
  }
  
  PhaseConfigurator.prototype.eventNames = {                // Names of events that are emited
     loadAccessToken: 'hasteOrOAuth',                        // Handler for inserting (loading) access token  
                                                            // Different value for clearer user api (see graphs)
     tokenFound:      'tokenFound'                          // Handler that passes access token to user
  }
                                             
  PhaseConfigurator.prototype.getRequestTokenInterface = function(){

     var inf = {                                                       // Set interface object
        OAuth:         this.alternator.run.bind(this.alternator, ''),  // Run with no access token
        continueOAuth: this.alternator.run.bind(this.alternator, ''),  // Alias of the OAuth()
        haste:         this.alternator.run.bind(this.alternator)       // Run with possible access token
     }
     //  inf must ahve real next(..) reference
     this.setStreamSupport(inf)
     return inf;
  }
  
  PhaseConfigurator.prototype.getAccessTokenInterface = function(){

     var inf = {
        onEnd: this.userFinish  
     }
  // inf must habe userStreamFinish as next(..)
     this.setStreamSupport(inf);
     return inf;
  }
  
  PhaseConfigurator.prototype.setStreamSupport = function(inf){ // console.log('Stream: ', this.sentOptions.stream)
     if(this.sentOptions.stream){             // check that user indicated stream behaviour
        inf.stream     = true;                // set stream indicator
        inf.next       = this.next;           // goes to the next middleware // could be just next() - do finish
        inf.twitterOptions = this.getTwitterRequestOptions();
     }
  }
  
  PhaseConfigurator.prototype.getTwitterRequestOptions = function(){
     return {
        restHost:   this.sentOptions.apiHost,                       // rest api domain
        streamHost: 'stream.twitter.com',                           // stream api domain
        method: this.sentOptions.apiMethod,                         // set method    
        path:   url.parse(this.sentOptions.apiPath, true).pathname, // path whitout query string
        params: url.parse(this.sentOptions.apiPath, true).query     // object with query params
     }
  } 
  
  PhaseConfigurator.prototype.verifyAccessToken = function(tokenObj, params){ 
     return this.promisify(this.verCredentials.bind(this, tokenObj, params))
  }

  PhaseConfigurator.prototype.verCredentials = function(tokenObj, params = {}){ // run phase that verifies access token
     var options = PhaseConfigurator.options;
     var vault   = PhaseConfigurator.vault;
     
     this.alternator.save({ legRun: this.legPhase.run, apiPhase: this.apiPhase }); // save apiPhase and legRun
                                                                                   // before we change them
     
     this.verCredentialsPhase = new this.Phase(this.phases.verCredentials,
                                               this.phases.verCredentials.plain, 
                                               this.response, 
                                               this.next)                  // make new phase

     this.alternator.changePhase({ apiPhase: this.verCredentialsPhase });  // add verCredentials as apiPhase
     
     this.addVerCredentialsRun(options, vault, params);           // add its run (actions);
     this.alternator.run(tokenObj);                               // runs the verCredentials phase
     
     var saved = this.alternator.saved;                                        // things we saved
     this.alternator.load({ apiPhase: saved.apiPhase, legRun: saved.legRun }); // load back before any changes
  }



  module.exports =  function(args){
    return function(){    
       var pc = new PhaseConfigurator(args);
       pc.startAlternator.apply(pc, arguments);
    }
  }

