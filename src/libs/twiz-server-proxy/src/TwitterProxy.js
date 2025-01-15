var https       = require('https');
var url         = require('url');

function TwitterProxy(res, next){ // 
      this.response = res;
      this.next     = next;
     
      this.headerFix = {
        textHtml : 'application/x-www-url-formencoded;charset=utf-8'
      }

      this.twtRequest;
      this.twtResponse;

      
   }   

   TwitterProxy.prototype.createTwtRequest = function(options, twtResponseHandler){ // creates request we'll send
      this.twtRequest = https.request(options, function(res){                       // to Twitter
          this.twtResponse = res;
          twtResponseHandler();
      }.bind(this))
   }

   TwitterProxy.prototype.twtRequestOnError = function(){ // all

      this.twtRequest.on('error', function(err){ this.next(err) }.bind(this))
   }

   TwitterProxy.prototype.twtRequestSend = function(){     // all

      this.twtRequest.end() // sends request to twtter
   }

   TwitterProxy.prototype.twtResponseOnFailure = function(phase){ // all responce
       //  console.log('statusCode:', this.twtResponse.statusCode );
      if(this.twtResponse.statusCode === 200) return false;

      // console.log('in onFailure')
      // console.log('content-type (before) : ', this.twtResponse.headers['content-type'])
      
      if(phase ==='leg'){          // when error is on some oauth
                                   // leg, twitter sends content-type=application/json
                                   // but body is actually form encoded. So we fix that.
        this.twtResponse.headers['content-type'] = this.headerFix.textHtml; // Fix twitter's incorect content-type
      }                                                             
                                                                   
      this.twtResponse.on('data', function(){ // had 'data' as arg
       // console.log('failure body:', data.toString('utf8'))  
      })

      // console.log('content-type: ', this.twtResponse.headers['content-type'])
                                                                   // set response's status line and headers
      this.setResponseHeaders();
      this.twtResponse.pipe(this.response);              // pipe response to clent response
        // console.log('before errorHandler');
      this.twtResponseOnError();
      return true
   }
   
   TwitterProxy.prototype.twtResponsePipeBack = function(action){  // all (not access token)
         
         //this.twtResponseReceiveBody(vault, enc); // receives body to vault in specified encoding
         //this.twtResponseOnEnd(handler);          // on response end invoke handler
      
         /* function handler(){
            this.twtResponseParseBody(vault);     // make it as json string
 
            this.setResponseHeaders();            //
            this.twtDataPipe(vault, enc);
         }.bind(this); 

         */
       //console.log(' pipeBack action:', actio)
         if(action === 'request_token') this.setRequestTokenHeaders(); // apply content-type fix
         
         this.setResponseHeaders();
         
         this.twtResponse.pipe(this.response); //  
   }

   TwitterProxy.prototype.setRequestTokenHeaders = function(){

      var headers = this.twtResponse.headers;
      headers['content-type'] = this.headerFix.textHtml; // aplly header fix for twitter's incorect content-type
    //  console.log('headers[content-type]: ', headers['content-type']);
   } 

   TwitterProxy.prototype.setResponseHeaders = function(){  // all responce (exept access_token) 
        this.response.statusCode    = this.twtResponse.statusCode;     
        this.response.statusMessage = this.twtResponse.statusMessage;
        var headers = this.twtResponse.headers;
        
        for(var header in headers){
          /* istanbul ignore else */              
          if(headers.hasOwnProperty(header)) this.response.setHeader(header, headers[header])
        }
        

      // console.log('headers writen:', this.response.headers)
   }
 
   TwitterProxy.prototype.twtResponseOnError = function(){ // all response
     //   console.log('twtResponseOnError')
      this.twtResponse.on('error', function(err){
           //console.log('twtResponse error: ', err);
           this.next(err);
      }.bind(this))
   }
   
   TwitterProxy.prototype.twtResponseReceiveBody = function(vault, encoding){ // all access_token
     // console.log('twtResponseReceiveBody');
      vault.twtData = '';
      this.twtResponse.on('data', function(data){
       //  console.log(" twitter responded: ", data.toString('utf8'));
         vault.twtData += data.toString(encoding);                    // makes 
      })
   }

   TwitterProxy.prototype.twtResponseOnEnd = function(func){
       
       this.twtResponse.on('end', func);
   }

   TwitterProxy.prototype.twtResponseParseBody = function(vault){ // 
      
      var data = vault.twtData;               // console.log('vault.twtData:', vault.twtData)
      try{                                    // try parsing access token
        data = JSON.parse(data);  
      }
      catch(er){ 
        data = url.parse("?" + data, true).query // simple hack for parsing twitter's access token 
                                                               // string (that is form-encoded)
        //console.log('url parsed => data:', data);
      }
      
      vault.twtData = data ; 
      
   }

   module.exports = TwitterProxy;
