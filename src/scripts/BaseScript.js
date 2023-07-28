const myConsole = require('#commons/myConsole')
const prompts = require('prompts')
const _ = require('lodash')
const parseArguments = require('minimist')


module.exports= class BaseScript {
    #dryrun = null
    constructor(dryrun) {
        this.#dryrun = dryrun
        this.loghighlight(`New MongoClient class[${this.className}] dryrun[${this.dryrun}]`)
    }
    get className() {
        return this.constructor.name
    }
    get dryrun() {
        return this.#dryrun
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
    async askAndExecAction() {
        const actionChoices = this.actionChoices
        if (actionChoices.length == 0) {
            this.loghighlight('Empty actionChoices - exit')
            process.exit(1)
        }
        let response = await prompts({
            type: 'select',
            name: 'value',
            message: 'Pick an acion',
            choices: actionChoices,
            initial: null
        })
        if (_.isEmpty(response.value)) {
            this.loghighlight(`Operation canceled - exit process`)
            process.exit(1)
        }
        const method = this[response.value]
        if (!_.isFunction(method)) {
            client.loghighlight(`Mongoclient does not provide '${response.value}' method - Exit process`)
            process.exit(1)
        }
        await this.confirm(`Confirm action '${response.value}'`)
        await this.run(method)
    }
    async runBefore() {
    }
    async runAfter() {
    }
    async runError(e) {
    }
    async run(method, ...args) {
        try {
            this.logsuperhighlight(`${method.name} BEGIN`)
            await this.runBefore()
            await method.apply(this, args)
            await this.runAfter()
            this.logsuperhighlight(`${method.name} END`)
        } catch (e) {
            this.logerror(`${method.name} FAILED`, e)
            await this.runError(e)
        }
    }
    static async factory() {
        const minimistOpts = {
            string: ['dryrun']
        }
        const args = parseArguments(process.argv, minimistOpts)
        const dryrun = args.dryrun ?? 'true'
        const client = new this(dryrun === 'true')
        myConsole.superhighlight(`dryrun[${dryrun}]`)
        return client
    }
}