'use strict';

const prompts = require('prompts')
const _ = require('lodash')
const parseArguments = require('minimist')
const appRootDir = require('app-root-dir')
const Runnable = require('#helpers/Runnable')
const { initConfig } = require(`${appRootDir.get()}/config.base`)


module.exports = class ToolsBase extends Runnable {
    #scriptConfig = null
    constructor(name, opts) {
        super(name, Object.assign({
            dryrun: true,
            scriptId: null
        }, opts ?? {}))
        this.loghighlight(`New [${this.className}] dryrun[${this.dryrun}] scriptId[${this.opts.scriptId}]`)
        this.#scriptConfig = initConfig(this.opts.scriptId)
    }
    get scriptConfig() {
        return this.#scriptConfig
    }
    set dryrun(dryrun) {
        this.opts.dryrun = dryrun == true
    }
    get dryrun() {
        return this.opts.dryrun === true
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
     *      title: 'Update passwords', 
     *      description: `...`,
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
        const actionChoice = actionChoices.find(x => x.value === reponse.value)
        this.log(JSON.stringify(actionChoice))
        const method = this[actionChoice.value]
        if (!_.isFunction(method)) {
            client.loghighlight(`Mongoclient does not provide '${actionChoice.value}' method - Exit process`)
            process.exit(1)
        }
        confirm === true && await this.confirm(`Confirm action '${actionChoice.value}'`)
        await this.runMethod.apply(this, [method, ...actionChoice.args ?? []])
    }
    static async factory(opts) {
        const minimistOpts = {
            string: ['dryrun']
        }
        const args = parseArguments(process.argv, minimistOpts)
        const dryrun = args.dryrun ?? 'true'
        /** this is important */
        return Runnable.factory.call(this, Object.assign({
            dryrun: dryrun === 'true'
        }, opts ?? {}))
    }
}