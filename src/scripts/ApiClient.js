'use strict';

const axios = require('axios')
const _ = require('lodash')
const BaseScript = require('./BaseScript')
const { format: prettyFormat } = require('pretty-format')
const chalk = require('chalk')
const assert = require('assert')

// http://seira-ldx.seiralocaltest/alerting/api/system/session-head-teacher-added
const _getSessionData = ({ sessionName, careerId, coaches, individualUserIds, groupIds }) => {
    individualUserIds ??= []
    groupIds ??= []
    coaches ??= []
    return {
        session: {
            _id: null,
            title: sessionName,
            publishedCareer: careerId,
            headTeachers: null,
            coaches: [...coaches],
            startDate: new Date().toISOString(),
            endDate: (() => { const d = new Date(); d.setHours(30 * 24); return d.toISOString() })(),
            learners: {
                groupIds: [...groupIds],
                individualUserIds: [...individualUserIds],
            },
            color: '#9c27b0',
            cardsToUnlockInfo: [],
            unlockedCards: [],
            accessDayTimeIntervals: [],
            secondaryCoaches: []
        }
    }
}
const _methodColor = {
    get: chalk.yellowBright('get'),
    post: chalk.greenBright('post'),
    put: chalk.cyanBright('put'),
    delete: chalk.magentaBright('delete')
}

