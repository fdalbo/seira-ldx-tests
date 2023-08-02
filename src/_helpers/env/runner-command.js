
'use strict';

const execa = require('execa')
const myConsole = require('#commons/myConsole')
const os = require('os')

process.on('uncaughtException', function (err) {
    myConsole.error(`process.main.uncaughtException`, err)
    /** Let some time to flush the console */
    setTimeout(() => process.exit(), 500)
})

const modeShell = os.platform() == 'linux'
/**  
 * launches the command 'command' in a child process
 * @resolve if run OK
 */
module.exports = function (command, options) {
    options = Object.assign({
        /** JEST handle the errors  */
        silent: true
    }, options ?? {})
    options.silent !== true && myConsole.superhighlight(`RUNNER-CMD BEGIN\nexecaCommandSync(${command})`)
    try {
        return execa.commandSync(command, {
            reject: true,
            stdio: [process.stdin, process.stdout, process.stderr],
            env: process.env,
            shell: modeShell
        })
    } catch (e) {
        options.silent !== true && myConsole.error(`RUNNER-CMD ERROR\n${command}`, e)
        throw (e)
    } finally {
        options.silent !== true && myConsole.superhighlight('RUNNER-CMD END\n')
    }
}



