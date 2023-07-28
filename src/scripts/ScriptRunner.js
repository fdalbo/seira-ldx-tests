'use strict';

const myConsole = require('#commons/myConsole')
const { pause } = require('#commons/promises')
const path = require('path')
const _ = require('lodash')
const appRootDir = require('app-root-dir')
const Stats = require('stats-incremental')
const CSVStream = require('./CsvStream')
const {
    isMainThread,
    parentPort: _workerParentPort,
    workerData: _workerData,
    threadId: _workertThreadId
} = require('worker_threads')
const _verbose = false
const _sendToMainThread = false
const {
    initConfig,
    ROLE_LEARNER,
    TEMPO_PAGE,
    TEMPO_RADIO,
    TEMPO_CARD_DISPLAY,
    TEMPO_TEXT_INPUT,
    TEMPO_MODAL
} = require(`${appRootDir.get()}/config.base`)
const _METRIC_CARDS = 'cards'
const _METRIC_QUIZ = 'quiz'
const _METRIC_NAV = 'navigation'
const _METRICS = [_METRIC_CARDS, _METRIC_QUIZ, _METRIC_NAV]
/** playwight role (getByRole) */
const _PW_ROLE_LINK = 'link'
const _PW_ROLE_BUTTON = 'button'
/** internal type for tracing */
const _TYPE_BUTTON = _PW_ROLE_BUTTON
const _TYPE_PAGE = 'page'
const _TYPE_TEXT_LINK = 'textLink'
const _TYPE_MENU = 'menu'
const _TYPE_INPUT = 'input'
const _TYPE_LIST_ITEM = 'listitem'

