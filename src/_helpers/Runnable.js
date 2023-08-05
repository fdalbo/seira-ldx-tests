'use strict';
const _ = require('lodash')
const assert = require('assert')
const Loggable = require('./Loggable')


module.exports = class Runnable extends Loggable {
    geLogName(method) {
        return method.name
    }
    async runBefore(method, ...args) {
    }
    async runStart(...args) {
    }
    async runAfter(method, ...args) {
    }
    async runError(method, e, ...args) {
    }
    async runFinally(method, ok, ...args) {
    }
    async run(...args) {
        return this.runMethod.apply(this, [this.runStart, ...args])
    }
    async runMethod(method, ...args) {
        assert(_.isEmpty(method), `method [${method?.name ?? 'noName'}] not found`)
        const logName = this.geLogName(method)
        let error = null
        try {
            this.logsuperhighlight(`RunMethod begin logName$[${logName}]`)
            await this.runBefore.apply(this, [method, ...args])
            await method.apply(this, args)
            await this.runAfter.apply(this, [method, ...args])
        } catch (e) {
            this.logerror(`RunMethod Error logName$[${logName}]`, e)
            error = e
            await this.runError.apply(this, [method, e, ...args])
        } finally {
            const ok = (error == null)
            this.logsuperhighlight(`RunMethod end ${ok ? 'OK' : 'KO'} logName$[${logName}]`)
            await this.runFinally.apply(this, [method, ok, ...args])
        }
    }
    static async factoryRun(opts, ...args) {
        const runnable = await this.factory.apply(this, [opts, ...args])
        await runnable.run()
    }
}