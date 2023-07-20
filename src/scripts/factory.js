
const myConsole = require('#commons/myConsole')
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
    let err = null
    try {
        myConsole.superhighlight(`BEGIN RUN ${className}`)
        myConsole.lowlight(`From [${scriptFilePath}]`)
        const klass = _classes.find(x => x.name === className)
        if (klass == null) {
            throw new Error(`Script Class [${className}] not found`)
        }
        await new klass(scriptFilePath, pwPage).run()
    } catch (e) {
        myConsole.error(`Error running ${className}`, e)
        err = e
        throw e
    } finally {
        myConsole.superhighlight(`END RUN ${err ? 'KO' : 'OK'} ${className}`)
    }
}