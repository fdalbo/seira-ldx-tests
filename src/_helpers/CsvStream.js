'use strict';

const csv = require('fast-csv')
const fs = require('fs')
const path = require('path')
const dateFormat = require('dateformat')
const myConsole = require('#commons/myConsole')

module.exports = class CSVStream {
    #csvFilePath = null
    #csvStream = null
    #startTime = null
    #opts = null
    constructor(opts) {
        this.#startTime = new Date().getTime()
        this.#opts = Object.assign({
            headers: true,
            override: true,
            filePath: null
        }, opts ?? {})
        this.#open()
    }
    get opts() {
        return this.#opts
    }
    get csvFilePath() {
        return this.#csvFilePath
    }
    get writeProperties() {
        return this.opts.writeProperties
    }
    get className() {
        return this.constructor.name;
    }
    destroy() {
        this.#close()
    }
    #open() {
        if (this.opts.override !== true) {
            const dateStr = dateFormat(new Date(), 'yyyy-mm-dd-HH-MM-ss')
            const extname = path.extname(this.opts.filePath)
            const nameNoExt = path.basename(this.opts.filePath, extname)
            this.#csvFilePath = this.opts.filePath.replace(
                path.basename(this.opts.filePath),
                `${nameNoExt}-${dateStr}${extname}`)
        } else {
            this.#csvFilePath = this.opts.filePath
        }
        /** Add a first line headers with the name of the json properties (write) */
        this.#csvStream = csv.format({ headers: this.opts.headers })
        if (fs.existsSync(this.csvFilePath)) {
            fs.rmSync(this.csvFilePath)
        }
        const fileStream = fs.createWriteStream(this.csvFilePath)
        this.#csvStream.pipe(fileStream)
            .on('error', (e) => {
                myConsole.highlight(`${this.className} error\nPath: ${this.csvFilePath}`, e)
            })
            .on('open', () => {
                myConsole.highlight(`${this.className} opened\nPath: ${this.csvFilePath}`)
            })
            .on('close', () => {
                myConsole.highlight(`${this.className} closed \nPath: ${this.csvFilePath}`)
            })
        return this.#csvStream
    }
    #close() {
        try {
            this.#csvStream && this.#csvStream.end()
            this.#csvStream = null
        } catch (e) {
            myConsole.error(`Error closing stream\n${this.csvFilePath}`, e)
        }
    }
    write(emitter, metricId, jsonObj) {
        jsonObj ??= {}
        const now = new Date().getTime()
        const res = {
            timeSec: Math.floor((now - this.#startTime) / 1000),
            // timeStamp: now,
            emitter: emitter,
            metricId: metricId
        }
        for (const p of this.writeProperties) {
            res[p] = jsonObj[p]
        }
        this.#csvStream && this.#csvStream.write(res)
    }
}