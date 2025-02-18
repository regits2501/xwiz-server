# xwiz-server

X OAuth wizard. Works with [xwiz-client](https://github.com/regits2501/xwiz-client).

xwiz-server does authentication and/or authorization to [X](https://x.com/) with [OAuth 1.0a](https://oauth.net/core/1.0a/), has built in `REST` api support and also supports third party `STREAM` and `REST` libs.

> `xwiz-client` is a browser script.

> `xwiz-server` is an Express middleware.

### Contents
* [Intro](#intro)
* [Examples](#examples)
  * [Example 1 (not saving access token)](#example-1-not-saving-access-token) 
    * [Continue OAuth](#continue-oauth)
    * [Test drive example 1](#test-drive-example-1)
  * [Example 2 (saving access token)](#example-2-saving-access-token)
    * [Verify credentials and haste](#verify-credentials-and-haste)
    * [Authorize or Authenticate (Sign in with X)](#authorize-or-authenticate-sign-in-with-X)
    * [Access Token](#access-token)
    * [Verify Credentials](#verify-credentials)
  * [Popup](#popup)
    * [Test drive popup](#test-drive-popup)
* [Additional use](/MORE_EXAMPLES.md)
  * [Stream](/MORE_EXAMPLES.md#stream)
  * [Chunked responses](/MORE_EXAMPLES.md#chunked-responses)
  * [getSessionData](/MORE_EXAMPLES.md#getsessiondata)
  * [onEnd](/MORE_EXAMPLES.md#onend)
  * [beforeSend](/MORE_EXAMPLES.md#beforesend)
  * [callback](/MORE_EXAMPLES.md#callback)
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
Many X apis require user authentication (`access token`) before usage. `OAuth 1.0a` is (essencially a digital signature) process of letting know who (which app) wants to use an api and on which user's behalf. In other words you tell X who you are, if X is ok with you it lets you to ask an user of your website (with X account), on authorization page, if he agrees that you act on his behalf (like post tweets on user's profile ect ...)

It happens to be a 3-leg (step) dance, it's implementation could look like this:

   ![OAuthImplementationExample](/Pics/ImplementationExample.png)

As you can see there are 3 actors. Your web app/site, your server and X.  
X apis for authorization and authentication do not use `CORS`, that is, they do not emit `CORS` headers. So we cant send request to X directly from browser, but rather proxy them trough a Server, since request sent from server do not have any `CORS` restrictions applied. Your app is identified with `CONSUMER_KEY` and `CONSUMER_SECRET`. Both of which you get from X when you [create new app](https://apps.X.com/).
 
> On X, user is internally associated with the `access token`.
 Like user's `access token` , your app's `key` and `secret` are extreamly sensitive information. If anyone whould to get your app's key/secret then it can send requests to X just like they were sent from your app. It can try to mock you. Usually that's not what you want. Also, javascript is in plain text form in browser so we should never have our `CONSUMER_KEY/SECRET` there but on server. This is another good reason why we need a server to proxy our requests. 
> Likewise if anyone is to get user's `access token`, then it may be able to send requests on user's behalf (who may actually never visited an app) and/or authorized such actions for that app. Altough, my guess is not in easy and straightforward way. 

	 
1. You ask your server to get you a `request token`. Server prepares and signs your request and sends it to X. X checks your `CONSUMER_KEY` and signature (by reproducing it). If all is ok, it grants (returns) you an unauthorized `request token`. It's function is to be authorized (approved) by user in step 2, so it can be used to get user's `access token` in step 3.

2. Uppon receiving `request token` data, user is redirected to X to obtain user authorization :
  * if you are using `/oauth/authorize` enpoint for redirection, then every time user is redirected there it lands on authorization [(interstitials) page](https://docs.x.com/resources/fundamentals/authentication/guides/log-in-with-x). Even if user previously authorized your app.
  
  * if you are using `/oauth/authenticate` enpoint for redirection, then only first time user is redirected it lands on authorization page. On any subsequent redirection X *remembers* first one and user is directed back again to the app. No authorization page is showed, the user is not involved directly. Historicaly it [didn't work](https://twittercommunity.com/t/twitter-app-permission-not-honored-on-subsequent-oauth-authenticate-calls/94440) like it should, for a time. 
 Two were actually the same where `/oauth/authenticate` acted like `/oauth/authorize`. 
 
    > Even there is no authorization page showed, there still can be a redirection page flash.

3. Since user approved your `request token`, now it is used to get user's `access token`. Server signs your request and sends it. X does things similarly like in first step and grants you an `access token` which belongs to the user who authorized it in second step.

After we get user's `access token` the 3-leg OAuth is finished and we can use it to send request to X on user's behalf (like posts tweets on user's profile). In `OAuth` parlance this process of sending requests with the access token is called `accessing protected resources`, but it is not part of the `OAuth`.

We can see that in 3-rd leg `access token` is send back to web app. Which usually is not good idea, because of security implications it could have, like we mentioned earlier.
 
Let's see what xwiz is doing with OAuth:

![xwizHaste](/Pics/XwizHaste.png)

Three differences are:
 * **Optimized load** 
 
     Preparing an `OAuth` leg (step) mostly refers to the assembling of `Signature Base String` and `Authorization Header string`. It is all done in browser (`Consumer`) in an effort to ease the server load for actions that bear no security concerns and thus do not need to be executed in server. Already prepared requests come to the server who acts mostly like a signing/stamping authority by merely inserting sensitive data and signing requests.

* **Security**

    Another important point is that the user's access token is never send back to the browser by any means.

* **Haste** 

     On the server we have a decision point where if we already have user's `access token` (stored from a previous authorization ie. in database) we can use `haste` (on diagram the *yes* branch ).
     
     Haste is a process where you verify `access token` freshness (verify credentials) with X and if it's fresh you can immediately go for a X api requests user actually wants. Checking token freshness is checking that user didn't revoke right to your app of doing things on it's behalf and such. 
     
     This is usefull for scenarios where you save user's `access token` after first authorization and then just check for it's freshness before you go for an api request. User does not need to be bothered every time with 3-leg `OAuth`, there is no interstitials page. With haste **you** are the one who *remembers* user authorization instead of letting X to do it (like it does on the `/oauth/authenticate`). All in order to have smooth user experience, like for instance in case `/oauth/authenticate` stops working as expected. Or when redirection page flashes for the moment before user is returned to app and you would like to remove that behaviour. 
     
     If this is the first time a user is making a request (and we dont have the `access token`) then we just continue the whole `OAuth flow` (on diagram the *no* branch). One of xwiz's features is very easy switching between any of your `OAuth` workflows while having a redundant mechanism for smooth user experience (`haste`) as an option.


## Examples

### [⬑](#contents)

In order to efficiently and safely use xwiz make sure you:
 1. **Provide HTTPS** all the way (client ---> server --> X)
 2. In browser install `xwiz-client`, on server install `xwiz-server` 
 3. Create [app account](https://developer.x.com/en/apps/create) on X
 4. Users (of your app) must have X accounts 

### Example 1 (not saving access token)

Simple use case where you do not save user's access token.

### [⬑](#contents)
      
   
    CDN:  <script src="https://cdn.jsdelivr.net/npm/xwiz-client/src/xwiz-client_bundle.min.js"></script>
   
    yarn:  yarn add xwiz-client
	 
    local:

    npm install xwiz-client

    Then drop it in script tag:  <script src="src/xwiz-client_bundle.js"></script>	
    
    Or if you are using your own builder make sure it picks up: "src/xwiz-client.js" file	 
	 
	 
  _**client**_

```js  
 // Let's say this code is in your page ->  https://myApp.com 

import xwizClient  from "./xwiz-client_bundle.js";

let xwizlent = xwizClient();

// lets say we initiate oauth on click event
btn.addListener('onClick', function(){     

  let args = { 
    
       // address of your xwiz-server 
      server_url: 'https://myServer.com/xwiz-server-route',
      
      // the location where X will redirect user after authorization
      redirection_url: 'https://myApp.com/redirect-path',
      
      //  X request options  
      options:{                                     
         method: 'POST',
         path:   '/2/tweets'
         body: {
           text: "Hooray, new post on X!"
         }
         encoding: 'json'
      }
  }

  try {

    const res =  await xwizlent.OAuth(args):

    // handle errors
    if(res.error) {  
      // >= 400 responses ( contains error.statusCode, error.statusText and error.data)
    }

    // flag that indicates browser redirection (302 - Redirect) to the redirection_url
    if(res.redirection) { 
      console.log('Browser redirects');
    }

    /*  
      Always present in case you need to pull some data from response 
      (like custom server headers you might be sending) 
    */
    console.log(res.xhr)
  }
  catch(e){
      // xwiz errors
      console.log(e);
  }

})
```

In code for redirection_url (`https://myApp.com/redirect-path`) invoke the `finishOAuth()`.

```js
 
 // Code in redirection_url 

 import xwizClient  from "./xwiz-client_bundle.js";

 let xwizlent = xwizClient();

 try {

   const args = {
      // address of your xwiz-server 
      server_url: 'https://my-node-server.com/xwiz-server-route',

      //  X request options  
      options:{                                     
         method: 'POST',
         path:   '/2/tweets'
         body: {
           text: "Hooray, new post on X!"
         }
         encoding: 'json'
      }
   }

   const res = await xwizlent.finishOAuth(args);

   // handle errors
   if(res.error){
     //  >= 400 responses
   }

   // handle success
   if(res.data){
     // will have data on succesfull xwiz.continueOAuth() call on server
   }
   
    /*  
      Always present in case you need to pull some data from response 
      (like custom server headers you might be sending)
    */
    console.log(res.xhr);
 }
 catch(e){

    // xwiz errors
    console.log(e)
 }
```

Note that `redirection_url` does not need to be different. In example above it could have been `https://myApp.com/`.
Check [`session_data`](/MORE_EXAMPLES.md#getsessiondata) to see how you can append data to `redirection_url`,

For popups check [popup](#popup).

  _**server**_

xwiz-server is writen as an express middleware.

#### Continue OAuth
### [⬑](#contents)

Since you are not saving user's access token, call the `continueOAuth()`.

`npm install xwiz-server`

```js
  import xwizServer from 'xwiz-server';
  import express from 'express'
  
  const app = express();
  const xwizer = xwizServer({                             
        
        // Your X app account - consumer_secret 
         consumer_secret: process.env.CONSUMER_SECRET, 
        
        // Your X app account - consumer_key
         consumer_key:    process.env.CONSUMER_KEY     
  })

 // add middleware
  app.use('/xwiz-server-route', xwizer);

 /*
    Simple use case (you are not saving user's access token) 
  */
  app.on('hasteOrOAuth', async function (xwiz, verifyCredentials) {

        /* 
           When you dont want to save access token (or don't want to use haste), 
           you hit complete 3 leg OAuth every time you are going to X on user behalf
        */
        xwiz.continueOAuth();
  })

```
Call stack from browser to node: 

client : `OAuth(args)`  =====> server `continueOAuth()` ====>  client: `finishOAuth(args)`.

This happens every time you are going to X in user behalf.
You get `res.redirection` set to true. Browser redirects from the page you are in.
You get final data in `finishOAuth(args)` call.

##### Test drive example 1

[Test drive](https://regits2501.github.io/QuoteOwlet/) the *Sign in with X + api data*.


### Example 2 (saving access token)

Improved use case where you are saving user's access token for reuse.
Here redirection happens only first time.
Subsequently you are using access token and going straight to an X API.
Thus skipping the redirection and the whole OAuth process.

### [⬑](#contents)

  _**client**_
```js  
 // Let's say this code is in your page ->  https://myApp.com 

import xwizClient  from "./xwiz-client_bundle.js";

let xwizlent = xwizClient();

// lets say we initiate oauth on click event
btn.addListener('onClick', function(){     

  let args = { 
    
       // address of your xwiz-server 
      server_url: 'https://myServer.com/xwiz-server-route',
      
      // the location where X will redirect user after authorization
      redirection_url: 'https://myApp.com/redirect-path',
      
      //  X request options  
      options:{                                     
         method: 'POST',
         path:   '/2/tweets'
         body: {
           text: "Hooray, new post on X!"
         }
         encoding: 'json'
      }
  }

  try {

    const res =  await xwizlent.OAuth(args):

    // handle errors
    if(res.error) {  
      // >= 400 responses ( contains error.statusCode, error.statusText and error.data)
    }

     // flag that indicates browser redirection (302 - Redirect) to the redirection_url
    if(res.redirection) {

      // will redirect only first time, when you've not yet accuired user's access token
      console.log('Browser redirects');
      return;
    }

    // handle success
    if(res.data){
     // will have data on succesfull xwiz.haste(accessToken) call on server
    }

   

    /*  
      Always present in case you need to pull some data from response 
      (like custom server headers you might be sending) 
    */
    console.log(res.xhr)
  }
  catch(e){
      // xwiz errors
      console.log(e);
  }

})
```

In code for redirection_url (`https://myApp.com/redirect-path`) invoke the `finishOAuth()`.

```js
 
 // Code in redirection_url 

 import xwizClient  from "./xwiz-client_bundle.js";

 let xwizlent = xwizClient();

 try {

   const args = {
      // address of your xwiz-server 
      server_url: 'https://my-node-server.com/xwiz-server-route',

      //  X request options  
      options:{                                     
         method: 'POST',
         path:   '/2/tweets'
         body: {
           text: "Hooray, new post on X!"
         }
         encoding: 'json'
      }
   }

   const res = await xwizlent.finishOAuth(args);

   // handle errors
   if(res.error){
     //  >= 400 responses
   }

   // handle success
   if(res.data){
     /* 
       will have data on succesfull xwiz.continueOAuth() call on server
       only first time you go to X for user's access token
      */
   }
   
    /*  
      Always present in case you need to pull some data from response 
      (like custom server headers you might be sending)
    */
    console.log(res.xhr);
 }
 catch(e){

    // xwiz errors
    console.log(e)
 }
 ```

#### Verify credentials and haste
### [⬑](#contents)

  _**server**_

Save user's access token on server.
Then check for it's fresheness with `verifyCredentials(..)` and got straight to an X API with `haste(..)`
Without doing complete OAuth for a user, every time you are want to go to X.
Like in simple use case with [continue oauth](#continue-oauth).

`npm install xwiz-server`

```js
  import xwizServer from 'xwiz-server';
  import express from 'express'
  
  const app = express();
  const xwizer = xwizServer({                             
        
        // Your X app account - consumer_secret 
         consumer_secret: process.env.CONSUMER_SECRET, 
        
        // your X app account - consumer_key
         consumer_key:    process.env.CONSUMER_KEY     
  })

 // add middleware
  app.use('/xwiz-server-route', xwizer);

 /*
   event where we pick `haste()` (you already saved user's access token),
   or `continueOAuth()` (you did not yet accuired user's access token) 
  */
  app.on('hasteOrOAuth', async function (xwiz, verifyCredentials) {

    try { /
        
        /**
         * Go for saved access token in your database (see 'tokenFound' bellow),
         * if found go for verifyCredentials(), then for xwiz.haste()
        */
        let accessToken = await goForUserAccessTokenInDB();
        if (!accessToken) throw "User's access token not found";
 
       // check user's access token freshness
        let credentials = await verifyCredentials(accessToken, { skip_status: true })
        
        // skip 3leg OAuth flow (gets X API data end sends back to browser)
        xwiz.haste(accessToken) 

    } catch (err) {

        // go for 3 leg OAuth only firs time, when you don't have user's access token
        xwiz.continueOAuth();
    }
  })

 // when xwiz gets user's access token you can save it here in 'token found' event
  app.on('tokenFound', function(token){

   try {
     
      // user's access token received from X that you can put in database
      let accessToken = await token;

    } catch (e) {
      console.log(e);
    }

  })
```

Call stack from browser to node: 

client : `OAuth(args)`  =====> server `verfyCredentials(accessToken)` ; `haste(accessToken)`.


You get `res.data` from `OAuth(args)` call. 
There is no redirection.
Redirection happen only first time, when you do not yet have an access token. 



### Authorize or Authenticate (Sign In with X)

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


This is the so called [Sign in with X](https://docs.x.com/resources/fundamentals/authentication/guides/log-in-with-x) flow, the one that uses `/oauth/authenticate` endpoint. By default,  xwiz gets you an access token and gets your api data immediately afterwards. After these actions you can specify your own end with [xwiz.onEnd()](/MORE_EXAMPLES.md#onend). This is handy if you are using template rendering to show the signed-in UI to user, wheater on front-end or back-end.

 Since it gets you an access token and api data in one swoop, xwiz makes the [sign-in-with-X](https://docs.x.com/resources/fundamentals/authentication/guides/log-in-with-x) button **unecessary**, the whole proccess can  happen in *one* click of a button. 
 

  As opposed to:
  
     1. user clicks the sign-in-with-twitter button to authorize your app (you display the signed-in user UI)  
     2. user clicks another button to get data it wants from an X api
     


### Access Token

### [⬑](#contents)
   Currently the minimum of what xwiz see as valid `access token` is an object that has properties `oauth_token` and `oauth_token_secret` set. But it can have other parameters, like `screen_name`.
The `xwiz-server` (here xwizer) is by default an ending middleware, that is it will end the request. So call it before your error handling middlewares, if any. There are cases when xwiz **does not end** the request, check [Stream](/MORE_EXAMPLES.md#stream) usage. Errors will be sent to the next error handling midleware with `next(err)` calls and same errors will also be piped back to the browser.

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
footprint you can use parameters object (like one with `skip_status`) to leave out information you don't need. Here is the [list of params](https://developer.x.com/en/docs/x-api/v1/accounts-and-users/manage-account-settings/api-reference/get-account-verify_credentials) you can use.
 


### Popup

### [⬑](#contents)

Put the `new_window` object to args to specifiy your new popup / window characteristics and call `xwizlent.finishOAuth(..)` from code in that popup / window . 
Note that browser doesn't differentiate much between a popup and a new window. Main difference is in dimentions.  

  _**client:**_
```js
 // Let's say this code is in your page ->  https://myApp.com 

let xwizlent = xwizClient();

// lets say we initiate oauth on click event
btn.addListener('onClick', function(){                 
   let args = {
   
      // address of your node server 
      server_url:      'https://myServer.com/xwiz-server-route',   
      
      // location of your popup/window page
      redirection_url: 'https://myApp.com/popupWindow',
 
      // popup specs
      new_window:{
         name: 'mypopupWindow',
         features: 'resizable=yes,height=613,width=400,left=400,top=300'
      },

      //  X request options  
      options:{
         method: 'POST',
         path:   '/2/tweets'
         body: {
           text: "Hooray, new post on X!"
         }
         encoding: 'json'
      }
   }

   try {

    const res =  await xwizlent.OAuth(args):

    // handle errors
    if(res.error) {  
      // >= 400 responses ( contains error.statusCode, error.statusText and error.data)
    }

    // handle success
    if(res.data){
      // will have data on succesfull xwiz.haste(accessToken) call on server
    }

    /* 
       when redirection happens instead of res.redirection notification you'le get a 
       reference to the popup window and the redirection will happen from that window
    */ 
    if(res.window) { 
      // a reference to the popup window, when it get's opened
    }

     
     /*  
        Always present in case you need to pull some data from response 
       (like custom server headers you might be sending) 
     */
    console.log(res.xhr)
  }
  catch(e){
      // xwiz errors
      console.log(e);
  }

})
```
The `redirection_url` is now the location of the popup window.
In the `new_window` we specify the window/popup features where `redirection_url` will land . Making this more of a website use case.
The `new_window` object contains two properties, `name` and `features`, they act the same as `windowName` and `windowFeatures` in [window.open()](https://developer.mozilla.org/en-US/docs/Web/API/Window/open). 
Note `res.window` reference to newly opened window / popup instead of `res.redirection`. 


```js
 // code in https://myApp.com/popupWindow

 import xwizClient  from "./xwiz-client_bundle.js";

 let xwizlent = xwizClient();

 try {

   const args = {
      // address of your xwiz-server 
      server_url: 'https://my-node-server.com/xwiz-server-route',

      //  X request options  
      options:{                                     
         method: 'POST',
         path:   '/2/tweets'
         body: {
           text: "Hooray, new post on X!"
         }
         encoding: 'json'
      }
   }

   const res = await xwizlent.finishOAuth(args);

   // handle errors
   if(res.error){
     //  >= 400 responses
   }

   // handle success
   if(res.data){
     // will have data on succesfull xwiz.continueOAuth() call on server
   }

 }
 catch(e){
    // xwiz errors
    console.log(e)
 }
```

What this enables is to have completely custom popup pages but same familiar popup, like for instance when you whould like to share something on X by pressing a X share button. Currently the downside is that users of the web site use case will get a popup warning by browser which they have to allow before popup apears.

                            
  _**server**_
```js
  import xwizServer from 'xwiz-server';
  import express from 'express'
  
  const app = express();
  const xwizer = xwizServer({                             
        
        // Your X app account - consumer_secret 
         consumer_secret: process.env.CONSUMER_SECRET, 
        
        // your X app account - consumer_key
         consumer_key:    process.env.CONSUMER_KEY     
  })

 // add middleware
  app.use('/xwiz-server-route',xwizer);

 /*
   event where we pick `haste(..)` (you already saved user's access token),
   or `continueOAuth(..)` (you did not yet accuired user's access token) 
  */
  app.on('hasteOrOAuth', async function (xwiz, verifyCredentials) {

    try { /
        
        /**
         * Go for saved access token in your database (see 'tokenFound' bellow),
         * if found go for verifyCredentials(), then for xwiz.haste()
        */
        let accessToken = goForUserAccessTokenInDB();
        if (!accessToken) throw "User's access token not found";
 
       // check user's access token freshness
        let credentials = await verifyCredentials(accessToken, { skip_status: true })
        
        // skip 3leg OAuth flow (gets X API data end sends back to browser)
        xwiz.haste(accessToken) 

    } catch (err) {

        // go for 3 leg OAuth only first time, when you don't have user's access token
        xwiz.continueOAuth();
    }
  })
```
##### Test drive popup
[Test drive](https://regits2501.github.io/QuoteOwlet/popupWorkflow) the custom pop-up workflow. 

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

`spaWarning` and `noRepeat` are errors that have informative character and usually you dont have to pay attention to them. They happen when user loads/relods page where `xwizlent.finishOAuth(..)` is called on every load, imediately (which is valid). They are indications that `xwizlent.finishOAuth(..)` will not run. For example, `spaWarning` means `xwizlent.finishOAuth(..)` won't run on url that doesn't contain valid X authorization data. `noRepeat` means that you cannot make two requests with same X authorization data (like same `request token`). Check the [Stream](/MORE_EXAMPLES.md#stream) for explanation of `chunkedResponseWarning`.

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
