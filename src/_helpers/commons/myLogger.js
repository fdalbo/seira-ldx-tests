'use strict';

const path = require('path')
const fs = require('fs')
const _ = require('lodash')
const winston = require('winston')
const { checkParentPath } = require('./utils')
const { rimraf } = require('rimraf')
const { isMainThread, threadId } = require('worker_threads')
const { getEnvValues } = require('#env/defaultEnvVars')

const _myFormat = winston.format.printf(({ level, message, timestamp }) => {
    return `${timestamp} ${message}`
})


class Logger {
    #filePath = null
    #myLogger = null
    #fileName = null
    #opts = null
    constructor(logFilePath, opts) {
        this.#opts = Object.assign({
            /** see https://www.npmjs.com/package/winston#logging */
            level: 'debug',
            serviceName: 'seira-ldx-myLogger',
            threadPrefix: ''
        }, opts ?? {})
        if (logFilePath.trim() == 0) {
            throw new Error(`logFilePath is empty`)
        }
        if (!checkParentPath(logFilePath)) {
            throw new Error(`Logger file path '${logFilePath}' is not valid`)
        }
        this.#fileName = path.basename(logFilePath, '.log')
        if (this.opts.threadSafe !== true && !isMainThread) {
            this.#fileName = `${this.#fileName}.${process.pid}.w${threadId.toString().padStart(3, '0')}`
        }
        this.#filePath = path.resolve(path.dirname(logFilePath), `${this.#fileName}.log`)
        if (fs.existsSync(this.#filePath)) {
            rimraf.sync(this.#filePath)
        }
        this.#myLogger = winston.createLogger({
            level: this.opts.level,
            format: winston.format.combine(
                winston.format.timestamp({
                    format: 'HH:mm:ss.SSS'
                }),
                _myFormat
            ),
            defaultMeta: { service: this.opts.serviceName },
            transports: [
                new winston.transports.File({ filename: this.#filePath })
            ]
        })
        if (!_.isEmpty(this.threadPrefix)){
            this.opts.threadPrefix = `${this.opts.threadPrefix} `
        }
    }
    get threadPrefix() {
        return this.opts.threadPrefix ?? ''
    }
    get opts() {
        return this.#opts
    }
    get filePath() {
        return this.#filePath
    }
    get name() {
        return this.#fileName
    }
    get level() {
        return this.#myLogger && this.#myLogger.level
    }
    debug(message, ...splatArgs) {
        this.#myLogger && this.#myLogger.log.apply(this.#myLogger, ['debug', `${this.threadPrefix}${message}`, ...splatArgs])
    }
    info(message, ...splatArgs) {
        this.#myLogger && this.#myLogger.log.apply(this.#myLogger, ['info', `${this.threadPrefix}${message}`, ...splatArgs])
    }
    warn(message, ...splatArgs) {
        this.#myLogger && this.#myLogger.log.apply(this.#myLogger, ['warn', `${this.threadPrefix}${message}`, ...splatArgs])
    }
    error(message, ...splatArgs) {
        this.#myLogger && this.#myLogger.log.apply(this.#myLogger, ['error', `${this.threadPrefix}${message}`, ...splatArgs])
    }
    /**
     * 'error' level - log all
     */
    all(message, ...splatArgs) {
        this.#myLogger && this.#myLogger.log.apply(this.#myLogger, ['error', `${this.threadPrefix}${message}`, ...splatArgs])
    }
    close() {
        this.#myLogger && this.#myLogger.close()
    }

}

module.exports = function createLogger(logFilePath, myConsole, opts) {
    const myLogger = new Logger(path.resolve(logFilePath), opts)
    myLogger.info(`INIT LOGGER ${new Date().toDateString()}\nPath [${logFilePath}]`)
    myLogger.info(`process.pid='${process.pid}' - process.ppid='${process.ppid}' - ${isMainThread ? 'main-thread' : `Worker-thread=${threadId}`}`)
    /** filter env variables for unit tests (env variables are not set) */
    myLogger.info(`Default env vars:\n${getEnvValues().filter(x => !_.isEmpty(x.value)).map(x => `- ${x.name}='${x.value}'`).join('\n')}`)
    myConsole && myConsole.lowlight(`Creates myLogger '${myLogger.name}' - Level: '${myLogger.level}'\nFile[ ${myLogger.filePath}]`)
    return myLogger
}
