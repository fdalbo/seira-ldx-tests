'use strict';

const isNumber = require('is-number')
const _ = require('lodash')
const fs = require('fs')
const path = require('path')
const { format: prettyFormat } = require('pretty-format')
const createLogger = require('#commons/myLogger')
const { isMainThread, threadId } = require('worker_threads')
const stripAnsi = require('strip-ansi')
const chalk = require('chalk')


const _Console = function () {
    let _traceConsole = null
    let _traceHttpRequests = null
    let _traceHttpResponses = null
    let _traceHttpLength = null
    let loggerStack = []
    let _currentLogger = null
    const _t0 = (() => {
        let globalT0 = process.env.SLDX_TRACE_T0
        if (isNumber(globalT0)) {
            globalT0 = parseInt(globalT0)
        } else {
            globalT0 = new Date().getTime()
            process.env.SLDX_TRACE_T0 = globalT0.toString()
        }
        return globalT0
    })()
    /** 
     * MAIN -> Main node thread (scripts, runner...) 
     * W001 -> Worker thread N°1 (codes executed inside a worker)
     */
    this.threadId = `${isMainThread ? 'MAIN' : `W${threadId.toString().padStart(isNumber(process.env.SLDX_CONSOLE_THREAD_NBDIGITS) ? parseInt(process.env.SLDX_CONSOLE_THREAD_NBDIGITS) : 3, '0')}`}`
    const threadPrefix = `${isMainThread ? `${chalk.cyan(this.threadId)}` : `${chalk.green(this.threadId)}`}`

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

    const _processLoggerArgs = (args) => {
        /** strip-ansi removes chalk chars */
        return [args.map(x => typeof x == 'string' ? stripAnsi(x) : x).join('')]
    }

    /************************************************************************************************************************
     *  EXPORTED METHODS
    /************************************************************************************************************************/
    /**
     * process env needs to be called each times because the first process doesn't have this variable available
     */
    this.setTraceEnvConfig = (p) => {
        if (process.env.SLDX_CONSOLE_TRACE == null) {
            /** 
             * value before loading env variables from .env 
             * call myConsole.enableConsole(true/false) at the begeging of the process to force to false
             */
            process.env.SLDX_CONSOLE_TRACE = true
        }
        const _isTrue = (varname) => {
            return process.env[varname] === 'true' || process.env[varname] === true
        }
        this.enableConsole(_isTrue('SLDX_CONSOLE_TRACE'))
        _traceHttpRequests = _isTrue('SLDX_TRACE_HTTP_REQUESTS')
        _traceHttpResponses = _isTrue('SLDX_TRACE_HTTP_RESPONSES')
        _traceHttpLength = _isTrue('SLDX_TRACE_HTTP_LENGTH')
        if (isNumber(_traceHttpLength)) {
            _traceHttpLength = parseInt(_traceHttpLength)
        } else {
            _traceHttpLength = 2000
        }
    }

    /** 
     * Initialize the myLogger with the name of js file
     * call initLoggerFromModule(import.meta js) from the js file
     * @param {string} import_meta provided by import.meta js file for esm ou __filename for commonjs
     */
    this.initLoggerFromModule = (import_meta, opts) => {
        import_meta ??= 'noname'
        /** 
         * with esm  initLoggerFromModule(import.meta)
         *      import  { filename as filenameEsm } from 'dirname-filename-esm'
         *      this.initLogger(filenameEsm(import_meta), '.js'))
         * with commonjs  initLoggerFromModule(__filename)
         *       this.initLogger(path.basename(import_meta, '.js'))
         */
        let name
        if (import_meta.endsWith('.js')) {
            name = path.basename(import_meta, '.js')
        } else {
            name = import_meta
        }
        this.initLogger(name, opts)
    }

    /** opts: {
     *      level: 'debug', 
     *      serviceName: 'qsfab-myLogger',
     *      false means that logFilePath is thead safe
     *      threadPrefix: threadName
     * } 
     */
    this.initLogger = (logFileName, opts) => {
        opts = Object.assign({
            /** force log dir */
            logDirPath: process.env.SLDX_LOG_DIR_PATH,
            threadPrefix: this.threadId
        }, opts ?? {})
        if (_.isEmpty(opts.logDirPath)) {
            this.warning(`Can't create logger [${logFileName}] - Process.env.SLDX_LOG_DIR_PATH is empty`)
            return
        }
        if (!fs.existsSync(opts.logDirPath)) {
            this.warning(`Can't create logger  [${logFileName}] - Folder '${opts.logDirPath}' not found`)
            return
        }
        logFileName ??= `myConsole.${process.id}`
        if (!logFileName.endsWith('.log')) {
            logFileName = `${logFileName}.log`
        }
        const logFilePath = path.resolve(opts.logDirPath, logFileName)
        _currentLogger = createLogger(logFilePath, this, opts)
        loggerStack.push(_currentLogger)
    }

    this.closeLogger = () => {
        if (_currentLogger) {
            console.log('closeLogger', _currentLogger.filePath)
            _currentLogger.close()
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
    this.jestPushLogger = (loggerName, jestBlockName) => {
        if (_.isEmpty(loggerName) || _.isEmpty(jestBlockName)) {
            return
        }
        this.initLogger(loggerName, {
            jestBlockName: jestBlockName
        })
        const message = `Process: ${process.pid} - QSConsole.pushLogger - Blockname '${jestBlockName}'\n\tCurrentLogger: ${_currentLogger?.opts?.jestBlockName ?? 'Aucun'}\n`
        this.loggerAll(message)
    }
    this.jestPopLogger = (jestBlockName) => {
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
        const oldState = _traceConsole == true
        const newSate = yes == true
        if (newSate != oldState) {
            console.log(chalk.magentaBright(`${threadPrefix} console ${newSate ? 'enabled' : 'disabled'}`))
        }
        _traceConsole = newSate
    }

    const _consoleLog = (...args) => {
        if (_traceConsole !== true) {
            return
        }
        const d = new Date()
        d.setTime(new Date().getTime() - _t0)
        const prefix = chalk.gray(`${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}:${d.getMilliseconds().toString().padStart(3, '0')}`)
        console.log.apply(console, [prefix, threadPrefix, ...args])
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
    this.superhighlight = (...args) => {
        /** !! Console & logging Always available */
        this.loggerAll.apply(this, args)
        _traceConsole && _consoleLog(chalk.yellowBright.apply(chalk, args))
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

    this.logHttpResponseBody = (headers, data) => {
        if (_traceHttpResponses !== true) {
            return
        }
        this.loggerDebug('Response Headers')
        this.loggerDebug(prettyFormat(headers))
        if (_.isEmpty(data)) {
            this.loggerDebug('Response Body[no data]')
            return
        }
        this.loggerDebug('Response Body')
        this.loggerDebug(prettyFormat(data).substring(0, _traceHttpLength))
    }

    this.logHttpRequestBody = (...args) => {
        if (_traceHttpRequests !== true) {
            return
        }
        if (_.isEmpty(args)) {
            return
        }
        /** file logger only  */
        this.loggerDebug(prettyFormat(args).substring(0, _traceHttpLength))
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
const globalsKey = `lsdxconsole_${process.pid}`
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
     * Update status with SLDX_CONSOLE_TRACE env variable of the current process
     * SLDX_CONSOLE_TRACE,... may have not been initialized by the proccess that created the myConsole
     */
    konsole.setTraceEnvConfig(process)
}

module.exports = process.sldxGlobals[globalsKey]