const _okHtpStatus = [200, 201]
const _validHtpStatus = [404, ..._okHtpStatus]
module.exports = class ApiCli extends BaseScript {
    #httpCli = null
    #httpCliSso = null
    #profiles = null
    constructor(opts) {
        super(opts)
        assert(!_.isEmpty(this.baseUrl), 'Empty baseUrl')
        assert(!_.isEmpty(this.baseUrlSso), 'Empty baseUrlSso')
        this.loghighlight(`baseUrl[${this.baseUrl}] baseUrlSso[${this.baseUrlSso}]`)
        this.#httpCliSso = axios.create({
            baseURL: this.baseUrlSso,
            timeout: this.scriptConfig.apiCli.timeout,
            validateStatus: () => true
        })
    }
    createHttpCli(bearerToken) {
        this.loghighlight(`\nCreate http client`)
        this.log(`Token: ${bearerToken}`)
        this.#httpCli = axios.create({
            baseURL: this.baseUrl,
            timeout: this.scriptConfig.apiCli.timeout,
            headers: {
                Authorization: `Bearer ${bearerToken}`
            },
            validateStatus: function (status) {
                return true /** all staus are processed by the caller */
            }
        })
    }
    get httpCli() {
        return this.#httpCli
    }
    get httpCliSso() {
        return this.#httpCliSso
    }
    /**
     * @param {object} callArgs 
     * object: {
     *              method, 
     *              path,
     *              dryrun,
     *              data
     *          }
     * @param {*} callBack 
     * @returns 
     */
    async batchedCalls(name, callsArgs, dryrun) {
        const saveDryrun = this.dryrun
        try {
            if (!_.isNil(dryrun)) this.dryrun = dryrun
            callsArgs ??= []
            const _verbose = true
            const batchSize = 10
            const mainResult = []
            console.log(`batchName[${name}] nbCalls[${callsArgs.length}] batchSize[${batchSize}]`)
            let mainIdx = 0
            let batchNum = 0
            while (mainIdx < callsArgs.length) {
                const promises = []
                for (let batchIdx = 0; batchIdx < batchSize && mainIdx < callsArgs.length; batchIdx++) {
                    const arg = callsArgs[mainIdx]
                    promises.push(this.callProxyHttp(arg.method, arg.path, arg.data))
                    mainIdx += 1
                }
                const promisesResult = await Promise.all(promises)
                mainResult.push(...promisesResult)
                _verbose && console.log(`batchName[${name}] batchNum[${batchNum}] result[${promisesResult.length}] mainResult[${mainResult.length}/${callsArgs.length}]`)
                batchNum++
            }
            _verbose && console.log(`batchName[${name}] mainResult[${mainResult.length}/${callsArgs.length}]`)
            return mainResult
        } finally {
            this.dryrun = saveDryrun
        }
    }
    get actionChoices() {
        return [
            { title: 'Get groups', description: `Get groups`, value: this.groups.name },
            { title: 'Get sessions', description: `Get sessions`, value: this.sessions.name },
            { title: 'splitProfiles', description: `splitProfiles`, value: this.splitProfiles.name },
            { title: 'Get carrersPublished', description: `Get carrersPublished`, value: this.carrersPublished.name },
            { title: 'deleteAllSession', description: `deleteAllSession`, value: this.deleteAllSession.name },
            { title: 'createTestSession', description: `creates test script session`, value: this.createTestSession.name },
            { title: 'deleteTestSession', description: `delete test script session`, value: this.deleteSessionByName.name, args: [this.scriptConfig.entities.session.mainName] },
            // { title: 'Login admin', description: `Login admin`, value: this.login.name }
        ]
    }
    get baseUrl() {
        return this.scriptConfig.proxyUrl
    }
    get baseUrlSso() {
        return this.scriptConfig.ssoUrl
    }
    getFullUrl(path) {
        return `${this.baseUrl}${path}`
    }
    /**
     * @param {*} method 
     * @param {*} path 
     * @param  {...any} args 
     * @returns null if 404
     */
    async #callHttpCli(httpCli, method, path, ...args) {
        if (this.dryrun) {
            this.log(`${chalk.yellow('dryrun')}\n${_methodColor[method]}[${path}]`)
            this.log(`${chalk.yellow('!!No result')}\n`)
            return {}
        }
        this.log(`[${httpCli == this.#httpCli ? 'proxy' : 'sso'}] ${_methodColor[method]}[${httpCli.defaults.baseURL}${path}]`)

        this.log(prettyFormat(args))
        assert(httpCli != null, 'Unexpected empty http client')
        const { status, data } = await httpCli[method].apply(httpCli, [path, ...args])
        /** fails if status is no included in _validHtpStatus*/
        this.log(`status[${_okHtpStatus.includes(status) ? chalk.green(status) : chalk.red(status)}]`)
        if (!_validHtpStatus.includes(status)) {
            this.logerror(`http status ${status}`)
            this.log(prettyFormat(data))
            throw new Error(`http status ${status}`)
        }
        if (status != 404) {
            let display
            if (_.isArray(data)) {
                /** Some requests return an array instead of an object */
                display = data.slice(0, 1).concat(`length[${data.length}]`).concat('...')
            } else {
                display = data
                if (data.result && _.isArray(data.result)) {
                    display = Object.assign({}, data)
                    display.result = data.result.slice(0, 1).concat('...')
                }
            }
            this.log('axios.data', prettyFormat(display))
        }
        this.log()
        return status == 404 ? null : data
    }
    async callProxyHttp(...args) {
        return this.#callHttpCli.apply(this, [this.httpCli, ...args])
    }
    async callSsoHttp(...args) {
        return this.#callHttpCli.apply(this, [this.httpCliSso, ...args])
    }
    async get(path) {
        return await this.callProxyHttp('get', path)
    }
    async delete(path, id, ...args) {
        assert(!_.isEmpty(id), 'empty id')
        return await this.callProxyHttp('delete', [path, id, ...args].join('/'))
    }
    async post(path, data) {
        // this.log(`post[${path}] data\n${JSON.stringify(data, null, 2)}`)
        return await this.callProxyHttp('post', path, data)
    }
    async put(path, data) {
        // this.log(prettyFormat(data))
        return await this.callProxyHttp('put', path, data)
    }
    getSsoCollection(path) {
        return this.get(`/generic-db-api/api/collections/seirasso${path}`)
    }
    /** not 'rustified' */
    getServerCollection(path) {
        return this.get(`/server/api${path}`)
    }
    getSeiraCollection(path) {
        return this.get(`/generic-db-api/api/collections/seiradb${path}`)
    }
    async groups() {
        return await this.getSsoCollection('/Group/*/10000/$limit')
    }
    async sessions() {
        return this.getSeiraCollection('/PublishedCareerSession/*/10000/$limit')
    }
    async profiles() {
        return await this.getSsoCollection('/Profile/*/10000/$limit')
    }
    async splitProfiles() {
        const teacherName = this.scriptConfig.entities.teacher.name
        const adminName = this.scriptConfig.entities.admin.name
        const learnerPrefix = this.scriptConfig.entities.learner.prefix
        this.#profiles = {
            admin: null,
            teacher: null,
            learners: new Map(),
            learnerIds: []
        }
        const profiles = await this.profiles()
        for (const profile of profiles.result) {
            if (this.#profiles.teacher == null && teacherName == profile.name) {
                this.#profiles.teacher = profile
            }
            if (this.#profiles.admin == null && adminName == profile.name) {
                this.#profiles.admin = profile
            }
            if (profile.name.startsWith(learnerPrefix)) {
                this.#profiles.learners.set(profile._id, profile)
                this.#profiles.learnerIds.push(profile._id)
            }
        }
        assert(this.#profiles.admin != null && this.#profiles.teacher != null && this.#profiles.learners.size !== 0,
            `Unexpected empty data\n- admin[${this.#profiles?.admin?.name}] expected[${adminName}]\n- teacher[${this.#profiles?.teacher?.name}] expected[${teacherName}]\n- learnersSize[${this.#profiles?.learners.size}]`
        )
        this.log(prettyFormat({
            admin: this.#profiles.admin,
            teacher: this.#profiles.teacher,
            learnersSize: this.#profiles.learners.size,
            learners: Array.from(this.#profiles.learners.values()).slice(0, 1).concat('...')
        }))
        return this.#profiles
    }
    async carrersPublished() {
        return await this.getServerCollection('/careers-publish')
    }
    async deleteAllSession() {
        this.loghighlight(`\ndeleteAllSession`)
        const sessions = await this.sessions()
        const calls = sessions.result.map(x => ({
            method: 'delete',
            path: `/server/api/careers-publish-sessions/${x._id}/true`
        }))
        return this.batchedCalls('deleteAllSession', calls)
    }
    async deleteSessionByName(sessionName) {
        this.loghighlight(`\deleteSessionByName [${sessionName}]`)
        assert(!_.isEmpty(sessionName), 'Empty session name')
        const sessions = await this.sessions()
        const session = sessions.result.find(x => x.title === sessionName)
        if (session != null) {
            await this.deleteSessionById(session._id)
        } else {
            this.log(`session [${sessionName}] not found`)
        }
    }
    async deleteSessionById(id) {
        this.loghighlight(`\deleteSessionById [${id}]`)
        assert(!_.isEmpty(id), 'Empty session id')
        const result = await this.delete('/server/api/careers-publish-sessions/', id, 'true')
        this.log(`session id[${id}] deleted`)
    }
    async createTestSession() {
        const sessionName = this.scriptConfig.entities.session.mainName
        assert(!_.isEmpty(sessionName), 'Empty session name [config.entities.session.mainName]')
        const sessionNbLearners = this.scriptConfig.entities.session.mainNbLearners
        assert(_.isInteger(sessionNbLearners) && sessionNbLearners > 0, `Unexpected number > 0  got[${sessionNbLearners}] [config.entities.session.mainNbLearners]`)
        const publishedCareerName = this.scriptConfig.entities.career.mainName
        assert(!_.isEmpty(sessionName), 'Empty career name [config.entities.career.mainName]')
        const profiles = await this.splitProfiles()
        assert(profiles.learners.size >= sessionNbLearners, `Not enougth leaner profiles Exected[${sessionNbLearners}] got[${profiles.learners.size}]`)
        this.loghighlight(`\nCreate session[${sessionName}] publishedCareerName[${publishedCareerName}] sessionNbLearners[${sessionNbLearners}] teacherName[${profiles.teacher.name}] admin[${profiles.admin.name}]`)
        const sessions = await this.sessions()
        const session = sessions.result.find(x => x.title === sessionName)
        if (session != null) {
            await this.deleteSessionById(session._id)
        }
        const learnerIds = profiles.learnerIds.slice(0, sessionNbLearners)
        const careers = await this.carrersPublished()
        const career = careers.find(x => x.title === publishedCareerName)
        assert(career != null, `Published career title[${publishedCareerName}] not found`)
        const createdSession = await this.put('/server/api/careers-publish-sessions', _getSessionData({
            sessionName: sessionName,
            /** ?? not _id  */
            careerId: career.id,
            coaches: [
                profiles.teacher._id,
                profiles.admin._id
            ],
            individualUserIds: [profiles.teacher._id, admin._id, ...learnerIds],
            groupIds: []
        }))
        this.log(`Session title[${sessionName}] created -  Career[${career.title}] learnerIds[${learnerIds.length}]`)
    }
    async login() {
        const loginPath = '/api/login'
        const loginData = {
            login: this.scriptConfig.entities.admin.name,
            password: this.scriptConfig.entities.admin.password
        }
        const data = await this.callSsoHttp('post', loginPath, loginData)
        this.createHttpCli(data.token)
    }
    async runBefore(method, ...args) {
        if (method === this.login) {
            return
        }
        if (this.httpCli != null) {
            return
        }
        await this.login()
    }
}
