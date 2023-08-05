const path = require('path')
const fs = require('fs')
const _ = require('lodash')
const deepmerge = require('deepmerge')
const appRootDir = require('app-root-dir')
const { format: prettyFormat } = require('pretty-format')
const assert = require('assert')
const myConsole = require('#commons/myConsole')
const { SLDX_ENV_VAR } = require('#env/defaultEnvVars')

exports.ROLE_LEARNER = 'learner'
exports.ROLE_TEACHER = 'teacher'
exports.ROLE_ADMIN = 'admin'
exports.TEMPO_PAGE = 'page'
exports.TEMPO_LIST_DETAIL_SESSION = 'listDetailSession'
exports.TEMPO_RADIO = 'radioCheckbox'
exports.TEMPO_CARD_DISPLAY = 'cardDisplay'
exports.TEMPO_TEXT_INPUT = 'textInput'
exports.TEMPO_MODAL = 'modal'
exports.TEMPO_SCREENSHOT = 'secreenShot'
exports.TEMPO_LOGIN = 'login'
exports.TEMPO_RETRY_READ_DOM = 'retryReadDom'

exports.METRIC_CARDS = 'cards'
exports.METRIC_QUIZ = 'quiz'
exports.METRIC_LEARNER_HOME = 'learnerhome'
exports.METRIC_START_CAREER = 'startcareer'
exports.METRIC_LOGIN = 'login'
exports.METRIC_FIRST_PAGE = 'firstpage'
exports.METRIC_LEARNER_SESSIONS = 'sessionslist'
exports.METRIC_LEARNER_SESSION = 'sessionhome'
exports.METRICS = [
    exports.METRIC_CARDS,
    exports.METRIC_QUIZ,
    exports.METRIC_LEARNER_HOME,
    exports.METRIC_START_CAREER,
    exports.METRIC_LOGIN,
    exports.METRIC_FIRST_PAGE,
    exports.METRIC_LEARNER_SESSIONS,
    exports.METRIC_LEARNER_SESSION
]
exports.STATUS_ERROR = 'error'
exports.STATUS_BEGIN = 'begin'
exports.STATUS_END_OK = 'endok'
exports.STATUS_END_KO = 'endko'
exports.STATUS_LIST = [exports.STATUS_ERROR, exports.STATUS_BEGIN, exports.STATUS_END_OK, exports.STATUS_END_KO]

exports.MESSAGE_BROADCAST_CHANNEL = 'MAIN'
exports.MESSAGE_STATUS = 'STATUS'
exports.MESSAGE_METRICS = 'METRICS'

module.exports.getLearnerShortName = (leanerName) => {
    const learnerIdx = (leanerName.match(/\.([0-9]+$)/) ?? [])[1]
    assert(!_.isEmpty(learnerIdx), `unexpected learner name [${leanerName}] - Does not match /\\.([0-9]+$)/`)
    return `learn${learnerIdx}`
}

let _config = null
/**
 * Base config is merged with the scenario's config (see _initConfig below)
 * Eg: If the script class name is 'Script1' 
 *     If process.SLDX_ENV == '' 
 *     - The config file's name is 'config.script1.js'
 *     - The script config is given by merging _baseConfig with config.script1.js
 *     If process.SLDX_ENV == 'debug' 
 *     - The config file's name is 'config.debug.script1.js'
 *     The script config is given by merging _baseConfig with the file above
 */
