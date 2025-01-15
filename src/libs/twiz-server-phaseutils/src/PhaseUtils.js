  var Upgrade = {
         
     addWorkSpace: function (){ // defines tools to manage alternator state (save/load phase ability)
       
         this.saved = {};
         
         this.save = function(s){ // save alternator state (phases and their runs)
            
            this.savePhases(s);    
            this.savePhaseRuns(s);  
         }
        
         this.savePhases = function(s){                      // save any phase
            if(s.legPhase) this.saved.legPhase = s.legPhase;
            if(s.apiPhase) this.saved.apiPhase = s.apiPhase;
         }
         
         this.savePhaseRuns = function(s){                   // save initial phase runs (functions)
            if(s.legRun) this.saved.legRun = s.legRun;
            if(s.apiRun) this.saved.apiRun = s.apiRun;
         }

         this.change = function(c){                          // change phases and runs
            this.changePhase(c);
            this.changePhaseRun(c);
         }
         
         this.changePhase = function(c){                     // change phases
            if(c.legPhase) this.legPhase = c.legPhase;   
            if(c.apiPhase) this.apiPhase = c.apiPhase
         }
          
         this.changePhaseRun = function(c){                  // change inital phase run
            if(c.legRun) this.legPhase.run = c.legRun;
            if(c.apiRun) this.apiPhase.run = c.apiRun;            
         }  
         
         this.load = function(l){                            // load state (phases and their runs)

            this.loadPhases(l);
            this.loadPhaseRuns(l);
         }

         this.loadPhases = function(l){                      // load phase/s if any
            if(l.legPhase) this.legPhase = l.legPhase;
            if(l.apiPhase) this.apiPhase = l.apiPhase;
         }

         this.loadPhaseRuns = function(l){                   // load run/s if any
            if(l.legRun) this.legPhase.run = l.legRun;
            if(l.apiRun) this.apiPhase.run = l.apiRun;
    
         }
    }
  }

 module.exports = Upgrade;

