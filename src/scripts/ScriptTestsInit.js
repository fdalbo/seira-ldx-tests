
'use strict';

const ApiClient = require('./ApiClient');
const myConsole = require('#commons/myConsole');
/** !! ; needed */

(async () => {
   try{
      const cli = await ApiClient.factory({
       scriptId: 'script1'
      })
      await cli.askAndExecAction()
   }catch(e){
      myConsole.error('Error running script', __filename, e);
   }
})()