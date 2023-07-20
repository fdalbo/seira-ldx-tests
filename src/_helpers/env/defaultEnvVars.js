'use strict';

const appRootDir = require('app-root-dir')
const _ = require('lodash')
const _ARGS_PREFIX = 'sldx'
module.exports.ARGS_PREFIX = _ARGS_PREFIX
const _SLDX_ENV_VAR = 'SLDX_ENV'
module.exports.SLDX_ENV_VAR = _SLDX_ENV_VAR
/** -- --sldxenv=xxx */
const _SLDX_ENV_ARG = `${_ARGS_PREFIX}env`
const DEFAULT_VARS = [
    /** .env file id ./local.dotenv by default */
    {
        name: _SLDX_ENV_VAR,
        value: 'local',
        highlight: true,
        arg: _SLDX_ENV_ARG
    }, {
        /** false doesn't trace http Req/Resp and myConsole.trace() in the console (only in log file)*/
        name: 'SLDX_TRACE_CONSOLE',
        allowEmpty: true,
        value: 'true',
        type: 'boolean'
    }, {
        name: 'SLDX_TRACE_HTTP_REQUESTS',
        allowEmpty: true,
        value: 'true',
        type: 'boolean'
    }, {
        name: 'SLDX_TRACE_HTTP_RESPONSES',
        allowEmpty: true,
        value: 'true',
        type: 'boolean'
    }, {
        name: 'SLDX_TRACE_HTTP_RESPONSE_BODY',
        allowEmpty: true,
        value: 'true',
        type: 'boolean'
    }, {
        name: 'SLDX_TRACE_HTTP_RESPONSE_LENGTH',
        allowEmpty: true,
        type: 'numeric',
        value: '2000'
    }, {
        name: 'SLDX_LOG_LEVEL',
        value: 'info',
        // See https://www.npmjs.com/package/winston#logging
        values: ['none', 'error', 'warn', 'info', 'verbose', 'debug']
    }, {
        name: 'SLDX_LOG_LEVEL_DISPLAY',
        allowEmpty: true,
        value: 'false',
        type: 'boolean'
    }, {
        name: 'SLDX_LOG_DIR_REMOVE_FILES',
        allowEmpty: true,
        value: 'true',
        type: 'boolean'
    }, {
        name: 'SLDX_APP_ROOTDIR',
        dirPath: true,
        value: appRootDir.get()
    }, {
        name: 'SLDX_WORKSPACE_ROOTDIR',
        dirPath: true,
        /** no workspace */
        value: appRootDir.get()
    }, {
        name: 'SLDX_LOG_DIR_PATH',
        dirPath: true,
        highlight: true,
        arg: `${_ARGS_PREFIX}LogDir`,
        /** /$host -> we create a SLDX_PROXY_HOST's hostname under /SLDX_LOG_DIR_PATH */
        value: `./_logs/$host`
    }, {
        name: 'SLDX_WORK_DIR_PATH',
        dirPath: true,
        arg: `${_ARGS_PREFIX}WorkDir`,
        /** /$host -> we create a SLDX_PROXY_HOST's hostname under /SLDX_WORK_DIR_PATH */
        value: './_workdir/$host'
    }, {
        name: 'SLDX_MONGO_HOST',
        value: '127.0.0.1'
    }, {
        name: 'SLDX_MONGO_PORT',
        value: '27017'
    }, {
        name: 'SLDX_PROXY_PROTOCOL',
        arg: `${_ARGS_PREFIX}ProxyProtocol`,
        value: ''
    }, {
        name: 'SLDX_PROXY_HOST',
        arg: `${_ARGS_PREFIX}ProxyHost`,
        value: ''
    }, {
        name: 'SLDX_PROXY_PORT',
        arg: `${_ARGS_PREFIX}ProxyPort`,
        value: '',
        allowEmpty: true,
        type: 'numeric'
    }, {
        name: 'SLDX_PROXY_URL',
        allowEmpty: true,
        source: 'calculated',
        /* calculated */
        value: '',
        highlight: true
    }, {
        name: 'SLDX_ADMIN_USER',
        arg: `${_ARGS_PREFIX}AdmipUser`,
        highlight: true
    }, {
        name: 'SLDX_ADMIN_PASSWORD',
        arg: `${_ARGS_PREFIX}AdmipPwd`,
        highlight: true
    }, {
        name: 'SLDX_USER_FIRST_IDX',
        type: 'numeric',
        value: '0'
    }, {
        name: 'SLDX_USER_PREFIX',
        value: 'user'
    }, {
        name: 'SLDX_USER_PWD',
        value: 'seira'
    }, {
        name: 'SLX_ARTILLERY_ROOT_DIR',
        highlight: true,
        dirPath: true,
        value: './artillery',
    }, {
        name: 'SLX_ARTILLERY_REPORT_SUFFIX',
        allowEmpty: true,
        /**
         * allow empty , string, $date, $day
         * $date: 'yyyy-mm-dd-HH-MM-ss'
         * $day:  'yyyy-mm-dd'
         */
        value: '$day',
    }, {
        name: 'SLX_PLAYWRIGHT_ROOT_DIR',
        dirPath: true,
        highlight: true,
        value: './playwright',
    },
    /* calculated by runner node, playwright, artillery*/
    {
        name: 'SLDX_RUNNER_EXEC',
        source: 'calculated',
        allowEmpty: true,
        value: ''
    }, {
        name: 'SLDX_RUNNER_SCRIPT_NAME',
        source: 'calculated',
        allowEmpty: true,
        value: ''
    }, {
        name: 'SLDX_PLAYWRIGHT_USER',
        source: 'calculated',
        allowEmpty: true,
        arg: `${_ARGS_PREFIX}pwuser`,
        value: ''
    }, {
        name: 'SLDX_PLAYWRIGTH_UI',
        source: 'calculated',
        allowEmpty: true,
        value: ''
    }, {
        name: 'SLDX_PLAYWRIGTH_DEBUG',
        source: 'calculated',
        allowEmpty: true,
        value: ''
    }, {
        name: 'SLDX_PLAYWRIGTH_SCRIPT_TIMEOUT',
        type: 'numeric',
        value: new Number(10 * 60 * 60 * 1000).toString()
    }
]

