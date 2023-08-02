
'use strict';
/**
 * Runs a script in a child process
 * Set the environment variables 
 */
const fs = require('fs-extra')
const path = require('path')
const execa = require('execa')
const appRootDir = require('app-root-dir')
const os = require('os')
const dotenv = require('dotenv')
const myConsole = require('#commons/myConsole')
const _ = require('lodash')
const dateFormat = require('dateformat')
const { format: prettyFormat } = require('pretty-format')
const { pause } = require('#commons/promises')
const { ARGS_PREFIX, readSldxEnv, readProccessArgument } = require('#env/defaultEnvVars')
const { traceVariables, initEnvVars } = require('#env/initEnvVars')
const YAML = require('yaml')

/**
 * Node uncaughtException
 */
process.on('uncaughtException', function (err) {
    myConsole.error(`process.main.uncaughtException`, err)
    /** Let some time to flush the console */
    setTimeout(() => process.exit(), 500)
})

const _replaceDateTags = (string) => {
    string ??= ''
    const date = dateFormat(new Date(), 'yyyy-mm-dd-HH-MM-ss')
    const day = dateFormat(new Date(), 'yyyy-mm-dd')
    return string.replaceAll('$date', date).replaceAll('$day', day)
}

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
    let dotEnvFilePath = path.resolve(`./${dotEnvFileName}`)
    if (!fs.existsSync(dotEnvFilePath)) {
        myConsole.warning(`\n\nExpected dotenv file path [${dotEnvFilePath}] not found\nTakes /.env\n`)
        dotEnvFilePath = null
    } else {
        myConsole.highlight(`Init environment variables\ndotEnvFilePath [${dotEnvFilePath}]`)
    }
    const { notEnvVarsArguments, environmentVariables } = initEnvVars(additionalEnvVars, {
        dotenvpath: dotEnvFilePath,
        /** trace just before execa() */
        traceVariables: false
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
    return { notEnvVarsArguments, environmentVariables }
}

const _setRunnerEnvVar = (environmentVariables, name, value) => {
    const envVar = environmentVariables.find(x => x.name === name)
    if (!envVar) {
        myConsole.warning(`Runer env variable not found [${name}][${value}]`)
        return
    }
    envVar.value = value ?? ''
    envVar.source = 'runner'
    process.env[name] = value
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
        let { notEnvVarsArguments, environmentVariables } = _init(mainScriptPath, additionalEnvVars)
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
                const reportDir = path.resolve(appRootDir.get(), 'artillery-report')
                fs.ensureDir(reportDir)
                const reportName = [path.basename(scriptToRunRelativePath, '.yml'), _replaceDateTags(process.env.SLDX_ARTILLERY_REPORT_SUFFIX ?? '')].filter(x => x.length != 0)
                const reportPath = path.resolve(reportDir, `${reportName.join('-')}.json`)
                myConsole.highlight(`Report [${reportPath}]`)
                fs.removeSync(reportPath)
                scriptToRunFullPath = path.resolve(process.env.SLDX_ARTILLERY_ROOT_DIR, scriptToRunRelativePath)
                childProcessArgs = ['run', '--output', reportPath, scriptToRunFullPath, ...notEnvVarsArguments]
                break
            case 'playwright':
                scriptToRunFullPath = path.resolve(process.env.SLDX_PLAYWRIGHT_ROOT_DIR, scriptToRunRelativePath)
                exec = 'npx'
                /** 
                 * npm run playwright.script1 --  --sldxenv=fdalbo --ui 
                 * minimist gives --ui=true and we want --ui idem for --debug
                 */
                notEnvVarsArguments = notEnvVarsArguments.map((x) => x.startsWith('--') ? x.split('=')[0] : x)
                _setRunnerEnvVar(environmentVariables, 'SLDX_PLAYWRIGTH_UI', `${notEnvVarsArguments.includes('--ui')}`)
                _setRunnerEnvVar(environmentVariables, 'SLDX_PLAYWRIGTH_DEBUG', `${notEnvVarsArguments.includes('--debug')}`)
                childProcessArgs = ['playwright', 'test', scriptToRunRelativePath, ...notEnvVarsArguments]
                break
            default:
                throw new Error(`Unexpected runner command [${options.exec}] Expected[${_expectedCommands.join(',')}]`)
        }
        let command = `${exec} ${childProcessArgs.join(' ')}`
        if (!fs.existsSync(scriptToRunFullPath)) {
            throw new Error(`Command[${command}] - Script file not found\n${scriptToRunFullPath}`)
        }
        if (exec === 'artillery') {
            const yamlConfig = fs.readFileSync(scriptToRunFullPath, { encoding: "utf8" })
            let parsedConfig = null
            try {
                parsedConfig = YAML.parse(yamlConfig)
            } catch (e) {
                throw new Error(`[artillery] Error parsing YAML file [${scriptToRunFullPath}]`, {
                    cause: e
                })
            }
            myConsole.lowlight(`\nArtillery config:\n${JSON.stringify(parsedConfig, null, 2)}\n`)
            const phases = parsedConfig?.config?.phases ?? [{
                maxVusers: 1,
                arrivalRate: 1
            }]
            if (phases.length > 1) {
                throw new Error(`[artillery] zero or one phase expected got[${phases.length}] file [${scriptToRunFullPath}]`)
            }
            const maxVusers = phases[0].maxVusers ?? 1
            const arrivalRate = phases[0].arrivalRate ?? 1
            if (maxVusers != arrivalRate) {
                throw new Error(`[artillery] YAML config error - Expected maxVusers[${maxVusers}] equals to  arrivalRate[${arrivalRate}]\nFile[${scriptToRunFullPath}]`)
            }
            _setRunnerEnvVar(environmentVariables, 'SLDX_ARTILLERY_NB_VUSERS', maxVusers)
            /** 
             * We need to add the number of workers
             * Currently we can launch one script per worker (artillery laucnhes multiple scipts per worker
             */
            process.env.WORKERS = maxVusers
        }
        myConsole.highlight(`COMMAND: '${command}'`)
        /** RUN SCRIPT - Execute the script in a child process */
        const scriptName = path.basename(scriptToRunFullPath)
        _setRunnerEnvVar(environmentVariables, 'SLDX_RUNNER_SCRIPT_NAME', scriptName)
        /** node, artillery, playwright */
        _setRunnerEnvVar(environmentVariables, 'SLDX_RUNNER_EXEC', options.exec)
        try {
            /** ALl variables befroe running the command */
            traceVariables(environmentVariables)
            const modeShell = os.platform() == 'linux'
            const result = await execa(exec, childProcessArgs, {
                /**
                 * No error on ctrl C
                 * try catch must be done in scriptToRunFullPath
                 */
                reject: false,
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
            if (result.exitCode != 0) {
                myConsole.superhighlight(`Command exited with code [${result.exitCode}]`)
                process.exit(result.exitCode)
            }
        } catch (e) {
            console.log('exception', prettyFormat(e))
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



