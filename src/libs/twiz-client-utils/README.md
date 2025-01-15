## twiz-client-utils [![Build Status](https://travis-ci.org/gits2501/twiz-client-utils.svg?branch=master)](https://travis-ci.org/gits2501/twiz-client-utils)
Utility functions and modulules that are used in [twiz-client](https://github.com/gits2501/twiz-client). But can be used elsewhere.

#### Current functions:
 name | info
 -----|------
*percentEncode* | percent encoding by rfc 3986 . 
*formEncode*  | encodes flat javascript objects by x-www-formencoded scheme

#### Current modules:

name | info
-----|-----
*CustomError* | provides ability of defining and throwing Error/s with custom `name` so users of your code can check `error.name` instead of usualy more verbose `error.message`. Works in Node and browsers.


#### installation: 
  
  `npm install twiz-client-utils`

#### usage:

     var CustomError = require('twiz-client-utils').CustomError
  ```javascript
     function Bush(branches){
        this.branches = branches; 
        
        CustomError.call(this)      // adds CustomError functionality
        this.addCustomErrors({      // adds custom errors with addCustomErrors api
            smallBush: 'must have more then 10 branches'
        })
    
       if(this.branches < 3) throw this.CustomError('smallBush') // throw error with CustomError
     } 

     var b;
     try{
         b = new Bush(5);
     catch(e){
         if(e.name === 'smallBush') ...
     }   
