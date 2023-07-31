'use strict';

const { MongoClient } = require('mongodb')
const BaseScript = require('./BaseScript')
const _ = require('lodash')
const assert = require('assert')
const escapeRegExp = require('escape-string-regexp')


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


module.exports.SeiraMongoClient = class SeiraMongoClient extends BaseScript {
    #url = null
    #mongoClient = null
    constructor(opts) {
        super(opts)
        this.#url = this.scriptConfig.mongo.url
        assert(!_.isEmpty(this.#url), 'unexpected emty mongo url [config.mongo.url]')
        this.#mongoClient = new MongoClient(this.url)
        this.loghighlight(`New MongoClient class[${this.className}] url[${this.url}] dryrun[${this.dryrun}]`)
    }
    get regExpLearners() {
        return new RegExp(`^${escapeRegExp(this.scriptConfig.entities.learner.prefix)}[0-9]*`)
    }
    get regExpGroups() {
        return new RegExp(`^${escapeRegExp(this.scriptConfig.entities.group.prefix)}[0-9]+.[0-9]+`)
    }
    get regExpSessions() {
        return new RegExp(`^${escapeRegExp(this.scriptConfig.entities.session.prefix)}[0-9]+.[0-9]+`)
    }
    get mongoClient() {
        return this.#mongoClient
    }
    get url() {
        return this.#url
    }
    get seirassoDb() {
        assert(!_.isNil(this.mongoClient))
        return this.mongoClient.db(_DBNAMES.SEIRASSO);
    }
    get seiraDb() {
        assert(!_.isNil(this.mongoClient))
        return this.mongoClient.db(_DBNAMES.SEIRADB);
    }
    async seiraDbCollection(collectionName) {
        return this.seirassoDb.collection(collectionName)
    }
    async seirassoCollection(collectionName) {
        return this.seirassoDb.collection(collectionName)
    }
    async logCollection(dbName, collectionName) {
        assert(!_.isNil(this.mongoClient))
        const docs = await this.mongoClient.db(dbName).collection(collectionName).find({}).toArray();
        this.log(`Logins:${JSON.stringify(docs, null, 2)}`)
    }
    async close(safe = true) {
        if (_.isNil(this.mongoClient)) {
            return
        }
        try {
            await this.mongoClient.close()
            this.loghighlight(`mongo client closed`)
        } catch (e) {
            this.logerror(`Error closing mongodb client`, e)
            if (!safe) throw e
        }
        this.#mongoClient = null
    }
    async connect() {
        assert(!_.isNil(this.mongoClient))
        this.loghighlight(`mongo client connected to ${this.url}`)
        await this.mongoClient.connect();
    }
}