var test          = require('tap').test;
var percentEncode = require('../src/utils').percentEncode;
var formEncode    = require('../src/utils').formEncode;

var result;
var expected; 
test('percentEncode (by RFC3986)',function(t){
   

   test('percentEncode safe characters',function(t){
      t.plan(1) 
   
      result   = percentEncode('March to Helm\'s Deep, leave non alive');      
      expected = 'March%20to%20Helm%27s%20Deep%2C%20leave%20non%20alive';
 
      t.equals(result, expected, 'Safe chars encoded')
   })
    
   
   test('percentEncode unsafe (!\'()*) characters', function(t){
     t.plan(1);
   
     result   = percentEncode('This night, the land will be stained with the blood of Rohan! (Saruman*)')
     expected =  'This%20night%2C%20the%20land%20will%20be%20stained%20with%20the%20blood%20of%20Rohan%21%20%28Saruman%2a%29'
     
     t.equals(result, expected, 'Unsafe chars (!\'()*) encoded')

   })
  
  t.end();
})


test('formEncode', function(t){

  var obj = {
    id: 980,
    name: 'Peregrin Tuk',
    race: 'Hobbit'
  }

  test('spaces convert to  \'+\'-es ', function(t){
      t.plan(1);

      result   = formEncode(obj);
      expected =  'id=980&name=Peregrin+Tuk&race=Hobbit'
  
      t.equals(result, expected, 'spaces converted to \'+\'-es');
   
      
  })
  
  test('spaces convert to \'%20\'', function(t){
     t.plan(1);
    
     result   = formEncode(obj, true);
     expected = 'id=980&name=Peregrin%20Tuk&race=Hobbit' 

     t.equals(result, expected, 'spaces converted to \'%20\'');
     
    
  })
 

  t.end();
}) 
