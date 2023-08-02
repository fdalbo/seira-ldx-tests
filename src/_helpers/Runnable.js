'use strict';

const myConsole = require('#commons/myConsole')
const _ = require('lodash')
const assert = require('assert')


module.exports = class Runnable {
    #opts = null
    #myConsole = null
    constructor(opts) {
        this.#myConsole = myConsole
        this.#opts = Object.assign({
            name: this.className
        }, opts ?? {})
        this.loghighlight(`NEW ${this.className} name[${this.name}]`)
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
        return this.#myConsole
    }
    get threadId(){
        return this.myConsole.threadId
    }
    geLogName(method){
        return method.name
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
    logwarning(...args) {
        this.myConsole.warning.apply(this.myConsole, args)
    }
    async runBefore(...args) {
    }
    async runStart(...args) {
    }
    async runAfter(...args) {
    }
    async runError(e, ...args) {
    }
    async run(...args) {
        return this.runMethod.apply(this, [this.runStart, ...args])
    }
    async runMethod(method, ...args) {
        assert(_.isEmpty(method), `method [${method?.name ?? 'noName'}] not found`)
        const logName = this.geLogName(method)
        try {
            this.myConsole.initLoggerFromModule(logName)
            this.logsuperhighlight(`Begin ${logName}`)
            await this.runBefore.apply(this, args)
            await method.apply(this, args)
            await this.runAfter.apply(this, args)
            this.logsuperhighlight(`End ${logName}`)
        } catch (e) {
            this.logerror(`${logName} FAILED`, e)
            await this.runError.apply(this, [e, ...args])
        }
    }
    static async factory(opts) {
        const runnable = new this(opts)
        await runnable.asyncInit()
        return runnable
    }
    static async factoryRun(opts, ...args) {
        const runnable = await this.factory.apply(this, [opts, ...args])
        await runnable.run()
    }
}