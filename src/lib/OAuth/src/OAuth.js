import { CustomError, percentEncode } from '../../Utils/src/utils.js';
import hmacSha1 from 'hmac_sha1';

 class OAuth {

   constructor(options) {

      CustomError.call(OAuth);
      OAuth.addCustomErrors({
         oauthTokenMissing: "oauth_token is missing",
         oauthTokenSecretMissing: "oauth_token_secret is missing"
      });

      this.addOAuthUtils.call(options); // adds functions for oauth string manipulations to an Options instance
   }

   static safeKeepAccessToken(tokenObj, vault) {
      if (tokenObj) {
         this.checkAccessToken(tokenObj);
         vault.accessToken = tokenObj;
      }
      else vault.accessToken = '';
   }

   static checkAccessToken(tokenObj) {
      if (!tokenObj.oauth_token) {
         console.log('throw ERROR');
         throw this.CustomError('oauthTokenMissing');
      }

      if (!tokenObj.oauth_token_secret) {
         throw this.CustomError('oauthTokenSecretMissing');
      }
   }

   addOAuthUtils() {
      this.missingVal_SBS = {
         consumer_key: 'consumer_key', // Name of consumer key as it stands in OAuth (for SBS), without 'oauth'

         // prefix. Used when inserting consumer_key value 
         token: 'token', // Name of access token param for SBS string. Used for inserting token.
         marker: percentEncode("=&"), // "%3D%26" missing value marker for signature base string
         offset: 3 // Esentialy length of percent encoded "&", we place missing between "="
         // and "&" 
      },

         this.missingVal_AHS = {
            signature: 'signature',
            marker: "=\"\"", // ="" - missing value marker for authorization header string (AHS) 
            offset: 1
         },

         this.SBS_AHS_insert = function (phase, key, value) {
            var sbs = this[phase + 'SBS'];
            this[phase + 'SBS'] = this.insertKey(sbs, this.missingVal_SBS, key, value); // set key in SBS

            var ahs = this[phase + 'AH']; // take  authorization header string of a phase
            this[phase + 'AH'] = this.insertKey(ahs, this.missingVal_AHS, key, value, true); // set key-val in AH
         },

         this.insertKey = function (insertString, missingVal, keyName, keyValue, ah) {
            var str = insertString;
            var len = (keyName.length + missingVal.marker.length) - missingVal.offset; // calcualte idx from where                                                                                      // we insert the value
            var idx = str.indexOf(keyName); // take index of the key we search  

            var front = str.slice(0, idx + len); // taking first part 
            var end = str.slice(idx + len); // taking second part 

            keyValue = ah ? percentEncode(keyValue) : percentEncode(percentEncode(keyValue));
            // single encoding if 
            // insertString is AHS
            str = front + keyValue + end; // assemble the string with new key/value
            return str;
         };
   }

   insertConsumerKey(vault, options, phase) {
      // SBS and AHS
      var consumer_key = options.missingVal_SBS.consumer_key; // get consumer key name (as it stands in OAuth Spec
      var value = vault.consumer_key; // Get value of consumer key from vault 

      options.SBS_AHS_insert(phase, consumer_key, value); // insert consumer key to SBS and AHS
   }

   insertAccessToken(vault, options, phase) {
      var tokenName = options.missingVal_SBS.token; // take the key name
      var tokenValue = vault.accessToken.oauth_token; // take the key value 

      options.SBS_AHS_insert(phase, tokenName, tokenValue); // insert token in SBS and AHS  
   }

   insertSignature(vault, options, phase) {
      var accessToken = vault.accessToken; // inserts it

      // into Authorization Header string
      var HmacSha1 = new hmacSha1('base64'); // Create new hmac function
      var signingKey = percentEncode(vault.consumer_secret) + "&"; // Prepare consumer_secret

      if (phase !== 'leg') signingKey = signingKey + percentEncode(accessToken.oauth_token_secret);
      // on non OAuth calls
      // add token_secret
      var sbs = options[phase + 'SBS']; // get SBS
      var signature = HmacSha1.digest(signingKey, sbs); // calculates oauth_signature


      var ah = options[phase + 'AH']; // get AH
      var key = options.missingVal_AHS.signature; // take key name 
      options[phase + 'AH'] = options.insertKey(ah, options.missingVal_AHS, key, signature, true);
      // inserts signature into AHS
   }

   finalizeOptions(options, phase) {
      options.host = options[phase + 'Host']; // when you start sending pref+ Host in  queryString
      options.path = options[phase + 'Path'];
      options.method = options[phase + 'Method'];

      options.headers.authorization = options[phase + 'AH']; // sets authorization header 
   }
   
   /*
         Set options for API phase (X api call with access token)
         MUST HAVE: "content-type" and "content-length" headers and a request body (body for the api request)
      */
   finalizeApiPhaseOptions(options, phase) {

      // Set general options
      this.finalizeOptions(options, phase);

      let hasBody = options.method === 'POST';

      if (hasBody) {

         options.headers['content-type'] = 'application/json';
         options.headers['content-length'] = Buffer.byteLength(options.apiBody, 'utf8');
         options.body = options.apiBody;
      }

   }
   /*
         Set options for OAUTH leg phases
         MUST HAVE: "content-length" header and a request body (body is legSBS - signature base string for the leg)
         MUST NOT HAVE: "content-type" header, if there is a content-type set the X will not be able to authenticate OAuth leg request
      */
   finalizeLegPhaseOptions(options, phase) { 

      // Set general options
      this.finalizeOptions(options, phase);

      options.headers['content-length'] = Buffer.byteLength(options.legSBS, 'utf8'); // set content-length

      let hasBody = options.method === 'POST';

      if (hasBody) {
         options.body = options.legSBS; // set body
      };
   }
}


export default OAuth
