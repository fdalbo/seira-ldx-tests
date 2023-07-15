

'use strict';
/**
 * package.json
 *  "scripts": {
 *       "perfs.test1": "node --no-warnings --experimental-specifier-resolution=node runner.js test-perfs-1.yml --sldxenv=fdalbo"
 *  },
 * Command
 *      - npm run perfs.test1 
 *        -> default environment is 'local' file[local.dotenv])
 *      - npm run perfs.test1 -- --sldxenv=myenv
 *        -> forces SLDX_ENV to 'myenv' file[myenv.dotenv])
 * Arguments
 *      - arg[1]        script to launch (runner.js)
 *      - args[2]       artillery yml file to launch (process.env.SLX_ARTILLERY_ROOT_DIR/test-perfs-1.yml)
 *      -- --sldxenv    optional
 */
const path = require('path')
const fs = require('fs')
const { SLDX_ENV_VAR, SLDX_ENV_ARG } = require('#env/defaultEnvVars')
const myConsole = require('#commons/myConsole')
const runner = require('#env/runner')
const appRootDir = require('app-root-dir')
/** dotenv lib */
const dotenv = require('dotenv')
const _ = require('lodash')
const chalk = require('chalk')

/** Just to create a log for the runner */
process.env.SLDX_LOG_DIR = './'
myConsole.initLoggerFromModule(__filename)
myConsole.enableConsole();

/**
 * Program arguments
 * - sldxenv (SLDX_ENV_ARG)
 */
const _argValues = new Map()
for (const argId of [SLDX_ENV_ARG]) {
    let argValue = process.argv.find(x => x.replace(/\s/g, '').includes(`${argId}=`))
    if (argValue && argValue.split('=').length > 1) {
        argValue = argValue.split('=')[1].trim()
        if (argValue) {
            _argValues.set(argId, argValue)
        }
    }
}

/**
 * Init env variables from .env file
 */
dotenv.config()
/*
*  Program additional variables
*/
let _nbSldxArgs = 0
const MYENVVARS = [{
    /** Just to display the variable in the console */
    name: SLDX_ENV_VAR,
    value: '',
    arg: SLDX_ENV_ARG,
    highlight: true
}].map(x => {
    if (x.arg && _argValues.has(x.arg)) {
        // argument overrides defaults and .env value
        x.value = _argValues.get(x.arg)
        myConsole.lowlight(`${x.name}[${x.value}] read from ${x.arg} argument`)
        _nbSldxArgs++
    } else if (process.env[x.name] && process.env[x.name].length !== 0) {
        //.env overrides default value
        x.value = process.env[x.name]
        myConsole.lowlight(`${x.name}[${x.value}] read from .env file`)
    }
    return x
})
const tests_env = MYENVVARS.find(x => x.name === SLDX_ENV_VAR).value
/**
 * SLDX_ENV is mandatory expected from '.env' or 'slxenv' argument
 */
if (_.isEmpty(tests_env)) {
    throw new Error(`Unexpected empty variable ${SLDX_ENV_VAR}`)
}
const dotEnvFileName = `sldx.${tests_env}.dotenv`
const dotEnvFilePath = path.resolve(`./${dotEnvFileName}`)
if (!fs.existsSync(dotEnvFilePath)) {
    throw new Error(`Expected env file path [${dotEnvFilePath}] not found`)
}
myConsole.lowlight(`Expected env file path [${dotEnvFilePath}]`)
/**
 * SLDX_ENV_VAR give the name of the .dotenv file (environment variables for the scenario)
 */
if ((process.argv.length - _nbSldxArgs) == 2) {
    /**
     * If args are [node runner.js] (no script file) it just means 'display variables'
     */
    const initEnvVars = require('#env/initEnvVars')
    initEnvVars(MYENVVARS, {
        dotenvpath: dotEnvFilePath
    })
    /** Display environment */
    const env = {
        perfsEnv: tests_env,
        perfsDotEnvFile: path.relative(appRootDir.get(), dotEnvFilePath),
        serverUrl: process.env.SLDX_PROXY_HOST,
        adminUser: process.env.SLDX_ADMIN_USER,
        adminword: process.env.SLDX_ADMIN_PASSWORD,

    }
    const text = ['\n\nENVIRONMENT:']
    for (const [k, v] of Object.entries(env)) {
        text.push(chalk.green(`- ${k.padEnd(15)}: ${v}`))
    }
    text.push('')
    myConsole.superhighlight(text.join('\n'))
    process.exit(0)
    /** END */
}

const scriptRelPath = process.argv[2]
myConsole.lowlight(`scriptRelPath [${scriptRelPath}]`)
const runnerOptions = {
    dotenvpath: dotEnvFilePath,
    command: 'artillery'
}
switch (path.extname(scriptRelPath)){
    case '.js':
        runnerOptions.command = 'node'
    break
    case '.yml':
        runnerOptions.command = 'artillery'
    break
    case '.yml':
        throw new Error (`Unexpected srcipt extension Excpected [.js for node or .yml for atillery]`)
    break

}
runner(scriptRelPath, MYENVVARS, runnerOptions)


