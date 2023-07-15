

'use strict';

import isNumber from 'is-number'
import path from 'path'
import dotenv from 'dotenv'
import parseArguments from 'minimist'
import myConsole from '#commons/myConsole'
import appRootDir from 'app-root-dir'
import url from 'url'
import fs from 'fs-extra'
import dateFormat from "dateformat"
import chalk from 'chalk'
/** absolute path to avoid .js extension*/
import { append as appendToDefaultVars, ARGS_PREFIX } from '#env/defaultEnvVars'

const _traceVariables = (vars) => {
    const traceEnvs = []
    for (const envVar of vars) {
        let text
        if (envVar.highlight === true) {
            text = `${chalk.cyan(envVar.name)}=${chalk.cyan(envVar.value)}`
        } else {
            text = `${envVar.name}=${envVar.value}`
        }
        traceEnvs.push(`- ${text} (${envVar.source})`)
    }
    myConsole.lowlight(`Environment variables:\n${traceEnvs.join('\n')}\n`)
}

const _resolveRootPath = (filepath) => {
    if (!path.isAbsolute(filepath)) {
        /** Relative path from project's root path */
        return path.resolve(appRootDir.get(), filepath)
    }
    return filepath
}

/**
 * Overrides environmentVariables values with the ones comming from dotenv file
 * @param {sting} optionsPath 
 * --> dotenv file path comes from runner options.dotenvpath parameter
 * @param {sting} argsPath
 * --> dotenv file path comes from sript --dotenvpath argument 
 * @param {array} environmentVariables 
 */
const _initVarsFromDotenv = (optionsPath, argsPath, environmentVariables) => {
    let dotenvpath = null
    let dotenvsource = null
    dotenvpath = optionsPath
    let dotenvExpected = false
    if (dotenvpath) {
        /** A/ .env path given by runner options.dotenvpath*/
        dotenvpath = _resolveRootPath(optionsPath)
        dotenvsource = 'runner options.dotenvpath parameter'
        dotenvExpected = true
    } else {
        dotenvpath = argsPath
        if (dotenvpath) {
            /** B/ .env path given by --dotenvpath argument*/
            dotenvpath = _resolveRootPath(dotenvpath)
            dotenvsource = 'script --dotenvpath argument'
            dotenvExpected = true
        } else {
            /** C/ regular .env path that the root of the project */
            dotenvpath = path.resolve(process.cwd(), '.env')
            dotenvsource = 'regular .env path'
        }
    }
    /** dotenv file needed - override  */
    myConsole.highlight(`dotenv file path comes from '${dotenvsource}'\n-> '${dotenvpath}'`)
    if (fs.existsSync(dotenvpath)) {
        /** Load  dotenv.config and overrides the process.env variables*/
        const dotenvConfig = (dotenv.config({ path: dotenvpath }) ?? {}).parsed ?? {}
        const dotenvEntries = Object.entries(dotenvConfig)
        if (dotenvEntries.length > 0) {
            for (const [key, value] of dotenvEntries) {
                const strValue = (value ?? '').toString()
                /** .env file contains name=value  */
                let envVar = environmentVariables.find(x => x.name === key)
                if (envVar == null) {
                    envVar = {
                        name: key
                    }
                    environmentVariables.push(envVar)
                }
                envVar.value = strValue
                envVar.source = 'dotenv'
            }
        } else {
            myConsole.lowlight(`dotenv file is empty`)
        }
    } else if (dotenvExpected === true) {
        myConsole.error(`dotenv file not found from '${dotenvsource}'\n- '${dotenvpath}'`)
        process.exit()
    } else {
        myConsole.lowlight('dot env file not found')
    }
}

/**
 * Initializes procress.env variables with the given additionalEnvVars JSON data
 * @param {[JSON]} additionalEnvVars = [{
 *      name: process.env.var.name,
 *      value: process.env.var.value,
 *      arg: node argument's name that starts with ARGS_PREFIX
 *      dirPath: true if it's a dir path (default false)
 *      allowEmpty: true if it must not be empty  (default false)
 *      calculated: true if it"s calculated programatically  (default false)
 *  }]
 * @param {JSON} options provided by runner.js
 * {
 *      dotenvpath: null forces the .env file path
 * } 
 * @return {[string]}
 * --> Array that contains the aruments that are not environment variables
 * --> These arguments are passed to the chile process (see runner.js)
 */