const _CLICKABLE = {
    MENU: {
        LEARNER: {
            label: 'Apprenant',
            selector: '#learner',
            type: _TYPE_MENU,
            tempo: TEMPO_PAGE,
            metric: _METRIC_NAV
        }
    },
    INPUTS: {
        CHECKBOX: {
            label: 'checkbox',
            /** dynamic */
            selector: null,
            type: _TYPE_INPUT,
            tempo: TEMPO_RADIO,
            metric: _METRIC_QUIZ
        },
        RADIO: {
            label: 'radio',
            /** dynamic */
            selector: null,
            type: _TYPE_INPUT,
            tempo: TEMPO_RADIO,
            metric: _METRIC_QUIZ
        }
    },
    PAGES: {
        CLIENT: {
            label: 'client',
            type: _TYPE_PAGE,
            path: '/client',
            tempo: TEMPO_PAGE,
            metric: _METRIC_NAV,
        }
    },
    BUTTONS: {
        CARDNEXT: {
            label: 'SUIVANT',
            tempo: TEMPO_CARD_DISPLAY,
            metric: _METRIC_CARDS,
            role: _PW_ROLE_BUTTON,
            type: _TYPE_BUTTON
        },
        CARDPREV: {
            label: 'Précédent',
            tempo: TEMPO_CARD_DISPLAY,
            metric: _METRIC_CARDS,
            role: _PW_ROLE_BUTTON,
            type: _TYPE_BUTTON
        },
        DEMARRER: {
            label: 'démarrer',
            metric: _METRIC_NAV,
            role: _PW_ROLE_BUTTON,
            type: _TYPE_BUTTON
        },
        MODALOK: {
            label: 'Ok',
            tempo: TEMPO_MODAL,
            role: _PW_ROLE_BUTTON,
            type: _TYPE_BUTTON
        },
        MODALCANCEL: {
            label: 'Annuler',
            tempo: TEMPO_MODAL,
            role: _PW_ROLE_BUTTON,
            type: _TYPE_BUTTON
        },
        CONNECTION: {
            label: 'Connexion',
            tempo: TEMPO_PAGE,
            metric: _METRIC_NAV,
            role: _PW_ROLE_BUTTON,
            type: _TYPE_BUTTON
        }
    },
    LINKS: {
        MYSESSIONS: {
            label: 'Toutes mes sessions',
            role: _PW_ROLE_LINK,
            metric: _METRIC_NAV,
            tempo: TEMPO_PAGE,
            type: _TYPE_TEXT_LINK
        }

    },
    TEXTS: {
        LIST: {
            /** dynamic */
            label: null,
            metric: _METRIC_NAV,
            tempo: TEMPO_PAGE,
            type: _TYPE_LIST_ITEM
        }

    }
}
exports.ScriptRunner = class ScriptRunner {
    stepIdx = 0
    name = null
    pwPage = null
    config = null
    learnerId = null
    learnerRole = null
    scenario = null
    errorIdx = 0
    metrics = null
    csvStream = null
    constructor(scriptFilePath, pwPage) {
        this.log(`NEW ScriptRunner`)
        this.name = path.basename(scriptFilePath)
        this.pwPage = pwPage
        this.config = initConfig(this.className.toLowerCase())
        this.scenario = this.config.scenario ?? {}
        this.learnerId = this.config.getUserId()
        this.learnerRole = this.config?.users?.learner?.role ?? 'empty'
        /** see https://playwright.dev/docs/api/class-page#page-set-default-navigation-timeout  */
        pwPage.setDefaultNavigationTimeout(this.config.timeouts.defaultNavigationTimeout ?? 1000)
        /** seehttps://playwright.dev/docs/api/class-page#page-set-default-timeout */
        pwPage.setDefaultTimeout(this.config.timeouts.defaultTimeout ?? 1000)
    }
    async asyncInit() {
        /** Metric */
        if (process.env.SLDX_METRICS_ENABLED == 'true') {
            this.metrics = {
                lastUpdate: null,
                stats: {}
            }
            for (const metricId of _METRICS) {
                this.metrics.stats[metricId] = Stats()
            }
            this.logHighlight(`Metrics are enabled [${_METRICS.join(',')}]`)
            this.csvStream = new CSVStream({
                headers: true,
                override: true,
                filePath: path.resolve(process.env.SLDX_METRICS_DIR_PATH, `${myConsole.threadId}-metrics.csv`),
                writeProperties: ['value', 'n', 'min', 'max', 'mean', 'variance', 'label']
            })
        } else {
            this.logHighlight(`Metrics are disabled (SLDX_METRICS_ENABLED!=true)`)
        }
    }
    get className() {
        return this.constructor.name
    }
    isPlayWright() {
        return this.config.exec === 'playwright'
    }
    isArtillery() {
        return this.config.exec === 'artillery'
    }
    isPlayWrightUi() {
        return this.isPlayWright && process.env.SLDX_PLAYWRIGTH_UI === 'true'
    }
    fullUrl = (path) => {
        return `${this.config.proxyUrl}${path}`
    }
    pwPageId() {
        const url = new URL(`${this.pwPage.url()}?`)
        return url.pathname.substring(url.pathname.lastIndexOf('/'))
    }
    /**
     * 
     * @param {string} selector 
     * @param {string} filename without extension
     */
    async saveScreenShot(selector, filename) {
        try {
            if (this.pwPage) {
                const ssPath = path.resolve(process.env.SLDX_SCREENSHOTS_DIR_PATH, `${myConsole.threadId}${filename}.png`)
                this.logHighlight(`Save screenshot [${ssPath}]`)
                await this.pwPage.locator(selector).screenshot({
                    animations: 'disabled',
                    type: 'png',
                    path: ssPath
                })
            }
        } catch (e) {
            myConsole.warning(`Error saving the screenshot`, e)
        }
    }
    async throwError(message, throwError = true) {
        this.errorIdx++
        await this.saveScreenShot('body', `error_${this.errorIdx++}`)
        if (throwError == true) {
            throw new Error(message)
        } else {
            myConsole.error('A non-fatal error occured', new Error(message))
        }
    }
    getStat(id) {
        return this.metrics.stats[id]
    }
    async sendMetrics(stats, clickInfo, value) {
        try {
            if (!this.metrics || stats.n <= 0 || !this.csvStream) {
                return
            }
            const data = {
                type: 'METRICS',
                id: clickInfo.metric,
                emitter: myConsole.threadId,
                data: {
                    value: value,
                    n: stats.n,
                    min: stats.min,
                    max: stats.max,
                    mean: Math.floor(stats.mean),
                    variance: Math.floor(stats.variance),
                    label: `${clickInfo.type}.${clickInfo.label}`
                }
            }
            _verbose && this.log(`sendMetrics: ${JSON.stringify(data, null, 2)}`)
            if (!isMainThread && _sendToMainThread) {
                _workerParentPort.postMessage(data)
            }
            this.csvStream.write(data.emitter, data.id, data.data)
        } catch (e) {
            myConsole.error('Error Sending metrics', e)
        }
    }
    async updateMetric(clickInfo, elapsedMs) {
        const metricId = clickInfo.metric
        if (!this.metrics || !metricId) {
            return
        }
        const stats = this.getStat(metricId)
        if (!stats) {
            myConsole.warning(`Metric id[${metricId}] not found`)
            return
        }
        stats.update(elapsedMs)
        this.log(`updateMetric.${clickInfo.type}.${metricId} label[${clickInfo.label}] elapsedMs[${elapsedMs}] count[${stats.n}] min[${stats.min}] max[${stats.max}] mean[${Math.floor(stats.mean)}] `)
        await this.sendMetrics(stats, clickInfo, elapsedMs)
    }
    /**
     * Calls callbackMethod
     * update the metrics if any (clickInfo.metric)
     * @param {plainObject} clickInfo 
     * @param {number} tempo (optional tempo MS ) 
     * @param {Object} callbackObj  (playwright locator, playwright page..)
     * @param {function} callbackMethod (async method)
     * @param  {...any} args  (args for callbackMethod)
     */
    async applyAndMesure(clickInfo, tempo, callbackObj, callbackMethod, ...args) {
        _verbose && this.log(`click.${clickInfo.type}.${clickInfo.label}`)
        const t0 = new Date().getTime()
        await callbackMethod.apply(callbackObj, args)
        const elapsedMs = new Date().getTime() - t0
        await this.updateMetric(clickInfo, elapsedMs)
        await this.tempo(tempo ?? clickInfo.tempo)
    }
    /**
     * Recommended method for selectors
     * We assume that the element(s) exist(s)
     * !! wait until the element is visible even if it is not found 
     * @param {string} selector 
     * @returns promise
     */
    locator(selector) {
        return this.pwPage.locator(selector)
    }
    /** 
    * https://playwright.dev/docs/api/class-elementhandle#element-handle-inner-html
    * ElementHandle returns null if not found contrary to locator below
    */
    selector(selector) {
        return this.pwPage.$(selector)
    }
    /** 
     * tempo is optional (see config.base and config.script)
     * @param {string or number} tempo 
     */
    async tempo(tempo) {
        tempo ??= this.config.tempo.default
        if (_.isString(tempo)) {
            if (!this.config.tempo[tempo]) {
                this.throwError(`Config - Unknown cinfog.tempo[${tempo}]`)
            }
            tempo = this.config.tempo[tempo]
        }
        const tempoMs = parseInt(tempo)
        if (isNaN(tempoMs)) {
            this.throwError(`Config - Bad 'tempo' value [${tempoMs}ms/${tempo}]`)
        }
        this.log(`[${new String(this.stepIdx++).padStart(2, 0)}] page[${this.pwPageId()}] tempoMs[${tempoMs}]`)
        await pause(tempoMs);
    }
    async clickMenuApprenant(tempo) {
        await this.clickBySelector(_CLICKABLE.MENU.LEARNER, tempo)
    }
    async clickSessionsApprenant(tempo) {
        await this.clickByRole(_CLICKABLE.LINKS.MYSESSIONS, tempo)
    }
    async clickSelectSessionApprenant(tempo) {
        await this.clickList(this.scenario.sessionName, tempo)
    }
    async clickNextCard(tempo) {
        await this.clickByRole(_CLICKABLE.BUTTONS.CARDNEXT, tempo)
    }
    async clickNextCardBeforeModal(tempo) {
        tempo = 5000
        await this.clickByRole(_CLICKABLE.BUTTONS.CARDNEXT, tempo)
    }
    async clickPrevCard(tempo) {
        await this.clickByRole(_CLICKABLE.BUTTONS.CARDPREV, tempo)
    }
    async clickDemarrerParcours(tempo) {
        const selectorPageDetailSession = 'button.start-button-cta  > .mat-button-wrapper > span'
        const selectorPageApprenant = '.card-aside > .mat-flat-button > .mat-button-wrapper'
        /** 
         * https://playwright.dev/docs/api/class-elementhandle#element-handle-inner-html
         * ElementHandle returns null if not found contrary to locator
         */
        let element = await this.selector(selectorPageDetailSession)
        let text = null
        if (element != null) {
            this.log('Career starts from user session\'s page')
            text = await element.innerHTML()
        } else {
            let element = await this.selector(selectorPageApprenant)
            if (element != null) {
                this.log('Career starts from learner\' homre welcome session')
                text = await element.innerHTML()
            } else {
                this.throwError(`Career starts from an unknownn page`)
            }
        }
        if (text.toLowerCase() != 'démarrer') {
            this.throwError(`User[${this.learnerId}] - Unexpected 'start career' button - Expected[démarrer] Got[${text}]`)
        }
        await this.clickByRole(_CLICKABLE.BUTTONS.DEMARRER, tempo)
    }
    async fillLabel(label, value, tempo) {
        this.log(`fillLabel '${label}' [${value}]`)
        await this.pwPage.getByLabel(label).fill(value)
        await this.tempo(tempo ?? TEMPO_TEXT_INPUT)
    }
    _checkClickInfo(clickInfo) {
        if (!_.isPlainObject(clickInfo) || _.isEmpty(clickInfo.label) || _.isEmpty(clickInfo.type)) {
            this.throwError(`_checkClickInfo expects an object with at least a label and a type - clickInfo[${clickInfo ? JSON.stringify(clickInfo, null, 2) : 'null'}]`)
        }
    }
    _checkClickable(object, clickInfo) {
        if (!object) {
            this.throwError(`_checkClickable unexpected null object - clickInfo[${JSON.stringify(clickInfo, null, 2)}]`)
        }
        if (!object.click) {
            this.throwError(`_checkClickable unexpected null object.click method - clickInfo[${JSON.stringify(clickInfo, null, 2)}]`)
        }
    }
    async clickBySelector(clickInfo, tempo) {
        this._checkClickInfo(clickInfo)
        if (_.isEmpty(clickInfo.selector)) {
            this.throwError(`clickBySelector: unexpected empty clickInfo.selector`)
        }
        _verbose && this.log(`clickBySelector '${clickInfo.selector}'`)
        const locator = await this.locator(clickInfo.selector)
        await this.clickByLocator(locator, clickInfo, tempo)
    }
    /**
     * @param {number} index 1 to n from top to bottom
     */
    async clickCheckBox(index, tempo) {
        const clickInfo = Object.assign({}, _CLICKABLE.INPUTS.CHECKBOX)
        clickInfo.selector = `mat-checkbox:nth-child(${index})`
        await this.clickBySelector(clickInfo, tempo)
    }
    /**
     * @param {number} index 1 to n from top to bottom
     */
    async clickRadio(index, tempo) {
        const clickInfo = Object.assign({}, _CLICKABLE.INPUTS.RADIO)
        clickInfo.selector = `mat-radio-button:nth-child(${index})`
        await this.clickBySelector(clickInfo, tempo)
    }
    async clickModalOK(tempo) {
        await this.clickByRole(_CLICKABLE.BUTTONS.MODALOK, tempo)
    }
    async clickModalCancel(tempo) {
        await this.clickByRole(_CLICKABLE.BUTTONS.MODALCANCEL, tempo)
    }
    async clickByRole(clickInfo, tempo = null) {
        this._checkClickInfo(clickInfo)
        if (!clickInfo.role) {
            this.throwError(`clickByRole - clickInfo.role is empty`)
        }
        const locator = await this.pwPage.getByRole(clickInfo.role, { name: clickInfo.label })
        await this.clickByLocator(locator, clickInfo, tempo)
    }
    async clickByLocator(locator, clickInfo, tempo) {
        if (locator == null) {
            this.throwError(`clickByLocator: unexpected null locator ${JSON.stringify(clickInfo)}`)
        }
        this._checkClickable(locator, clickInfo)
        await this.applyAndMesure(clickInfo, tempo, locator, locator.click)
    }
    async clickByText(textInfo, tempo = null) {
        this._checkClickInfo(textInfo)
        const locator = await this.pwPage.getByText(textInfo.label)
        await this.clickByLocator(locator, textInfo, tempo)
    }
    async clickList(text, tempo) {
        const textInfo = Object.assign({}, _CLICKABLE.TEXTS.LIST)
        textInfo.label = text
        this.log(`clickList '${text}'`)
        await this.clickByText(textInfo, tempo)
    }
    async clickConnect(tempo) {
        await this.clickByRole(_CLICKABLE.BUTTONS.CONNECTION, tempo)
    }
    async gotoPage(pageInfo, tempo) {
        this._checkClickInfo(pageInfo)
        if (!pageInfo.path) {
            this.throwError(`gotoPage - pageInfo.path is empty`)
        }
        const url = this.fullUrl(pageInfo.path)
        this.log(`gotoPage ${url}`)
        await this.applyAndMesure(pageInfo, tempo, this.pwPage, this.pwPage.goto, url)
    }
    log(message) {
        myConsole.lowlight.call(myConsole, message)
    }
    logHighlight(message) {
        myConsole.highlight.call(myConsole, message)
    }
    async run() {
        try {
            const traceEnv = []
            for (const [key, value] of Object.entries(process.env)) {
                (key == 'LOCAL_WORKER_ID' || key.startsWith('SLDX')) && traceEnv.push(`${key}=${value}`)
            }
            this.log(`BEGIN RUN ${this.name}`)
            this.log(`SLDX Variables:\n${traceEnv.sort().join('\n')}\n`)
            await this.beforeLogin()
            await this.login()
            await this.afterLogin()
            await this.beforeEnd()
        } finally {
            this.log(`END RUN ${this.name}`)
            this.csvStream && this.csvStream.destroy()
        }
    }
    async login(tempo) {
        this.logHighlight(`login ${this.learnerId}/${this.config.getUserPwd()} [${this.learnerRole}]`)
        await this.gotoPage(_CLICKABLE.PAGES.CLIENT)
        await this.fillLabel('Veuillez entrer votre identifiant ou e-mail *', this.learnerId)
        await this.fillLabel('Mot de passe : *', this.config.getUserPwd())
        await this.clickConnect()
        await pause(1000)
    }
    async assertSessionProgression(percent) {
        const expectedPogress = `${percent}%`
        const sessionProgress = await this.getSessionProgression()
        /**
         * isPlayWrightUi not fails -> used to test the user interface
         * Eg: npm run playwright.script1 --  --sldxenv=fdalbo --sldxpwuser=user3 --ui
         */
        if ((this.isArtillery() || !this.isPlayWrightUi()) && expectedPogress != sessionProgress) {
            this.throwError(`unexpected session progression for user[${this.learnerId}] - Expected[${expectedPogress}] - Got[${sessionProgress}]`)
        }
    }
    async getSessionProgression() {
        const progress = await this.locator('app-progress-bar .percentage-progression').innerHTML()
        this.logHighlight(`Progession [${progress}]`)
        return progress
    }
    
    async beforeLogin() {
        this.logHighlight(`beforeLogin`)
    }
    async afterLogin() {
        this.logHighlight(`afterLogin`)
        await this.clickMenuApprenant()
        if (this.learnerRole = ROLE_LEARNER) {
            await this.learnerCheckSatus()
        } else {
            /** In case we want to develop scenarri for other  user roles */
            this.throwError(`Unexpected user role[${this.learnerId}.${this.learnerRole}] - Expected[${ROLE_LEARNER}]`)
        }
    }
    async learnerCheckSatus() {
        await this.assertSessionProgression(0)
    }
    async beforeEnd() {
        await pause(1000);
    }
    async initTestContext(){

    }
    async removeSession(){

    }
    async createSession(){
        /*

Request URL:
http://seira-ldx.seiralocaltest/server/api/careers-publish-sessions
Request Method:
PUT
Status Code:
200 OK

{
   "session":{
      "_id":null,
      "title":"testperfs",
      "publishedCareer":"64ae803cc20f828c07357608",
      "headTeachers":null,
      "coaches":[
         "64b543d215765cb9111d8aed"
      ],
      "startDate":"2023-07-24T00:00:00.000Z",
      "endDate":"2023-07-30T23:59:59.999Z",
      "learners":{
         "individualUserIds":[
            
         ],
         "groupIds":[
            "64b2d5ea5c29e540bc1aba4e"
         ]
      },
      "color":null,
      "cardsToUnlockInfo":[
         
      ],
      "unlockedCards":[
         
      ],
      "accessDayTimeIntervals":[
         
      ],
      "secondaryCoaches":[
         
      ]
   }
}
        */
    }
    /**
     * @returns the runner
     */
    static async factory(scriptFilePath, pwPage) {
        const runner = new this(scriptFilePath, pwPage)
        await runner.asyncInit()
        return runner
    }
    static async runScript(scriptFilePath, pwPage) {
        let runError = null
        try {
            const name = path.basename(scriptFilePath)
            myConsole.initLoggerFromModule(name)
            myConsole.superhighlight(`BEGIN RUN ${className}`)
            myConsole.lowlight(`From [${scriptFilePath}]`)
            if (_.isEmpty(process.env.SLDX_RUNNER_EXEC)) {
                myConsole.warning(`\n\nProcess must be launched by the runner\n- npm run artillery.script1 --  --sldxenv=playwright.debug\n- npm run playwright.script1 --  --sldxenv=playwright.debug --sldxpwuser=user4 --debug\n\n`)
                throw new Error(`Process must be launched by the runner`)
            }
            const klass = _classes.find(x => x.name === className)
            if (klass == null) {
                throw new Error(`Script Class [${className}] not found`)
            }
            const script = klass.factory(scriptFilePath, pwPage)
            await script.run()
        } catch (e) {
            myConsole.error(`Error running ${className}`, e)
            runError = true
            throw e
        } finally {
            myConsole.superhighlight(`END RUN ${runError ? 'KO' : 'OK'} ${className}`)
        }
    }
    static scriptTimeout() {
        const to = parseInt(process.env.SLDX_PLAYWRIGTH_SCRIPT_TIMEOUT)
        if (isNaN(to)) {
            throw new Error('Unexpected not number process process.env.SLDX_PLAYWRIGTH_SCRIPT_TIMEOUT')
        }
        return to
    }

}
