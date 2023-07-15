"use strict";

import chalk from 'chalk'
import lineByLine from 'n-readlines'
import myConsole from '../commons/myConsole'
import EntityProcessorsMap from './EntityProcessorsMap'
/** see http://numeraljs.com */
import _numeral from 'numeral'
/** See https://momentjs.com and https://momentjs.com/timezone/ */
import _moment from 'moment-timezone'


const _initLocaleAndTimeZone = async (opts) => {
    opts = Object.assign({
        locale: 'fr',
        timeZone: 'Europe/Paris'
    }, opts ?? {})
    try {
        /** Loads and register the locale provided by numeral */
        const res = await import(`numeral/locales/${opts.locale}`)
    } catch (e) {
        throw new Error(`'numeral' module do not provide the local '${opts.locale}. You must register the locale manually (see documention)`, {
            cause: e
        })
    }
    /** Default format used to parse numbers */
    _numeral.locale(opts.locale)
    try {
        /** Loads the locale provided by moment */
        const res = await import(`moment/locale/${opts.locale}`)
    } catch (e) {
        throw new Error(`'moment' module do not provide the local '${opts.locale}`, {
            cause: e
        })
    }
    _moment().local(opts.locale)
    /** Default timeZone used to convert UTC dates taht are used by the backend */
    _moment.tz.setDefault(opts.timeZone)
}
/** 
 * Fr by default 
 * @TODO export method
 */
_initLocaleAndTimeZone()

class CSV2JSON {
    #entityProcessorsMap = null
    #lineNumber = 0
    #tagLineNumber = 0
    #currentEntityProcessor = null
    #resultJson = {}
    constructor(opts) {
        opts = Object.assign({
            verbose: false
        }, opts ?? {})
        this.#entityProcessorsMap = new EntityProcessorsMap({
            verbose: opts.verbose
        })
    }
    get entityProcessorsMap() {
        return this.#entityProcessorsMap
    }
    get lineNumber() {
        return this.#lineNumber
    }
    get tagLineNumber() {
        return this.#tagLineNumber
    }
    get currentEntityProcessor() {
        return this.#currentEntityProcessor
    }
    set currentEntityProcessor(processor) {
        if (this.#currentEntityProcessor) {
            const data = this.#currentEntityProcessor.processEnd(this.resultJson)
            myConsole.lowlight(`-process.${this.#currentEntityProcessor.tagName}.${this.#currentEntityProcessor.entityId}.done.${data.length}`)
        }
        this.#currentEntityProcessor = processor
    }
    get resultJson() {
        return this.#resultJson
    }
    run(csvFilePath) {
        const errors = []
        let nbOk = 0
        this.#lineNumber = 0
        const liner = new lineByLine(csvFilePath)
        do {
            let lineStr
            try {
                lineStr = liner.next()
                if (lineStr === false) {
                    /** Ends up current processor */
                    this.currentEntityProcessor = null
                    break
                }
                this.#lineNumber++
                this.#tagLineNumber++
                lineStr = lineStr.toString().trim()
                if (lineStr.length == 0) {
                    /** NEXT  */
                } else if (lineStr.startsWith('#')) {
                    this.processNewEntity(lineStr)
                    /** NEXT  */
                } else {
                    this.processLine(lineStr)
                    nbOk++
                }
            } catch (e) {
                e.stack ??= ''
                errors.push({
                    lineNumber: this.lineNumber,
                    tagName: this.currentEntityProcessor ? this.currentEntityProcessor.tagName : 'none',
                    tagLineNumber: this.tagLineNumber,
                    error: e,
                    line: lineStr
                })
                break
            }
        } while (true)
        if (errors.length == 0) {
            myConsole.color('green', `--> ${nbOk} lines processed with success`)
        } else {
            const errorsStr = errors.map(x => `${new String(x.lineNumber).padStart(3, '0')} ${chalk.red(x.error.message)}\n${x.tagName} [${x.tagLineNumber}]\n${x.line}\n${x.error.stack.split('\n').slice(1, 6).join('\n')}`).join('\n')
            myConsole.color('gray', `${chalk.red(`${errors.length} errors occured`)}\n${errorsStr}`)
        }
    }
    processLine(lineStr) {
        if (this.currentEntityProcessor == null) {
            throw new Error(`Line ${this.lineNumber} - No current entity - lineStr[${lineStr}]`)
        }
        this.currentEntityProcessor.processLine(lineStr, this.#tagLineNumber)
    }
    processNewEntity(lineStr) {
        this.#tagLineNumber = 0
        const tagName = lineStr
        const entityProcessor = this.entityProcessorsMap.getByTag(tagName)
        if (entityProcessor == null) {
            throw new Error(`Line ${this.lineNumber} - Tag[${tagName}] - Entity description not found`)
        }
        this.currentEntityProcessor = entityProcessor
        this.currentEntityProcessor.processBegin()
    }
}
export default CSV2JSON