export default function initEnvVars(additionalEnvVars, options) {
    options ??= {}
    additionalEnvVars ??= []
    /** 
     * DEFAULT ENV-VARS READ FROM defaultEnvVars
     */
    const environmentVariables = appendToDefaultVars(additionalEnvVars)
    /** 
    * Removes 2 first arguments
    * process arguments: (1)runner.js (2)scriptFile (>2)--qsenvxx=value
    * Returns {  argkey: argvalue }
    */
    const minimistOpts = {
        /** 
         * --qsenvcompany processed as a string: '01' -> '01' and not 1 
         * See https://www.npmjs.com/package/minimist
         */
        string: environmentVariables.filter(x => x.type === 'string' && x.arg).map(x => x.arg),
        boolean: environmentVariables.filter(x => x.type === 'boolean' && x.arg).map(x => x.arg)
    }
    //console.log(JSON.stringify(minimistOpts, null, 2))
    const parsedArguments = parseArguments(process.argv.slice(2), minimistOpts)
    /** OVERRIDES ENV-VARS WITH DOTENV FILE IF ANY */
    _initVarsFromDotenv(options.dotenvpath, parsedArguments['dotenvpath'], environmentVariables)
    const notEnvVarsArguments = []
    /** OVERRIDES ENV-VARS WITH PROCESS ARGUMENTS IF ANY  */
    for (const [key, value] of Object.entries(parsedArguments)) {
        if (!key.toLowerCase().startsWith(ARGS_PREFIX)) {
            /** not an environment variable for us - we store it in order to sent it to the child process*/
            notEnvVarsArguments.push(`--${key}=${value}`)
            continue
        }
        const strValue = (value ?? '').toString()
        if (strValue.length > 0) {
            let envVar = environmentVariables.find(x => x.arg === key)
            if (envVar == null) {
                /** adds env variable qsenvtoto=xxx from --qsenvtoto=xxx argument  */
                envVar = {
                    name: key
                }
                environmentVariables.push(envVar)
            }
            envVar.value = strValue
            envVar.source = `--${key}`
        }
    }

    /** VALIDATES / CALCULATES VALUES */
    const validationErrs = []
    for (const envVar of environmentVariables) {
        const value = envVar.value.trim()
        if (envVar.allowEmpty === true && value.length == 0) {
            // OK
        } else if (value.length == 0 && envVar.allowEmpty !== true) {
            validationErrs.push(`${envVar.name}: Unexpected empty value`)
        } else if (envVar.type === 'numeric' && !isNumber(value)) {
            validationErrs.push(`${envVar.name}: '${value}' is not a numeric value`)
        }
    }
    if (validationErrs.length > 0) {
        throw new Error(`Environment variables validation failed:\n-${validationErrs.join('\n-')}`)
    }

    /** 
     * 1/ RESOLVES FOLDERS PATH
     * - !! Resolves 
     * -> $host
     * -> $day
     * -> $date
     * -> $VAR_NAME Eg: $SLDX_ENV 
     * - done once other environment variable values have been calculated
     * 2/ ADDS PROCESS.ENV VARIABLES FROM environmentVariable
     */
    const removeLogDirFiles = environmentVariables.find(x => x.name == 'SLDX_LOG_DIR_REMOVE_FILES')?.value == 'true'
    const SLDX_PROXY_HOST = environmentVariables.find(x => x.name == 'SLDX_PROXY_HOST')?.value
    const urlPath = SLDX_PROXY_HOST ? new URL(SLDX_PROXY_HOST).hostname.replace(/([^a-zA-Z0-9])/g, '-') : 'nohost'
    const datePath = dateFormat(new Date(), 'yyyy-mm-dd-HH-MM-ss')
    const dayPath = dateFormat(new Date(), 'yyyy-mm-dd')
    for (const envVar of environmentVariables) {
        if (envVar.dirPath === true && envVar.value.length !== 0) {
            /** THIS IS A FOLDER PATH */
            envVar.value = envVar.value.split('/').map(x => {
                if (x && x.startsWith('$')) {
                    const envVarName = x.slice(1)
                    const foundVar = environmentVariables.find(x => x.name === envVarName)
                    if (foundVar) {
                        /** This is the value of an environent variable */
                        return foundVar.value
                    }
                    switch (x) {
                        case '$date':
                            x = datePath
                            break
                        case '$day':
                            x = dayPath
                            break
                        case '$host':
                            x = urlPath
                            break
                    }
                }
                return x
            }).join('/')
            const folderPath = _resolveRootPath(envVar.value)
            /** !!! LOGS ONlY - To not clear other directories like  SLDX_APP_ROOTDIR*/
            console.log('removeLogDirFiles', removeLogDirFiles, envVar.name)
            if (envVar.name === 'SLDX_LOG_DIR' && removeLogDirFiles === true) {
                console.log('folderPath', folderPath)
                fs.emptyDirSync(folderPath)
            } else {
                fs.ensureDirSync(folderPath)
            }
            envVar.value = folderPath
        }
        /** UPDATE process.env */
        process.env[envVar.name] = envVar.value
    }
    /** ADDS PROCESS.ENV VARIABLES FROM environmentVariables */

    environmentVariables.sort((a, b) => a.name.localeCompare(b.name))

    _traceVariables(environmentVariables)

    return notEnvVarsArguments
}
