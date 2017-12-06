var twizServer   = require('../src/twiz-server');
var assert       = require('assert');
var EventEmitter = require('events').EventEmitter;
var httpMocks    = require('node-mocks-http')
var nock         = require('nock');
var fx           = require('node-fixtures');
var fs           = require('fs');

//var express    = require('express')

var args   = {                   // mock consumer and https keys
   consumer_key: 'CONSUMER_KEY',
   consumer_secret: 'CONSUMER_SECRET',
   key: 'tlsServerKey',                 
   cert: 'tlsServerCert'
}

var mock;
var twizer;  // preset args for all requests

var twtAPI = {                                     // set twitter response params 
     host: 'https://api.twitter.com',
     path: '/oauth/request_token',
     responseBody:  {                            // body of a twitter api response (like for request_token leg)
       oauth_token: 'oauthToken',
       oauth_token_secret: 'oauthTokenSecret',
       oauth_callback_confirmed: 'true'
     }

}

var twitterResponse = nock(twtAPI.host)        // Now we can call twitter from our testing module. Nock will
                      .post(twtAPI.path)        // intecept it and mock it with these params.
                      .reply(200, twtAPI.responseBody);
var accessToken ;
var app;

beforeEach(function(){

  accessToken = { oauth_token: 'oauthToken', oauth_token_secret: 'oauthTokenSecret' }

  mock = {                                       // mock client (received) request
    request: httpMocks.createRequest({
       url: fx.data.req.requestTokenUrl          // get request token url
    }),
   
    response: httpMocks.createResponse({
       eventEmitter: EventEmitter
    }),

    next: function(err){/*...*/}
  }

  mock.request.app = new EventEmitter();         // simulate express framework environment
  app = mock.request.app;                        // convinience var
  	
  twizer = twizServer(args);
  

})

function errorValidation(name, err){             // used to check thrown errors by name

    if(err.name === name) return true;
}

