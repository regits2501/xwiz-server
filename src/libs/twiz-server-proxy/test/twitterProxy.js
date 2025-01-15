var TwitterProxy = require('../src/TwitterProxy');
var EventEmitter = require('events').EventEmitter;
var fx           = require('node-fixtures');       // loads fixtures from test/fixtures
var httpMocks    = require('node-mocks-http');     // mock request/response pair (mocks received client request)
var nock         = require('nock');                // to mock twitter api response
var assert       = require('assert');

var options = fx.options.data;                     // get options fuxture


var next = function(){};

var twtAPI = {
   host: 'https://' + options.host,
   path: options.path,
   responseBody:  {                              // body of a twitter api response (like for request_token leg)
     oauth_token: 'oauthToken',
     oauth_token_secret: 'oauthTokenSecret',
     oauth_callback_confirmed: 'true'
   }

}

var twitterResponse; 
var tp;                                         // placeholder for twitter proxy instance

var request;                                   // mocks of client request/response streams
var response;

beforeEach(function(){

   request  = httpMocks.createRequest();
   response = httpMocks.createResponse({
       eventEmitter: EventEmitter              // add listening to events capability
   });

   tp = new TwitterProxy(response, next);
})

describe('Twitter Proxy', function(){

   it('create twitter request-response', function(done){
       twitterResponse = nock(twtAPI.host)        // Now we can call twitter from our testing module. Nock will
                       .post(twtAPI.path)         // intecept it and mock it.
                       .reply(200, twtAPI.responseBody);

       tp.createTwtRequest(options, function(){
          assert.ok(typeof tp.twtRequest === 'object'  && typeof tp.twtRequest === 'object');
          done();
       })
      
       tp.twtRequestSend();                     // sends twitter request to nock
   })  
  describe('Failure', function(){
     it('request error -> call next', function(done){
       
       var error = { message: "One does not simply walk into Mordor", code:"BAD_THINGS" }
        
       twitterResponse = nock(twtAPI.host)       
                        .post(twtAPI.path)        
                        .replyWithError(error);  // simulates error on request
      
       tp.createTwtRequest(options, function(){
            // hendler doesnt get called , since we simulate error on request    
       }) 
      
       tp.next = function(err){                 // define what next means for this simulation
          assert.deepStrictEqual(err, error);          
          done();
       } 

       tp.twtRequestOnError();   // tp.twtRequestOnError will call the internal reference to next function
      
       tp.twtRequestSend();
     })
    
     describe('statusCode !== 200', function(){
        it('leg phase - pipe back to client', function(done){  // test error in leg phase
           var error = { message: "Long dark of Moria...", code: "Internal server error"}
          
           twitterResponse = nock(twtAPI.host)
                            .post(twtAPI.path)        
                            .reply(500, error);  // simulates error on request
    
           tp.createTwtRequest(options, function(){
           
             this.twtResponseOnFailure('leg');     // deal with non 200 responses (on leg phase fix content-type)
             this.response.on('end', function(){   // note this is response is pair of client request (mocked)
                 done();                           // since the tp.twtResponse.pipe() ends the stream ,
                                                   // so calling 'end' event handler indicates succesfull pipe
             })

           }.bind(tp))

           tp.twtRequestSend();
       })

       it('all other phases - pipe back to client', function(done){ // test error in all other phases
           var error = { message: "Long dark of Moria...", code: "Internal server error"}
          
           twitterResponse = nock(twtAPI.host)       
                            .post(twtAPI.path)        
                            .reply(500, error);  // simulates error on request
    
           tp.createTwtRequest(options, function(){
           
             this.twtResponseOnFailure();          // deal with non 200 responses
             this.response.on('end', function(){   // note this is response is pair of client request (mocked)
                 done();                           // since the tp.twtResponse.pipe() ends the stream ,
                                                   // so calling 'end' event handler indicates succesfull pipe
             })

           }.bind(tp))

           tp.twtRequestSend();
       })
       
       it('response error', function(done){        // test error in all other phases
           var errorStr = 'You shall not pass'
           tp.next = function(err){                // next will be called in response error handler
                assert.equal(err, errorStr)
                done();
           } 
           twitterResponse = nock(twtAPI.host)       
                            .post(twtAPI.path)        
                            .reply(400);           // s
    
           tp.createTwtRequest(options, function(){

             this.twtResponseOnFailure();           // subscribes twtResponseOnError() handler
             this.twtResponse.emit('error', errorStr);  

           }.bind(tp))

           tp.twtRequestSend();
       })
 
      

     })

       

  })

  describe('Success',function(){
        
     describe('twitter request', function(){       
       
        it('response received', function(done){                          // make sure twitter request is ending as expected
           var vault = {};
           twitterResponse = nock(twtAPI.host)       
                          .post(twtAPI.path)        
                          .reply(200, twtAPI.responseBody);
  
           tp.createTwtRequest(options, function(){
              this.twtResponseOnFailure()
              this.twtResponseReceiveBody(vault,'utf8')
              this.twtResponseOnEnd(function(){          // test ending of response stream
                 assert.deepStrictEqual(JSON.parse(vault.twtData), twtAPI.responseBody);
                 done();
              })
               
           }.bind(tp))
      
           tp.twtRequestSend();                          // sends twitter request to nock

 
        })

        it('request_token -> pipe back', function(done){  // make sure request token is piped back to client
          twitterResponse = nock(twtAPI.host)       
                          .post(twtAPI.path)        
                          .reply(200, twtAPI.responseBody);
  
          tp.createTwtRequest(options, function(){
             this.twtResponsePipeBack('request_token');  // applies header fix for request token response
 
             this.response.on('end', function(){
                done();
             }) 
          }.bind(tp))
      
          tp.twtRequestSend();                            // sends twitter request to nock
        })

        it('all other -> pipe back', function(done){      // make sure all other request are piped back also
          twitterResponse = nock(twtAPI.host)      
                           .post(twtAPI.path)        
                           .reply(200, twtAPI.responseBody);
  
          tp.createTwtRequest(options, function(){
             this.twtResponsePipeBack();
             this.response.on('end', function(){
                done();
             }) 
          }.bind(tp))
      
          tp.twtRequestSend();                           // sends twitter request to nock
        })
   
        it('receive body', function(done){               // test that body of a request is received (in vault)
           var vault = {};
           twitterResponse = nock(twtAPI.host)      
                            .post(twtAPI.path)       
                            .reply(200, twtAPI.responseBody);
  
           tp.createTwtRequest(options, function(){

              this.twtResponseReceiveBody(vault, 'utf8');
              this.twtResponsePipeBack();
              this.response.on('end', function(){
                   
                assert.deepStrictEqual(JSON.parse(vault.twtData), twtAPI.responseBody);
                done();
             }) 
           }.bind(tp))
      
           tp.twtRequestSend();                          // sends twitter request to nock
        })

        describe('parse body', function(){

          var vault = {};
          it('object from json string', function(done){   // test parsing of a twiter response body

             twitterResponse = nock(twtAPI.host)       
                              .post(twtAPI.path)     
                              .reply(200, twtAPI.responseBody);
  
             tp.createTwtRequest(options, function(){
    
               this.twtResponseReceiveBody(vault, 'utf8'); 
               this.twtResponsePipeBack();
               this.response.on('end', function(){
                 
                   tp.twtResponseParseBody(vault);       // parse body on end
                   assert.deepStrictEqual(vault.twtData, twtAPI.responseBody)
                  done();
               }) 

             }.bind(tp))
      
             tp.twtRequestSend();                       // sends twitter request to nock
          })
           
          it('object from www-form-url-encoded string', function(done){   // test parsing of a body according
             var urlEncoded = fx.options.urlEncodedRequestToken;
 
             twitterResponse = nock(twtAPI.host)       
                              .post(twtAPI.path)     
                              .reply(200, urlEncoded);
  
             tp.createTwtRequest(options, function(){
    
               this.twtResponseReceiveBody(vault, 'utf8'); 
               this.twtResponsePipeBack();
               this.response.on('end', function(){
                
                  tp.twtResponseParseBody(vault);       // parse body on end
                  assert.strictEqual(vault.twtData.oauth_token, twtAPI.responseBody.oauth_token);
                  assert.strictEqual(vault.twtData.oauth_token_secret, twtAPI.responseBody.oauth_token_secret) 
                  assert.strictEqual(vault.twtData.oauth_callback_confirmed, 
                                      twtAPI.responseBody.oauth_callback_confirmed)
                                                        // assert each property instead of using deepStrictEqual
                                                        // since prototype of compared object are not same.
                                                        // twtData is instance of URL, doesnt have Object for  
                                                        // for prototype.
                  done();
               }) 

             }.bind(tp))
      
             tp.twtRequestSend();                     // sends twitter request to nock
          })

       })

   })
  
 })
})

