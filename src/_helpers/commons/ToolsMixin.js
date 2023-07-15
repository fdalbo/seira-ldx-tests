'use strict';

const jmespath = require('jmespath')
const { format: prettyFormat } = require('pretty-format')


const LEVEL_NONE = 'none'
const LEVEL_ERROR = 'error'
const LEVEL_WARN = 'warn'
const LEVEL_INFO = 'info'
const LEVEL_VERBOSE = 'verbose'
const LEVEL_DEBUG = 'debug'

const _levelInfo = new Map([
    [LEVEL_NONE, {
        order: 0,
        prefix: '[none] '
    }], [LEVEL_ERROR, {
        order: 1,
        prefix: '[erro] '
    }], [LEVEL_WARN, {
        order: 2,
        prefix: '[warn] '
    }], [LEVEL_INFO, {
        order: 3,
        prefix: '[info] '
    }], [LEVEL_VERBOSE, {
        order: 4,
        prefix: '[verb] '
    }], [LEVEL_DEBUG, {
        order: 5,
        prefix: '[debu] '
    }]
])
_levelInfo.values
/**
 * Adds tooling to BaseClass
 * See BaseWorker, BaseWorkerParentPort, Listener, 
 */
module.exports = (BaseClass) => class extends BaseClass {

    __toolsMixinInit(name, konsole, options) {
        this.__konsole = konsole
        this.__name = name
        this.__options = Object.assign({
            logPrefix: null,
            logLevel: process.env.SLDX_LOG_LEVEL ?? LEVEL_ERROR,
            verbose: false,
            steps: {
                main: {
                    color: 'yellow',
                    level: 'none'
                },
                default: {
                    color: 'green',
                    level: LEVEL_INFO
                }
            }
        }, options || {})
        this.__logPrefix = this.__options.logPrefix || name
        if (this.__options.verbose === true) {
            this.setVerbose()
        } else {
            this.logLevel = this.__options.logLevel
        }
    }
    get className() {
        return this.constructor.name
    }
    get logLevel() {
        return this.__options.logLevel
    }
    set logLevel(level) {
        this.__options.logLevel = level ?? LEVEL_INFO
        this.__levelDebug = this.logLevel === 'none' || this.logLevel === LEVEL_DEBUG
        this.__levelVerbose = this.__levelDebug || this.logLevel === LEVEL_VERBOSE
        this.__levelInfo = this.__levelVerbose || this.logLevel === LEVEL_INFO
        this.__levelWarning = this.__levelInfo || this.logLevel === LEVEL_WARN
    }
    get name() {
        return this.__name
    }
    get options() {
        return this.__options
    }
    isVerbose() {
        return this.logLevel === LEVEL_VERBOSE || this.logLevel === LEVEL_DEBUG
    }
    setVerbose() {
        this.logLevel = LEVEL_VERBOSE
    }
    optionsValue(expression, firstValue = true) {
        const res = jmespath.search(this.__options, expression)
        if (res == null || !Array.isArray(res)) {
            return res
        }
        if (firstValue !== true) {
            return res
        }
        return res.length == 0 ? null : res[0]
    }
    get console() {
        return this.__konsole
    }

    __logAddPrefix(level, logargs) {
        let arg0 = logargs[0]
        if (arg0 instanceof Error) {
            logargs.unshift(`.onError`)
        } else if (typeof arg0 !== 'string') {
            logargs.unshift('')
        }
        arg0 = logargs[0].toString()
        const prefix = [arg0]
        if (!arg0.startsWith('.')) {
            prefix.unshift(' - ')
        }
        prefix.unshift(this.__logPrefix)
        if (process.env.SLDX_LOG_LEVEL_DISPLAY === 'true' && _levelInfo.get(level)) {
            prefix.unshift(_levelInfo[level].prefix)
        }
        logargs[0] = prefix.join('')
        return logargs
    }
    __logEnabled(level) {
        const current = _levelInfo.get(this.logLevel)
        const newLevel = _levelInfo.get(level)
        if (!newLevel || !current) {
            return false
        }
        return newLevel.order <= current.order
    }
    /** adds the logPrefix to the message and returns an Error */
    newError(message = '', error, log = false) {
        if (typeof error == 'string') {
            error = new Error(prettyFormat(error))
            /** !! parenthesis mandatory() */
        } else if (!(error instanceof Error)) {
            error = new Error(prettyFormat(error))
        }
        if (log === true) {
            this.logError(message, error)
        }
        if (!message.startsWith('.')) {
            message = `.error - ${message}`
        }
        return new Error(this.logGetMessage(message), {
            cause: error
        })
    }
    /** adds the logPrefix to the text */
    logGetMessage(text) {
        return this.__logAddPrefix(null, [text])[0]
    }
    /*****************************************************************************************************
     * ERROR
    *****************************************************************************************************/
    logError(...args) {
        /** Always logs errors */
        this.__konsole.error.apply(this.__konsole, this.__logAddPrefix(LEVEL_ERROR, args))
    }
    /*****************************************************************************************************
     * STEPS
    *****************************************************************************************************/
    _logStep(id, text) {
        const opts = this.optionsValue(`steps.${id}`)
        if (!opts) {
            throw this.newError(`Step not found -  this.options.steps.${id} is empty`)
        }
        this.logColor(opts.level, opts.color, text)
    }
    logStepMain(text) {
        this._logStep('main', text)

    }
    logStep(text) {
        this._logStep('default', text)
    }
    /*****************************************************************************************************
     * WARNING
     *****************************************************************************************************/
    logWarning(...args) {
        /** Always logs errors */
        if (this.__levelWarning) {
            this.__konsole.warning.apply(this.__konsole, this.__logAddPrefix(LEVEL_WARN, args))
        } else {
            this.logTrace.apply(this, args)
        }
    }
    /*****************************************************************************************************
     * INFO
     *****************************************************************************************************/
    logInfo(...args) {
        if (this.__levelInfo) {
            this.__konsole.lowlight.apply(this.__konsole, this.__logAddPrefix(LEVEL_INFO, args))
        } else {
            this.logTrace.apply(this, args)
        }
    }
    logLowlight(...args) {
        if (this.__levelInfo) {
            this.__konsole.lowlight.apply(this.__konsole, this.__logAddPrefix(LEVEL_INFO, args))
        } else {
            this.logTrace.apply(this, args)
        }
    }
    logHighlight(...args) {
        if (this.__levelInfo) {
            this.__konsole.highlight.apply(this.__konsole, this.__logAddPrefix(LEVEL_INFO, args))
        } else {
            this.logTrace.apply(this, args)
        }
    }
    logMediumlight(...args) {
        if (this.__levelInfo) {
            this.__konsole.mediumlight.apply(this.__konsole, this.__logAddPrefix(LEVEL_INFO, args))
        } else {
            this.logTrace.apply(this, args)
        }
    }
    /*****************************************************************************************************
     * DEBUG
     *****************************************************************************************************/
    logDebug(...args) {
        if (this.__levelDebug) {
            this.__konsole.lowlight.apply(this.__konsole, this.__logAddPrefix(LEVEL_DEBUG, args))
        } else {
            this.logTrace.apply(this, args)
        }
    }
    /*****************************************************************************************************
     * VERBOSE
     *****************************************************************************************************/
    logVerbose(...args) {
        if (this.__levelVerbose) {
            this.__konsole.lowlight.apply(this.__konsole, this.__logAddPrefix(LEVEL_VERBOSE, args))
        } else {
            this.logTrace.apply(this, args)
        }
    }
    /*****************************************************************************************************
     * COLOR
     *****************************************************************************************************/
    logColor(level = LEVEL_INFO, color, ...args) {
        if (!_levelInfo.get(level)) {
            this.__konsole.lowlight(`!!logColor - Unknown level '${level}'`)
            return
        }
        if (this.__logEnabled(level)) {
            const colorArgs = this.__logAddPrefix(level, args);
            colorArgs.unshift(color)
            this.__konsole.color.apply(this.__konsole, colorArgs)
        } else {
            this.logTrace.apply(this, args)
        }
    }
    /*****************************************************************************************************
     * FILE LOGGER ONLY
     *****************************************************************************************************/
    logTrace(...args) {
        this.__konsole.loggerAll.apply(this.__konsole, this.__logAddPrefix(null, args))
    }
}

