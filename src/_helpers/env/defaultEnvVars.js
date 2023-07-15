'use strict';
import appRootDir from 'app-root-dir'

 

export const ARGS_PREFIX = 'sldx'
export const SLDX_ENV_VAR = 'SLDX_ENV'
/** sldxenv */
export const SLDX_ENV_ARG = `${ARGS_PREFIX}env`
export const SLDX_LOG_ROOT_PATH = './_logs'

const DEFAULT_VARS = [
    /** .env file id ./local.dotenv by default */
    {
        name: SLDX_ENV_VAR,
        value: 'local',
        highlight: true,
        arg: SLDX_ENV_ARG
    }, {
        name: 'SLX_ARTILLERY_ROOT_DIR',
        highlight: true,
        dirPath: true,
        value: './artillery',
    }, {
        name: 'SLX_PLAYWRIGHT_ROOT_DIR',
        dirPath: true,
        highlight: true,
        value: './playwright',
    },{
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
        name: 'SLDX_LOG_DIR',
        dirPath: true,
        highlight: true,
        arg: `${ARGS_PREFIX}LogDir`,
        /** /$host -> we create a SLDX_PROXY_HOST's hostname under /logs */
        value: `${SLDX_LOG_ROOT_PATH}/$host`
    }, {
        name: 'SLDX_WORK_DIR',
        dirPath: true,
        arg: `${ARGS_PREFIX}WorkDir`,
        /** /$host -> we create a SLDX_PROXY_HOST's hostname under /workdir */
        value: './_workdir/$host'
    }, {
        name: 'SLDX_PROXY_HOST',
        arg: `${ARGS_PREFIX}ProxyHost`,
        value: '',
        highlight: true
    }, {
        name: 'SLDX_PROXY_PORT',
        arg: `${ARGS_PREFIX}ProxyPort`,
        value: '',
        allowEmpty: true,
        type: 'numeric',
        highlight: true
    }, {
        name: 'SLDX_ADMIN_USER',
        arg: `${ARGS_PREFIX}AdmipUser`,
        highlight: true
    }, {
        name: 'SLDX_ADMIN_PASSWORD',
        arg: `${ARGS_PREFIX}AdmipPwd`,
        highlight: true
    }, {
        /** calculated by runner */
        name: 'SLDX_RUNNER_SCRIPT_NAME',
        allowEmpty: true,
        value: ''
    }, {
        name: 'SLDX_MONGO_HOST',
        value: '127.0.0.1'
    }, {
        name: 'SLDX_MONGO_PORT',
        value: '27017'
    }
]

export function append(myEnvVars) {
    myEnvVars ??= []
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
        x.name=x.name.replaceAll(' ', '')
        if (x == null) {
            return false
        }
        if (x.values && x.values.indexOf(x.value) < 0) {
            console.warn(`!! Environment variable ${x.name} - Unexpected value ${x.value}\Expected values : '${x.values.join(',')}'`)
        }
        return true
    })
}

/** return an array {name: value} for default env vars*/
export const getValues = () => {
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