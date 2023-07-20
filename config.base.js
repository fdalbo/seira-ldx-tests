const helpers = require('./config.helpers')
const path = require('path')
const fs = require('fs')
const deepmerge = require('deepmerge')
const appRootDir = require('app-root-dir')
const { format: prettyFormat } = require('pretty-format')
const myConsole = require('#commons/myConsole')

exports.ROLE_LEARNER = 'learner'
exports.TEMPO_PAGE = 'page'
exports.TEMPO_RADIO = 'radioCheckbox'
exports.TEMPO_CARD_DISPLAY = 'cardDisplay'
exports.TEMPO_TEXT_INPUT = 'textInput'
exports.TEMPO_MODAL = 'modal'

let _config = null
const _baseCOnfig = {
    /** artillery / playwright */
    exec: process.env.SLDX_RUNNER_EXEC,
    proxyUrl: process.env.SLDX_PROXY_URL,
    admin: {
        user: process.env.SSLDX_ADMIN_USER,
        name: process.env.SSLDX_ADMIN_PASSWORD ?? ''
    },
    user: {
        id: null,
        password: process.env.SLDX_USER_PWD,
        role: exports.ROLE_LEARNER
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
    timeouts:{
        defaultNavigationTimeout: 1000,
        defaultTimeout: 1000

    },
    artillery: {
        user: {
            id: helpers.getArtilleryUser,
            password: process.env.SLDX_USER_PWD ?? ''
        },
    },
    playwright: {
        user: {
            id: helpers.getPlaywrightUser,
            password: process.env.SLDX_USER_PWD ?? ''
        },
    },
    scenario: null,
    getUserId: (...args) => {
        let userId = _config[process.env.SLDX_RUNNER_EXEC].user.id ?? ''
        if (typeof userId == 'function') userId = userId.apply(this, args)
        userId = userId.toString().trim()
        if (typeof userId.length == 0) {
            throw new Error(`Unexptected empty user.id`)
        }
        return userId
    },
    getUserPwd: () => {
        return _config[process.env.SLDX_RUNNER_EXEC].user.password ?? ''
    }
}
module.exports.initConfig = (scriptId) => {
    if (!['artillery', 'playwright'].includes(process.env.SLDX_RUNNER_EXEC)) {
        throw new Error(`Unknown value for SLDX_RUNNER_EXEC [${process.env.SLDX_RUNNER_EXEC}]`)
    }
    const configPath = path.resolve(appRootDir.get(), `config.${scriptId.toLowerCase()}.js`)
    if (!fs.existsSync(configPath)) {
        throw new Error(`Script [${scriptId}] - Config file not found\n- [[${configPath}]`)
    }
    _config = deepmerge(_baseCOnfig, require(configPath))
    myConsole.lowlight(`Script [${scriptId}] - Config:\nPath: [${configPath}]\n\n${prettyFormat(_config)}`)
    return _config
}