
const axios = require('axios')
const _ = require('lodash')
const BaseScript = require('./BaseScript')
const { format: prettyFormat } = require('pretty-format')
const chalk = require('chalk')

// http://seira-ldx.seiralocaltest/alerting/api/system/session-learner-added
const ff = [
    {
        "key": "fromId",
        "type": "text",
        "value": "64ae7420c20f828c07357510"
    },
    {
        "key": "title",
        "type": "text",
        "value": "TESTPERFS.SESSION"
    },
    {
        "key": "coaches",
        "type": "text",
        "value": "testperfs.teacher TESTPERFS.TEACHER"
    },
    {
        "key": "coachIds",
        "type": "array",
        "value": [
            "64b543d215765cb9111d8aed"
        ]
    },
    {
        "key": "description",
        "type": "text",
        "value": "<p style=\"text-align: center;\">&nbsp;</p>\n<p style=\"text-align: center;\">&nbsp;</p>\n<p style=\"text-align: center;\"><span style=\"color: rgb(132, 63, 161);\"><strong>D&eacute;but du parcous de test de performances scenario 1</strong></span></p>\n<p style=\"text-align: center;\">&nbsp;</p>\n<p style=\"text-align: center;\">&nbsp;</p>\n<p style=\"text-align: center;\">&nbsp;</p>"
    },
    {
        "key": "startDate",
        "type": "date",
        "value": "2023-07-29T00:00:00.000Z"
    },
    {
        "key": "endDate",
        "type": "date",
        "value": "2023-08-04T23:59:59.999Z"
    },
    {
        "key": "receivers",
        "type": "select",
        "value": [
            "64afed29f818a7ee5ebb444c",
            "64b2d8665c29e540bc1aba63",
            "64b2d8a65c29e540bc1aba68",
            "64b2d8e85c29e540bc1aba6d",
            "64b2d9325c29e540bc1aba72",
            "64b7e6a54aa44f95adb480f6",
            "64b7e6c24aa44f95adb480fb",
            "64b7e6f64aa44f95adb48100",
            "64b7e76c4aa44f95adb48105",
            "64b7e7814aa44f95adb4810a"
        ]
    },
    {
        "key": "accessTimeIntervals",
        "type": "text",
        "value": "7j/7 24h/24"
    }
]

