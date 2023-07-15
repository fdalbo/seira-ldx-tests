const _ = require('lodash')
const path = require('path')
const elegantSpinner = require('elegant-spinner')
const chalk = require('chalk')
const indentString = require('indent-string')
const figures = require('figures')
const { expect: chaiExpect } = require('chai')
const myConsole = require('#commons/myConsole')

const STATUS = Object.freeze({
    WAITING: {
        name: "wait",
        color: chalk.grey,
        symbol: '*'
    },
    RUNNING: {
        name: "run",
        color: chalk.yellow,
        // spinner is a function
        symbol: null
    },
    SUCCESS: {
        name: "success",
        color: chalk.green,
        symbol: figures.tick
    },
    ERROR: {
        name: "error",
        color: chalk.red,
        symbol: figures.cross
    },
    SKIPPED: {
        name: "skipped",
        color: chalk.cyan,
        symbol: figures.lozenge
    }
})

module.exports = class Task {
    #title = null
    #spinner = elegantSpinner()
    #status = STATUS.WAITING
    #subTasks = []
    #controller = null
    #parent = null
    #level = null
    #indent = null
    #controlledTask = false
    #children = []
    constructor(parent, title, controller) {
        this.#title = title ?? ''
        this.#parent = parent
        if (parent == null) {
            this.#controller = controller
        } else {
            parent.addChild(this)
            this.#controller = this.parent.controller
        }
        chaiExpect(this.controller, 'unexpected null controller').to.exist
        this.#level = parent ? parent.level + 1 : 1
        this.#indent = 0 + (this.level - 1) * 4
    }
    addChild(task) {
        task && this.#children.push(task)
    }
    get isLeaf() {
        return this.#children.length === 0
    }
    get className() {
        return this.constructor.name;
    }
    render(force = false) {
        if (this.skipRender) {
            return ''
        }
        const res = [indentString(this.renderLines(force), this.indent)]
        if (this.subTasks.length > 0) {
            for (const subTask of this.subTasks) {
                subTask.skipRender !== true && res.push(subTask.render(force))
            }
        }
        return res.join('\n')
    }
    /** A STRING with \n if multiple lines - default is title*/
    renderLines(force) {
        return this.status.color(`${this.statusSymbol} ${this.title}`)
    }
    triggerRender(force = false) {
        this.controller.render(force)
    }
    get level() {
        return this.#level
    }
    get indent() {
        return this.#indent
    }
    get parent() {
        return this.#parent
    }
    get controller() {
        return this.#controller
    }
    get skipRender() {
        return this.title.length == 0
    }
    set subTasks(subTasks) {
        this.#subTasks = subTasks ?? []
    }
    get subTasks() {
        return this.#subTasks
    }
    get status() {
        return this.#status
    }
    get isWaiting() {
        return this.#status === STATUS.WAITING
    }
    get isSkipped() {
        return this.#status === STATUS.SKIPPED
    }
    get isRunning() {
        return this.#status === STATUS.RUNNING
    }
    get isDone() {
        return this.#status === STATUS.SUCCESS || this.#status === STATUS.ERROR || this.#status === STATUS.SKIPPED
    }
    setStatus(status, render = true) {
        if (this.#status === status || this.isDone) {
            return
        }
        this.#status = status
        render && this.triggerRender()
    }
    setTitle(title, render = true) {
        if (this.#title === title) {
            return
        }
        this.#title = title ?? ''
        render && this.triggerRender()
    }
    get title() {
        return this.#title
    }
    get statusSymbol() {
        if (this.status === STATUS.RUNNING) {
            return this.#spinner()
        }
        return this.status.symbol
    }
    /**
     * 
     * @param {Boolean} controlledTask 
     * false to not put the task in the task stack (independant  task)
     */
    start(render = true, controlledTask = true) {
        this.setStatus(STATUS.RUNNING, render)
        this.#controlledTask = controlledTask === true
        if (this.#controlledTask) {
            this.controller.pushRunningTask(this)
        }
    }
    done(render = true) {
        for (const subtask of this.subTasks ?? []) {
            // render is done by this.setStatus
            subtask.done(false)
        }
        /** Forces display success (green) */
        this.setStatus(STATUS.SUCCESS, render)
        const t = this.controller.peekRunningTask()
        if (t === this) {
            /** unstack the task */
            this.controller.popRunningTask()
        }
    }
    error(render = true, error) {
        if (this.isLeaf) {
            const msg = []
            if (error) {
                msg.push(_.isString(error) ? error : error.message)
            }
            msg.push(`Log: ${path.relative(process.env.SLDX_WORKSPACE_ROOTDIR, myConsole.loggerFilePath())}`)
            this.setTitle(`${this.title}\n  ${chalk.grey(msg.join('\n  '))}`)
        }
        this.setStatus(STATUS.ERROR, render)
        this.parent && this.parent.error(render)
    }
    skipped(render = true) {
        this.setStatus(STATUS.SKIPPED, render)
    }
}
