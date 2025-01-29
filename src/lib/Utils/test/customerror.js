var test            = require('tap').test;
var CustomError     = require('../src/utils').CustomError;
var throwAsyncError = require('../src/utils').throwAsyncError


function Bar (){
  CustomError.call(this);
  this.addCustomErrors({
     'error1': 'description of error1',
     'error2': 'desciption of error2'
  })

}
Bar.prototype.throwError = function(condition1, condition2){
    if(condition1) throw this.CustomError('error1')
    if(condition2) throw this.CustomError('error2')
}

var bar = new Bar();

test('CustomError throw',function(t){
   

   test('throw custom error1', function(t){
      t.plan(1);
       
      t.throw(bar.throwError.bind(bar, 'error1'), bar.messages.error1, 'throws error message: '+ bar.messages.error1 )
   })
   
   test('throw custom error2', function(t){
      t.plan(1);
       
      t.throw(bar.throwError.bind(bar, '', 'error2'), bar.messages.error1, 'throws error message: '+ bar.messages.error2 )
   })

   t.end()
})

test('throw Async Error (Promise) ', function(t){   // simulate promise async aware error throwing, promise avalable
   var baz = {} 
   baz.throwAsyncError = throwAsyncError; // get async error throwing function

   var p = new Promise(function(res, rej){
      baz.reject = rej;
   })

   test('throws async error', function(t){
       t.plan(1);
       var error = 'error in promise'
       baz.throwAsyncError(error);  // throw error (calls reject(..) if Promise is globaly avalable)

       p.then(null,
         function rejected(err){ 
            t.equals(err, error);
       })
   })

   t.end()
})
 
test('throw Async Error (no Promise)', function(t){ //' when no promise is avalable just throw error
   test('throws error', function(t){
       t.plan(1);

       var baz = {} 
       var error = 'sync error'
       baz.throwAsyncError = throwAsyncError; // get async error throwing function
       
       Promise = ''                  // simulate no promise avalable
       var savedPromise = Promise;

       t.throw(baz.throwAsyncError.bind(baz, error), error);
      
       Promise = savedPromise;      // return promise functionality
       
   })

   t.end()
})
