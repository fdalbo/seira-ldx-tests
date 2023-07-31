
'use strict';

const myConsole = require('#commons/myConsole')
const path = require('path')
const _ = require('lodash')
const _classes = [
    require('./Script1')
]

module.exports.scriptTimeout = () => {
    const to = parseInt(process.env.SLDX_PLAYWRIGTH_SCRIPT_TIMEOUT)
    if (isNaN(to)) {
        throw new Error('Unexpected not number process process.env.SLDX_PLAYWRIGTH_SCRIPT_TIMEOUT')
    }
    return to
}

module.exports.runScript = async (className, scriptFilePath, pwPage) => {
    let runError = null
    try {
        const name = path.basename(scriptFilePath)
        myConsole.initLoggerFromModule(name)
        myConsole.superhighlight(`BEGIN RUN ${className}`)
        myConsole.lowlight(`From [${scriptFilePath}]`)
        if (_.isEmpty(process.env.SLDX_RUNNER_EXEC)) {
            myConsole.warning(`\n\nProcess must be launched by the runner\n- npm run artillery.script1 --  --sldxenv=playwright.debug\n- npm run playwright.script1 --  --sldxenv=playwright.debug --sldxpwuser=user4 --debug\n\n`)
            throw new Error(`Process must be launched by the runner`)
        }
        const klass = _classes.find(x => x.name === className)
        if (klass == null) {
            throw new Error(`Script Class [${className}] not found`)
        }
        const script = new klass(scriptFilePath, pwPage)
        await script.run()
    } catch (e) {
        myConsole.error(`Error running ${className}`, e)
        runError = true
        throw e
    } finally {
        myConsole.superhighlight(`END RUN ${runError ? 'KO' : 'OK'} ${className}`)
    }
}