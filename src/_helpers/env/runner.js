
'use strict';
/**
 * Runs a script in a child process
 * Set the environment variables 
 */
const fs = require('fs')
const path = require('path')
const execa = require('execa')
const myConsole = require('#commons/myConsole')
const { pause } = require('#commons/promises')
const { ARGS_PREFIX, readSldxEnv, readProccessArgument } = require('#env/defaultEnvVars')
const initEnvVars = require('#env/initEnvVars')
const appRootDir = require('app-root-dir')
const os = require('os')
const dotenv = require('dotenv')

/**
 * Node uncaughtException
 */
process.on('uncaughtException', function (err) {
    myConsole.error(`process.main.uncaughtException`, err)
    /** Let some time to flush the console */
    setTimeout(() => process.exit(), 500)
})


const _init = (mainScriptPath, additionalEnvVars) => {
    additionalEnvVars ??= []
    /** Just to create a runner.log for the runner */
    myConsole.initLoggerFromModule(mainScriptPath, { logDirPath: './' })
    myConsole.enableConsole()
    dotenv.config({
        /** root .env */
        path: `${appRootDir.get()}/.env`
    })
    /**
     * Program arguments
     * npm run perfs.test1 -- --sldxenv=local
     * --> Reads sldxenv in arguments
     * --> Expected dotEnvFilePath for the scenario: 'sldx.local.dotenv'
     * npm run perfs.test1
     * --> Reads sldxenv .env  (fSLDX_ENV=local)
     * --> Expected dotEnvFilePath for the scenario: 'sldx.local.dotenv'
     */
    const tests_env = readSldxEnv(myConsole)
    const dotEnvFileName = `${ARGS_PREFIX}.${tests_env}.dotenv`
    const dotEnvFilePath = path.resolve(`./${dotEnvFileName}`)
    if (!fs.existsSync(dotEnvFilePath)) {
        throw new Error(`Expected env file path [${dotEnvFilePath}] not found`)
    }
    myConsole.highlight(`Init environment variables\ndotEnvFilePath [${dotEnvFilePath}]`)
    const notEnvVarsArguments = initEnvVars(additionalEnvVars, {
        dotenvpath: dotEnvFilePath
    })
    const _myArgs = readProccessArgument()
    if ((process.argv.length - _myArgs.size) == 2) {
        /**
         * If no script file argument it just means 'display variables'
         * npm run displayEnVariables
         */
        process.exit(0)
        /** END */
    }
    return notEnvVarsArguments
}

/**
 *  
 * @param {*} mainScriptPath    given by caller's __filename 
 * @param {*} additionalEnvVars additional environment variables
 * @param {*} options           command to launch
 */
module.exports = async function (mainScriptPath, additionalEnvVars, options) {
    let runErr = false
    try {
        /**
         * notEnvVarsArguments: arguments tat 
         */
        let notEnvVarsArguments = _init(mainScriptPath, additionalEnvVars)
        const scriptToRunRelativePath = process.argv[2]
        myConsole.superhighlight(`RUNNER: BEGIN - Process: ${process.pid}`)
        options = Object.assign({}, {
            /** 'node', 'artillery', playwright */
            exec: null
        }, options ?? {})
        let exec = options.exec ?? ''
        let childProcessArgs
        let scriptToRunFullPath
        switch (exec) {
            case 'node':
                scriptToRunFullPath = path.resolve(appRootDir.get(), scriptToRunRelativePath)
                childProcessArgs = ['--no-warnings', '--es-module-specifier-resolution=node', '--trace-warnings', scriptToRunFullPath, ...notEnvVarsArguments]
                break
            case 'artillery':
                scriptToRunFullPath = path.resolve(process.env.SLX_ARTILLERY_ROOT_DIR, scriptToRunRelativePath)
                myConsole.lowlight(`\nArtillery config:\n${fs.readFileSync(scriptToRunFullPath, { encoding: "utf8" })}\n`)
                childProcessArgs = ['run', scriptToRunFullPath, ...notEnvVarsArguments]
                break
            case 'playwright':
                scriptToRunFullPath = path.resolve(process.env.SLX_PLAYWRIGHT_ROOT_DIR, scriptToRunRelativePath)
                exec = 'npx'
                /** 
                 * npm run playwright.script1 --  --sldxenv=fdalbo --ui 
                 * minimist gives --ui=true and we want --ui
                 */
                notEnvVarsArguments = notEnvVarsArguments.map((x) => x.startsWith('--ui') ? '--ui' : x)
                childProcessArgs = ['playwright', 'test', scriptToRunRelativePath, ...notEnvVarsArguments]
                break
            default:
                throw new Error(`Unexpected runner command [${options.exec}] Expected[${_expectedCommands.join(',')}]`)
        }
        const command = `${exec} ${childProcessArgs.join(' ')}`
        if (!fs.existsSync(scriptToRunFullPath)) {
            throw new Error(`Command[${command}] - Script file not found\n${scriptToRunFullPath}`)
        }
        myConsole.highlight(`COMMAND: '${command}'`)
        /** RUN SCRIPT -Execute the script in a child process */
        const scriptName = path.basename(scriptToRunFullPath)
        process.env.SLDX_RUNNER_SCRIPT_NAME = scriptName
        /** node, artillery, playwright */
        process.env.SLDX_RUNNER_EXEC = options.exec
        try {
            const modeShell = os.platform() == 'linux'
            //execa.execaSync(process.execPath, childProcessArgs, {
            execa.sync(exec, childProcessArgs, {
                stdio: [process.stdin, process.stdout, process.stderr],
                /** Environment variables are passed to the child process by default */
                env: process.env,
                /** 
                 * Needed on ubuntu to prevent the following error with 'npm run items xxx':
                 * npm run qsPlant.customers Command failed with ENOENT: npm run qsPlant.customers
                 * spawnSync npm run qsPlant.customers ENOENT
                 * Error: Command failed with ENOENT: npm run qsPlant.customers
                 * spawnSync npm run qsPlant.customers ENOENT
                 * at Object.spawnSync (node:internal/child_process:1112:20)
                 * at Object.spawnSync (node:child_process:827:24)
                 * at Module.execaSync (file:///mnt/d/Git/Testing/test-qsfab/node_modules/execa/index.js:173:25)
                 * at module.exports (/mnt/d/Git/Testing/test-qsfab/src/scripts/runner-command.js:22:15)
                 * at async /mnt/d/Git/Testing/test-qsfab/scripts/command-items.js:31:13
                 */
                shell: modeShell
            })
        } catch (e) {
            /** 
             * The original cause thrown by the script is not present (e.cause)
             * --> We need to put a ty{}catch (e) {myConsole.error("ERROR", e)} in the script
             */
            myConsole.error(`Run ${command} ${scriptName} ERROR\n`, e)
            runErr = true
        }
    } catch (e) {
        myConsole.error("RUNNER ERROR", e)
        runErr = true
    } finally {
        myConsole.superhighlight(`RUNNER: END ${runErr ? 'KO' : 'Ok'}\n`)
        await pause(500)
    }
}



