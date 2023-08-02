'use strict';

const _ = require('lodash')
const assert = require('assert')
const { format: prettyFormat } = require('pretty-format')

module.exports = class Loggable {
    #opts = null
    constructor(opts) {
        this.#opts = Object.assign({
            name: this.className,
            myConsole: null
        }, opts ?? {})
        if (this.opts.myConsole == null) {
            this.opts.myConsole = require('#commons/myConsole')
        }
        this.loghighlight(`NEW ${this.className} name[${this.name}]`)
    }
    destroy() {
    }
    async asyncInit() {

    }
    get className() {
        return this.constructor.name
    }
    get name() {
        return this.#opts.name
    }
    get opts() {
        return this.#opts
    }
    get myConsole() {
        return this.opts.myConsole 
    }
    get threadId() {
        return this.myConsole.threadId
    }
    /**
     * Not in console - only in file logger
     * @param  {...any} args
     */
    logFile(...args) {
        this.myConsole.loggerDebug.apply(this.myConsole, args)
    }
    /**
     * log* methods below log in console and file 
     */
    log(...args) {
        this.loglowlight.apply(this, args)
    }
    /** log in file only */
    logjson(...args) {
        const newargs = []
        for (const a of args){
            if (_.isObject(a)){
                newargs.push(prettyFormat(a))
            }else {
                newargs.push( a)
            }
        }
        this.logFile.apply(this, newargs)
    }
    loglowlight(...args) {
        this.myConsole.lowlight.apply(this.myConsole, args)
    }
    loghighlight(...args) {
        this.myConsole.highlight.apply(this.myConsole, args)
    }
    logsuperhighlight(...args) {
        this.myConsole.superhighlight.apply(this.myConsole, args)
    }
    logerror(...args) {
        this.myConsole.error.apply(this.myConsole, args)
    }
    logcolor(color, ...args) {
        this.myConsole.color.apply(this.myConsole, [color, ...args])
    }
    logwarning(...args) {
        this.myConsole.warning.apply(this.myConsole, args)
    }
    initFileLogegr(logName) {
        assert(!_.isEmpty(logName), 'initFileLogegr - unexpected empty logger name')
        this.myConsole.initLoggerFromModule(logName)
    }
    static async factory(opts) {
        const loggable = new this(opts)
        await loggable.asyncInit()
        return loggable
    }
}