# Additional use
Check [examples](/README.md#examples) before continuing (recomended).

### Contents
  * [Stream](#stream)
  * [Chunked responses](#chunked-responses)
  * [getSessionData](#getsessiondata)
  * [onEnd](#onend)
  * [beforeSend](#beforesend)
  * [callback](#callback)

## Stream 

With xwiz using stream means using third party `STREAM` and/or `REST` libraries, while letting xwiz to take care **only** for user `authentication`, that is getting an `access token`. In other words stream efectively turns off built in `REST` capability.
Specify stream in client by passing `args.stream = true`. 

_**browser:**_
```js
  ...
  import xwizClient from './xwiz-client_bundle.js'

  let xwizlent = xwizClient();

  let args = {
     server_url: 'myServer.com/route',
     ...
     ...
     stream: true , // Indicate that you want to use 'your own' Stream and/or REST libs 
     options : {              // X request options
        path:   'media/upload',
        method: 'POST',
        params: {
           source: 'image.jpg',
           ...  // can contain your own properties 
           ... 
        }
     }
  } 
```
Then on server you can do the following:

_**node.js:**_
```js
   ...
   app.use(xwizer)                                           // instance of xwiz-server

   app.on('hasteOrOAuth', function(xwiz, verifyCredentials){
                                  // Here we presume access token is already loaded from your storage
       if(!accessToken){
         xwiz.continueOAuth();    // we continue OAuth when we don't have access token
         return;
       }
       
       // If you are storing tokens in persistent memory code can look like this: 
       // (this step is optional)
 
       verifyCredentials(accessToken, {skip_status: true})              
       .then(function fullfiled(credentials){
            if(xwiz.stream){                          // Check that user indicated stream
               app.options     = xwiz.twitterOptions; // X request options as in the args.options on client
               app.accessToken = accessToken;         // save access token to app (just as an example)     
               xwiz.next()                            // Jump to next middleware, here it's 'myStream(..)'                                 
            }
            else xwiz.haste(accessToken);            // maybe you'll want haste
       }, function rejected(err){
            // ...
       })
   })

   app.on('tokenFound', function(found, xwiz){
       
       found
       .then(function fullfiled(accessToken){
         
           if(xwiz.stream){
              app.options     = xwiz.twitterOptions; // Save X request options
              app.accessToken = accessToken;         // Save access token
              xwiz.next()                            // Jump to next middleware, here it is 'myStream(..)'
           }            

       }, function rejected(err){
         ...
       }) 
      
   })
   app.use(function myStream(req, res, next){      // your own streaming implementation, must end response 
       let accessToken = app.accessToken
       let options     = app.twitterOptions            // same as in args.options
       
       options; /* {          
                     path:   'media/upload',
                     method: 'POST',
                     params: {
                     source: 'image.jpg',
                        ...  // can contain your own properties 
                        ... 
                   } 
                */

      // your code for STREAM and/or REST apis ...
   })
```

Instead of baking in something like `onStream(..)` function that would handle your own `stream/rest` requests, in `hasteOrOAuth` and `tokenFound` events you are given 3 basic building blocks for creating such `onStream(..)` handler. With the exception of `access token` that you've got already, they are:

 property  |  description
---------  |  ------------- 
xwiz.stream | Flag that indicates request wants third party `stream`/`rest` capability
xwiz.twitterOptions | Your `args.options` from browser, has `path`, `method` and `params` properties
xwiz.next | Reference to Express' `next()` function which runs next middleware (myStream in example)

So you can easily see something like `onStream` handler that:
 
 1. checks if request wants custom `stream`/`rest` libs
 2. saves `twitterOptions`/`accessToken` to apropriate places to be used in the next middleware 
 3. when it's done doing its thing, calls the next middleware

As you can see, xwiz is not keen to stuff potentialy security sensitive data to `app` or `req` objects. It is given to your judgement to place your data where you see fit. `app` is used as storage in example just as an ilustration of a purpose, maybe you would want some caching solution like `redis`/`memcache`. 


## Chunked responses 
### [⬑](#contents)

When making stream requests the response often come as series of data [chunks](https://en.wikipedia.org/wiki/Chunked_transfer_encoding) from the other end. To consume response in chunk by chunk manner set [xhr.onprogress(..)](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequestEventTarget/onprogress) callback in `beforeSend` function:

_**browser:**_
 ```js
 let args = {
      ...
      options:{
         ...
         beforeSend: function(xhr){

            xhr.onprogress = function(evt){
              xhr.responseText // consume chunks (for text/plain response, for instance)
             }
         }
      }
  }
```  
A reference on how to [consume](https://stackoverflow.com/questions/6789703/how-to-write-javascript-in-client-side-to-receive-and-parse-chunked-response-i) chunks. 

1. If your not sending  `content-type`.

   It is good idea to set `content-type` header on your server before you proxy first `chunk` back to client or else when stream finialy ends promise will reject with `noContentType` error. But your data will already be consumed in your in `onprogress(..)` callback.

2. If you are sending `content-type`.

   When your stream is consumed in `onprogress(..)` and it ends, the promise will still resolve and you will have all your data that stream emmited in `o.data` also. Since you're getting your data in `onprogress(..)` you might not want to receive it in your promise too. Same goes if your using callbacks and not promises. To stop all data from stream to resolve in promise set `chunked=true` in `args.options`.

_**browser:**_
```js
 let args = {
    ...
    options = {
       ...
       chunked: true
    }
 }
 ```
By setting `chunked` you dont have to worry about sending `content-type`, it will make the promise reject with error `chunkedResponseWarning` no matter the presents of `content-type header`. So you have consistent behavior, when you would want to consume chunks only in `xhr.onprogress(..)` handler. 

## getSessionData 
### [⬑](#contents)

There is an interesting capability provided by the [OAuth 1.0a](https://oauth.net/core/1.0a/) spec section `6.2.3`. "The callback URL `MAY` include Consumer provided query parameters. The Service Provider `MUST` retain them unmodified and append the `OAuth` parameters to the existing query".

 This relates to `OAuth` step 2. When we redirect user to X for obtaining `authorization` we are *sending* a `callback url` (I've called it `redirection_url`) along with `request token` (not shown in diagrams), which X uses to (re)direct user back to app when authorization is done. In that url we can piggy-back arbitrary data as query params to X and back to app. Then, when we are (re)directed back to app, we can take back that data. The result is that we have a simple mechanism that allows our data to survive redirections, that is changing window contexts in browser. Which is handy in cases when we have the `SPA` workflow and everthing happens in one window tab, so data we send from our app's window context can *survive* changing that context to the context of X' window on which `authorization` happens and then again finally our apps' window context.

 This can also be used for web site workflows, but you'le get the `o.window` reference in that case which also can be used for exact same thing. This mechanism comes in hand when you are in a place like [github pages](https://pages.github.com/) and don't have access to a database there and/or your are not currently interested in puting a database solution on a server. Here is how you can use it:

### SPA
_**browser:**_
```js
  //  code in https://myApp.com

  import xwizClient  from "./xwiz-client_bundle.js";
  
  let xwizlent = xwizClient();
  
  btn.addListener('onClick', function(){                  // lets say we initiate oauth on click event
     let args = {
        
        // address of your node server where xwiz-server runs
        server_url: 'https://myServer.com/xwiz-server-route',   
        
        // location of your popup window page
        redirection_url: 'https://myApp.com/popUpWindow',
          
        // your arbitrary data that is appended to redirection_url as query parameters 
        // you could put here your X request options, so your data can 'survive' redirection
        session_data: {                                 
           weater: 'Dry, partly cloudy with breeze.',
           background_noise: 'cicada low frequency',
           intentions: 'lawfull good'
        }

        // window popup options (optional)
        new_window: {
           name: 'myPopUpWindow',
           features: 'resizable=yes,height=613,width=400,left=400,top=300'
        },
        
        //  X request options  
        options: {                                        
           method: 'POST',
           path:   '/2/tweets',
           body: {
             text: "Hooray, new tweet!"
           },
           encoding: 'json'
        }
     }
     
     try {

        let res = xwizlent.OAuth(args)
        ... 
     }
     catch(e){
       console.log(e);
     }
  })

```
Code for https://myApp.com/popUpWindow

 ```js

  
  import xwizClient  from "./xwiz-client_bundle.js";
  let twizlent = twizClient();

  // Gets our session_data from redirection_url 
  let sessionData = twizlent.getSessionData();  
                                                 
 
  console.log(sessionData); 
  /* {              
      weater: 'Dry, partly cloudy with breeze.',
      background_noise: 'cicada low frequency',
      intentions: 'lawfull good'
  }*/                                                                   
  ...     
```
If there is no `session data` in url, function returns `undefined` and logs warning on console `noSessionData: 'Unable to find session data in current url'`

## onEnd 
### [⬑](#contents)

In `tokenFound` handler `xwiz` has the `onEnd(..)` function available.
It's use is to specify your own function that will end the request as you see fit. For instance when you would like to use a template engine. `onEnd(..)` fires after `access protected resources` (api) call but it does not end the response.

_**node.js:**_
```js
  app.on('tokenFound', aync function(found, xwiz){

     xwiz.onEnd(async function setUserName(apiData, res) {

        await token
        /* 
          Happens after accessToken is found and API data received
           Uses server side template engine 
        */
        res.render('signedInUI', { user: apiData.someData })   
    })

    try {
     
        // user's access token received from X that you can put in database
        let accessToken = await token;

    } catch (e) {
        console.log(e);
    }
  })
```

When we get the `access token` in our promise then xwiz gets api data and calls your `onEnd(..)` callback with that data and response stream.
So we've sent the rendered html with `user.name` from data we got from  X's `/2/tweets`
api. When you are specifying the `onEnd(..)` function then it must end the response or else the request will hang. 

Also if your workflow requires front-end template rendering. You can instead of `res.render(..)` use :
```js
res.redirect(302,'/signedInUI');  // redirects the client to the signedInUI template
```
Then the `twizlent.finishOAuth(..)` will get this `signedInUI` template in it's `res.data`.

## beforeSend 
### [⬑](#contents)

On client side the `args.options` object can also have a `beforeSend` property. It is a function that allows your to manipulate `xhr` instance before request is sent.

_**browser:**_
```js   
  // https://myApp.com
  btn.addListener('onClick', function(){                  // lets say we initiate oauth on click event
     let args = {
        ...
        ...
        options:{                                         //  X request options  
           method: 'POST',
           path:   '/2/tweets'

           body: {
             text: "Hooray, new tweet!"
           },
           encoding:'json',
           
           beforeSend: function(xhr){
              // xhr.open(..) is called for you, dont do it
       
                 xhr.setRequestHeader('X-My-Header-Name', 'value') // in case you need something like this

              // xhr.send(..) is called for you, dont do it
           }
       }
     } 

```


## Callback 
### [⬑](#contents)

The `args` object can have the `callback` property. You can specify there your callback function which will run **only** if:

1. **Promise is not avalable** 

If there is `Promise`, `OAuth(..)` and `finishOAuth(..)` functions always return promise.

_**browser:**_

```js
args = {
   ...
   ...
   callback: function(o){
         if(o.error)
         if(o.data)
         if(o.window) // or if(o.rederection). When using SPA workflow (o.window), 
                      // when using web site (o.redirection)  

         o.xhr        // always present in case you need to pull some data from response (like custom headers)      
   }
   
}


let xwizlent = xwizClient();

try{

   let res = xwizlent.OAuth(args);
   ...
}
catch(e){
   // xwiz errors
   console.log(e);
}
```

If promise is not available and there is no `callback` specified you'le get and error `noCallbackFunc` see [errors](/README.md#errors).
