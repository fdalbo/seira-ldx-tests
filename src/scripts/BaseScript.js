const myConsole = require('#commons/myConsole')
const prompts = require('prompts')
const _ = require('lodash')
const parseArguments = require('minimist')
const appRootDir = require('app-root-dir')
const {
    initConfig
} = require(`${appRootDir.get()}/config.base`)


module.exports = class BaseScript {
    #scriptConfig = null
    #opts = null
    constructor(opts) {
        this.#opts = Object.assign({
            dryrun: true,
            scriptId: null
        }, opts ?? {})
        this.loghighlight(`New [${this.className}] dryrun[${this.dryrun}]`)
        this.#scriptConfig = _.isEmpty(opts.scriptId) ? null : initConfig(opts.scriptId)
        this.log()
    }
    get className() {
        return this.constructor.name
    }
    get scriptConfig() {
        return this.#scriptConfig
    }
    get opts() {
        return this.#opts
    }
    set dryrun(dryrun) {
        this.#opts.dryrun = dryrun == true
    }
    get dryrun() {
        return this.#opts.dryrun === true
    }
    log(...args) {
        this.loglowlight.apply(this, args)
    }
    loglowlight(...args) {
        myConsole.lowlight.apply(myConsole, args)
    }
    loghighlight(...args) {
        myConsole.highlight.apply(myConsole, args)
    }
    logsuperhighlight(...args) {
        myConsole.superhighlight.apply(myConsole, args)
    }
    logerror(...args) {
        myConsole.error.apply(myConsole, args)
    }
    logwarning(...args) {
        myConsole.warning.apply(myConsole, args)
    }
    async confirm(message, exitProcess = true) {
        const response = await prompts({
            type: 'confirm',
            name: 'value',
            message: message,
            initial: false
        })
        if (response.value !== true && exitProcess === true) {
            this.loghighlight(`Operation canceled - exit process`)
            process.exit(1)
        }
        return response.value == true
    }
    /**
     * [{ 
     *      title: 'Udapdate passwords', 
     *      description: `For all user.alias.match('/${_LEARNERS.PREFIX}*[0-9]+/') replaces the password by '${_LEARNERS.PASSWORD}'`,
     *      value: 'updatePwd' 
     *  }, ...]
     */
    get actionChoices() {
        return []
    }
    async askAndExecAction(confirm = false) {
        const actionChoices = this.actionChoices
        if (actionChoices.length == 0) {
            this.loghighlight('Empty actionChoices - exit')
            process.exit(1)
        }
        const reponse = await prompts({
            type: 'select',
            name: 'value',
            message: 'Pick an acion',
            choices: actionChoices,
            initial: null
        })
        if (_.isEmpty(reponse.value)) {
            this.loghighlight(`Operation canceled - exit process`)
            process.exit(1)
        }
        const actionChoice = actionChoices.find (x=>x.value === reponse.value)
        this.log(JSON.stringify(actionChoice))
        const method = this[actionChoice.value]
        if (!_.isFunction(method)) {
            client.loghighlight(`Mongoclient does not provide '${actionChoice.value}' method - Exit process`)
            process.exit(1)
        }
        confirm === true && await this.confirm(`Confirm action '${actionChoice.value}'`)
        await this.run.apply(this, [method, ...actionChoice.args ?? []])
    }
    async runBefore(method, ...args) {
    }
    async runAfter(method, ...args) {
    }
    async runError(e, method, ...argse) {
    }
    async run(method, ...args) {
        try {
            this.logsuperhighlight(`${method.name} BEGIN`)
            myConsole.initLoggerFromModule(method.name)
            this.log(JSON.stringify(args))
            await this.runBefore.apply(this, [method, ...args])
            await method.apply(this, args)
            await this.runAfter.apply(this, [method, ...args])
            this.logsuperhighlight(`${method.name} END`)
        } catch (e) {
            this.logerror(`${method.name} FAILED`, e)
            await this.runError.apply(this, [e, method, ...args])
        }
    }
    static async factory(opts) {
        const minimistOpts = {
            string: ['dryrun']
        }
        const args = parseArguments(process.argv, minimistOpts)
        const dryrun = args.dryrun ?? 'true'
        const client = new this(Object.assign({
            dryrun: dryrun === 'true'
        }, opts ?? {}))
        myConsole.superhighlight(`dryrun[${client.dryrun}]`)
        return client
    }
}