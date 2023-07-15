
'use strict';
/**
 * Runs a script in a child process
 * Set the environment variables 
 */
import fs from 'fs'
import path from 'path'
import { execaSync } from 'execa'
import myConsole from '#commons/myConsole'
import { pause } from '#commons/promises'
import initEnvVars from '#env/initEnvVars'
import appRootDir from 'app-root-dir'
import os from 'os'

/**
 * Node uncaughtException
 */
process.on('uncaughtException', function (err) {
    myConsole.error(`process.main.uncaughtException`, err)
    /** Let some time to flush the console */
    setTimeout(() => process.exit(), 500)
})

export default async function (scriptRelativePath, additionalEnvVars, options) {
    additionalEnvVars ??= []
    try {
        const scriptFullPath = path.resolve(appRootDir.get(), scriptRelativePath)

        myConsole.superhighlight(`RUNNER: BEGIN - Process: ${process.pid}`)

        myConsole.lowlight(`Script file path\n- ${scriptFullPath}\nprocess.execPath:\n- ${process.execPath}`)

        options = Object.assign({}, {
            dotenvpath: null
        }, options ?? {})

        if (!fs.existsSync(scriptFullPath)) {
            throw new Error(`Script file found\n${scriptFullPath}`)
        }

        myConsole.highlight(`Init environment variables`)
        /** 
         * initEnvVars:
         * -> Initializes process.env with if arguments startoing with --qsenvxxx=yyy 
         * -> Returns the arguments that are not env variables
         * -> These args are sent to the child process
         * childProcessArgs:
         * -> Arguments used to launch the process
         * -> Regular args + the ones returned by initEnvVars
         * EG: npm run quantities-scenario1 -w apps/qsfab-perfs  -- --nbworkers=2
         * --> nbWorkers if available in the child process through process.args
         * Options:
         * --es-module-specifier-resolution=node: allows to import je files without .js extension
         * --> import QuantitiesWorkersManager from './src/QuantitiesWorkersManager' (no .js needed)
         */
        const runnerVars = initEnvVars(additionalEnvVars, options)
       // let childProcessArgs = ['--no-warnings', '--es-module-specifier-resolution=node', '--trace-warnings', scriptFullPath, ...runnerVars]
        let childProcessArgs = [scriptFullPath]
        /** RUN SCRIPT -Execute the script in a child process */
        const scriptName = path.basename(scriptFullPath, '.js')
        let runErr = false
        process.env.SLDX_RUNNER_SCRIPT_NAME = scriptName
        try {
            myConsole.superhighlight(`Run script ${scriptName} BEGIN`)
            const modeShell = os.platform() == 'linux'
            //execaSync(process.execPath, childProcessArgs, {
            execaSync('artillery run', childProcessArgs, {
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
            myConsole.error(`Run script ${scriptName} ERROR\n`, e)
            runErr = true
        } finally {
            myConsole.superhighlight(`Run script ${scriptName} END ${runErr ? 'KO' : 'Ok'}\n`)
        }
    } catch (e) {
        myConsole.error("RUNNER ERROR", e)
    } finally {
        myConsole.superhighlight('RUNNER: END\n')
        await pause(500)
    }
}



