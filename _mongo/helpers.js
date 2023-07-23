const { CollectionInfo, MongoClient, ObjectId } = require('mongodb')
const myConsole = require('#commons/myConsole')
const prompts = require('prompts')
const _ = require('lodash')

const _USERS = {
    PREFIX: 'testperfs',
    PASSWORD: 'seira',
    ENCRYPTED_PASSWORD: '$2a$10$egusEbUGmahKRCwcLgks1el2DyNJadEbNM57BnouqynHkn5VxZjj.'
}
module.exports.USERS = _USERS
const _DBNAMES = {
    SEIRASSO: 'seirasso',
    SEIRADB: 'seiradb',
    SEIRALICENCE: 'licencemanagementdb',
    SEIRALICENCESSO: 'licencemanagementsso',
}
module.exports.DBNAMES = _DBNAMES
const _SEIRADB_COLLECTIONS = {
    ALERTS: 'alerts',
    CAREERS: 'careers',
    CAREERTRACKINGS: 'careertrackings',
    CERTIFICATETEMPLATES: 'certificatetemplates',
    CERTIFICATIONS: 'certifications',
    CHATS: 'chats',
    CONTAINERGROUPS: 'containergroups',
    CURRENTTHEMES: 'currentthemes',
    CUSTOMACTIVITIES: 'customactivities',
    INSTANCECONFIGS: 'instanceconfigs',
    MODULES: 'modules',
    MYCOMPANIES: 'mycompanies',
    NEWSFEEDS: 'newsfeeds',
    NOTIFICATIONS: 'notifications',
    PRECONFIGUREDS: 'preconfigureds',
    PUBLISHEDCAREERS: 'publishedcareers',
    PUBLISHEDCAREERSESSIONS: 'publishedcareersessions',
    PUBLISHEDSKILLCERTIFICATIONS: 'publishedskillcertifications',
    REPORTTEMPLATES: 'reporttemplates',
    SESSIONEDUCATIONALFOLLOWUPS: 'sessioneducationalfollowups',
    SESSIONLEARNERSTAKEHOLDERS: 'sessionlearnerstakeholders',
    THEMES: 'themes',
    USERROLES: 'userroles',
    VISIOCHATS: "visiochats"
}
module.exports.SEIRADB_COLLECTIONS = _SEIRADB_COLLECTIONS
const _SEIRASSO_COLLECTIONS = {
    GROUPS: 'groups',
    LICENCES: 'licences',
    LOGINHISTORIES: 'loginhistories',
    LOGINS: 'logins',
    PASSWORDRESETTOKENS: 'passwordresettokens',
    PROFILEHISTORIES: 'profilehistories',
    PROFILES: 'profiles'
}
module.exports.SEIRASSO_COLLECTIONS = _SEIRASSO_COLLECTIONS


module.exports.SeiraMongoClient = class SeiraMongoClient extends MongoClient {
    #url = null

    constructor(url) {
        myConsole.highlight(`MongoClient url [${url}]`)
        super(url)
        this.#url = url
        this.log(`New MongoClient class[${this.className}] url[${this.url}]`)
    }
    get className() {
        return this.constructor.name
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
    get url() {
        return this.#url
    }
    get seirassoDb() {
        return this.db(_DBNAMES.SEIRASSO);
    }
    async seirassoCollection(collectionName) {
        return this.seirassoDb.collection(collectionName)
    }
    async logCollection(dbName, collectionName) {
        const docs = await this.db(dbName).collection(collectionName).find({}).toArray();
        this.log(`Logins:${JSON.stringify(docs, null, 2)}`)
    }
    async close(safe = true) {
        try {
            await super.close()
            this.loghighlight(`mongo client closed`)
        } catch (e) {
            this.logerror(`Error closing mongodb client`, e)
            if (!safe) throw e
        }
    }
    async connect() {
        this.loghighlight(`mongo client connected to ${this.url}`)
        await super.connect();
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
    async askAndExecAction() {
        let response = await prompts({
            type: 'select',
            name: 'value',
            message: 'Pick an acion',
            choices: [
                { title: 'Udapdate passwords', description: `For all user.alias.match('/${_USERS.PREFIX}*[0-9]+/') replaces the password by '${_USERS.PASSWORD}'`, value: 'updatePwd' },
                { title: 'Update user name', description: `For all user.alias.match('/user[0-9]+/') replaces 'users*' by ${_USERS.PREFIX}*`, value: 'updateUserName' },
            ],
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
            await this.connect()
            await this.runBefore()
            await method.apply(this, args)
            await this.runAfter()
            this.logsuperhighlight(`${method.name} END`)
        } catch (e) {
            this.logerror(`${method.name} FAILED`, e)
            await this.runError(e)
        } finally {
            await this.close()
        }
    }
}