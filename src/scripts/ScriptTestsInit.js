
const axios = require('axios')
const _ = require('lodash')
const BaseScript = require('./BaseScript')
const { format: prettyFormat } = require('pretty-format')


const _data_Session = {
    "_id": null,
    "title": "testperfs.session.1_100",
    "publishedCareer": "64b2d4b95c29e540bc1ab93a",
    "headTeachers": null,
    "coaches": [
        "64b543d215765cb9111d8aed"
    ],
    "startDate": "2023-07-28T00:00:00.000Z",
    "endDate": "2023-08-03T23:59:59.999Z",
    "learners": {
        "individualUserIds": [],
        "groupIds": [
            "64c11f9e342e5ef526cbfe79"
        ]
    },
    "color": null,
    "cardsToUnlockInfo": [],
    "unlockedCards": [],
    "accessDayTimeIntervals": [],
    "secondaryCoaches": []
}



class ApiCli extends BaseScript {
    bearerToken = null
    baseUrl = null
    httpCli = null
    constructor(dryrun) {
        super(dryrun)
        // this.bearerToken = (process.env.SLDX_ADMIN_BEARER_TOKEN ?? '').trim()
        // if (_.isEmpty(this.bearerToken)) {
        //     throw new Error('SLDX_ADMIN_BEARER_TOKEN is empty')
        // }
        this.baseUrl = process.env.SLDX_PROXY_URL
        this.baseUrl = 'http://seira-ldx.seiralocaltest'
        this.loghighlight(`url[${this.baseUrl }]`)
        this.httpCli = axios.create({
            baseURL: this.baseUrl,
            timeout: 1000,
            headers: {
                Authorization: this.bearerToken ? `Bearer ${this.bearerToken}` : ''
            }
        })
    }
    get actionChoices() {
        return [
            { title: 'Login admin', description: `FLogin admin`, value: this.login.name }
        ]
    }
    getFullUrl(path){
        return `${this.baseUrl}${path}`
    }
    async get(path) {
        this.log(`get[${path}]`)
        const response = await axios.get(this.getFullUrl(path))
        this.log(prettyFormat(response))
        this.log()
    }
    async post(path, data) {
        this.log(`post[${path}] adminId[${process.env.SLDX_ADMIN_ID}] adminPwd[${process.env.SLDX_ADMIN_PWD}]\n${JSON.stringify(data, null, 2)}`)
        const response = await this.httpCli.post(path, data)
        this.log(prettyFormat(response))
        this.log()
    }
    async login() {
      //  await this.get('/server/api/theming/current')
        return this.post('/api/login', {
            login: process.env.SLDX_ADMIN_ID,
            password: process.env.SLDX_ADMIN_PWD
        })
    }
}


(async () => {
    const cli = await ApiCli.factory()
    await cli.askAndExecAction()
})()