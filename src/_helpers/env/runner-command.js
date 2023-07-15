
'use strict';

import { execaCommandSync } from 'execa'
import myConsole from '#commons/myConsole'
import { pause } from '#commons/promises'

process.on('uncaughtException', function (err) {
    myConsole.error(`process.main.uncaughtException`, err)
    /** Let some time to flush the console */
    setTimeout(() => process.exit(), 500)
})

/**  
 * launches the command 'command' in a child process
 * @resolve if run OK
 */
export default async function (command, options) {
    options = Object.assign({
        /** JEST handle the errors  */
        silent: false
    }, options ?? {})
    options.silent!== true && myConsole.superhighlight(`RUNNER-CMD BEGIN\nexecaCommandSync(${command})`)
    try {
        execaCommandSync(command, {
            stdio: [process.stdin, process.stdout, process.stderr]
        })
    } catch (e) {
        options.silent!== true && myConsole.error(`RUNNER-CMD ERROR\n${command}`, e)
        throw (e)
    } finally {
        options.silent!== true && myConsole.superhighlight('RUNNER-CMD END\n')
        await pause(500)
    }
}



