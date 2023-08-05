'use strict';

const axios = require('axios')
const _ = require('lodash')
const { format: prettyFormat } = require('pretty-format')
const chalk = require('chalk')
const assert = require('assert')
const ToolsBase = require('./ToolsBase')
const { table } = require('table')

const _sortProfiles = (a, b) => {
    const aIdx = parseInt(a.name.match(/([0-9]+$)/))
    const bIdx = parseInt(b.name.match(/([0-9]+$)/))
    if (isNaN(aIdx) || isNaN(bIdx)) {
        return a.name.localeCompare(b.name)
    }
    return aIdx > bIdx ? 1 : aIdx < bIdx ? -1 : 0
}


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
                individualUserIds: [...individualUserIds]
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
module.exports = class ToolsBaseApi extends ToolsBase {
    #httpCli = null
    #httpCliSso = null
    #profiles = null
    /**
     * @param {*} opts 
     * {
     *      dryrun: true,
     *      scriptId: null
     * }
     */
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
        this.loghighlight(`Create http client`)
        this.log(`Token: ${bearerToken.substring(0, 50)}...`)
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
            { title: 'Get groups', description: `Get groups`, value: this.groups.name, args: [true] },
            { title: 'Get sessions', description: `Get sessions`, value: this.sessions.name, args: [true] },
            { title: 'Get profiles', description: `Get profiles`, value: this.profiles.name, args: [true] },
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
    _displayAsTable(array, opts) {
        array ??= []
        opts = Object.assign({
            nbCols: 5,
            property: '_id',
            cell: (item, idx) => item == null ? item : item[opts.property] ?? `[${idx}] ${opts.property} missing`,
            nbRecords: -1
        }, opts ?? {})
        const result = []
        let buffer = []
        const length = Math.min(opts.nbRecords > 0 ? opts.nbRecords : array.length, array.length)
        for (let idx = 0; idx < length; idx++) {
            const item = array[idx]
            buffer.push(opts.cell(item, idx))
            if (buffer.length >= opts.nbCols) {
                result.push(buffer)
                buffer = []
            }
        }
        if (buffer.length === opts.nbCols) {
            result.push(buffer)
        } else if (buffer.length > 0) {
            for (let i = buffer.length; i < opts.nbCols; i++) buffer[i] = array.length > length ? '...' : ''
            result.push(buffer)
        }
        this.log(`length[${array.length}] property[${opts.property}]\n${table(result)}`)
    }
    _logUrl(type, httpCli, method, path) {
        const text = httpCli == this.#httpCli ? `proxy ${type}` : `sso ${type}`
        const header = chalk[type == 'request' ? 'magenta' : 'cyan'](text)
        this.log(`[${header}] ${_methodColor[method]}[${httpCli.defaults.baseURL}${path}]`)
    }
    logHttpRequest(httpCli, method, path, ...args) {
        this._logUrl('request', httpCli, method, path)
        /** file logger only  */
        this.myConsole.logHttpRequestBody(args)
    }
    logHttpResponse(headers, status, data) {
        this.log(`status[${_okHtpStatus.includes(status) ? chalk.green(status) : chalk.red(status)}]`)
        this.myConsole.logHttpResponseBody(headers, data)
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
        assert(!_.isNil(httpCli), 'Unexpected null http client')
        this.logHttpRequest.apply(this, [httpCli, method, path, ...args])
        const { status, data, headers } = await httpCli[method].apply(httpCli, [path, ...args])
        this.logHttpResponse(headers, status, data)
        if (!_validHtpStatus.includes(status)) {
            throw new Error(`http error status[${status}]`)
        }
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
    async getSsoCollection(path, sort) {
        const data = await this.get(`/generic-db-api/api/collections/seirasso${path}`)
        if (sort) {
            data.result = data.result.sort(sort)
        }
        return data
    }
    /** not 'rustified' */
    async getServerCollection(path) {
        return this.get(`/server/api${path}`)
    }
    async getSeiraCollection(path) {
        return this.get(`/generic-db-api/api/collections/seiradb${path}`)
    }
    displayCollection(data, opts) {
        this._displayAsTable(data.result, opts)
    }
    async groups(displayResult = false) {
        const data = await this.getSsoCollection('/Group/*/10000/$limit')
        displayResult === true && this.displayCollection(data, { nbCols: 4, property: 'name' })
        return data
    }
    async sessions(displayResult = false) {
        const data = await this.getSeiraCollection('/PublishedCareerSession/*/10000/$limit')
        displayResult === true && this.displayCollection(data, { property: 'title' })
        return data
    }
    async profiles(displayResult = false) {
        /** !! sorted by name testperfs.leaner.idx - Important because the user names is retreived by the worker index in artillery test */
        const data = await this.getSsoCollection('/Profile/*/10000/$limit', _sortProfiles)
        displayResult === true && this.displayCollection(data, { property: 'name', nbRecords: 200 })
        return data
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
        this.logFile('splitProfiles', prettyFormat({
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
        this.loghighlight(`deleteAllSession`)
        const sessions = await this.sessions()
        const calls = sessions.result.map(x => ({
            method: 'delete',
            path: `/server/api/careers-publish-sessions/${x._id}/true`
        }))
        return this.batchedCalls('deleteAllSession', calls)
    }
    async deleteSessionByName(sessionName) {
        this.loghighlight(`deleteSessionByName [${sessionName}]`)
        assert(!_.isEmpty(sessionName), 'Empty session name')
        const sessions = await this.sessions()
        const session = this.dryrun ? { _id: 'fakeid' } : sessions.result.find(x => x.title === sessionName)
        if (session != null) {
            await this.deleteSessionById(session._id)
        } else {
            this.log(`session [${sessionName}] not found`)
        }
    }
    async deleteSessionById(id) {
        this.loghighlight(`deleteSessionById [${id}]`)
        assert(!_.isEmpty(id), 'Empty session id')
        await this.delete('/server/api/careers-publish-sessions', id, 'true')
        this.loghighlight(`session id[${id}] deleted`)
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
        this.loghighlight(`Create session[${sessionName}] publishedCareerName[${publishedCareerName}] sessionNbLearners[${sessionNbLearners}]`)
        const sessions = await this.sessions()
        const session = sessions.result.find(x => x.title === sessionName)
        if (session != null) {
            await this.deleteSessionById(session._id)
        }
        const learnerIds = profiles.learnerIds.slice(0, sessionNbLearners)
        const careers = await this.carrersPublished()
        const career = careers.find(x => x.title === publishedCareerName)
        assert(career != null, `Published career title[${publishedCareerName}] not found`)
        await this.put('/server/api/careers-publish-sessions', _getSessionData({
            sessionName: sessionName,
            /** ?? not _id  */
            careerId: career.id,
            coaches: [
                profiles.teacher._id,
                profiles.admin._id
            ],
            individualUserIds: [profiles.teacher._id, profiles.admin._id, ...learnerIds],
            groupIds: []
        }))
        this.log(`Session created title[${sessionName}] Career[${career.title}] learners[${learnerIds.length}]`)
    }
    /**
     * Called before lauching test perfs (artillery or playwright)
     */
    async resetTestEnvironment() {
        this.logsuperhighlight(`Begin - resetTestEnvironment`)
        await this.login()
        await this.createTestSession()
        this.logsuperhighlight(`End - resetTestEnvironment`)
    }
    async login() {
        const saveDryrun = this.dryrun
        try {
            this.dryrun = false
            const loginPath = '/api/login'
            const loginData = {
                login: this.scriptConfig.entities.admin.name,
                password: this.scriptConfig.entities.admin.password
            }
            const data = await this.callSsoHttp('post', loginPath, loginData)
            this.createHttpCli(data.token)
        } finally {
            this.dryrun = saveDryrun
        }
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
