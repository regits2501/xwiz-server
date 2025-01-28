var Options = require('../src/Options.js');
var assert  = require('assert');
var fx      = require('node-fixtures');


var ssl_key  = 'tlsServer-.pem';     // mock private key used in encription
var ssl_cert = 'tlsServerCert.pem';  // mock certificate
var cons_key = 'CONSUMER_KEY';       // mock ck
var cons_secret = 'CONSUMER_SECRET'; // mock cs

                         
var url = fx.options.url; // mock twiz-client url

var headers = {          // mock headers of a request
  'accept': "*/*",
  'accept-language': "en-US",
  'content-length': '0'   
}  

                         // mock http request, response and next function
var request = {
   'url': url,
   'headers': headers
}
var response = {};
var next = function(){};


var mock = {
 'options': {},
 'vault': {},

 'args':{
    'consumer_key': cons_key,
    'consumer_secret': cons_secret,
    'key': ssl_key,
    'cert': ssl_cert
    
 } 
}

function errorValidation(name, err){   // used to check thrown errors by name

    if(err.name === name) return true;
}

var op = new Options(mock.options, mock.vault, mock.args);

describe('Options', function(){

   describe('missing', function(){
      it('request - throw error', function(){
          assert.throws(op.initOptions.bind(op,'', response, next), errorValidation.bind(null, 'requestNotSet'))
      }) 
      
      it('response - throw error', function(){
          assert.throws(op.initOptions.bind(op, request,'', next), errorValidation.bind(null, 'responseNotSet'))
      }) 

      it('consumer_key - throw error', function(){
          mock.args.consumer_key = ''                    // simulate missing prop
          assert.throws(op.initOptions.bind(op, request,response, next), errorValidation.bind(null, 'consumerKeyNotSet'))
          mock.args.consumer_key = cons_key;             // return its value
      }) 

      it('consumer_key - throw error', function(){
          mock.args.consumer_secret = ''                 // simulate missing prop
          assert.throws(op.initOptions.bind(op, request,response, next), errorValidation.bind(null, 'consumerSecretNotSet'))
          mock.args.consumer_secret = cons_secret;       // return its value
      }) 

      
      it('ssl private key - throw error', function(){
          mock.args.key = ''                             // simulate missing prop
          assert.throws(op.initOptions.bind(op, request,response, next), errorValidation.bind(null, 'keyNotSet'))
          mock.args.key = ssl_key;                       // return its value
      }) 
      
     it('ssl certificate - throw error', function(){
          mock.args.cert = ''                           // simulate missing prop
          assert.throws(op.initOptions.bind(op, request,response, next), errorValidation.bind(null, 'certNotSet'))
          mock.args.cert = ssl_cert;                    // return its value
      }) 
   })

   describe('get options from url', function(){
      
      it('gets options', function(){
         assert.doesNotThrow(op.initOptions.bind(op, request, response, next));
      })
     
      it('parse options', function(){
        assert.ok(op.sentOptions);
      })

      describe('possible options',function(){
           
           it('apiHost', function(){
             assert.ok(op.sentOptions.apiHost);
           }) 
           
           it('apiPath', function(){
             assert.ok(op.sentOptions.apiPath);
           }) 
  
           it('apiMethod', function(){
             assert.ok(op.sentOptions.apiMethod);
           }) 

           
           it('apiAuthorizationHeader', function(){
             assert.ok(op.sentOptions.apiAH);
           }) 
           
           it('apiSignatureBaseString', function(){
             assert.ok(op.sentOptions.apiSBS);
           }) 

           it('legHost', function(){
             assert.ok(op.sentOptions.legHost);
           }) 
           
           it('legPath', function(){
             assert.ok(op.sentOptions.legPath);
           }) 
  
           it('legMethod', function(){
             assert.ok(op.sentOptions.legMethod);
           }) 

           
           it('legAuthorizationHeader', function(){
             assert.ok(op.sentOptions.legAH);
           }) 
           
           it('legSignatureBaseString', function(){
             assert.ok(op.sentOptions.legSBS);
           }) 
     
           it('verHost', function(){
             assert.ok(op.sentOptions.verHost);
           }) 
           
           it('verPath', function(){
             assert.ok(op.sentOptions.verPath);
           }) 
  
           it('verMethod', function(){
             assert.ok(op.sentOptions.verMethod);
           }) 

           
           it('verAuthorizationHeader', function(){
             assert.ok(op.sentOptions.verAH);
           }) 
           
           it('verSignatureBaseString', function(){
             assert.ok(op.sentOptions.verSBS);
           }) 

      })
   })

   describe('headers', function(){
      it('accept', function(){
         assert.equal(op.request.headers.accept, headers.accept);
      })

      it('accept-language', function(){
         assert.equal(op.request.headers['accept-language'], headers['accept-language']);
      })
   })
   
   describe('node.js framework', function(){
       it('express', function(){
           op.request.app = {}; // simulate express framework environment
           op.initOptions(request, response, next)
           assert.deepStrictEqual(op.app, op.request.app)
       })
   
       it('connect', function(){
          op.request.app = ''; // simulate no express framework
          op.initOptions(request, response, next)
          assert(op.app, op)
       })
   })
 
})
