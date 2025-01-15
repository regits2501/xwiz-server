var Options = require('twiz-server-options');
var OAuth   = require('../src/OAuth');
var assert  = require('assert');
var fx      = require('node-fixtures'); // load fixtures

var sec = fx.data.secrets;    // ssl private key, CONSUMER_SECRET etc ...    
var url = fx.data.url;        // receved url 

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
    'consumer_key': sec.cons_key,
    'consumer_secret': sec.cons_secret,
    'key': sec.ssl_key,
    'cert': sec.ssl_cert
    
  } 
}

function errorValidation(name, err){   // used to check thrown errors by name

    if(err.name === name) return true;
}

var op;                         // placeholder for Options instance

describe('options', function(){

  it('instantiated', function(){
     assert.doesNotThrow(function(){
        op = new Options(mock.options, mock.vault, mock.args)

     })
  })
  
  it('prepared', function(){
    assert.doesNotThrow(op.initOptions.bind(op, request, response, next));
  })
  
})

var accessToken = {
    oauth_token: 'oauthToken',
    oauth_token_secret: 'oauthTokenScret'
}

var oa;                         // placeholder for OAuth instance

describe('OAuth',function(){
   it('instantiated', function(){
      assert.doesNotThrow(function(){
          oa = new OAuth(mock.options)
      })
   })

    
   describe('access token', function(){
      describe('missing', function(){
         it('update vault', function(){
            OAuth.safeKeepAccessToken('', mock.vault);
            assert.ok(!mock.vault.accessToken);
         })
         it('oauth_token - throw error ', function(){
             accessToken.oauth_token = ''                 // simulate missing oauth token
             assert.throws(OAuth.safeKeepAccessToken.bind(OAuth, accessToken, mock.vault),
                             errorValidation.bind(null, 'oauthTokenMissing'));
             accessToken.oauth_token = 'oauthToken'
         })
   
        it('oauth_token_secret - throw error ', function(){
             accessToken.oauth_token_secret = ''                 // simulate missing oauth token
             assert.throws(OAuth.safeKeepAccessToken.bind(OAuth, accessToken, mock.vault),
                             errorValidation.bind(null, 'oauthTokenSecretMissing'));
             accessToken.oauth_token_secret = 'oauthTokenSecret';
         })
        
      })

      describe('safe keep', function(){
         it('access token', function(){
            OAuth.safeKeepAccessToken(accessToken, mock.vault);
            assert.deepStrictEqual(accessToken, mock.vault.accessToken);
         })
      })
   })
  
  describe('(OAuth) leg phase', function(){
     
      describe('insert CONSUMER_KEY', function(){

         var legSBS = 'POST&https%3A%2F%2Fapi.twitter.com%2Foauth%2Frequest_token&oauth_callback%3Dhttps%253A%252F%252Fgits2501.github.io%252FQuoteOwlet%252Findex.html%253Fdata%253Dquote%25253DThey%25252520say%25252520the%25252520owlet%25252520brings%25252520wisdom%252526author%25253Dtrough%25252520random%25252520quotes.%252526hobbit%25253Dname%2525253DPeregrin%25252526lastName%2525253DTuk%252526id%25253D209%26oauth_consumer_key%3DCONSUMER_KEY%26oauth_nonce%3DbDJZNXY2WDlCbWxRVHhXdDdHMGhDeEVSbVc5ZXQ2RQ%26oauth_signature_method%3DHMAC-SHA1%26oauth_timestamp%3D1526636582%26oauth_version%3D1.0'; // mock inserted CONSUMER_KEY to legSBS

         var legAH = 'OAuth oauth_callback="https%3A%2F%2Fgits2501.github.io%2FQuoteOwlet%2Findex.html%3Fdata%3Dquote%253DThey%252520say%252520the%252520owlet%252520brings%252520wisdom%2526author%253Dtrough%252520random%252520quotes.%2526hobbit%253Dname%25253DPeregrin%252526lastName%25253DTuk%2526id%253D209", oauth_consumer_key="CONSUMER_KEY", oauth_nonce="bDJZNXY2WDlCbWxRVHhXdDdHMGhDeEVSbVc5ZXQ2RQ", oauth_signature="", oauth_signature_method="HMAC-SHA1", oauth_timestamp="1526636582", oauth_version="1.0"'; // mock inserted CONSUMER_KEY to legAH

         
         it('Signature Base String (SBS)', function(){
             oa.insertConsumerKey(mock.vault, mock.options, 'leg');
             assert.equal(mock.options.legSBS, legSBS);
         })

         it('Authorization Header String (AHS)', function(){
             assert.equal(mock.options.legAH, legAH);
         })
         
         
     }) // sP2yRyTO%2BrFRmmyHO%2B6LZ0sMan0%3D

    describe('insert SIGNATURE', function(){
       var legAH =  'OAuth oauth_callback="https%3A%2F%2Fgits2501.github.io%2FQuoteOwlet%2Findex.html%3Fdata%3Dquote%253DThey%252520say%252520the%252520owlet%252520brings%252520wisdom%2526author%253Dtrough%252520random%252520quotes.%2526hobbit%253Dname%25253DPeregrin%252526lastName%25253DTuk%2526id%253D209", oauth_consumer_key="CONSUMER_KEY", oauth_nonce="bDJZNXY2WDlCbWxRVHhXdDdHMGhDeEVSbVc5ZXQ2RQ", oauth_signature="sP2yRyTO%2BrFRmmyHO%2B6LZ0sMan0%3D", oauth_signature_method="HMAC-SHA1", oauth_timestamp="1526636582", oauth_version="1.0"'; // mock inserted SIG

       it('signature', function(){ 
          oa.insertSignature(mock.vault, mock.options, 'leg');
          assert.equal(mock.options.legAH, legAH);
       })
       
       
    })
    
    describe('set request options', function(){
      it('Host', function(){
          oa.finalizeOptions(mock.options, 'leg')
          assert.equal(mock.options.legHost, mock.options.host)
      })
         
      it('Path', function(){
          assert.equal(mock.options.legPath, mock.options.path)
      })

      it('Method', function(){
          assert.equal(mock.options.legMethod, mock.options.method)
      })

      it('Authorization Header', function(){
          assert.equal(mock.options.headers.authorization, mock.options.legAH)
      })
 

    })
      
  })
   
  // same thing for api phase
  
 describe('API phase', function(){
     
      describe('insert CONSUMER_KEY', function(){

         var apiSBS = 'POST&https%3A%2F%2Fapi.twitter.com%2F1.1%2Fstatuses%2Fupdate.json&oauth_consumer_key%3DCONSUMER_KEY%26oauth_nonce%3DbDJZNXY2WDlCbWxRVHhXdDdHMGhDeEVSbVc5ZXQ2RQ%26oauth_signature_method%3DHMAC-SHA1%26oauth_timestamp%3D1526636582%26oauth_token%3D%26oauth_version%3D1.0%26status%3D%2522They%2520say%2520the%2520owlet%2520brings%2520wisdom%2522%250A%2520~%2520trough%2520random%2520quotes.' // mock inserted CONSUMER_KEY to apiSBS

         var apiAH = 'OAuth oauth_consumer_key="CONSUMER_KEY", oauth_nonce="bDJZNXY2WDlCbWxRVHhXdDdHMGhDeEVSbVc5ZXQ2RQ", oauth_signature="", oauth_signature_method="HMAC-SHA1", oauth_timestamp="1526636582", oauth_token="", oauth_version="1.0"'; // mock inserted CONSUMER_KEY to apiAH



         
         it('Signature Base String (SBS)', function(){
          // console.log(mock.options.apiAH);
             oa.insertConsumerKey(mock.vault, mock.options, 'api');
             assert.equal(mock.options.apiSBS, apiSBS);
         })
 
         it('Authorization Header String (AHS)', function(){
             assert.equal(mock.options.apiAH, apiAH);
         })
         
     }) 

    describe('insert ACCESS TOKEN', function(){
       var apiAH = 'OAuth oauth_consumer_key="CONSUMER_KEY", oauth_nonce="bDJZNXY2WDlCbWxRVHhXdDdHMGhDeEVSbVc5ZXQ2RQ", oauth_signature="", oauth_signature_method="HMAC-SHA1", oauth_timestamp="1526636582", oauth_token="oauthToken", oauth_version="1.0"'; // mock inserted access token to apiAH
   
       it('access token', function(){
            oa.insertAccessToken(mock.vault, mock.options, 'api');
            assert.equal(mock.options.apiAH, apiAH);
       })
    })
    

    
    describe('insert SIGNATURE', function(){
       var apiAH = 'OAuth oauth_consumer_key="CONSUMER_KEY", oauth_nonce="bDJZNXY2WDlCbWxRVHhXdDdHMGhDeEVSbVc5ZXQ2RQ", oauth_signature="GZPFyIE%2FX%2BjAujtzS0ZE2h8Xc7c%3D", oauth_signature_method="HMAC-SHA1", oauth_timestamp="1526636582", oauth_token="oauthToken", oauth_version="1.0"'; // mock inserted SIGNATURE

       it('signature', function(){ 
         oa.insertSignature(mock.vault, mock.options, 'api');
         assert.equal(mock.options.apiAH, apiAH);
       })
       
       
    })
  
    describe('set request options', function(){
      it('Host', function(){
          oa.finalizeOptions(mock.options, 'api')
          assert.equal(mock.options.apiHost, mock.options.host)
      })
         
      it('Path', function(){
          assert.equal(mock.options.apiPath, mock.options.path)
      })

      it('Method', function(){
          assert.equal(mock.options.apiMethod, mock.options.method)
      })

      it('Authorization Header', function(){
          assert.equal(mock.options.headers.authorization, mock.options.apiAH)
      })
     
    })
    
 })   // and verify credentials phase

 describe('Verify Credentials phase', function(){
     
     describe('insert CONSUMER_KEY', function(){

         var verSBS = 'GET&https%3A%2F%2Fapi.twitter.com%2F1.1%2Faccount%2Fverify_credentials.json&include_email%3Dtrue%26include_entities%3Dfalse%26oauth_consumer_key%3DCONSUMER_KEY%26oauth_nonce%3DbDJZNXY2WDlCbWxRVHhXdDdHMGhDeEVSbVc5ZXQ2RQ%26oauth_signature_method%3DHMAC-SHA1%26oauth_timestamp%3D1526636582%26oauth_token%3D%26oauth_version%3D1.0%26skip_status%3Dtrue' // mock inserted CONSUMER_KEY to verSBS

         var verAH = 'OAuth oauth_consumer_key="CONSUMER_KEY", oauth_nonce="bDJZNXY2WDlCbWxRVHhXdDdHMGhDeEVSbVc5ZXQ2RQ", oauth_signature="", oauth_signature_method="HMAC-SHA1", oauth_timestamp="1526636582", oauth_token="", oauth_version="1.0'; // mock inserted CONSUMER_KEY to verAH



         
         it('Signature Base String (SBS)', function(){
             oa.insertConsumerKey(mock.vault, mock.options, 'ver');
             assert.equal(mock.options.verSBS, verSBS);
         })
 
         it('Authorization Header String (AHS)', function(){
             assert.equal(mock.options.verAH, verAH);
         })
         
     }) 

    describe('insert ACCESS TOKEN', function(){
       var verAH = 'OAuth oauth_consumer_key="CONSUMER_KEY", oauth_nonce="bDJZNXY2WDlCbWxRVHhXdDdHMGhDeEVSbVc5ZXQ2RQ", oauth_signature="", oauth_signature_method="HMAC-SHA1", oauth_timestamp="1526636582", oauth_token="oauthToken", oauth_version="1.0'; // mock inserted access token to verAH
   
       it('access token', function(){
           oa.insertAccessToken(mock.vault, mock.options, 'ver');
           assert.equal(mock.options.verAH, verAH);
       })
    })
    

    
    describe('insert SIGNATURE', function(){
       var verAH = 'OAuth oauth_consumer_key="CONSUMER_KEY", oauth_nonce="bDJZNXY2WDlCbWxRVHhXdDdHMGhDeEVSbVc5ZXQ2RQ", oauth_signature="T6bIPitL0h3tz3UsR4M%2FSG7%2FPu4%3D", oauth_signature_method="HMAC-SHA1", oauth_timestamp="1526636582", oauth_token="oauthToken", oauth_version="1.0'; // mock inserted SIGNATURE

       it('signature', function(){ 
          oa.insertSignature(mock.vault, mock.options, 'ver');
          assert.equal(mock.options.verAH, verAH);
       })
       
       
    })

    describe('set request options', function(){
      it('Host', function(){
          oa.finalizeOptions(mock.options, 'ver')
          assert.equal(mock.options.verHost, mock.options.host)
      })
         
      it('Path', function(){
          assert.equal(mock.options.verPath, mock.options.path)
      })

      it('Method', function(){
          assert.equal(mock.options.verMethod, mock.options.method)
      })

      it('Authorization Header', function(){
          assert.equal(mock.options.headers.authorization, mock.options.verAH)
      })
     
    }) 

  })

   
})