const _baseConfig = {
    /** artillery / playwright */
    exec: process.env.SLDX_RUNNER_EXEC,
    proxyUrl: process.env.SLDX_PROXY_URL,
    /** used by login (see ToolBaseApi) */
    ssoUrl: process.env.SLDX_SSO_URL,
    metrics: {
        /** Display metrics true/false */
        sendToMainThread: true
    },
    entities: {
        admin: {
            name: process.env.SLDX_ADMIN_NAME,
            password: process.env.SLDX_ADMIN_PWD,
            role: exports.ROLE_ADMIN
        },
        learner: {
            /** !! overriden by artillery (see artillery/tests-artillery.js) */
            name: process.env.SLDX_LEARNER_NAME,
            shortName: process.env.SLDX_LEARNER_SHORTNAME,
            /** Used by DB tools */
            prefix: process.env.SLDX_LEARNER_PREFIX,
            password: process.env.SLDX_LEARNER_PWD,
            encryptedPwd: process.env.SLDX_LEARNER_ENCRYPTED_PWD,
            role: exports.ROLE_LEARNER
        },
        teacher: {
            name: process.env.SLDX_TEACHER_NAME,
            password: process.env.SLDX_TEACHER_PWD,
            role: exports.ROLE_TEACHER
        },
        group: {
            /** Used by DB tools */
            prefix: process.env.SLDX_GROUP_PREFIX
        },
        session: {
            /** Used by DB tools */
            prefix: process.env.SLDX_SESSION_PREFIX,
            mainName: `${process.env.SLDX_SESSION_PREFIX}main`,
            mainNbLearners: 100
        },
        career: {
            /** Career used by the scenario */
            mainName: `${process.env.SLDX_CAREER_PREFIX}main`,
        }
    },
    apiCli: {
        /** axios tiemput for http request (see testInitScript / ToolBaseApi) */
        timeout: 1000
    },
    mongo: {
        host: process.env.SLDX_MONGO_HOST,
        port: process.env.SLDX_MONGO_PORT,
        url: process.env.SLDX_MONGO_URL
    },
    misc: {
        /** nb retries if read dom fails (pause tempo.retryReadDom + readDomNbRetries) */
        readDomNbRetries: 5,
        /** Display the the monitoring every refreshMonitoringPeriod Ms */
        refreshMonitoringPeriod: 5000,
        /** Counts/reports the number of click every timeSlotPeriod Ms*/
        timeSlotPeriod: 100,
        /** Click response time
         * fast:    time < clickResponseTimeOk 
         * ok:      clickResponseTimeOk < time < clickResponseTimeWarning 
         * warning: clickResponseTimeWarning < time < clickResponseTimeDanger 
         * danger:  time > clickResponseTimeDanger 
         * */
        clickResponseTimeOk: 1000,
        clickResponseTimeWarning: 3000,
        clickResponseTimeDanger: 5000,
    },
    tempo: {
        /** tempo before retrying if dom read fails */
        retryReadDom: 5000,
        /** tempo after click on the session list line */
        listDetailSession: 3000,
        /** tempo after login */
        login: 2000,
        /** tempo before secreenShot (on error) */
        secreenShot: 5000,
        /** default tempo */
        default: 2000,
        /** Tempo on navigation click */
        page: 2000,
        /** Tempo on radio/checkbo click (quiz) */
        radioCheckbox: 2000,
        /** Tempo on next/prev card button */
        cardDisplay: 5000,
        /** Tempo after an input field has been filled */
        textInput: 1000,
        /** Tempo after displaying a modal and before clicking the ok/cancel button s*/
        modal: 2000
    },
    timeouts: {
        /** Playwright timeouts (https://playwright.dev/docs/api/class-page#page-set-default-navigation-timeout) */
        defaultNavigationTimeout: 1 * 60 * 1000,
        defaultTimeout: 1 * 60 * 1000
    },
    /** Scenario data (see script 1) */
    scenario: null
}
const _initConfig = (scriptId) => {
    assert(!_.isNil(scriptId), 'Unexpected empty scriptId. Can\'t read config file')
    if (!['artillery', 'playwright', 'node'].includes(process.env.SLDX_RUNNER_EXEC)) {
        throw new Error(`Unknown value for SLDX_RUNNER_EXEC [${process.env.SLDX_RUNNER_EXEC}]`)
    }
    const testEnv = process.env[SLDX_ENV_VAR] ?? ''
    let fileNameScript = `config.${scriptId.toLowerCase()}.js`
    if (!_.isEmpty(testEnv)) {
        /**
         * if SLDX_ENV_VAR=local
         * searches for config.script1.local.env
         * if not found searches for config.script1.env
         * if not found error
         */
        const fileNameScriptEnv = `config.${scriptId.toLowerCase()}.${testEnv}.js`
        if (fs.existsSync(path.resolve(appRootDir.get(), fileNameScriptEnv))) {
            fileNameScript = fileNameScriptEnv
        } else {
            myConsole.lowlight(`${SLDX_ENV_VAR}='${testEnv}' but config file '${fileNameScriptEnv}' has not been found`)
            myConsole.lowlight(`Takes '${fileNameScript}'`)
        }
    }
    const configPath = path.resolve(appRootDir.get(), fileNameScript)
    assert(fs.existsSync(configPath), `Script [${scriptId}] - Config file not found\n- [${configPath}]`)
    /** Merge */
    _config = deepmerge(_baseConfig, require(configPath))
    _config.scriptId = scriptId
    _config.configPath = configPath
    _config.fileName = fileNameScript
    assert(_.isEmpty(_config.leaner), `Script [${scriptId}] - Unexpected empty config.leaner`)
    myConsole.highlight(`Config Path: [${configPath}]`)
    myConsole.lowlight(`Config:\n${prettyFormat(_config)}\n©`)
    return _config
}

module.exports.initConfig = _initConfig