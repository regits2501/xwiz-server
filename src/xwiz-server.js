import PhaseConfigurator from "./lib/PhaseConfigurator/PhaseConfigurator.js";

export default function (args) {

   return function () {
      const pc = new PhaseConfigurator(args);
      pc.startAlternator.apply(pc, arguments);
   }
}


