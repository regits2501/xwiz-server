import xOAuthConfigurator from "./lib/xOAuthConfigurator/xOAuthConfigurator.js";

export default function (args) {

   return function () {

      (async () => {

        const xOAuth = new xOAuthConfigurator(args);
        await xOAuth.start.apply(xOAuth, arguments);
      })();
   }
}