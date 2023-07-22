const { CollectionInfo, MongoClient, ObjectId } = require('mongodb')
const myConsole = require('#commons/myConsole')
const { nullFormat } = require('numeral')


module.exports.DBNAMES = {
    SEIRASSO: 'seirasso',
    SEIRADB: 'seiradb',
    SEIRALICENCE: 'licencemanagementdb',
    SEIRALICENCESSO: 'licencemanagementsso',
}
module.exports.SEIRASSO_COLLECTIONS = {
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
module.exports.SEIRADB_COLLECTIONS = {
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
    VISIOCHATS: 'visiochats"'
}
module.exports.SEIRASSO_COLLECTIONS = {
    GROUPS: 'groups',
    LICENCES: 'licences',
    LOGINHISTORIES: 'loginhistories',
    LOGINS: 'logins',
    PASSWORDRESETTOKENS: 'passwordresettokens',
    PROFILEHISTORIES: 'profilehistories',
    PROFILES: 'profiles'
}
module.exports.SeiraMongoClient = class SeiraMongoClient extends MongoClient {
    #url = null

    constructor(url) {
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
        return this.db(module.exports.DBNAMES.SEIRASSO);
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