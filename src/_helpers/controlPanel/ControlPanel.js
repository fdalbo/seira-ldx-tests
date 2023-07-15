"use strict";

const os = require('os')
const _ = require('lodash')
const terminalUpdate = require('log-update')
const chalk = require('chalk')
const indentString = require('indent-string')
const figures = require('figures')
const { pause } = require('#commons/promises')
const myConsole = require('#commons/myConsole')

const _clearTerminal = (isSoft = true) => {
    if (os.platform() == 'win32') {
        process.stdout.write(
            isSoft ? '\x1B[H\x1B[2J' : '\x1B[2J\x1B[3J\x1B[H\x1Bc'
        )
        return
    } else {
        process.stdout.write('\x1Bc')
    }
}

module.exports = class ControlPanel {
    #intervalId = null
    #config = null
    #tasks = null
    #runningTasksStack = []
    #status = null
    #startTime = null
    #opts = null
    constructor(taskList, opts) {
        this.#tasks = taskList ?? []
        this.#opts = Object.assign({
            debug: false
        }, opts ?? {})
    }
    get periodRefresh() {
        return this.config.periodRefresh
    }
    get opts() {
        return this.#opts
    }   
    get config() {
        return this.#config
    }
    get tasks() {
        return this.#tasks
    }
    get isOpened() {
        return this.#status === 'opened'
    }
    initConfig(config) {
        this.#config = Object.assign({
            periodRefresh: 200

        }, config ?? {})
        this.config.periodRefresh = Math.max(this.config.periodRefresh, 200)
    }
    addTasks(...tasks) {
        tasks.forEach(task => this.tasks.push(task))
    }
    async open(config) {
        this.#startTime = new Date().getTime()
        this.initConfig(config)
        _clearTerminal()
        this.displayOpen()
        this.#status = 'opened'
        this.render()
        await pause(500)
    }
    openGetContext(enhanced) {
        return [
            `${figures.arrowRight} ${chalk.cyan('Context')}:`,
            chalk.grey(`  ${figures.arrowRight} ${enhanced(`server[${new URL(process.env.SLDX_PROXY_HOST).hostname}] - company[${process.env.QS_COMPANY}] - useIot[${process.env.QS_USE_QSIOT}]`)}`),
            ''
        ]
    }
    displayOpen() {
        const _enhanced = chalk.whiteBright
        let openInfo = [
            '',
            chalk.green(`\nOpen Control Panel`),
            ''
        ]
        const context = this.openGetContext(_enhanced)
        if (context.length > 0) {
            openInfo.push(`${figures.arrowRight} ${chalk.cyan('Context')}:`)
            openInfo.push(indentString(context.join('\n'), 2))
        }
        // Tasks
        openInfo.push(`${figures.arrowRight} ${chalk.cyan('Tasks')}:`)
        const text = openInfo.join('\n')
        myConsole.log(chalk.grey(text))
        if (this.opts.debug !== true){
            myConsole.enableConsole(false)
        }
        terminalUpdate.clear()
    }
    async close(error, exitProcess = true) {
        if (!this.isOpened) {
            return
        }
        try {
            this.#status = 'closed'
            this.stopRefreshScreen()
            /** force display */
            this.startRefreshScreen(true)
            await pause(1000)
            if (error) {
                for (const t of this.#runningTasksStack) {
                    t.error(error)
                }
            }
        } catch (e) {
            myConsole.error('!! Error closing control panel', e)
        } finally {
            await this.displayClose(error)
            if (exitProcess === true) {
                myConsole.highlight('Exit process')
            }
        }
    }
    async displayClose(error) {
        try {
            const currentTask = this.peekRunningTask()
            let text = error ? `Control Panel Closed (error task '${currentTask ? currentTask.title : 'no task'}')` : `Control Panel Closed (success)`
            myConsole.enableConsole(true)
            if (error) {
                text = chalk.red(`Control Panel Closed (error task '${currentTask ? currentTask.title : 'no task'}')`)
                myConsole.error(text, error)
                text = `${text}\n${error.message}`
            } else {
                text = chalk.green(`Control Panel Closed (success)`)
                myConsole.log(text)
            }
            // Needs some time to refresh the console
            await pause(200)
        } catch (e) {
            myConsole.error('!! Error closing (finally) control panel', e)
        }
    }
    stopRefreshScreen() {
        if (this.#intervalId) {
            clearInterval(this.#intervalId)
            this.#intervalId = null
        }
    }
    elapsedStart() {
        return new Date().getTime() - this.#startTime
    }
    pushRunningTask(task) {
        this.#runningTasksStack.push(task)
        return task
    }
    popRunningTask() {
        const task = this.#runningTasksStack.pop()
        return task
    }
    peekRunningTask() {
        return this.#runningTasksStack.at(this.#runningTasksStack.length - 1)
    }
    render(forceRender = false) {
        if (!this.isOpened) {
            return
        }
        this.stopRefreshScreen()
        this.startRefreshScreen(forceRender)
        this.#intervalId = setInterval(() => this.startRefreshScreen(), this.periodRefresh)
    }
    getScreenText(forceRender) {
        return this.tasks.map(x => x.render(forceRender))
    }
    startRefreshScreen(forceRender = false) {
        const text = this.getScreenText(forceRender).concat('').join('\n')
        /** Update terminal */
        terminalUpdate(indentString(text, 2))
    }
}