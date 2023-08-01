'use strict';

const  myConsole = require('#commons/ this.myConsole')


module.exports = class ToolsBase {
    #name = null
    #opts = null
    #myConsole = null
    constructor(name,opts) {
        this.#name =name
        this.#myConsole = myConsole
        this.#opts = Object.assign({
        }, opts ?? {})
        this.log()
    }
    get className() {
        return this.constructor.name
    }
    get name() {
        return this.#name
    }
    get scriptConfig() {
        return this.#scriptConfig
    }
    get opts() {
        return this.#opts
    }
    get  myConsole() {
        return  this.#myConsole 
    }
    /**
     * Not in console - only in file logger
     * @param  {...any} args
     */
    logFile(...args) {
         this.myConsole.loggerDebug.apply( this.myConsole, args)
    }
    /**
     * log* methods below log in console and file 
     */
    log(...args) {
        this.loglowlight.apply(this, args)
    }
    loglowlight(...args) {
         this.myConsole.lowlight.apply( this.myConsole, args)
    }
    loghighlight(...args) {
         this.myConsole.highlight.apply( this.myConsole, args)
    }
    logsuperhighlight(...args) {
         this.myConsole.superhighlight.apply( this.myConsole, args)
    }
    logerror(...args) {
         this.myConsole.error.apply( this.myConsole, args)
    }
    logwarning(...args) {
         this.myConsole.warning.apply( this.myConsole, args)
    }
    async runBefore(...args) {
    }
    async runStart(...args) {
    }
    async runAfter(...args) {
    }
    async runError(e,...args) {
    }
    async run(...args) {
        try {
             this.myConsole.initLoggerFromModule(this.name)
            this.logsuperhighlight(`Begin ${this.name}`)
            await this.runBefore.apply(this, args)
            await this.runStart.apply(this, args)
            await this.runAfter.apply(this, args)
            this.logsuperhighlight(`End ${method.name}`)
        } catch (e) {
            this.logerror(`${this.name} FAILED`, e)
            await this.runError.apply(this, [e,...args])
        }
    }
    static async factory(name, opts) {
        const client = new this(name, opts)
        return client.run()
    }
}