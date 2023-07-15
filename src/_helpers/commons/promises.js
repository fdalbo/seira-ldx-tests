
'use strict';

import isNumber from 'is-number'
import myConsole from '#commons/myConsole'
import { format as prettyFormat } from 'pretty-format'

export async function pause(ms) {
    if (ms <= 0) return
    return new Promise(r => setTimeout(r, ms))
}


export class Deferred {
    #name = ''
    #resolve = null
    #reject = null
    #promise = null
    #status = 'pending'
    #opts = null
    #timeoutId = null
    #startTime = null

    constructor(name = 'noname', opts) {
        this.#name = name
        this.#promise = new Promise((res, rej) => {
            this.#resolve = res
            this.#reject = rej
        });
        this.#opts = Object.assign({
            timeout: null,
            trace: false,
            timeoutMsg: null,
            /** overvrite the regular onTimeout method - returns true to stop the regular processing */
            timeoutCallBack: null,
            /** @todo  unexpectedStatusFails: true for integration tests and false for perfs tests */
            unexpectedStatusFails: false
        }, opts ?? {})
        const timeout = this.opts.timeout
        this.opts.trace && myConsole.lowlight(`Deferred.${this.name}.create - Status:${this.#status} - timeout: ${timeout ?? 'none'}`)
        this.#startTime = new Date().getTime()
        if (isNumber(timeout)) {
            this.#timeoutId = setTimeout(this.#onTimeout.bind(this), timeout)
        }
    }
    destroy() {
        this.#clearTimeout()
        if (this.isPending()) {
            this.reject(new Error(`Deferred.${this.name}.destroy while status is pending`))
        }
        this.#clearPromise()
    }
    #clearPromise() {
        this.#resolve = null
        this.#reject = null
        this.#promise = null
        this.#startTime = null
    }
    #clearTimeout() {
        this.opts.trace && myConsole.lowlight(`Deferred.${this.name}.clearTimeout`)
        if (this.#timeoutId) {
            clearTimeout(this.#timeoutId)
            this.#timeoutId = null
        }
    }
    get name() {
        return this.#name
    }
    get status() {
        return this.#status
    }
    setStatus(status) {
        this.#opts.trace && myConsole.lowlight(`Deferred.${this.name}.setStatus - Old:${this.status} ${status}`)
        this.#status = status
        this.#clearTimeout()
        this.#clearPromise()
    }
    get promise() {
        return this.#promise
    }
    /** ms since the creation of the deferred */
    get elapsed() {
        return this.#startTime ? new Date().getTime() - this.#startTime : -1
    }
    get opts() {
        return this.#opts
    }
    #onTimeout() {
        let timeoutMsg = this.opts.timeoutMsg
        if (timeoutMsg && typeof timeoutMsg == 'function') {
            timeoutMsg = timeoutMsg()
        }
        const msg = `Deferred.${this.name}.onTimeout.${this.opts.timeout}.ms - Elapsed[${this.elapsed}]${timeoutMsg ? `\n${timeoutMsg}` : ''}`
        if (this.opts.timeoutCallBack != null && this.opts.timeoutCallBack(this, msg) === true) {
            /** reject/resolve on timeout is handled by timeoutCallBack*/
            return
        }
        /** default action -> reject */
        this.reject(new Error(msg))
    }
    #checkValidity(method, reason = '') {
        this.opts.trace && myConsole.lowlight(`Deferred.${this.name}.${method} - Status:${this.status}\nReason: ${reason ?? 'none'}`)
        if (!this.#resolve || !this.#reject) {
            throw new Error(`Deferred.${this.name}.${method}.checkValidity - Unexpected NULL resolve or reject - Deferred has already been rejected/resolved`)
        }
        if (this.#status !== 'pending') {
            const msg = `Deferred.${this.name}.${method} - Unexpected status - Got: '${this.status}' - Expected: 'pending'\nReason: ${reason ?? 'none'}`
            myConsole.warning(msg)
            if (this.opts.unexpectedStatusFails === true) {
                this.#reject(new Error(msg))
                this.setStatus('rejected')
                return false
            }
        }
        return true
    }
    resolve(msg) {
        msg ??= 'no resolve message'
        if (!this.#checkValidity('resolve', msg)) {
            return
        }
        this.#resolve.call(null, msg)
        this.setStatus('resolved')
    }
    reject(error) {
        error ??= 'no reject message'
        if (!error instanceof Error) {
            error = new Error(error.toString())
        }
        if (!this.#checkValidity('reject', error.message)) {
            return
        }
        this.#reject.call(null, error)
        this.setStatus('rejected')
    }
    isPending() {
        return this.#status == 'pending'
    }
    isFulfilled() {
        return this.#status == 'resolved'
    }
    isRejected() {
        return this.#status == 'rejected'
    }
}
