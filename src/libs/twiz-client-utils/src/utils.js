'use strict'
 
   function percentEncode(str){                                     // percent encode by RFC3986
   
      return encodeURIComponent(str).replace(/[!'()*]/g, function(c){ // percent encodes unsafe chars, then
                                                                     // it follows RFC3986 and percent encodes
                                                                     // reserved characters in sqere brackets.
         return '%' + c.charCodeAt(0).toString(16);   // takes binary representation of every reserved char
                                                      // , coverts it to hex string char and appends to "%".
      });
 
   }

   function formEncode(dataObj, spaces){ // form encodes an object (optionaly changes '+' for '%20')
       var pairs = [];
       var value;
       var key;
       var type;
        for(var name in dataObj){
            type = typeof dataObj[name];
             if(dataObj.hasOwnProperty(name) && type !== "function" && dataObj[name] !== "null"){ // only props 
                                                                                           // in dataObj 
                  key = percentEncode(name);   // encode property name

                  if(type === 'object'){                         
                     value = formEncode(dataObj[name], spaces); // form encode object
                     value = percentEncode(value)          // since return value is string, percent encode it
                  }                      
                  else value = percentEncode(dataObj[name]) // property is not object, percent encode it
                  
                  if(!spaces){
                     key = key.replace(/%20/g, "+") 
                     value = value.replace(/%20/g, "+"); // substitute space encoding for +
                  }
                 
                  pairs.push(key + "=" + value)                 
             }
        }

      return pairs.join("&");
  } 

  
   function CustomError(){
       
       this.messages = {}; // error messages place holder    
   
       
       this.addCustomErrors = function (errors){  // add custom error messages
 
          Object.getOwnPropertyNames(errors).map(function(name){
     
            this.messages[name] = errors[name];
          },this)
       }

       this.CustomError = function(name){// uses built-in Error func to make custom err info

          var err = Error(this.messages[name]);      // take message text
          err['name'] = name;                          // set error name
          return err; 
       }


   }

   module.exports = {
      percentEncode: percentEncode,
      formEncode:    formEncode,
      CustomError:   CustomError
   }
