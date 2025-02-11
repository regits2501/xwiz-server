# xwiz 

X OAuth wizard.

Xwiz does authentication and/or authorization to [X](https://www.x.com) with [OAuth 1.0a](https://oauth.net/core/1.0a/), has built in `REST` api support and also supports third party `STREAM` and `REST` libs.

> `xwiz-client` is a js script.

> `xwiz-server` is Express middleware.

### Contents
* [Intro](#intro)
* [Usage](#usage)
  * [SPA](#spa-singe-page-apps)
    * [Authorize or Authenticate](#authorize-or-authenticate)
    * [Access Token](#access-token)
    * [Verify Credentials](#verify-credentials)
    * [Test drive](#test-drive)
  * [Web Site (pop-ups)](#web-site)  
* [Additional use](/EXAMPLES.md)
  * [Stream](/EXAMPLES.md#stream)
  * [Chunked responses](/EXAMPLES.md#chunked-responses)
  * [getSessionData](/EXAMPLES.md#getsessiondata)
  * [onEnd](/EXAMPLES.md#onend)
  * [beforeSend](/EXAMPLES.md#beforesend)
  * [callback](/EXAMPLES.md#callback)
* [Errors](#errors)
  * [Browser](#browser)
    * [OAuth(..)](#xwizlentoauth-rejected-handler)
    * [finishOAuth(..)](#xwizlentfinishoauth-rejected-handler)
  * [Node.js](#nodejs)
    * [continueOAuth(..)](#xwizcontinueoauth)
    * [haste(..)](#xwizhaste)
    * [verifyCredentials(..)](#verifycredentials)
 * [Developers](#developers)

## Intro
Many X apis require user authentication (`access token`) before usage. `OAuth 1.0a` is (essencially a digital signature) process of letting know who (which app) wants to use an api and on which user's behalf. In other words you tell X who you are, if X is ok with you it lets you to ask an user of your website (with X account), on authorization page, if he agrees that you act on its behalf (like post tweets on user's profile ect ...)

It happens to be a 3-leg (step) dance, it's implementation could look like this:

   ![OAuthImplementationExample](/Pics/ImplementationExample.png)

As you can see there are 3 actors. Your web app/site, your server and X.  
X apis for authorization and authentication do not use `CORS`, that is, they do not emit `CORS` headers. So we cant send request to X directly from browser, but rather proxy them trough a Server, since request sent from server do not have any `CORS` restrictions applied. Your app is identified with `CONSUMER_KEY` and `CONSUMER_SECRET`. Both of which you get from X when you [create new app](https://apps.X.com/).
 
> On X, user is internally associated with the `access token`.
 Like user's `access token` , your app's `key` and `secret` are extreamly sensitive information. If anyone whould to get your app's key/secret then it can send requests to X just like they were sent from your app. It can try to mock you. Usually that's not what you want. Also, javascript is in plain text form in browser so we should never have our `CONSUMER_KEY/SECRET` there but on server. This is another good reason why we need a server to proxy our requests. 
> Likewise if anyone is to get user's `access token`, then it may be able to send requests on user's behalf (who may actually never visited an app) and/or authorized such actions for that app. Altough, my guess is not in easy and straightforward way. 

	 
1. You ask your server to get you a `request token`. Server prepares and signs your request and sends it to X. X checks your `CONSUMER_KEY` and signature (by reproducing it). If all is ok, it grants (returns) you an unauthorized `request token`. It's function is to be authorized (approved) by user in step 2, so it can be used to get user's `access token` in step 3.

2. Uppon receiving `request token` data, user is redirected to X to obtain user authorization :
  * if you are using `/oauth/authorize` enpoint for redirection, then every time user is redirected there it lands on authorization [(interstitials) page](https://developer.X.com/en/docs/X-for-websites/log-in-with-X/guides/browser-sign-in-flow.html). Even if user previously authorized your app.
  
  * if you are using `/oauth/authenticate` enpoint for redirection, then only first time user is redirected it lands on authorization page. On any subsequent redirection X *remembers* first one and user is directed back again to the app. No authorization page is showed, the user is not involved directly. Historicaly it [didn't work](https://twittercommunity.com/t/twitter-app-permission-not-honored-on-subsequent-oauth-authenticate-calls/94440) like it should, for a time. 
 Two were actually the same where `/oauth/authenticate` acted like `/oauth/authorize`. 
 
    > Even there is no authorization page showed, there still can be a redirection page flash.

3. Since user approved your `request token`, now it is used to get user's `access token`. Server signs your request and sends it. X does things similarly like in first step and grants you an `access token` which belongs to the user who authorized it in second step.

After we get user's `access token` the 3-leg OAuth is finished and we can use it to send request to X on user's behalf (like posts tweets on user's profile). In `OAuth` parlance this process of sending requests with the access token is called `accessing protected resources`, but it is not part of the `OAuth`.

We can see that in 3-rd leg `access token` is send back to web app. Which usually is not good idea, because of security implications it could have, like we mentioned earlier.
 
Let's see what xwiz is doing with OAuth:

![TwizHaste](/Pics/TwizHaste.png)

Three differences are:
 * **Optimized load** 
 
     Preparing an `OAuth` leg (step) mostly refers to the assembling of `Signature Base String` and `Authorization Header string`. It is all done in browser (`Consumer`) in an effort to ease the server load for actions that bear no security concerns and thus do not need to be executed in server. Already prepared requests come to the server who acts mostly like a signing/stamping authority by merely inserting sensitive data and signing requests.

* **Security**

    Another important point is that the user's access token is never send back to the browser by any means.

* **Haste** 

     On the server we have a decision point where if we already have user's `access token` (stored from a previous authorization ie. in database) we can use `haste` (on diagram the *yes* branch ).
     
     Haste is a process where you verify `access token` freshness (verify credentials) with X and if it's fresh you can immediately go for a X api requests user actually wants. Checking token freshness is checking that user didn't revoke right to your app of doing things on it's behalf and such. 
     
     This is usefull for scenarios where you save user's `access token` after first authorization and then just chech for it's freshness before you go for an api request. User does not need to be bothered every time with 3-leg `OAuth`, there is no interstitials page. With haste **you** are the one who *remembers* user authorization instead of letting X to do it (like it does on the `/oauth/authenticate`). All in order to have smooth user experience, like for instance in case `/oauth/authenticate` stops working as expected. Or when redirection page flashes for the moment before user is returned to app and you would like to remove that behaviour. 
     
     If this is the first time a user is making a request (and we dont have the `access token`) then we just continue the whole `OAuth flow` (on diagram the *no* branch). One of xwiz's features is very easy switching between any of your `OAuth` workflows while having a redundant mechanism for smooth user experience (`haste`) as an option.


## Usage 

### [⬑](#contents)

In order to efficiently and safely use xwiz make sure you:
 1. **Provide HTTPS** all the way (client ---> server --> X)
 2. In browser install `xwiz-client`, on server install `xwiz-server` 
 3. Create [app account](https://apps.X.com/app/new) on X
 4. Users (of your app) must have X accounts 


in browser: 

     
   
    CDN:  <script src="https://cdn.jsdelivr.net/npm/xwiz-client/src/xwiz-client_bundle.min.js"></script>
   
    bower:  comming soon
	 
    local:

    npm install xwiz-client && npm run build

    Then drop it in script tag:  <script src="src/xwiz-client_bundle.js"></script>		 
	 
	 
on server:  

     npm install xwiz-server

### SPA (singe page apps)
_**browser:**_
```js  
 // Let's say this code is in your page ->  https://myApp.com 

let xwizlent = xwizClient();
  
btn.addListener('onClick', function(){                // lets say we initiate oauth on click event
  let args = {
      server_url:      'https://myServer.com/route', // address of your node server 
      redirection_url: 'https://myApp.com',          // address of your web app/site (where X will direct
                                                     //  user after authorization)
      options:{                                      //  X request options  
         method: 'POST',
         path:   '/2/tweets'
         body: {
           text: "Hooray, new tweet!"
         },
         encoding: 'json'
      }
  }

  xwizlent.OAuth(args)
  .then(function fulfilled(o){
      if(o.error)              // not 200OK responses (has o.error.statusCode, o.error.statusText, o.error.data)
      if(o.data)               // (200OK) will have data on succesfull xwiz.haste(accessToken) call on server
      if(o.redirection)        // Will have an o.redirection set to *true* when xwiz.continueOAuth() is called on                                     // server and user is redirected. Serves as a notifier for redirections.
      o.xhr                    // Always present in case you need to pull some data from response 
                               // (like custom server headers you might be sending)  
  }, function rejected(err){ // xwiz errors
     // err is instance of Error()
     // has err.name, err.message, err.stack ...
  })

})  

// finishOAuth() Can be called asap in page 
// Makes 3-rd step from diagram 
// We dont need the redirection url for this step, but it will be ignored so we can pass same args
// It will fire after X (re)directs back to app, only on valid redirection (authorization) urls from X. 

xwizlent.finishOAuth(args); 
  .then(function fulfilled(o){
      if(o.error) //  not 200OK responses
      if(o.data)  //  (200OK) will have data on succesfull xwiz.continueOAuth() call on server
  
      o.xhr       // Always present in case you need to pull some data from response 
                  // (like custom server headers you might be sending)  
   }, function rejected(err){  // xwiz errors
        // err is instance of Error()
        // has err.name, err.message, err.stack ...
}) 
```

Notice that our `redirection_url` is same as url of the page from which we are making a request. Making this a SPA use case.
The only presumtions about a succesfull request is one with `200OK` status code, so anything that does not have that status code will still be in fulfilled handler but in `o.error`, left to your code logic.

`xwizlent.OAuth(..)` will bring api data (`o.data`) if `xwiz.haste(accessToken)` was called on the server and had `200OK` response. If not and the `xwiz.continueOAuth()` is called it will receive `request token` and redirect user to X. 

Then `o.redirection` is set to `true` in fullfuled handler. Also note that here everything (redirection to X, X's (re)direction back to app) happens in same window/tab in browser. Check [web site](#web-site) workflow for popUps.

Server is writen as express middleware.

_**node.js:**_
```js
  var xwizServer = require('xwiz-server');
  var express    = require('express');
  
  var app = express();
  var xwizer = xwizServer({                             
         consumer_secret: process.env.CONSUMER_SECRET,  
         consumer_key:    process.env.CONSUMER_KEY,
         key:  fs.readFileSync('yourServerPrivateKey.pem'), 
         cert: fs.readFileSync('yourServerCert.pem')       // can be self signed certificate
  })

  app.use(xwizer);                                          // use the xwiz-server

  app.on('hasteOrOAuth', function(xwiz, verifyCredentials){ // event where we pick haste or oauth
   
       // When you don't have access token (or just don't want to use haste) you continue the oauth flow
       xwiz.continueOAuth(); 
                              // 1. user gets request token
                              // 2. is redirected for authorization (or authentication), xwizlent.OAuth(..) has
                              //    o.redirection set to *true*
                              // 3. with xwiz.finishOAuth() in browser users gets api data in o.data
       / *    . . .    */

       // Note that here in *hasteOrOAuth* handler is where you should go for user's access token
       // since 'hasteOrOAuth' event will only be emitted for certain requests. Otherwise you'll hog your server
       // cpu/io unnecessary. Verifyng credentials and using haste is completely optional step.

       verifyCredentials(accessToken,{ skip_status: true}) // When you have accessToken
       .then(function fullfilled(credentials){             // You can inspect returned credentials object
          xwiz.haste(accessToken)                          // Gets api data and sends back to browser 
                                                           // (to xwiz.OAuth(..) fullfiled handler)
       }, function rejected(err){ // non 200OK responses from verifyCredentials
            xwiz.continueOAuth()  // likely you would want to send it to reauthorization of access token 
       })
       .catch(function(err){      // errors that might happen in fullfiled handler
     
       })
  })

  app.on('tokenFound', function(found){ // when whole oauth process is finished you will get the user's
                                        // access token 

     found                        // promise
     .then(function(accessToken){
         // user's access token received from X which you can put in database
         
     }, function rejected(err){   // xwiz errors

     })
  })
]
```

##### Test drive
[Test drive](https://gits2501.github.io/QuoteOwlet/) SPA (with `/oauth/authenticate`). Running on heroku free plan. May appear slow when dyno is waking up.

### Authorize or Authenticate

### [⬑](#contents)
By default `xwizlent.OAuth(..)` will use the `/oauth/authorize` endpoint , but you can use the `/oauth/authenticate` like this:

_**browser:**_
```js
let args = {
    ...
      endpoints:{ 
         authorize: 'authenticate' // sets authenticate instead of authorize (notice no forward slash)
      }
 }
 ```


This is the so called [Sign in with X](https://developer.X.com/en/docs/X-for-websites/log-in-with-X/guides/browser-sign-in-flow) flow, the one that uses `/oauth/authenticate` endpoint. That's how you would utilize it.


### Access Token

### [⬑](#contents)
   Currently the minimum of what xwiz see as valid `access token` is an object that has properties `oauth_token` and `oauth_token_secret` set. But it can have other parameters, like `screen_name`.
The `xwiz-server` (here xwizer) is by default an ending middleware, that is it will end the request. So call it before your error handling middlewares, if any. There are cases when xwiz **does not end** the request, check [Stream](/EXAMPLES.md#stream) usage. Errors will be sent to the next error handling midleware with `next(err)` calls and same errors will also be piped back to the browser.

### Prefligh 

### [⬑](#contents)
 If your app is not on same domain your browser will preflight request because of `CORS`. So you need to use some preflight middleware before `xwiz-server`:
 _**node.js:**_
```js
 ...
 app.use(yourPreflight);
 app.use(xwizer);
```
Currently you only have to set `Access-Control-Allow-Origin` to your app's fqdn address. 
 
### Verify credentials 

### [⬑](#contents)
 The `credentials` object in fulfileld handler can contain a lot of information. In order to ease the memory 
footprint you can use parameters object (like one with `skip_status`) to leave out information you don't need. Here [list of params](https://developer.twitter.com/en/docs/accounts-and-users/manage-account-settings/api-reference/get-account-verify_credentials.html) you can use.
 


### Web Site

### [⬑](#contents)

Web Site workflow is very similar to that of a `SPA`. You just need to put the `new_window` object to args to specifiy your new popUp / window characteristics and call `xwizlent.finishOAuth(..)`  from code in that popUp / window . Note that browser doesn't differentiate much between a popUp and a new window (new tab). Main difference is in dimentions.  

_**browser:**_
```js
 // Let's say this code is in your page ->  https://myApp.com 

let xwizlent = xwizClient();
  
btn.addListener('onClick', function(){                  // lets say we initiate oauth on click event
   let args = {
      server_url:      'https://myServer.com/route',    // address of your node server 
      redirection_url: 'https://myApp.com/popUpWindow', // address of your popUp/window page
                                                     
      new_window:{
         name: 'myPopUpWindow',
         features: 'resizable=yes,height=613,width=400,left=400,top=300'
      },

      options:{                                         //  X request options  
         method: 'POST',
         path:   '/2/tweets'
         body: {
           text: "Hooray, new tweet!"
         },
         encoding: 'json'
      }
   }

   xwizlent.OAuth(args)
   .then(function fulfilled(o){
      if(o.error)              // not 200OK responses (has o.error.statusCode, o.error.statusText, o.error.data)
      if(o.data)               // (200OK) will have data on succesfull xwiz.haste(accessToken) call on server
      if(o.window)             // When redirection happens instead of o.redirection notification you'le have 
                               // reference to the popUp/window and the redirection will happen from that window.                               // Like you would expect. 

       o.xhr                   // Always present in case you need to pull some data from response 
                               // (like custom server headers you might be sending)  
   }, function rejected(err){  // Twiz errors
        // err is instance of Error()
        // has err.name, err.message, err.stack ...
   })

})
```
The `redirection_url` is now different then the page url from which we are making the request. Also we have `new_window` where we specify the window/popUp features where `redirection_url` will land . Making this more of a website use case.
The `new_window` object contains two properties, `name` and `features`, they act the same as `windowName` and `windowFeatures` in [window.open()](https://developer.mozilla.org/en-US/docs/Web/API/Window/open). Note `o.window` reference to newly opened window / popUp instead of `o.redirection`. 

_**browser(different page):**_
```js
 // code in https://myApp.com/popUpWindow
  xwizlent.finishOAuth(args);  // Also can be called asap in page
  .then(function fulfilled(o){
      if(o.error)              //  not 200OK responses
      if(o.data)               //  (200OK)  will have data on succesfull xwiz.continueOAuth() call on server

      o.xhr                     // always present in case you need to pull some data from response 
                               // (like custom server headers you might be sending)      
   }, function rejected(err){  // xwiz errors
        // err is instance of Error()
        // has err.name, err.message, err.stack ...
   })

```
What this enables is to have completely custom popUp pages but same familiar popUp, like for instance when you whould like to share something on X by pressing a X share button. Currently the downside is that users of the web site use case will get a popUp warning by browser which they have to allow before popUp apears.
Test drive [here]
                            
_**node.js:**_
```js 
  // Same code as in SPA use case;
```


## Errors

### [⬑](#contents)


### Browser
#### `xwizlent.OAuth(..)` `rejected(..)` handler:

error.name  |  error.message
----------- | --------------
redirectionUrlNotSet | You must provide a `redirection_url` to which users will be redirected.
serverUrlNotSet | You must proivide `server_url` to which request will be sent.
optionNotSet | Check that `method` and `path` are set.
noCallbackFunc | You must specify a callback function. 
callbackURLnotConfirmed | `Redirection(callback) url` you specified wasn't confirmed by X. 
noContentType | Failed to get `content-type` header from response. Possible `CORS` restrictions or header is missing.
chunkedResponseWarning | Stream is consumed chunk by chunk in `xhr.onprogress(..)` callback.

#### `xwizlent.finishOAuth(..)` `rejected(..)` handler:

error.name  |  error.message
----------- | --------------
verifierNotFound | `"oauth_verifier"` string was not found in `redirection(callback) url`.
tokenNotFound | `"oauth_token"` string was not found in `redirection(callback) url`.
tokenMissmatch | `Request token` and token from `redirection(callback) url` do not match.
requestTokenNotSet | `Request token` was not set.
requestTokenNotSaved | `Request token` was not saved. Check that page url from which you make request match your redirection_url.
chunkedResponseWarning | Stream is consumed chunk by chunk in `xhr.onprogress(..)` callback. 
noRepeat | Cannot make another request with same `redirection(callback)` url. 
spaWarning | X authorization data not found in url.

`spaWarning` and `noRepeat` are errors that have informative character and usually you dont have to pay attention to them. They happen when user loads/relods page where `xwizlent.finishOAuth(..)` is called on every load, imediately (which is valid). They are indications that `xwizlent.finishOAuth(..)` will not run. For example, `spaWarning` means `xwizlent.finishOAuth(..)` won't run on url that doesn't contain valid X authorization data. `noRepeat` means that you cannot make two requests with same X authorization data (like same `request token`). Check the [Stream](/EXAMPLES.md#stream) for explanation of `chunkedResponseWarning`.

### Node.js

### [⬑](#contents)

#### `xwiz.continueOAuth(..)` 
Errors are ones that can happen on `request` or `response` streams (lower level) and they are hanled by calling `next(..)`. There are no xwiz errors currently for this function. Not `200OK` responses are only piped back to client and are not considered as errors.

#### `xwiz.haste(..)` 
Errors work same as `xwizlent.continueOAuth(..)`


#### `verifyCredentials()`
Any **not** `200OK` response are considered as an `accessTokenNotVerified` error. Express' `next(..)` is called and promise is rejected with the same error. 

 error.name | error.message
 ---------  |  -------------
accessTokenNotVerified | `json string`

Note that the `error.message` will be a `json string` taken from `response` payload so you can have exact X error description, error code etc ...

## Developers
### [⬑](#contents)
#### xwiz-client (browser)
Before making changes:

    npm run start   // runs `build` and `watch` scripts
      
When you're done:      
   
    npm run lint

Build:
    
    npm run build
      
Test:       

    npm test

#### xwiz-server (node.js)

Make changes.

Lint:

    npm run lint
 
 Test:
 
    npm run test
