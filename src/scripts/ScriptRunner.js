'use strict';

const { pause } = require('#commons/promises')
const path = require('path')
const _ = require('lodash')
const appRootDir = require('app-root-dir')
const assert = require('assert')
const Runnable = require('#helpers/Runnable')
const {
    isMainThread,
    BroadcastChannel,
} = require('worker_threads')
const _verbose = false
const {
    initConfig,
    ROLE_LEARNER,
    TEMPO_PAGE,
    TEMPO_LIST_DETAIL_SESSION,
    TEMPO_RADIO,
    TEMPO_CARD_DISPLAY,
    TEMPO_TEXT_INPUT,
    TEMPO_MODAL,
    TEMPO_SCREENSHOT,
    TEMPO_LOGIN,
    TEMPO_RETRY_READ_DOM,
    METRIC_CARDS,
    METRIC_QUIZ,
    METRIC_NAV,
    MESSAGE_STATUS,
    MESSAGE_METRICS,
    MESSAGE_BROADCAST_CHANNEL,
    STATUS_ERROR,
    STATUS_BEGIN,
    STATUS_END_KO,
    STATUS_END_OK
} = require(`${appRootDir.get()}/config.base`)
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
            /** Tests show that this actions needs more time to dipslay the page */
            tempo: TEMPO_PAGE,
            metric: METRIC_NAV
        }
    },
    INPUTS: {
        CHECKBOX: {
            label: 'checkbox',
            /** dynamic */
            selector: null,
            type: _TYPE_INPUT,
            tempo: TEMPO_RADIO,
            metric: METRIC_QUIZ
        },
        RADIO: {
            label: 'radio',
            /** dynamic */
            selector: null,
            type: _TYPE_INPUT,
            tempo: TEMPO_RADIO,
            metric: METRIC_QUIZ
        }
    },
    PAGES: {
        CLIENT: {
            label: 'client',
            type: _TYPE_PAGE,
            path: '/client',
            tempo: TEMPO_PAGE,
            metric: METRIC_NAV,
        }
    },
    BUTTONS: {
        CARDNEXT: {
            label: 'SUIVANT',
            tempo: TEMPO_CARD_DISPLAY,
            metric: METRIC_CARDS,
            role: _PW_ROLE_BUTTON,
            type: _TYPE_BUTTON
        },
        CARDPREV: {
            label: 'Précédent',
            tempo: TEMPO_CARD_DISPLAY,
            metric: METRIC_CARDS,
            role: _PW_ROLE_BUTTON,
            type: _TYPE_BUTTON
        },
        DEMARRER: {
            label: 'démarrer',
            metric: METRIC_NAV,
            role: _PW_ROLE_BUTTON,
            tempo: TEMPO_PAGE,
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
            metric: METRIC_NAV,
            role: _PW_ROLE_BUTTON,
            type: _TYPE_BUTTON
        }
    },
    LINKS: {
        MYSESSIONS: {
            label: 'Toutes mes sessions',
            role: _PW_ROLE_LINK,
            metric: METRIC_NAV,
            tempo: TEMPO_PAGE,
            type: _TYPE_TEXT_LINK
        }

    },
    TEXTS: {
        LIST: {
            /** dynamic */
            label: null,
            metric: METRIC_NAV,
            tempo: TEMPO_LIST_DETAIL_SESSION,
            type: _TYPE_LIST_ITEM
        }

    }
}

/**
 * BroadcastChannel used to send messages to main tread (ScriptsController)
 * The only way to use the BroadcastChannel with artillery is declare it there (not in the cass)
 */
