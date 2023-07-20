
const myConsole = require('#commons/myConsole')
const { pause } = require('#commons/promises')
const path = require('path')
const _ = require('lodash')
const appRootDir = require('app-root-dir')
const {
    initConfig,
    ROLE_LEARNER,
    TEMPO_PAGE,
    TEMPO_RADIO,
    TEMPO_CARD_DISPLAY,
    TEMPO_TEXT_INPUT,
    TEMPO_MODAL
} = require(`${appRootDir.get()}/config.base`)

exports.ScriptRunner = class ScriptRunner {
    stepIdx = 0
    name = null
    pwPage = null
    config = null
    userId = null
    userRole = null
    scenario = null
    constructor(scriptFilePath, pwPage) {
        this.name = path.basename(scriptFilePath)
        this.pwPage = pwPage
        myConsole.initLoggerFromModule(this.name)
        this.config = initConfig(this.className.toLowerCase())
        this.scenario = this.config.scenario ?? {}
        this.userId = this.config.getUserId()
        this.userRole = this.config.user.role ?? 'empty'
        /** see https://playwright.dev/docs/api/class-page#page-set-default-navigation-timeout  */
        pwPage.setDefaultNavigationTimeout(this.config.timeouts.defaultNavigationTimeout ?? 1000)
        /** seehttps://playwright.dev/docs/api/class-page#page-set-default-timeout */
        pwPage.setDefaultTimeout(this.config.timeouts.defaultTimeout ?? 1000)
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
                throw new Error(`Config - Unknown cinfog.tempo[${tempo}]`)
            }
            tempo = this.config.tempo[tempo]
        }
        const tempoMs = parseInt(tempo)
        if (isNaN(tempoMs)) {
            throw new Error(`Config - Bad 'tempo' value [${tempoMs}ms/${tempo}]`)
        }

        await pause(tempoMs);
        this.log(`[${new String(this.stepIdx++).padStart(2, 0)}] ${this.pwPageId()}`)
    }
    async clickMenuApprenant(tempo) {
        await this.clickBySelector('#learner', tempo)
    }
    async clickSessionsApprenant(tempo) {
        await this.clickLink('Toutes mes sessions', tempo)
    }
    async clickSelectSessionApprenant(tempo) {
        await this.clickList(this.scenario.sessionName, tempo)
    }
    async clickNextCard(tempo) {
        await this.clickButtonCard(true, tempo)
    }
    async clickPrevCard(tempo) {
        await this.clickButtonCard(false, tempo)
    }
    async clickButtonCard(next = true, tempo) {
        tempo ??= TEMPO_CARD_DISPLAY
        await this.clickButton(next === true ? 'SUIVANT' : 'Précédent', tempo)
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
            myConsole.lowlight('Career starts from user session\'s page')
            text = await element.innerHTML()
        } else {
            let element = await this.selector(selectorPageApprenant)
            if (element != null) {
                myConsole.lowlight('Career starts from learner\' homre welcome session')
                text = await element.innerHTML()
            } else {
                throw new Error(`Career starts form an unknownn page`)
            }
        }
        if (text.toLowerCase() != 'démarrer') {
            throw new Error(`User[${this.userId}] - Unexpected 'start career' button - Expected[démarrer] Got[${text}]`)
        }
        await this.clickButton('démarrer', tempo)
    }
    async fillLabel(label, value, tempo) {
        tempo ??= TEMPO_TEXT_INPUT
        this.log(`fillLabel '${label}' [${value}]`)
        await this.pwPage.getByLabel(label).fill(value)
        await this.tempo(tempo)
    }
    async clickBySelector(selector, tempo) {
        this.log(`clickBySelector '${selector}'`)
        await this.locator(`${selector}`).click()
        await this.tempo(tempo)
    }
    /**
     * @param {number} index 1 to n from top to bottom
     */
    async clickCheckBox(index, tempo) {
        tempo ??= TEMPO_RADIO
        await this.clickBySelector(`mat-checkbox:nth-child(${index})`, tempo)
    }
    /**
     * @param {number} index 1 to n from top to bottom
     */
    async clickRadio(index, tempo) {
        tempo ??= TEMPO_RADIO
        await this.clickBySelector(`mat-radio-button:nth-child(${index})`, tempo)
    }
    async clickButton(buttonName, tempo) {
        await this.clickByRole('button', buttonName, tempo)
    }
    async clickModalOK(tempo) {
        tempo ??= TEMPO_MODAL
        await this.clickButton('Ok', tempo)
    }
    async clickModalCancel(tempo) {
        tempo ??= TEMPO_MODAL
        await this.clickButton('Annuler', tempo)
    }
    async clickByRole(role, name, tempo) {
        this.log(`clickByRole '${role}' '${name}'`)
        await this.pwPage.getByRole(role, { name: name }).click()
        await this.tempo(tempo)
    }
    async clickLink(name, tempo) {
        tempo ??= TEMPO_PAGE
        await this.clickByRole('link', name, tempo)
    }
    async clickList(text, tempo) {
        tempo ??= TEMPO_PAGE
        this.log(`clickList '${text}'`)
        await this.pwPage.getByText(text).click();
        await this.tempo(tempo)
    }
    async clickTile(title, tempo) {
        tempo ??= TEMPO_PAGE
        this.log(`clickTile ${title}`)
        await this.pwPage.getByTitle(title).click();
        await this.tempo(tempo)
    }
    async clickConnect(tempo) {
        tempo ??= TEMPO_PAGE
        await this.clickButton('Connexion', tempo)
    }
    log(...args) {
        myConsole.lowlight.apply(myConsole, args)
    }
    async run() {
        const traceEnv = []
        for (const [key, value] of Object.entries(process.env)) {
            (key == 'LOCAL_WORKER_ID' || key.startsWith('SLDX')) && traceEnv.push(`${key}=${value}`)
        }
        this.log(`SLDX Variables:\n${traceEnv.join('\n')}\n`)
        await this.login()
        await this.afterLogin()
        await this.beforeEnd()
    }
    async login(tempo) {
        tempo ??= TEMPO_PAGE
        myConsole.highlight(`login ${this.userId}/${this.config.getUserPwd()} [${this.userRole}]`)
        const url = this.fullUrl('/client')
        this.log(`gotoPage ${url}`)
        await this.pwPage.goto(url)
        await this.tempo(tempo)
        await this.fillLabel('Veuillez entrer votre identifiant ou e-mail *', this.userId)
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
            throw new Error(`unexpected session progression for user[${this.userId}] - Expected[${expectedPogress}] - Got[${sessionProgress}]`)
        }
    }
    async getSessionProgression() {
        const progress = await this.locator('app-progress-bar .percentage-progression').innerHTML()
        myConsole.highlight(`Progession [${progress}]`)
        return progress
    }
    async afterLogin() {
        myConsole.highlight(`afterLogin`)
        await this.clickMenuApprenant()
        if (this.userRole = ROLE_LEARNER) {
            await this.learnerCheckSatus()
        } else {
            /** In case we want to develop scenarri for other  user roles */
            throw new Error(`Unexpected user role[${this.userId}.${this.userRole}] - Expected[${ROLE_LEARNER}]`)
        }
    }
    async learnerCheckSatus() {
        await this.assertSessionProgression(0)
    }
    async beforeEnd() {
        await pause(1000);
    }
}
