var test        = require('tap').test;
var CustomError = require('../src/utils').CustomError;


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

 
