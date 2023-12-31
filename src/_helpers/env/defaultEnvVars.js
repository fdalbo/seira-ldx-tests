'use strict';

const appRootDir = require('app-root-dir')
const myConsole = require('#commons/myConsole')
const _ = require('lodash')
const _ARGS_PREFIX = 'sldx'
module.exports.ARGS_PREFIX = _ARGS_PREFIX
const _SLDX_ENV_VAR = 'SLDX_ENV'
module.exports.SLDX_ENV_VAR = _SLDX_ENV_VAR
/** -- --sldxenv=xxx */
const _SLDX_ENV_ARG = `${_ARGS_PREFIX}env`
const DEFAULT_VARS = [
    {
        name: _SLDX_ENV_VAR,
        value: 'default',
        highlight: true,
        arg: _SLDX_ENV_ARG
    }, {
        /** false doesn't trace http Req/Resp and myConsole.trace() in the console (only in log file)*/
        name: 'SLDX_CONSOLE_TRACE',
        allowEmpty: true,
        value: 'true',
        type: 'boolean'
    }, {
        /** Worker 1 prefix=W0001 */
        name: 'SLDX_CONSOLE_THREAD_NBDIGITS',
        allowEmpty: true,
        value: '3',
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
    },{
        name: 'SLDX_TRACE_HTTP_LENGTH',
        allowEmpty: true,
        type: 'numeric',
        value: '2000'
    }, {
        name: 'SLDX_LOG_LEVEL',
        value: 'debug',
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
        value: `./_logs/$host/$day`
    }, {
        /** calculated  SLDX_LOG_DIR_PATH/screenshots */
        name: 'SLDX_SCREENSHOTS_DIR_PATH',
        allowEmpty: true,
        highlight: true,
        value: ''
    }, {
        /** calculated  SLDX_LOG_DIR_PATH/screenshots */
        name: 'SLDX_METRICS_DIR_PATH',
        allowEmpty: true,
        highlight: true,
        value: ''
    }, {
        name: 'SLDX_WORK_DIR_PATH',
        dirPath: true,
        arg: `${_ARGS_PREFIX}WorkDir`,
        /** /$host -> we create a SLDX_PROXY_HOST's hostname under /SLDX_WORK_DIR_PATH */
        value: './_workdir/$host/$day'
    }, {
        name: 'SLDX_MONGO_HOST',
        value: '127.0.0.1'
    }, {
        name: 'SLDX_MONGO_PORT',
        value: '27017'
    }, {
        /** calculated  */
        name: 'SLDX_MONGO_URL',
        allowEmpty: true,
        highlight: true,
        value: ''
    }, {
        name: 'SLDX_PROTOCOL',
        arg: `${_ARGS_PREFIX}ProxyProtocol`,
        value: 'http'
    }, {
        name: 'SLDX_PROXY_HOST',
        arg: `${_ARGS_PREFIX}ProxyHost`,
        value: 'seira-ldx.seiralocaltest'
    }, {
        name: 'SLDX_PROXY_PORT',
        arg: `${_ARGS_PREFIX}ProxyPort`,
        value: '80',
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
        name: 'SLDX_SSO_HOST',
        arg: `${_ARGS_PREFIX}SsoHost`,
        value: 'localhost'
    }, {
        name: 'SLDX_SSO_PORT',
        arg: `${_ARGS_PREFIX}SsoHost`,
        value: '3010',
        allowEmpty: true,
        type: 'numeric'
    }, {
        name: 'SLDX_SSO_URL',
        allowEmpty: true,
        source: 'calculated',
        /* calculated */
        value: '',
        highlight: true
    }, {
        name: 'SLDX_ADMIN_NAME',
        value: 'testperfs.admin',
        arg: `${_ARGS_PREFIX}AdminId`,
        highlight: true
    }, {
        name: 'SLDX_ADMIN_PWD',
        value: 'seira',
        arg: `${_ARGS_PREFIX}AdminPwd`,
        highlight: true
    }, {
        name: 'SLDX_TEACHER_NAME',
        value: 'testperfs.teacher',
        arg: `${_ARGS_PREFIX}TeacherId`,
        highlight: true
    }, {
        name: 'SLDX_TEACHER_PWD',
        value: 'seira',
        arg: `${_ARGS_PREFIX}TeacherPwd`,
        highlight: true
    }, {
        name: 'SLDX_LEARNER_PWD',
        value: 'seira'
    }, {
        name: 'SLDX_LEARNER_ENCRYPTED_PWD',
        value: '$2a$10$egusEbUGmahKRCwcLgks1el2DyNJadEbNM57BnouqynHkn5VxZjj.'
    }, {
        /** _PREFIX Used by DB tools */
        name: 'SLDX_LEARNER_PREFIX',
        value: 'testperfs.learner.'
    }, {
        name: 'SLDX_SESSION_PREFIX',
        value: 'testperfs.session.'
    }, {
        name: 'SLDX_CAREER_PREFIX',
        value: 'testperfs.career.'
    }, {
        name: 'SLDX_GROUP_PREFIX',
        value: 'testperfs.group.'
    }, {
        name: 'SLDX_METRICS_ENABLED',
        value: 'true'
    }, {
        name: 'SLDX_ARTILLERY_ROOT_DIR',
        highlight: true,
        dirPath: true,
        value: './artillery',
    }, {
        name: 'SLDX_ARTILLERY_REPORT_SUFFIX',
        allowEmpty: true,
        /**
         * allow empty , string, $date, $day
         * $date: 'yyyy-mm-dd-HH-MM-ss'
         * $day:  'yyyy-mm-dd'
         */
        value: '$day',
    }, {
        name: 'SLDX_ARTILLERY_MAINTHREAD_OFFSET',
        allowEmpty: true,
        /** 
         * Used to calculate the learnerName (SLDX_LEARNER_PREFIX) IN MAIN THREAD
         * Each time a test is launched (testCounter) in the MAIN thread we calculate the learnerName (used or login) with the following method:
         * SLDX_LEARNER_PREFIX + SLDX_ARTILLERY_MAINTHREAD_OFFSET + testCounter
         * Eg: if SLDX_ARTILLERY_MAINTHREAD_OFFSET = 0
         *     - first test: testperfs.learner.1
         *     - second test: testperfs.learner.2
         * Eg: if SLDX_ARTILLERY_MAINTHREAD_OFFSET = 100
         *     - first test: testperfs.learner.101
         *     - second test: testperfs.learner.102
         * If we provide a .csv file to artillery (payload.path) with the user names the file is read from the begining for each thread/worker
         * - We can't have the same learner logged in twice (the test fails whe we check the progression which must be equal to 0%)
         * - We need to calculate a unique learner name per test regardless of the thread it is run in
         * If we use 'arrivalCount' (advised) to manage the rampup, Artillery will run all the tests in the same thread
         * - We don't have threads conflicts
         * If we use 'arrivalRate' (number of tests/vusers created per second) to manage the rampup, Artillery can potentially run the tests in multiple thread
         * - We can have threads conflicts and it's why we need to calculate a unic learnerName
        */
        value: '0',
    }, {
        name: 'SLDX_ARTILLERY_WORKER_OFFSET',
        allowEmpty: true,
        /** 
         * Used to calculate the learnerName (SLDX_LEARNER_PREFIX) in WORKER THREAD
         * Each time a test is launched (testCounter) in a WORKER thread we calculate the learnerName with the following method:
         * SLDX_LEARNER_PREFIX + SLDX_ARTILLERY_WORKER_OFFSET + testCounter
         * Eg: if SLDX_ARTILLERY_MAINTHREAD_OFFSET = 500
         *     - first test: testperfs.learner.501
         *     - second test: testperfs.learner.502
        */
        value: '500',
    }, {
        name: 'SLDX_PLAYWRIGHT_ROOT_DIR',
        dirPath: true,
        highlight: true,
        value: './playwright',
    },
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
    }, {
        name: 'SLDX_ARTILLERY_JSON_CFG',
        allowEmpty: true
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
            myConsole.warning(`!! Environment variable ${x.name} - Unexpected value ${x.value}\nExpected values : '${x.values.join(',')}'`)
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
            myConsole.warning(`defaultEnvVars - unexpected null DEFAULT_VARS value (check double comma ', ,' in DEFAULT_VARS array)`)
        }
    }
    return res
}

/**
 * Program arguments
 * - npm run perfs.test1 -- --sldxenv=default
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
