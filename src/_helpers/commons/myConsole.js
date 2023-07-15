'use strict';

import isNumber from 'is-number'
import chalk from 'chalk'
import clone from 'clone'
import _ from 'lodash'
import fs from 'fs'
import path from 'path'
import createLogger from '#commons/myLogger'
import { filename } from 'dirname-filename-esm'
import { isMainThread, threadId } from 'worker_threads'
import stripAnsi from 'strip-ansi'


const _Console = function () {
    let _traceConsole = null
    let _traceRequests = null
    let _traceResponses = null
    let _traceResponseBody = null
    let _traceResponseLength = null
    let loggerStack = []
    let _currentLogger = null
    const _t0 = (() => {
        let globalT0 = process.env.QS_TRACE_T0
        if (isNumber(globalT0)) {
            globalT0 = parseInt(globalT0)
        } else {
            globalT0 = new Date().getTime()
            process.env.QS_TRACE_T0 = globalT0.toString()
        }
        return globalT0
    })()
    /** 
     * MAIN -> Main node thread (scripts, runner...) 
     * W001 -> Worker thread N°1 (codes executed inside a worker)
     */
    const _threadPrefix = `${isMainThread ? `${chalk.cyan('MAIN')}` : `${chalk.green(`W${threadId.toString().padStart(3, '0')}`)}`}`

    const _errorProcessArgs = (argArray) => {
        argArray ??= []
        const newArgs = []
        for (const arg of argArray) {
            _displayError(arg, newArgs)
        }
        return newArgs
    }

    const _displayError = (err, output) => {
        if (!err) {
            return output
        }
        if (typeof err != 'object' || !err.message) {
            output.push(err.toString())
            return output
        }
        if (err.message) {
            output.push(chalk.redBright(`${err.message}`))
        }
        if (err.name === 'AssertionError') {
            /** chai assertion error */
            const o = Object.assign({}, err)
            delete o.message
            delete o.stack
            output.push(chalk.gray(JSON.stringify(o, null, 2)))
        }
        output.push(chalk.gray(`${err.stack ?? 'no stack'}`))
        if (err.cause) {
            output.push(chalk.redBright('CAUSE:'))
            _displayError(err.cause, output)
        } else {
            //  output.push(chalk.grey('NO CAUSE'))
        }
        return output
    }

    const _cleanupHttpError = (error) => {
        let err = error ?? {}
        while (err != null) {
            if (err.stack) {
                const idx = err.stack.findIndex(x => x.includes('sun.') || x.includes('java.') || x.includes('org.'))
                err.stack = err.stack.slice(0, idx)
            }
            err = err.stacktrace ?? err.cause ?? null
        }
        return error
    }

    const _processLoggerArgs = (args) => {
        /** strip-ansi removes chalk chars */
        return [args.map(x => typeof x == 'string' ? stripAnsi(x) : x).reduce((acc, x) => { acc.push(x); return acc }, []).join('\n')]
    }


    /************************************************************************************************************************
     *  EXPORTED METHODS
    /************************************************************************************************************************/
    /**
     * process env needs to be called each times because the first process doesn't have this variable available
     */
    this.setTraceEnvConfig = (p) => {
        if (process.env.SLDX_TRACE_CONSOLE == null) {
            /** 
             * value before loading env variables from .env 
             * call myConsole.enableConsole(true/false) at the begeging of the process to force to false
             */
            process.env.SLDX_TRACE_CONSOLE = true
        }
        const _isTrue = (varname) => {
            return process.env[varname] === 'true' || process.env[varname] === true
        }
        this.enableConsole(_isTrue('SLDX_TRACE_CONSOLE'))
        _traceRequests = _isTrue('SLDX_TRACE_HTTP_REQUESTS')
        _traceResponses = _isTrue('SLDX_TRACE_HTTP_RESPONSES')
        _traceResponseBody = _isTrue('SLDX_TRACE_HTTP_RESPONSE_BODY')
        _traceResponseLength = _isTrue('SLDX_TRACE_HTTP_RESPONSE_LENGTH')
        if (isNumber(_traceResponseLength)) {
            _traceResponseLength = parseInt(_traceResponseLength)
        } else {
            _traceResponseLength = 2000
        }
    }

    /** 
     * Initialize the myLogger with the name of js file
     * call initLoggerFromModule(import.meta js) from the js file
     * @param {string} import_meta provided by import.meta js file
     */
    this.initLoggerFromModule = async (import_meta) => {
        this.initLogger(path.basename(filename(import_meta), '.js'))
    }

    /** opts: {
     *      level: 'debug', 
     *      serviceName: 'qsfab-myLogger',
     *      false means that logFilePath is thead safe
     *      threadSafe: true
     * } 
     */
    this.initLogger = async (logFileName, opts) => {
        if (!process.env.SLDX_LOG_DIR) {
            this.warning(`Can't create qsConsolelogger [${logFileName}] - Process.env.SLDX_LOG_DIR is empty`)
            return
        }
        if (!fs.existsSync(process.env.SLDX_LOG_DIR)) {
            this.warning(`Can't create qsConsolelogger  [${logFileName}] - Folder '${process.env.SLDX_LOG_DIR}' not found`)
            return
        }
        logFileName ??= `myConsole.${process.id}`
        if (!logFileName.endsWith('.log')) {
            logFileName = `${logFileName}.log`
        }
        const logFilePath = path.resolve(process.env.SLDX_LOG_DIR, logFileName)
        _currentLogger = createLogger(logFilePath, this, opts)
        loggerStack.push(_currentLogger)
    }

    this.closeLogger = async () => {
        if (_currentLogger) {
            console.log('closeLogger', _currentLogger.filePath)
            await _currentLogger.close()
        }
        console.log('closeLogger end')
        loggerStack = loggerStack.filter(l => l != _currentLogger)
        _currentLogger = null
    }

    /**
     * Pushes a myLogger in myLogger stack
     * Embedded describe blocks can mamange their own myLogger
     * When JEST enter a block with '@log(logFile)' in the block's name we push a myLogger
     * When JEST exist a block with '@log(logFile)' in the block's name we pop a myLogger and restore the previous one if any
     * @param name Name of the log file extracted from the block's name
     * @param blockName Block's name without @log(..) info
     * @returns promise
     */
    this.jestPushLogger = async (loggerName, jestBlockName) => {
        if (_.isEmpty(loggerName) || _.isEmpty(jestBlockName)) {
            return
        }
        await this.initLogger(loggerName, {
            jestBlockName: jestBlockName
        })
        const message = `Process: ${process.pid} - QSConsole.pushLogger - Blockname '${jestBlockName}'\n\tCurrentLogger: ${_currentLogger?.opts?.jestBlockName ?? 'Aucun'}\n`
        this.loggerAll(message)
    }
    this.jestPopLogger = async (jestBlockName) => {
        if (loggerStack.length == 0) {
            return
        }
        // this.lowlight(`Process: ${process.pid} - PopLogger - blockName: '${blockName}'`)
        const _msg = (msg = '') => {
            return `Process: ${process.pid} - QSConsole.popLogger.${jestBlockName} - Current: ${_currentLogger?.opts?.jestBlockName ?? 'aucun'}' ${msg}`
        }
        if (!_currentLogger || _currentLogger.opts?.jestBlockName != jestBlockName) {
            this.warning(_msg(`- Same qsBlockName expected loggerStack.length=${loggerStack.length}`))
            return
        }
        this.loggerAll(_msg())
        loggerStack.pop()
        _currentLogger = loggerStack[loggerStack.length - 1]
        this.loggerAll(_msg())
    }

    this.enableConsole = (yes = true) => {
        if (_traceConsole == null || _traceConsole != yes) {
            console.log(chalk.magentaBright(`console ${yes ? 'enabled' : 'disbaled'}`))
        }
        _traceConsole = yes == true
    }

    const _consoleLog = (...args) => {
        if (_traceConsole !== true) {
            return
        }
        const d = new Date()
        d.setTime(new Date().getTime() - _t0)
        const prefix = chalk.gray(`${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}:${d.getMilliseconds().toString().padStart(3, '0')}`)
        console.log.apply(console, [_threadPrefix, prefix, ...args])
    }

    this.hasLoger = () => {
        return _currentLogger != null
    }
    this.loggerFilePath = () => {
        return this.hasLoger() ? _currentLogger.filePath : 'No Logger File'
    }

    this.highlight = (...args) => {
        /** Console & logging Always available */
        this.loggerAll.apply(this, args)
        _traceConsole && _consoleLog(chalk.magentaBright.apply(chalk, args))
    }
    this.lowlight = (...args) => {
        /** !! Console & logging Always available */
        this.loggerAll.apply(this, args)
        _traceConsole && _consoleLog(chalk.gray.apply(chalk, args))
    }
    this.mediumlight = (...args) => {
        /** !! Console & logging Always available */
        this.loggerAll.apply(this, args)
        _traceConsole && _consoleLog(chalk.yellow.apply(chalk, args))
    }
    this.superhighlight = (...args) => {
        /** !! Console & logging Always available */
        this.loggerAll.apply(this, args)
        _traceConsole && _consoleLog(chalk.yellowBright.apply(chalk, args))
    }
    this.describeBlock = (...args) => {
        /** !! Console Always available */
        this.loggerAll.apply(this, args)
        _traceConsole && _consoleLog(chalk.bold.apply(chalk, args))
    }
    this.red = (...args) => {
        /** !! Console & logging Always available */
        this.loggerAll.apply(this, args)
        _traceConsole && _consoleLog(chalk.redBright.apply(chalk, args))
    }
    this.lowlightGreen = (...args) => {
        args.unshift('#6c8d88')
        this.color.apply(this, args)
    }
    this.lowlightRed = (...args) => {
        args.unshift('#a64040')
        this.color.apply(this, args)
    }
    this.warningLowlight = (...args) => {
        args.unshift('#958820')
        this.color.apply(this, args)
    }
    this.color = (color, ...args) => {
        color ??= 'grey'
        /** !! Console Always available */
        this.loggerInfo.apply(this, args)
        if (color.startsWith('#')) {
            _traceConsole && _consoleLog(chalk.hex(color).apply(chalk, args))
        } else {
            _traceConsole && _consoleLog(chalk[color].apply(chalk, args))
        }
    }
    this.log = _consoleLog

    this.error = (...args) => {
        args = [`\nAn error has occurred\nLog file: ${this.loggerFilePath()}\n`, ..._errorProcessArgs(args), '']
        _traceConsole && _consoleLog(chalk.red.call(chalk, args.join('\n')))
        this.loggerAll.apply(this, args)
    }
    this.warning = (...args) => {
        this.loggerWarn.apply(this, args)
        _traceConsole && _consoleLog(chalk.yellow.apply(chalk, args))
    }
    this.errorExit = (...args) => {
        const timeout = 300
        const newArgs = [`\nEXIT PROCESS on error\n\n`].concat(args)
        newArgs.push('\n\n')
        this.error.apply(this, newArgs)
        /**
         * timeout: setTimeout to let the time to flush stdout/stderr in the console
         */
        setTimeout(() => process.exit(1), timeout)
        /**
         * Code below doesn't work because _consoleLog is asynchronous and the pending job is stopped by process.exit
         * -> the error message is not displayed
         * See https://github.com/nodejs/node/blob/master/doc/api/process.md#processexitcode 
         * See https://github.com/nodejs/node/blob/master/doc/api/process.md#a-note-on-process-io
         * const x =['EXIT PROCESS:'].concat(args)
         * this.error.apply(this, x)
         * process.exit(ERROR_CODE)
         */
    }

    this.trace = (...args) => {
        this.loggerDebug.apply(this, args)
        _traceConsole && _consoleLog(chalk.italic(chalk.cyanBright.apply(chalk, args)))
    }

    this.traceResponse = (messageOrResponse, response) => {
        try {
            if (_traceResponses !== true) {
                return
            }
            // To not modify the original
            const responseBody = clone(response?.body ?? {})
            const message = []
            if (typeof messageOrResponse === 'string') {
                message.push(messageOrResponse)
            } else {
                response = messageOrResponse
            }
            let isJson = false
            if (response && response.status && responseBody) {
                if (response.request) {
                    message.push(`${response.request.method} - ${response.request.url}`)
                }
                message.push(`Status: ${response.status} - Headers: ${JSON.stringify(response.header, null, 2)}`)
                const ct = response.header['Content-Type'] ?? response.header['content-type'] ?? ''
                isJson = ct.indexOf('application/json') >= 0
                if (isJson && responseBody.error) {
                    if (responseBody.error.message) {
                        // 500 errors ?? .error
                        message.push(`Error Message:\n${responseBody.error.message}`)
                    }
                    if (responseBody.error.details && responseBody.error.details.length > 1) {
                        // first detail is the error message
                        message.push(`Error Details:\n${responseBody.error.details.slice(1).join('\n')}`)
                    }
                }
            }
            _traceConsole && _consoleLog(chalk.italic(chalk[response.status >= 400 ? 'red' : 'green'].apply(chalk, [message.join('\n')])))
            if (_traceResponseBody !== true) {
                this.loggerDebug(message.join('\n'))
                return
            }
            if (isJson) {
                message.push('Data:')
                if (responseBody.error) {
                    /** Cleanup huge java stack :-( */
                    responseBody.error = _cleanupHttpError(responseBody.error)
                }
                message.push(JSON.stringify(responseBody, null, 2).slice(0, _traceResponseLength))
            } else if (response?.text) {
                //this.loggerDebug('This is not a JSON payload - Print TEXT')
                message.push('This is not a JSON payload - Print TEXT')
                /** This is not the JSON - Print TEXT */
                //this.loggerDebug(response.text.slice(0, _traceResponseLength))
                message.push(response.text.slice(0, _traceResponseLength))
            } else {
                //this.loggerDebug('This is not a JSON payload - response.text is null')
                message.push('This is not a JSON payload - response.text is null')
            }
            this.loggerDebug(message.join('\n'))
        } catch (e) { this.error(e) }
    }

    /**
     * 
     * @param { string or superTestRequest} messageOrRequest 
     * @param {superTestRequest} request 
     * @param {obj} params 
     * @returns 
     */
    this.traceRequest = (messageOrRequest, request, params) => {
        if (_traceRequests !== true) {
            return
        }
        const message = []
        if (typeof messageOrRequest === 'string') {
            message.push(messageOrRequest)
        } else {
            request = messageOrRequest
        }
        if (!request) {
            message.push('no request to trace')
            this.loggerDebug(message.join('\n'))
            return
        }
        let url
        if (!_.isEmpty(params)) {
            /**
             * the params are serialized by .query(p) method and are not available in superTestRequest.url at this stage
             * we serialize the params by our own
             */
            const qs = new URLSearchParams(params)
            url = `${request.url}?${qs.toString()}`
        } else {
            url = request.url
        }
        message.push(`${request.method} - ${url}`)
        if (request.header) {
            const h = Object.assign({}, request.header)
            if (false && h.Authorization) {
                h.Authorization = h.Authorization.slice(-40)
            }
            message.push(`Headers: ${JSON.stringify(h, null, 2)}`)
        }
        _traceConsole && _consoleLog(chalk.italic(chalk.blue.apply(chalk, [message.join('\n')])))
        if (request._data) {
            message.push('data')
            message.push(JSON.stringify(request._data || {}, null, 2))
        }
        this.loggerDebug(message.join('\n'))
    }

    /** Log in loger file (no console) */
    this.loggerDebug = (...args) => {
        _currentLogger && _currentLogger.debug.apply(_currentLogger, _processLoggerArgs(args))
    }
    this.loggerInfo = (...args) => {
        _currentLogger && _currentLogger.info.apply(_currentLogger, _processLoggerArgs(args))
    }
    this.loggerWarn = (...args) => {
        _currentLogger && _currentLogger.warn.apply(_currentLogger, _processLoggerArgs(args))
    }
    this.loggerAll = (...args) => {
        _currentLogger && _currentLogger.all.apply(_currentLogger, _processLoggerArgs(args))
    }

}
/**
 * JEST loads the console module before executing the script in the same process
 * --> normaly we should have one instance/evaluation of a module per process
 * We store the console in process.sldxGlobals in order to retreive and create the console if not exists
 * Useful to push/pop loggers with the name of the test file that is executed
 */
const globalsKey = `qsconsole_${process.pid}`
/** Same as for jestContext.js */
if (!process.sldxGlobals) process.sldxGlobals = {}
if (!process.sldxGlobals[globalsKey]) {
    const konsole = new _Console()
    /** default config */
    konsole.setTraceEnvConfig(process)
    process.sldxGlobals[globalsKey] = konsole
} else {
    const konsole = process.sldxGlobals[globalsKey]
    /** 
     * Update status with SLDX_TRACE_CONSOLE env variable of the current process
     * SLDX_TRACE_CONSOLE,... may have not been initialized by the proccess that created the myConsole
     */
    konsole.setTraceEnvConfig(process)
}
export default process.sldxGlobals[globalsKey]



