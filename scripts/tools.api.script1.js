
'use strict';

const ToolsBaseApi = require('#tools/ToolsBaseApi');
const myConsole = require('#commons/myConsole');
/** !! ; needed */

/**
 *  npm run tools.api.script1.debug  DRYRUN BY DEFAULT
 *  %npm run tools.api.script1.debug -- --dryrun false 
 */

(async () => {
   try{
      const cli = await ToolsBaseApi.factory({
       scriptId: 'script1'
      })
      await cli.askAndExecAction()
   }catch(e){
      myConsole.error('Error running ToolsBaseApi (script1)', __filename, e);
   }
})()