const _broadCastChannel = new BroadcastChannel(MESSAGE_BROADCAST_CHANNEL)
module.exports = class ScriptRunner extends Runnable {
    stepIdx = 0
    config = null
    learnerName = null
    learnerRole = null
    scenario = null
    errorIdx = 0
    metrics = null
    constructor(opts) {
        opts = Object.assign({
            scriptFilePath: null,
            pwPage: null
        }, opts ?? {})
        super(opts)
        assert(!_.isEmpty(this.scriptFilePath), 'Unexpected empty scriptFilePath')
        assert(!_.isNil(this.pwPage), 'Unexpected empty pwPage')
        this.loghighlight(`Script runner launched from[${this.scriptFilePath}]`)
        this.config = initConfig(this.className.toLowerCase())
        this.scenario = this.config.scenario ?? {}
        this.learnerName = this.config.getLearnerName()
        const learnerIdx = (this.learnerName.match(/\.([0-9]+$)/) ?? [])[1]
        assert(!_.isEmpty(learnerIdx), `unexpected learner name [${this.learnerName}] - Does not match /\.([0-9]+$)/`)
        this.leanerShortName = `learner${learnerIdx}`
        this.learnerRole = this.config?.entities?.learner?.role ?? 'empty'
        /** see https://playwright.dev/docs/api/class-page#page-set-default-navigation-timeout  */
        this.pwPage.setDefaultNavigationTimeout(this.config.timeouts.defaultNavigationTimeout ?? 1000)
        /** seehttps://playwright.dev/docs/api/class-page#page-set-default-timeout */
        this.pwPage.setDefaultTimeout(this.config.timeouts.defaultTimeout ?? 1000)
    }
    /** overriden */
    async asyncInit() {
    }
    get pwPage() {
        return this.opts.pwPage
    }
    get scriptFilePath() {
        return this.opts.scriptFilePath
    }
    canSendMessage(data) {
        if (isMainThread || _.isNil(_broadCastChannel) || _.isEmpty(data)) return false
        if (data.type == MESSAGE_METRICS && this.config.metrics.sendToMainThread !== true) return false
        return true
    }
    async sendMessage(type, id, data) {
        data ??= {}
        data.learner = this.leanerShortName
        const messagedata = {
            type: type,
            id: id,
            emitter: this.threadId,
            data: data ?? {}
        }
        _verbose && this.log(`sendMessage: ${JSON.stringify(messagedata, null, 2)}`)
        if (this.canSendMessage(messagedata)) {
            _broadCastChannel.postMessage(messagedata)
        }
        await pause(100)
        return messagedata
    }
    geLogName(method) {
        return this.leanerShortName
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
                const ssPath = (idx) => path.resolve(process.env.SLDX_SCREENSHOTS_DIR_PATH, `${this.threadId}${filename}.${idx}.png`)
                this.loghighlight(`Save screenshot [${ssPath(1)}]`)
                await this.pwPage.locator(selector).screenshot({
                    animations: 'disabled',
                    type: 'png',
                    path: ssPath(1)
                })
                /** Let some time to display the page and to compare the 2 screen shots*/
                await pause(this.config.tempo[TEMPO_SCREENSHOT])
                await this.pwPage.locator(selector).screenshot({
                    animations: 'disabled',
                    type: 'png',
                    path: ssPath(2)
                })
            }
        } catch (e) {
            this.logwarning(`Error saving the screenshot`, e)
        }
    }
    async throwError(message, throwError = true) {
        this.errorIdx++
        await this.saveScreenShot('body', `error_${this.errorIdx++}`)
        message = `[${this.threadId}] [${this.learnerName ?? 'no learner'}] ${message}`
        if (throwError == true) {
            this.logerror('A fatal error occured (see screenshot)', new Error(message))
            throw new Error(message)
        } else {
            this.logerror('A non-fatal error occured', new Error(message))
        }
    }
    async sendMetrics(clickInfo, duration) {
        try {
            const data = await this.sendMessage(MESSAGE_METRICS, clickInfo.metric, {
                duration: duration,
                label: `${clickInfo.type}.${clickInfo.label}`
            })
        } catch (e) {
            this.logerror('Error Sending metrics', e)
        }
    }
    async updateMetric(clickInfo, elapsedMs) {
        const metricId = clickInfo.metric
        if (_.isEmpty(metricId)) {
            return
        }
        await this.sendMetrics(clickInfo, elapsedMs)
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
        this.log(`click.${clickInfo.type}.${clickInfo.label}`)
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
                await this.throwError(`Config - Unknown config.tempo[${tempo}]`)
            }
            tempo = this.config.tempo[tempo]
        }
        const tempoMs = parseInt(tempo)
        if (isNaN(tempoMs)) {
            await this.throwError(`Config - Bad 'tempo' value [${tempoMs}ms/${tempo}]`)
        }
        this.log(`[${new String(this.stepIdx++).padStart(2, 0)}] pause page[${this.pwPageId()}] tempoMs[${tempoMs}]`)
        await pause(tempoMs);
    }
    async clickMenuApprenant(tempo) {
        await this.clickBySelector(_CLICKABLE.MENU.LEARNER, tempo)
    }
    async clickSessionsApprenant(tempo) {
        await this.clickByRole(_CLICKABLE.LINKS.MYSESSIONS, tempo)
    }
    async clickSelectSessionApprenant(tempo) {
        await this.clickList(this.config.entities.session.mainName, tempo)
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
        const expectedText = 'démarrer'
        const _tryReadStartButton = async () => {
            /** 
            * https://playwright.dev/docs/api/class-elementhandle#element-handle-inner-html
            * ElementHandle returns null if not found contrary to locator
            */
            let element = await this.selector(selectorPageDetailSession)
            let innerHtml = null
            if (element != null) {
                this.log('Career starts from user session\'s page')
                innerHtml = await element.innerHTML()
            } else {
                element = await this.selector(selectorPageApprenant)
                if (element != null) {
                    this.log('Career starts from learner\' homre welcome session')
                    innerHtml = await element.innerHTML()
                }
            }
            return (innerHtml ?? '').trim()
        }
        let buttonText
        let nbRetries = this.config.misc.readDomNbRetries
        do {
            buttonText = await _tryReadStartButton()
            if (_.isEmpty(buttonText)) {
                nbRetries--
                this.logwarning(`Can't read '${expectedText}' button - nbRetries[${nbRetries}] retryPause[${this.config.tempo[TEMPO_RETRY_READ_DOM]}]`)
                await this.tempo(TEMPO_RETRY_READ_DOM)
            }
        } while (_.isEmpty(buttonText) && nbRetries > 0)
        if (_.isEmpty(buttonText) || buttonText.toLowerCase() != expectedText) {
            await this.throwError(`Career starts from an unknownn page - Expected[${expectedText}] Got[${buttonText}] nbRetries[${nbRetries}]`)
        }
        await this.clickByRole(_CLICKABLE.BUTTONS.DEMARRER, tempo)
    }
    async fillLabel(label, value, tempo) {
        this.log(`fillLabel '${label}' [${value}]`)
        await this.pwPage.getByLabel(label).fill(value)
        await this.tempo(tempo ?? TEMPO_TEXT_INPUT)
    }
    async _checkClickInfo(clickInfo) {
        if (!_.isPlainObject(clickInfo) || _.isEmpty(clickInfo.label) || _.isEmpty(clickInfo.type)) {
            await this.throwError(`_checkClickInfo expects an object with at least a label and a type - clickInfo[${clickInfo ? JSON.stringify(clickInfo, null, 2) : 'null'}]`)
        }
    }
    async _checkClickable(object, clickInfo) {
        if (!object) {
            await this.throwError(`_checkClickable unexpected null object - clickInfo[${JSON.stringify(clickInfo, null, 2)}]`)
        }
        if (!object.click) {
            await this.throwError(`_checkClickable unexpected null object.click method - clickInfo[${JSON.stringify(clickInfo, null, 2)}]`)
        }
    }
    async clickBySelector(clickInfo, tempo) {
        await this._checkClickInfo(clickInfo)
        if (_.isEmpty(clickInfo.selector)) {
            await this.throwError(`clickBySelector: unexpected empty clickInfo.selector`)
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
        await this._checkClickInfo(clickInfo)
        if (!clickInfo.role) {
            await this.throwError(`clickByRole - clickInfo.role is empty`)
        }
        const locator = await this.pwPage.getByRole(clickInfo.role, { name: clickInfo.label })
        await this.clickByLocator(locator, clickInfo, tempo)
    }
    async clickByLocator(locator, clickInfo, tempo) {
        if (locator == null) {
            await this.throwError(`clickByLocator: unexpected null locator ${JSON.stringify(clickInfo)}`)
        }
        await this._checkClickable(locator, clickInfo)
        await this.applyAndMesure(clickInfo, tempo, locator, locator.click)
    }
    async clickByText(textInfo, tempo = null) {
        await this._checkClickInfo(textInfo)
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
        await this._checkClickInfo(pageInfo)
        if (!pageInfo.path) {
            await this.throwError(`gotoPage - pageInfo.path is empty`)
        }
        const url = this.fullUrl(pageInfo.path)
        this.log(`gotoPage ${url}`)
        await this.applyAndMesure(pageInfo, tempo, this.pwPage, this.pwPage.goto, url)
    }
    async runBefore(method, ...args) {
        const traceEnv = []
        for (const [key, value] of Object.entries(process.env)) {
            (key == 'LOCAL_WORKER_ID' || key.startsWith('SLDX')) && traceEnv.push(`${key}=${value}`)
        }
        this.log(`SLDX Variables:\n${traceEnv.sort().join('\n')}\n`)
        await this.sendMessage(MESSAGE_STATUS, STATUS_BEGIN)
    }
    async runError(method, e, ...args) {
        await this.sendMessage(MESSAGE_STATUS, STATUS_ERROR, {
            message: e.message ?? 'no message'
        })
        throw (e)
    }
    async runFinally(method, ok, ...args) {
        await this.sendMessage(MESSAGE_STATUS, ok ? STATUS_END_KO : STATUS_END_KO)
    }
    async runStart() {
        await this.beforeLogin()
        await this.login()
        await this.afterLogin()
        await this.beforeScriptEnd()
        await this.sendMessage(MESSAGE_STATUS, STATUS_END_OK)
    }
    async login(tempo) {
        this.loghighlight(`login ${this.learnerName}/${this.config.getUserPwd()} [${this.learnerRole}]`)
        await this.gotoPage(_CLICKABLE.PAGES.CLIENT)
        await this.fillLabel('Veuillez entrer votre identifiant ou e-mail *', this.learnerName)
        await this.fillLabel('Mot de passe : *', this.config.getUserPwd())
        await this.clickConnect()
        await this.tempo(TEMPO_LOGIN)
    }
    async assertSessionProgression(percent) {
        const expectedPogress = `${percent}%`
        const sessionProgress = await this.getSessionProgression()
        /**
         * isPlayWrightUi not fails -> used to test the user interface
         * Eg: npm run playwright.script1 --  --sldxenv=fdalbo --sldxpwuser=user3 --ui
         */
        if ((this.isArtillery() || !this.isPlayWrightUi()) && expectedPogress != sessionProgress) {
            await this.throwError(`unexpected session progression for user[${this.learnerName}] - Expected[${expectedPogress}] - Got[${sessionProgress}]`)
        }
    }
    async getSessionProgression() {
        const progress = await this.locator('app-progress-bar .percentage-progression').innerHTML()
        this.loghighlight(`Progession [${progress}]`)
        return progress
    }
    async beforeLogin() {
        this.loghighlight(`beforeLogin`)
    }
    async afterLogin() {
        this.loghighlight(`afterLogin`)
        await this.clickMenuApprenant()
        if (this.learnerRole = ROLE_LEARNER) {
            await this.learnerCheckSatus()
        } else {
            /** In case we want to develop scenarri for other  user roles */
            await this.throwError(`Unexpected user role[${this.learnerName}.${this.learnerRole}] - Expected[${ROLE_LEARNER}]`)
        }
    }
    async learnerCheckSatus() {
        await this.assertSessionProgression(0)
    }
    async beforeScriptEnd() {
        await pause(1000);
    }
    static async factoryRun(scriptFilePath, pwPage, myConsole) {
        if (_.isEmpty(process.env.SLDX_RUNNER_EXEC)) {
            this.logwarning(`\n\nProcess must be launched by the runner\n- npm run artillery.script1 --  --sldxenv=playwright.debug\n- npm run playwright.script1 --  --sldxenv=playwright.debug --sldxpwuser=user4 --debug\n\n`)
            throw new Error(`Process must be launched by the runner`)
        }
        await Runnable.factoryRun.apply(this, [{
            name: this.name.toLocaleLowerCase(),
            scriptFilePath: scriptFilePath,
            pwPage: pwPage,
            myConsole: myConsole
        }])
    }
    static scriptTimeout() {
        const to = parseInt(process.env.SLDX_PLAYWRIGTH_SCRIPT_TIMEOUT)
        if (isNaN(to)) {
            throw new Error('Unexpected not number process process.env.SLDX_PLAYWRIGTH_SCRIPT_TIMEOUT')
        }
        return to
    }
}