describe('twiz-server', function(){

   describe('Failure', function(){

      it('oauth leg not recognised', function(done){ // check that unsupported oauth leg paths are handled
          mock.request.url = mock.request.url.replace('request_token','fire_token');// mock unsupported oauth leg
          mock.next = function(err){
             assert.equal(err.name, 'legNotRecognized');
             done(); 
          }
          twizer(mock.request, mock.response, mock.next);
      })
     
     describe('basic params mising', function(){   
       it('call next err', function(){
          mock.next = function(err){ console.log(err.message);
             assert.equal(err.name, 'requestNotSet'); // assert that we ahave error we wanted  
          }
          
          twizer('', mock.response, mock.next);       // simulate missing request stream reference
       })
     })
      
     describe('request token leg', function(){
       it('oauth token missing in api call - call next()', function(done){ // missing oauth_token,check for error

           
           app.on('hasteOrOAuth', function(twiz, verifyCredentials){
                accessToken.oauth_token = ''; // simulate missing oauth token
                twiz.haste(accessToken);               
           })

           mock.next = function(err){
             assert.equal(err.name , 'oauthTokenMissing')  // assert we passed error to next handler
             done()
           }           
   
           twizer(mock.request, mock.response, mock.next);
       })
      
      // oauth token secret missing
       it('oauth token secret missing in api call - call next()', function(done){ // missing oauth_token_secret

           
           app.on('hasteOrOAuth', function(twiz, verifyCredentials){
              accessToken.oauth_token_secret = ''; // simulate missing oauth token
              twiz.haste(accessToken);                  // tries to make api call since oauth token object is present            

           })

           mock.next = function(err){
             assert.equal(err.name , 'oauthTokenSecretMissing')  // assert that thrown error is one we want
             done()
           }           
   
           twizer(mock.request, mock.response, mock.next);       
       })
     })


     describe('verCredentials', function(){

        it('no access token - call next(err) ', function(done){ // check that error is thrown when verCredentials is called without access token 
            app.on('hasteOrOAuth', function(twiz, verifyCredentials){

                verifyCredentials('')            // simulate call with no access token       
               .then(function fullfiled(token){ 
                    /*...*/                                      // we expect rejected promise
                }, function rejected(err){ 
                    // console.log('name:', err.name, '\nmessage: ',err.message)
                   assert.equal(err.name, 'accessTokenMissing') // assert that error we want is thrown
                   assert.equal(errorInNext.name, 'accessTokenMissing'); // check that next is called with same error             
                   done();
                })
            })

            var errorInNext;
            mock.next = function(err){
               errorInNext = err;                               // remember error in next()
            }           
   
            twizer(mock.request, mock.response, mock.next);

        })
        
     })
      
     
     describe('status code !== 200', function(){

       describe('request token', function(){
         it('<- pipe back', function(done){ // make sure error in request token is piped back tp client
           nock.cleanAll();
           twitterResponse = nock(twtAPI.host)
                           .post(twtAPI.path)
                           .reply(400, 'One does not simply ...'); // simulate failure

           app.on('hasteOrOAuth', function(twiz, verifyCredentials){ // simulate oauth call with no access token
               twiz.continueOAuth(); // when no access token is present it goes to request token (oauth) leg
              
           })
        
           mock.response.on('end', function(){  // error is piped back to client(response) and stream ends
              done();
           })

         
         
           twizer(mock.request, mock.response, mock.next);
        })
      })
    
      describe('access token', function(){
        it('<- pipe back', function(done){  // make sure error in access token request is piped back
                                                         // to client
           mock.request.url = fx.data.req.accessTokenUrl // Simulate received access token request 
           nock.cleanAll();

           var responseError = { errors: 'One does not simply walk ...' } 
           var twitterResponse = nock(twtAPI.host)
                                .post('/oauth/access_token')
                                .reply(400, responseError)
          
           var rejectedData;
           app.on('tokenFound', function(p, twiz){
              // must reject promise
                p.then(function fullfiled(data){
                  /*...*/                          // never happens
               },
                function rejected(err){ // 
                   rejectedData = err;
               })
           })

           mock.response.on('end', function(){ // make sure that response ended and promise was resolved
               setTimeout(function(){       // do checks on next tick (promise reject handler after response end)
 
                  assert.equal(400, mock.response._getStatusCode());
                  assert.deepStrictEqual(rejectedData, responseError); // assert promise was rejected with error
                        
                  done()
               },0) // run in next tick

           })

           twizer(mock.request, mock.response, mock.next);
        })
      
    
    
        it('<- api call (after access token) pipe back', function(done){ // make sure api call fail is piped back 
           nock.cleanAll();
           mock.request.url = fx.data.req.accessTokenUrl // Simulate received access token request 

         
           var accessToken = { oauth_token: 'oauthToken', oauth_token_secret:'oauthTokenSecret'}
 
           twitterResponse = nock(twtAPI.host)                    // simualte successful access token request
                            .post('/oauth/access_token')
                            .reply(200, accessToken);
           
           var error = { err: 'Something went wrong'}
           var twitterResponse2 = nock('https://api.twitter.com')     // then simulate succesful api request
                                  .post(fx.data.req.at_apiPath)       // apiPath for access token requests
                                  .reply(400, error);
      
           var receivedToken;
           var app = mock.request.app;

           app.on('tokenFound', function(p){             // in access token handler receive token
              p.then(function(token){
                 receivedToken = token;
                 
              })
           })
           mock.response.on('end', function(){        // response ends on succesful second 'api' call 
                                                      // afther access token request
               assert.deepStrictEqual(accessToken, receivedToken) // check that we got access token
               
               assert.equal(400, mock.response._getStatusCode()) // check that we've simulated an error
              done(); 
           })
           
          
           twizer(mock.request, mock.response, mock.next);
                      
       })
     })

    describe('verifyCredentials', function(){
       it('call next(err)', function(done){                   // check response not 200OK in verCredentials

          var error = {                                        // corresponds to HTTP 404 page not found
               "errors":[{"message":"Sorry, that page does not exist","code":34}]
          };

          var twtResponse = nock(twtAPI.host)
                            .get('/1.1/account/verify_credentials.json') // verify credentials path
                            .reply(400, error)

          app.on('hasteOrOAuth', function(twiz, verifyCredentials){

             verifyCredentials(accessToken)          
             .then(function fullfiled(token){ 
                    /*...*/                                      // we expect rejected promise
              }, function rejected(err){
                   
                     // console.log('name:', err.name, '\nmessage: ',err.message)
                   assert.deepStrictEqual(err.name, 'accessTokenNotVerified');// check that we have sent error
                   assert.deepStrictEqual(errorInNext.name,'accessTokenNotVerified'); // check that next() is 
                                                                                      // called with same error
                   done();
              })
           })

           var errorInNext;
           mock.next = function(err){ 
               errorInNext = err;                               // remember error in next()

           }           
   
           twizer(mock.request, mock.response, mock.next);

       })
     })
    
    })
   })

   describe('Success', function(){           // Check succesfull requests to twitter
     describe('request token', function(){
       it('<- piped back to client', function(done){   // Check that request token is piped back to client
           nock.cleanAll();
           twitterResponse = nock(twtAPI.host)             
                             .post(twtAPI.path)
                             .reply(200,twtAPI.responseBody ); // simulate success

           app.on('hasteOrOAuth', function(twiz, verifyCredentials){ // simulate oauth call (no access token)
               twiz.continueOAuth();
              
           })
        
           mock.response.on('end', function(){  // error is piped back to client(response) and stream ends
              done();
           })

           twizer(mock.request, mock.response, mock.next);
       })

       it('stream', function(done){ // test that twiz gets stream tools ready
           nock.cleanAll();
           
           mock.request.url = fx.data.req.requestTokenWithStream  // Simulate stream specified in request token 
           mock.next = function(){ // simulate Expess' next middleware invocation
               done();             // calling done in middleware = next(..) call tested
           }                                                    // step 

           var app = mock.request.app;
           var sentOptions = {                // simulate sent twittier request options
               restHost: 'api.twitter.com',
               streamHost: 'stream.twitter.com',
               method: 'POST',
               path: '/1.1/statuses/update.json',
               params: { 
                 status: '"They say the owlet brings wisdom"\n ~ trough random quotes.' 
               } 
           }
 
           app.on('hasteOrOAuth', function(twiz, verifyCredentials){
                 
                assert.ok(twiz.stream);

		assert.equal(twiz.twitterOptions.restHost, sentOptions.restHost);
                assert.equal(twiz.twitterOptions.streamHost, sentOptions.streamHost);
                assert.equal(twiz.twitterOptions.method, sentOptions.method)            // method
                assert.equal(twiz.twitterOptions.path, sentOptions.path);               // path
                assert.deepEqual(twiz.twitterOptions.params, sentOptions.params)        // params

                assert.ok(typeof twiz.next === 'function');   
                twiz.next();                                  // end the test
           })

           twizer(mock.request, mock.response, mock.next);

       })
    })
     
       // request token api call test case needed
    describe('access token', function(){   
       it('access token & api call', function(done){  // Check that we've got access token and that api call is
                                                       // is succesfull
           nock.cleanAll();
           mock.request.url = fx.data.req.accessTokenUrl       // Simulate received access token request 

         
 
           twitterResponse = nock(twtAPI.host)                 // simualte successful access token request
                             .post('/oauth/access_token')
                             .reply(200, accessToken);
            
           var twitterResponse2 = nock(twtAPI.host)             // then simulate succesful api request
                                  .post(fx.data.req.at_apiPath) // api path for access token requests
                                  .reply(200, { success: true});
      
           var receivedToken;
           var app = mock.request.app;

           app.on('tokenFound', function(p, twiz){            // in access token handler receive token
              p.then(function(token){
                 receivedToken = token;
                 
              })
           })

           mock.response.on('end', function(){               // response ends on succesful second call (api call)
                                                             // afther access token request
               assert.deepStrictEqual(accessToken, receivedToken)
               done();
           })

           twizer(mock.request, mock.response, mock.next);
                      
       })
    
       
       it('api call ends with user callback function', function(done){
           nock.cleanAll();
           mock.request.url = fx.data.req.accessTokenUrl       // Simulate received access token request 

         
 
           twitterResponse = nock(twtAPI.host)                 // simualte successful access token request
                            .post('/oauth/access_token')
                            .reply(200, accessToken);
           
           var responseBody = {success: true}
           var twitterResponse2 = nock(twtAPI.host)            // then simulate succesful api request
                                  .post(fx.data.req.at_apiPath)// api path for access token request// api path for access token requestss 
                                  .reply(200, responseBody);
      
           var receivedToken;
           var receivedResponseBody;
           var app = mock.request.app;

           app.on('tokenFound', function(p, twiz){            // in access token handler receive token
              p.then(function(token){
                 receivedToken = token;
              })
              
              twiz.onEnd( function userFinish(twtData, response){ // specifies user callback that ends stream
                    receivedResponseBody = twtData;         // remember data we got from api request
                    response.statusCode = '302'
                    response.statusMessage = 'Found';
                    response.setHeader('Location','https://myapp.com/myChangedPage')
                    response.end() // ends stream
  
              })

           })

           mock.response.on('end', function(){               // response ends on succesful second call (api call)
                                                             // in user callback function
               assert.deepStrictEqual(receivedToken, accessToken)            // check we got access token
               assert.deepStrictEqual(receivedResponseBody, responseBody)    // check we got data in user cb

               assert.equal(302, mock.response._getStatusCode());            // check statusCode
               done();
           })

           twizer(mock.request, mock.response, mock.next);

          
       })

       

       it('stream', function(done){
           nock.cleanAll();
           
           mock.request.url = fx.data.req.accessTokenWithStream  // Simulate stream specified in request token 
           mock.next = function(){ // simulate Expess' next middleware invocation
               done();             // calling done in middleware = next(..) call tested
           }                                                        // step 
           
         
           var accessToken = {
                oauth_token:'OAUTH_TOKEN',
                oauth_token_secret: 'OAUTH_TOKEN_SECRET'
           };

           twitterResponse = nock(twtAPI.host)                 // simualte successful access token request
                            .post('/oauth/access_token')
                            .reply(200,accessToken);

          
           var app = mock.request.app;
           var sentOptions = {
                restHost: 'api.twitter.com',
                streamHost: 'stream.twitter.com',
                method: 'POST',
                path: '/1.1/statuses/update.json',
                params: { 
                    status: '"If you look into your own heart, and you find nothing wrong there, what is there to worry about? What is there to fear?  "\n ~ Confucius ' 
                } 
           }
          
           app.on('tokenFound', function(found, twiz){
               
              found
              .then(function(accessToken){  
                assert.ok(twiz.stream);
		assert.equal(twiz.twitterOptions.restHost, sentOptions.restHost);
                assert.equal(twiz.twitterOptions.streamHost, sentOptions.streamHost);
                assert.equal(twiz.twitterOptions.method, sentOptions.method)            // method
                assert.equal(twiz.twitterOptions.path, sentOptions.path);               // path
                assert.deepEqual(twiz.twitterOptions.params, sentOptions.params)        // params

                assert.ok(typeof twiz.next === 'function');   
                twiz.next(); 
              })                                 // end the test
           })

           twizer(mock.request, mock.response, mock.next);
       })
   
     })

     describe('verCredentials', function(){

         it('credential valid - api call is succesfull', function(done){ // check that error is thrown when
                                                                 // verCredential is called with no  access token 

             var twitterResponse = nock(twtAPI.host)          // mock sucsesfull credentials validation response
                                   .get('/1.1/account/verify_credentials.json') // path for verify credentials 
                                   .reply(200, accessToken) 
                                              
             var apiResponseBody = { success: "status updated" }
             var twitterResponse2 = nock(twtAPI.host)
                                    .post(fx.data.req.rt_apiPath)// api path for request token reqeusts 
                                    .reply(200, apiResponseBody) // 201 only to deffer it from 200 of previous call

             app.on('hasteOrOAuth', function(twiz, verifyCredentials){
                
                verifyCredentials(accessToken)                  // simulate call with no access token       
                .then(function fullfiled(token){ 
                   assert.deepStrictEqual(token, accessToken)   // check that we've got valid token confirmation
                   twiz.haste(accessToken);                     // make api call (access token is valid)
                }, function rejected(err){  
                      /* ... */                                 // we expect resolved promise
                }) 
              })

            mock.response.on('end', function(){
                assert.equal(200, mock.response._getStatusCode()); // check that api call after verifying creds 
                                                                   // is succesful 
                done();
            })         
   
            twizer(mock.request, mock.response, mock.next);

        })
        
   })
  })
})
 