/**
 * Apends MyEnvVars to DEFAULT_VARS
 * @param {[{vars}]} myEnvVars 
 * @returns the new vars array
 */
module.exports.appendToDefaultVars = function (myEnvVars) {
    myEnvVars ??= []
    for (const v in myEnvVars) {
        if (!_.isPlainObject(v) || _.isEmpty(v.name)) {
            throw new Error(`Bad format for additional variable. {name: 'VAR_NAME'} expected\n${JSON.stringify(myEnvVars, null, 2)}`)
        }
    }
    const result = DEFAULT_VARS.concat(myEnvVars).map(x => {
        const res = Object.assign({
            arg: null,
            dirPath: false,
            value: '',
            allowEmpty: false,
            type: 'string',
            highlight: false
        }, x ?? {})
        res.value = (res.value ?? '').toString()
        /** 
         * where the variable value comes from - default, .env, --argument..
         * empty source means default value 
         */
        res.source ??= 'default'
        return res
    })
    // filter [,,] mistakes
    return result.filter(x => {
        x.name = x.name.replaceAll(' ', '')
        if (x == null) {
            return false
        }
        if (x.values && x.values.indexOf(x.value) < 0) {
            console.warn(`!! Environment variable ${x.name} - Unexpected value ${x.value}\Expected values : '${x.values.join(',')}'`)
        }
        return true
    })
}

/** 
 * @return an array {name: value} for default env vars
 */
module.exports.getEnvValues = function () {
    const res = []
    for (const v of DEFAULT_VARS) {
        if (v) {
            res.push({ name: v.name, value: process.env[v.name] })
        } else {
            console.warn(`defaultEnvVars - unexpected null DEFAULT_VARS value (check double comma ', ,' in DEFAULT_VARS array)`)
        }
    }
    return res
}

/**
 * Program arguments
 * - npm run perfs.test1 -- --sldxenv=local
 * Read arguments that start with --${ARGS_PREFIX}
 * @returns  a map with argid/argValue
 */
module.exports.readProccessArgument = function () {
    const argValues = new Map()
    const myArgsPrefix = `--${_ARGS_PREFIX}`
    for (let arg of process.argv) {
        arg = arg.replace(/\s/g, '')
        if (!arg.startsWith(myArgsPrefix)) {
            continue
        }
        arg = arg.split('--')[1].split('=')
        argValues.set(arg[0], arg[1] ?? '')
    }
    return argValues
}
module.exports.readSldxEnv = function (myConsole) {
    process.env[_SLDX_ENV_VAR] ??= ''
    const myArgs = module.exports.readProccessArgument()
    if (myArgs.has(_SLDX_ENV_ARG)) {
        process.env[_SLDX_ENV_VAR] = myArgs.get(_SLDX_ENV_ARG)
        myConsole.highlight(`${_SLDX_ENV_VAR}='${process.env[_SLDX_ENV_VAR]}' read from --${_SLDX_ENV_ARG} argument`)
    } else if (process.env[_SLDX_ENV_VAR].length > 0) {
        myConsole.highlight(`${_SLDX_ENV_VAR}='${process.env[_SLDX_ENV_VAR]}' read from .env file`)
    }
    if (process.env[_SLDX_ENV_VAR].trim().length == 0) {
        throw new Error(`Unexpected empty variable ${_SLDX_ENV_VAR}`)
    }
    return process.env[_SLDX_ENV_VAR]
}
