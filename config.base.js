const path = require('path')
const fs = require('fs')
const _ = require('lodash')
const deepmerge = require('deepmerge')
const appRootDir = require('app-root-dir')
const { format: prettyFormat } = require('pretty-format')
const myConsole = require('#commons/myConsole')
const { SLDX_ENV_VAR } = require('#env/defaultEnvVars')

exports.ROLE_LEARNER = 'learner'
exports.ROLE_TEACHER = 'teacher'
exports.ROLE_ADMIN = 'admin'
exports.TEMPO_PAGE = 'page'
exports.TEMPO_RADIO = 'radioCheckbox'
exports.TEMPO_CARD_DISPLAY = 'cardDisplay'
exports.TEMPO_TEXT_INPUT = 'textInput'
exports.TEMPO_MODAL = 'modal'


const _getArtilleryUser = () => {
    const workerIdx = parseInt(process.env.LOCAL_WORKER_ID ?? '')
    if (isNaN(workerIdx)) {
        throw new Error(`Running artillery - Unexpected empty 'LOCAL_WORKER_ID' env variable`)
    }
    const userPrefix = process.env.SLDX_LEARNER_PREFIX ?? 'user'
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
const _getPlaywrightUser = () => {
    const user = process.env.SLDX_PLAYWRIGHT_USER ?? ''
    if (user.length == 0) {
        throw new Error(`Running playwright - Unexpected empty 'SLDX_PLAYWRIGHT_USER' env variable`)
    }
    return user
}

let _config = null
const _baseConfig = {
    /** artillery / playwright */
    exec: process.env.SLDX_RUNNER_EXEC,
    proxyUrl: process.env.SLDX_PROXY_URL,
    users: {
        admin: {
            user: process.env.SSLDX_ADMIN_USER,
            name: process.env.SSLDX_ADMIN_PASSWORD,
            role: exports.ROLE_ADMIN
        },
        learner: {
            /** many learners testperfs.learner.1, .2 ... */
            id: null,
            password: process.env.SLDX_LEARNER_PWD,
            role: exports.ROLE_LEARNER
        },
        teacher: {
            id: process.env.SLDX_TEACHER_ID,
            password: process.env.SLDX_TEACHER_PWD,
            role: exports.ROLE_TEACHER
        }
    },
    mongo: {
        host: process.env.SLDX_MONGO_HOST,
        port: process.env.SLDX_MONGO_PORT,
    },
    tempo: {
        default: 2000,
        page: 2000,
        radioCheckbox: 2000,
        cardDisplay: 5000,
        textInput: 1000,
        modal: 2000
    },
    timeouts: {
        defaultNavigationTimeout: 30 * 1000,
        defaultTimeout: 30 * 1000

    },
    artillery: {
        user: {
            id: _getArtilleryUser,
            password: process.env.SLDX_LEARNER_PWD ?? ''
        },
    },
    playwright: {
        user: {
            id: _getPlaywrightUser,
            password: process.env.SLDX_LEARNER_PWD ?? ''
        },
    },
    scenario: null,
    getUserId: (...args) => {
        let learnerId = _config[process.env.SLDX_RUNNER_EXEC]?.users?.learner.id ?? ''
        if (typeof learnerId == 'function') learnerId = learnerId.apply(this, args)
        learnerId = learnerId.toString().trim()
        if (typeof learnerId.length == 0) {
            throw new Error(`Unexptected empty learner.id`)
        }
        return learnerId
    },
    getUserPwd: () => {
        return _config[process.env.SLDX_RUNNER_EXEC]?.users?.learner?.password ?? ''
    }
}
const _initConfig = (scriptId) => {
    if (!['artillery', 'playwright', 'node' ].includes(process.env.SLDX_RUNNER_EXEC)) {
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
    _config.scriptId =scriptId
    _config.configPath =configPath
    myConsole.highlight(`Config Path: [${configPath}]`)
    myConsole.lowlight(`Config:\n${prettyFormat(_config)}\n©`)
    return _config
}


module.exports.getArtilleryUser = _getArtilleryUser
module.exports.getPlaywrightUser = _getPlaywrightUser
module.exports.initConfig = _initConfig