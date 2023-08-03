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
exports.METRIC_NAV = 'navigation'
exports.METRICS = [exports.METRIC_CARDS, exports.METRIC_QUIZ, exports.METRIC_NAV]

exports.STATUS_ERROR = 'error'
exports.STATUS_BEGIN = 'begin'
exports.STATUS_END_OK = 'endok'
exports.STATUS_END_KO = 'endko'
exports.STATUS_LIST = [exports.STATUS_ERROR, exports.STATUS_BEGIN, exports.STATUS_END_OK, exports.STATUS_END_KO]

exports.MESSAGE_BROADCAST_CHANNEL = 'MAIN'
exports.MESSAGE_STATUS = 'STATUS'
exports.MESSAGE_METRICS = 'METRICS'



const _getArtilleryLearnerName = () => {
    const workerIdx = parseInt(process.env.LOCAL_WORKER_ID ?? '')
    if (isNaN(workerIdx)) {
        throw new Error(`Running artillery - Unexpected empty 'LOCAL_WORKER_ID' env variable`)
    }
    const userPrefix = process.env.SLDX_LEARNER_PREFIX
    if (userPrefix.length == 0) {
        throw new Error(`Running artillery - Unexpected empty 'SLDX_LEARNER_PREFIX' env variable`)
    }
    /**
     * userPrefix1, 2, 3....
     */
    const userFirstIdx = workerIdx + parseInt(process.env.SLDX_ARTILLERY_USER_FIRST_IDX ?? '0')
    if (isNaN(userFirstIdx)) {
        throw new Error(`Running artillery - Unexpected empty 'SLDX_ARTILLERY_USER_FIRST_IDX' env variable`)
    }
    return `${userPrefix}${userFirstIdx}`
}
const _getPlaywrightLearnerName = () => {
    const name = process.env.SLDX_PLAYWRIGHT_LEARNER_NAME
    if (name.length == 0) {
        throw new Error(`Running playwright - Unexpected empty 'SLDX_PLAYWRIGHT_LEARNER_NAME' env variable`)
    }
    return name
}

let _config = null
const _baseConfig = {
    /** artillery / playwright */
    exec: process.env.SLDX_RUNNER_EXEC,
    proxyUrl: process.env.SLDX_PROXY_URL,
    ssoUrl: process.env.SLDX_SSO_URL,
    metrics:{
        sendToMainThread: true
    },
    entities: {
        admin: {
            name: process.env.SLDX_ADMIN_NAME,
            password: process.env.SLDX_ADMIN_PWD,
            role: exports.ROLE_ADMIN
        },
        learner: {
            /** many learners testperfs.learner.1, .2 ... */
            id: null,
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
            prefix: process.env.SLDX_GROUP_PREFIX
        },
        session: {
            prefix: process.env.SLDX_SESSION_PREFIX,
            mainName: `${process.env.SLDX_SESSION_PREFIX}main`,
            mainNbLearners: 100
        },
        career: {
            mainName: `${process.env.SLDX_CAREER_PREFIX}main`,
        }
    },
    apiCli: {
        timeout: 1000
    },
    mongo: {
        host: process.env.SLDX_MONGO_HOST,
        port: process.env.SLDX_MONGO_PORT,
        url: process.env.SLDX_MONGO_URL
    },
    misc: {
        /** nb retries after read dom failed (pause tempo.retryReadDom + readDomNbRetries) */
        readDomNbRetries: 5,
        refreshSummaryPeriod: 2000
    },
    tempo: {
        retryReadDom: 5000,
        listDetailSession: 3000,
        login: 2000,
        secreenShot: 5000,
        default: 2000,
        page: 2000,
        radioCheckbox: 2000,
        cardDisplay: 5000,
        textInput: 1000,
        modal: 2000
    },
    timeouts: {
        defaultNavigationTimeout: 1 * 60 * 1000,
        defaultTimeout: 1 * 60 * 1000
    },
    artillery: {
        learner: {
            name: _getArtilleryLearnerName,
            password: process.env.SLDX_LEARNER_PWD ?? ''
        },
    },
    playwright: {
        learner: {
            name: _getPlaywrightLearnerName,
            password: process.env.SLDX_LEARNER_PWD ?? ''
        },
    },
    scenario: null,
    getLearnerName: (...args) => {
        let learnerName = _config[process.env.SLDX_RUNNER_EXEC]?.learner.name ?? ''
        if (typeof learnerName == 'function') learnerName = learnerName.apply(this, args)
        learnerName = learnerName.toString().trim()
        if (learnerName.length == 0) {
            throw new Error(`Unexpected empty learner.name`)
        }
        myConsole.highlight(`learner[${learnerName}]`)
        return learnerName
    },
    getUserPwd: () => {
        return _config[process.env.SLDX_RUNNER_EXEC]?.learner?.password ?? ''
    }
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
    if (!fs.existsSync(configPath)) {
        throw new Error(`Script [${scriptId}] - Config file not found\n- [${configPath}]`)
    }
    _config = deepmerge(_baseConfig, require(configPath))
    _config.scriptId = scriptId
    _config.configPath = configPath
    _config.fileName = fileNameScript
    myConsole.highlight(`Config Path: [${configPath}]`)
    myConsole.lowlight(`Config:\n${prettyFormat(_config)}\n©`)
    return _config
}


module.exports.getArtilleryUserName = _getArtilleryLearnerName
module.exports.getPlaywrightUserName = _getPlaywrightLearnerName
module.exports.initConfig = _initConfig