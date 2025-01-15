var CustomError = require('twiz-client-utils').CustomError;
var percentEncode = require('twiz-client-utils').percentEncode;
var hmacSha1    = require('hmac_sha1');

 function OAuth(options){
     CustomError.call(OAuth);
     OAuth.addCustomErrors({
        oauthTokenMissing: "oauth_token is missing",
        oauthTokenSecretMissing: "oauth_token_secret is missing"
     })

     this.addOAuthUtils.call(options); // adds functions for oauth string manipulations to an Options instance
  }

  
  OAuth.safeKeepAccessToken = function(tokenObj, vault){ // if we have access token data , keep it in vault
      if(tokenObj){
         this.checkAccessToken(tokenObj);
         vault.accessToken = tokenObj;
      }
      else vault.accessToken = '';
  }

  OAuth.checkAccessToken = function(tokenObj){           // check token object for access token data
      // console.log('checkAccessTolken --', tokenObj) 
      if(!tokenObj.oauth_token) { console.log('throw ERROR')
         throw this.CustomError('oauthTokenMissing');     
      }
      
      if(!tokenObj.oauth_token_secret) {
         throw this.CustomError('oauthTokenSecretMissing');
      } 
   }

   OAuth.prototype.addOAuthUtils = function addUtils(){
      this.missingVal_SBS = {
         consumer_key: 'consumer_key', // Name of consumer key as it stands in OAuth (for SBS), without 'oauth'
                                       // prefix. Used when inserting consumer_key value 
         token: 'token',               // Name of access token param for SBS string. Used for inserting token.
         marker: percentEncode("=&"),  // "%3D%26" missing value marker for signature base string
         offset: 3                     // Esentialy length of percent encoded "&", we place missing between "="
                                       // and "&" 
      },

      this.missingVal_AHS = { 
         signature:'signature',            
         marker: "=\"\"",              // ="" - missing value marker for authorization header string (AHS) 
         offset: 1                   
      },

      this.SBS_AHS_insert = function(phase, key, value){ // inserts missing keyValue pair to SBS and AH 
         var sbs = this[phase + 'SBS'];     //console.log('sbs_ah insert:',phase,sbs)  // sbs of a phase)
         this[phase + 'SBS'] = this.insertKey(sbs, this.missingVal_SBS, key, value); // set key in SBS
          
         var ahs = this[phase + 'AH'];                 // take  authorization header string of a phase
         this[phase + 'AH'] = this.insertKey(ahs, this.missingVal_AHS, key , value, true); // set key-val in AH
      }, 
     
      this.insertKey = function(insertString, missingVal, keyName, keyValue, ah){ // insert missing key/value
         var str = insertString; 
         var len = (keyName.length + missingVal.marker.length) - missingVal.offset;// calcualte idx from where                                                                                      // we insert the value
         var idx = str.indexOf(keyName);          // take index of the key we search  
         // console.log("marker: "+missingVal.marker, "consumer_key: "+ value, "idx: "+idx, "len: "+len) 
         var front = str.slice(0, idx + len); // taking first part 
         var end = str.slice(idx + len )      // taking second part 
         // console.log("front: " + front)
         keyValue =  ah ? percentEncode(keyValue) : percentEncode(percentEncode(keyValue)); 
                                                                                   // single encoding if 
                                                                                   // insertString is AHS
         str = front + keyValue + end;    // assemble the string with new key/value
       //  console.log("inserted: "+ str); 
         return str;                     
      }
   }
 
   OAuth.prototype.insertConsumerKey = function(vault, options, phase){// insert missing consumer key in 
                                                                       // SBS and AHS
      var consumer_key = options.missingVal_SBS.consumer_key;// get consumer key name (as it stands in OAuth Spec
      var value = vault.consumer_key;                        // Get value of consumer key from vault 
      
      options.SBS_AHS_insert(phase, consumer_key, value)   // insert consumer key to SBS and AHS
   };

   OAuth.prototype.insertAccessToken = function(vault, options, phase){ 
      var tokenName  = options.missingVal_SBS.token;       // take the key name
      var tokenValue = vault.accessToken.oauth_token;      // take the key value 

     // console.log('missingVal_SBS.token: ', options.missingVal_SBS.token) 
      options.SBS_AHS_insert(phase, tokenName, tokenValue); // insert token in SBS and AHS  
   }
   
      
   OAuth.prototype.insertSignature = function(vault, options, phase){ // creates signature and 
      var accessToken = vault.accessToken;                               // inserts it
                                                                         // into Authorization Header string
      var HmacSha1 = new hmacSha1('base64');                             // Create new hmac function
      var signingKey = percentEncode(vault.consumer_secret) + "&";       // Prepare consumer_secret

      if(phase !== 'leg') signingKey = signingKey + percentEncode(accessToken.oauth_token_secret); 
                                                                                          // on non OAuth calls
                                                                                          // add token_secret

      var sbs = options[phase + 'SBS'];                           // get SBS
      var signature = HmacSha1.digest(signingKey, sbs);           // calculates oauth_signature

      
      var ah = options[phase + 'AH'];                            // get AH
      var key = options.missingVal_AHS.signature;                 // take key name 
      options[phase + 'AH'] = options.insertKey(ah, options.missingVal_AHS, key, signature, true); 
                                                                         // inserts signature into AHS
    //  console.log(" SIGNATURE: " + signature);
    //  console.log(" AHS: " + options[phase + 'AH']); 
   };

   OAuth.prototype.finalizeOptions = function(options, phase){ // sets final options that we send in twitter req 
      options.host    = options[phase + 'Host']; // when you start sending pref+ Host in  queryString
      options.path    = options[phase + 'Path'];
      options.method  = options[phase + 'Method'];
 
      options.headers.authorization = options[phase + 'AH']; // sets authorization header 
   }

  module.exports = OAuth
