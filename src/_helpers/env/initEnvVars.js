

'use strict';

const isNumber = require('is-number')
const path = require('path')
const dotenv = require('dotenv')
const parseArguments = require('minimist')
const myConsole = require('#commons/myConsole')
const appRootDir = require('app-root-dir')
const fs = require('fs-extra')
const dateFormat = require('dateformat')
const chalk = require('chalk')
const assert = require('assert')
const _ = require('lodash')

/** absolute path to avoid .js extension*/
const { appendToDefaultVars, ARGS_PREFIX } = require('#env/defaultEnvVars')

module.exports.traceVariables = (vars) => {
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
 * --> dotenv file path 
 * @param {array} dotenvpath 
 */
const _initVarsFromDotenv = (dotenvpath, environmentVariables) => {
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
module.exports.initEnvVars = (additionalEnvVars, options) => {
    options = Object.assign({
        dotenvpath: null,
        traceVariables: true
    }, options ?? {})
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
    /** OVERRIDES ENV-VARS WITH DOTENV FILE IF ANY */
    const parsedArguments = parseArguments(process.argv.slice(2), minimistOpts)
    let dotenvpath, dotenvsource, dotenvExpected = false
    if (options.dotenvpath) {
        /** A/ .env path given by runner options.dotenvpath*/
        dotenvpath = _resolveRootPath(options.dotenvpath)
        dotenvsource = 'runner options.dotenvpath parameter'
        dotenvExpected = true
    } else {
        dotenvpath = parsedArguments['dotenvpath']
        if (dotenvpath) {
            /** B/ .env path given by --dotenvpath argument*/
            dotenvpath = _resolveRootPath(dotenvpath)
            dotenvsource = 'script --dotenvpath argument'
            dotenvExpected = true
        } else {
            /** regular .env store at the root of the project */
            dotenvpath = path.resolve(process.cwd(), '.env')
            dotenvsource = 'regular .env path'
        }
    }
    /** dotenv file needed - override  */
    if (fs.existsSync(dotenvpath)) {
        _initVarsFromDotenv(dotenvpath, environmentVariables)
    } else if (dotenvExpected === true) {
        myConsole.error(`dotenv file not found from '${dotenvsource}'\n- '${dotenvpath}'`)
        process.exit()
    } else {
        myConsole.lowlight('dot env file not found')
    }
    const notEnvVarsArguments = []
    /** OVERRIDES ENV-VARS WITH PROCESS ARGUMENTS IF ANY  */
    for (const [key, value] of Object.entries(parsedArguments)) {
        if (key == '_') {
            continue
        }
        if (!key.toLowerCase().includes(ARGS_PREFIX)) {
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
    const urlPath = environmentVariables.find(x => x.name == 'SLDX_PROXY_HOST')?.value
    assert(!_.isEmpty(urlPath), 'Empty SLDX_PROXY_HOST variable')
    const datePath = dateFormat(new Date(), 'yyyy-mm-dd-HH-MM-ss')
    const dayPath = dateFormat(new Date(), 'yyyy-mm-dd')
    let logDirPath = null
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
            if (envVar.name === 'SLDX_LOG_DIR_PATH' && removeLogDirFiles === true) {
                fs.emptyDirSync(folderPath)
                logDirPath = folderPath
            } else {
                fs.ensureDirSync(folderPath)
            }
            envVar.value = folderPath
        }
    }
    /** sort for display */
    environmentVariables.sort((a, b) => a.name.localeCompare(b.name))
    /** Update  process.env */
    for (const envVar of environmentVariables) {
        /** UPDATE process.env */
        process.env[envVar.name] = envVar.value ?? ''
    }
    /** calculated variables */
    const calculated =[]
    
    const proxyUrl = environmentVariables.find(x => x.name == 'SLDX_PROXY_URL')
    proxyUrl.value = `${process.env.SLDX_PROTOCOL}://${process.env.SLDX_PROXY_HOST}${process.env.SLDX_PROXY_PORT ? `:${process.env.SLDX_PROXY_PORT}` : ''}`
    calculated.push(proxyUrl)

    const ssoUrl = environmentVariables.find(x => x.name == 'SLDX_SSO_URL')
    ssoUrl.value = `${process.env.SLDX_PROTOCOL}://${process.env.SLDX_SSO_HOST}${process.env.SLDX_SSO_PORT ? `:${process.env.SLDX_SSO_PORT}` : ''}`
    calculated.push(ssoUrl)
   
    const mongoUrl = environmentVariables.find(x => x.name == 'SLDX_MONGO_URL')
    mongoUrl.value = `mongodb://${process.env.SLDX_MONGO_HOST}:${process.env.SLDX_MONGO_PORT}`
    calculated.push(mongoUrl)

    const screenshotsPathVar = environmentVariables.find(x => x.name == 'SLDX_SCREENSHOTS_DIR_PATH')
    if (logDirPath && screenshotsPathVar) {
        screenshotsPathVar.value = path.resolve(logDirPath, 'screenshots')
        fs.ensureDirSync(screenshotsPathVar.value) 
        calculated.push(screenshotsPathVar)
    }
    const metricPathVar = environmentVariables.find(x => x.name == 'SLDX_METRICS_DIR_PATH')
    if (logDirPath && metricPathVar) {
        metricPathVar.value = path.resolve(logDirPath, 'metrics')
        fs.ensureDirSync(metricPathVar.value)
        calculated.push(metricPathVar)
    }

    /** Update  process.env */
    calculated.forEach(v => process.env[v.name] = v.value ?? '')

    if (options.traceVariables === true) {
        module.exports.traceVariables(environmentVariables)
    }
    return { environmentVariables, notEnvVarsArguments }
}
