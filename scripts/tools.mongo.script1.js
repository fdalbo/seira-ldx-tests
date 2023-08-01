

'use strict';

const myConsole = require('#commons/myConsole');
const ToolsScript1Mongo = require('#tools/ToolsScript1Mongo');
/** !! ; needed */

/**
 *  npm run tools.mongo.script1.debug DRYRUN BY DEFAULT
 *  npm run tools.mongo.script1.debug -- --dryrun false 
 */
(async () => {
    try {
        const cli = await ToolsScript1Mongo.factory({
            scriptId: 'script1'
        })
        await cli.askAndExecAction()
    } catch (e) {
        myConsole.error('Error running ToolsScript1Mongo (script1)', __filename, e);
    } finally {
        process.exit(0)
    }
})()

