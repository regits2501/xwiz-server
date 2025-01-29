var Upgrade = require('../src/PhaseUtils');
var assert  = require('assert');

var legPhase_ = {lp: 'lp phase stuff'};  // simulate phase object
var apiPhase_ = {ap: 'ap phase stuff' };

var legRun_   = function(){/* ... */};  // sumulate phase runs (functions)
var apiRun_   = function(){/* ... */};

var alternator = {}     // phases container


Upgrade.addWorkSpace.call(alternator); // add work space = save/load ability

describe('Phase Utils', function(){

  describe('add abilities', function(){

   describe('save', function(){ // test that we can saev each phase separately or together, do same for runs

      it('leg phase', function(){
         alternator.save({legPhase: legPhase_})
    
         assert.deepStrictEqual(alternator.saved.legPhase, legPhase_);         
      })


      it('api phase', function(){
         alternator.save({apiPhase: apiPhase_})
    
         assert.deepStrictEqual(alternator.saved.apiPhase, apiPhase_);         
      })

      it('phases', function(){

         alternator.save({legPhase: legPhase_ , apiPhase: apiPhase_})
    
         assert.deepStrictEqual(alternator.saved.apiPhase, apiPhase_); 
         assert.deepStrictEqual(alternator.saved.legPhase, legPhase_);         
      })

      it('leg run', function(){
         alternator.save({legRun: legRun_})
    
         assert.deepStrictEqual(alternator.saved.legRun, legRun_);         
            
      })
      
      it('api run', function(){
         alternator.save({apiRun: apiRun_})
    
         assert.deepStrictEqual(alternator.saved.apiRun, apiRun_);         
      })      
      
      it('phase runs', function(){

         alternator.save({legRun: legRun_ , apiRun: apiRun_})
    
         assert.deepStrictEqual(alternator.saved.apiRun, apiRun_); 
         assert.deepStrictEqual(alternator.saved.legRun, legRun_);         
      })
   })

   describe('load', function(){ // test that we can load each phase separately or together, do same for runs
         
      it('leg phase', function(){
          alternator.legPhase = ''; // make leg phase not set
          saved = alternator.saved;

          alternator.load({ legPhase: saved.legPhase });
          assert.deepStrictEqual(alternator.legPhase, saved.legPhase);
     
      })
   
      it('api phase', function(){
          alternator.apiPhase = ''; // make api phase not set
          saved = alternator.saved;

          alternator.load({ apiPhase: saved.apiPhase });
          assert.deepStrictEqual(alternator.apiPhase, saved.apiPhase);
     
      })

     it('phases', function(){
        alternator.legPhase = '';   // unset leg phase
        alternator.apiPhase = '';    // unset api phase
        var saved = alternator.saved;
        
        alternator.load({ legPhase: saved.legPhase, apiPhase: saved.apiPhase })
        assert.deepStrictEqual(alternator.legPhase, saved.legPhase)
        assert.deepStrictEqual(alternator.apiPhase, saved.apiPhase)
     })
  
     it('leg run', function(){
        alternator.legRun = '';      // unset leg run
        var saved = alternator.saved;

        alternator.load({ legRun: saved.legRun });
        assert.deepStrictEqual(alternator.legPhase.run, saved.legRun);
     }) 
   
     it('api run', function(){
        alternator.apiRun = '';      // unset leg run
        var saved = alternator.saved;

        alternator.load({ apiRun: saved.legRun });
        assert.deepStrictEqual(alternator.apiPhase.run, saved.legRun);
     }) 
  })

  describe('change', function(){ // test that we can change both phases separately or together, do same for runs
    
     it('leg phase', function(){
         var otherPhase = {op: 'other phase stuff'};
         alternator.legPhase = legPhase_
         alternator.change({ legPhase: otherPhase });

         assert.deepStrictEqual(alternator.legPhase, otherPhase)
     }) 

     it('api phase', function(){
         var otherPhase = {op: 'other phase stuff'};

         alternator.apiPhase = legPhase_
         alternator.change({ apiPhase: otherPhase });

         assert.deepStrictEqual(alternator.apiPhase, otherPhase)
     }) 
    
     it('phases', function(){
         var otherPhase = {op: 'other phase stuff'};
         var anotherPhase = {ap: 'another phase stuff'};

         alternator.legPhase = legPhase_;
         alternator.apiPhase = apiPhase_;
         alternator.change({ legPhase: otherPhase, apiPhase: anotherPhase });

         assert.deepStrictEqual(alternator.legPhase, otherPhase);
         assert.deepStrictEqual(alternator.apiPhase, anotherPhase);
     }) 

     it('leg run', function(){
         var otherRun = function(){};  // define some other run
         
         alternator.legPhase.run = ''; // unset leg phase run
         alternator.change({ legRun: otherRun })
         assert.deepStrictEqual(alternator.legPhase.run, otherRun);
        
     })
    
     it('api run', function(){
         var anotherRun = function(){};  // define some other run
         
         alternator.apiPhase.run = ''; // unset leg phase run
         alternator.change({ apiRun: anotherRun })
         assert.deepStrictEqual(alternator.apiPhase.run, anotherRun);
        
     })
  
      it('runs', function(){
         var otherRun = function(){};  // define some other run
         var anotherRun = function(){};

         alternator.legPhase.run = ''; // unset leg phase run
         alternator.apiPhase.run = ''; 
         alternator.change({ legRun: otherRun, apiRun: anotherRun })
         
         assert.deepStrictEqual(alternator.legPhase.run, otherRun);
         assert.deepStrictEqual(alternator.apiPhase.run, anotherRun);
     })
   })
 })

})