// http://seira-ldx.seiralocaltest/alerting/api/system/session-head-teacher-added
const _getSessionData = ({ sessionName, careerId, teacherId, learnerIds, groupIds }) => {
    learnerIds ??= []
    groupIds ??= []
    return {
        session: {
            _id: null,
            title: sessionName,
            publishedCareer: careerId,
            headTeachers: null,
            coaches: [
                teacherId
            ],
            startDate: new Date().toISOString(),
            endDate: (() => { const d = new Date(); d.setHours(30 * 24); return d.toISOString() })(),
            learners: {
                groupIds: groupIds,
                individualUserIds: [...learnerIds],
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

const _defSessionName = ''
const _validHtpStatus = [200, 201, 404]
module.exports = class ApiCli extends BaseScript {
    baseUrl = null
    baseUrlSso = null
    httpCli = null
    constructor(opts) {
        super(opts)
        // this.baseUrl = process.env.SLDX_PROXY_URL
        this.baseUrl = 'http://seira-ldx.seiralocaltest'
        this.baseUrlSso = 'http://localhost:3010'
        this.loghighlight(`baseUrl[${this.baseUrl}] baseUrlSso[${this.baseUrlSso}]`)
    }
    createHttpCli(bearerToken, timeout = 1000) {
        this.loghighlight(`\nCreate http client`)
        this.log(`Token: ${bearerToken}`)
        this.httpCli = axios.create({
            baseURL: this.baseUrl,
            timeout: timeout,
            headers: {
                Authorization: `Bearer ${bearerToken}`
            },
            validateStatus: function (status) {
                return true /** all staus are processed by the caller */
            }
        })
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
                    promises.push(this.callHttpCli(arg.method, arg.path, arg.data))
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
            { title: 'Get profiles', description: `Get profiles`, value: this.profiles.name },
            { title: 'Get carrersPublished', description: `Get carrersPublished`, value: this.carrersPublished.name },
            { title: 'deleteAllSession', description: `deleteAllSession`, value: this.deleteAllSession.name },
            {
                title: 'createSession', description: `createSession`, value: this.createSession.name, args: [{
                    sessionName: this.scriptConfig.scenario.sessionName,
                    sessionNbLearners: this.scriptConfig.scenario.sessionNbLearners,
                    teacherName: this.scriptConfig.scenario.teacherName,
                    publishedCareerName: this.scriptConfig.scenario.publishedCareerName
                }]
            },
            { title: 'deleteSessionByName', description: `deleteSessionByName`, value: this.deleteSessionByName.name, args: [this.scriptConfig.scenario.sessionName] },
            // { title: 'Login admin', description: `Login admin`, value: this.login.name }
        ]
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
    async callHttpCli(method, path, ...args) {
        if (this.dryrun) {
            this.log(`${chalk.yellow('dryrun')}\n${_methodColor[method]}[${path}]`)
            return {}
        }
        this.log(`${_methodColor[method]}[${path}]`)
        if (!this.httpCli) {
            throw new Error('Unexpected empty http client')
        }
        const { status, data } = await this.httpCli[method].apply(this.httpCli, [path, ...args])
        /** fails if status is no included in _validHtpStatus*/
        this.log(`status[${[200, 201].includes(status) ? chalk.green(status) : chalk.red(status)}]`)
        if (!_validHtpStatus.includes(status)) {
            this.logerror(`http status ${status}`)
            this.log(prettyFormat(data))
            throw new Error(`http status ${status}`)
        } else if (status != 404) {
            let display
            if (_.isArray(data)) {
                /** Some requests return an array instead of an object */
                display = data.slice(0, 1).concat('...')
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
    async get(path) {
        return await this.callHttpCli('get', path)
    }
    async delete(path, id) {
        return await this.callHttpCli('delete', `${path}${id}`)
    }
    async post(path, data) {
        // this.log(`post[${path}] data\n${JSON.stringify(data, null, 2)}`)
        return await this.callHttpCli('post', path, data)
    }
    async put(path, data) {
        // this.log(prettyFormat(data))
        return await this.callHttpCli('put', path, data)
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
    async deleteSession(sessionName) {
        this.loghighlight(`\ndeleteSession [${sessionName}]`)
        if (_.isEmpty(sessionName)) {
            throw new Error('Empty session name')
        }
        const sessions = await this.sessions()
        const session = sessions.result.find(x => x.title === sessionName)
        if (session != null) {
            const result = await this.delete('/server/api/careers-publish-sessions/', session._id)
            this.log(`session [${sessionName}] deleted id[${session._id}]`)
        } else {
            this.log(`session [${sessionName}] not found`)
        }
    }
    async deleteSessionByName(sessionName) {
        this.loghighlight(`\deleteSessionByName [${sessionName}]`)
        if (_.isEmpty(sessionName)) {
            throw new Error('Empty session name')
        }
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
        if (_.isEmpty(id)) {
            throw new Error('Empty session id')
        }
        const result = await this.delete('/server/api/careers-publish-sessions/', id)
        this.log(`session id[${id}] deleted`)
    }
    async createSession({ sessionName, publishedCareerName, sessionNbLearners, teacherName }) {
        if (_.isEmpty(sessionName) || _.isEmpty(publishedCareerName) || _.isEmpty(teacherName) || !_.isInteger(sessionNbLearners)) {
            throw new Error(`createSession - Empty sessionName[${sessionName}] or publishedCareerName[${publishedCareerName}] or teacherName[${teacherName}]or  bad sessionNbLearners[${sessionNbLearners}]`)
        }
        this.loghighlight(`\nCreate session[${sessionName}] publishedCareerName[${publishedCareerName}] sessionNbLearners[${sessionNbLearners}] teacherName[${teacherName}] `)
        const sessions = await this.sessions()
        const session = sessions.result.find(x => x.title === sessionName)
        if (session != null) {
            await this.deleteSessionById(session._id)
        }
        const profiles = await this.profiles()
        const learnerIds = []
        let teacherId = null
        for (const profile of profiles.result) {
            if (teacherId == null && teacherName == profile.name) {
                teacherId = profile._id
            }
            if (learnerIds.length < sessionNbLearners && profile.name.includes('learner')) {
                learnerIds.push(profile._id)
            }
        }
        if (_.isEmpty(teacherId)) {
            throw new Error(`Teacher name[${teacherId}] not found`)
        }
        if (learnerIds.length < sessionNbLearners) {
            throw new Error(`Not enougth leaner profiles Exected[${sessionNbLearners}] got[${learnerIds.length}]`)
        }
        const careers = await this.carrersPublished()
        const career = careers.find(x => x.title === publishedCareerName)
        if (career == null) {
            throw new Error(`Published career title[${publishedCareerName}] not found`)
        }
        const createdSession = await this.put('/server/api/careers-publish-sessions', _getSessionData({
            sessionName: sessionName,
            /** ?? not _id  */
            careerId: career.id,
            teacherId: teacherId,
            learnerIds: null, //learnerIds,
            groupIds: ["64c11f9e342e5ef526cbfe65"]
        }))
        this.log(`Session title[${sessionName}] created -  Career[${career.title}] learnerIds[${learnerIds.length}]`)
    }
    async login() {
        const loginPath = '/api/login'
        const loginData = {
            login: process.env.SLDX_ADMIN_ID,
            password: process.env.SLDX_ADMIN_PWD
        }
        if (this.dryrun) {
            this.log(`${chalk.yellow('dryrun')}\nlogin[${this.baseUrlSso}${loginPath}]\n${JSON.stringify(loginData, null, 2)}`)
            return {}
        }
        const httpSsoCli = axios.create({
            baseURL: this.baseUrlSso
        })
        this.loghighlight(`\nlogin[${httpSsoCli.defaults.baseURL}${loginPath}`)
        this.log(JSON.stringify(loginData, null, 2))
        const { status, data } = await httpSsoCli.post(loginPath, loginData)
        if (status != 200) {
            throw new Error(`Login error path[${loginPath}]  status[${status}]`)
        }
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
