
const myConsole = require('#commons/myConsole')
const { pause } = require('#commons/promises')
const path = require('path')

exports.ScriptRunner = class ScriptRunner {
    pageIdx = 0
    name = null
    options = null
    pwPage = null
    config = null
    constructor(scriptName, pwPage, options) {
        this.name = path.basename(scriptName)
        this.pwPage = pwPage
        this.options = Object.assign({
        }, options ?? {})
        myConsole.initLoggerFromModule(this.name)
        this.initConfig()
    }
    getArtilleryUser() {
        const workerIdx = parseInt(process.env.LOCAL_WORKER_ID ?? '')
        if (isNaN(workerIdx)) {
            throw new Error(`Unexpected empty 'LOCAL_WORKER_ID' env variable`)
        }
        const userPrefix = process.env.SLDX_USER_PREFIX ?? 'user'
        if (userPrefix.length == 0) {
            throw new Error(`Unexpected empty 'SLDX_USER_PREFIX' env variable`)
        }
        /**
         * userPrefix1, 2, 3....
         */
        const userFirstIdx = workerIdx + parseInt(process.env.SLDX_USER_FIRST_IDX ?? '0')
        if (isNaN(userFirstIdx)) {
            throw new Error(`Unexpected empty 'SLDX_USER_FIRST_IDX' env variable`)
        }
        return `${userPrefix}${userFirstIdx}`
    }
    getPlaywrightUser() {
        const user = process.env.SLDX_PLAYWRIGHT_USER ?? ''
        if (user.length == 0) {
            throw new Error(`Unexpected empty 'SLDX_PLAYWRIGHT_USER' env variable`)
        }
        return user
    }

    initConfig() {
        let user
        if (process.env.SLDX_RUNNER_EXEC == 'artillery') {
            user = this.getArtilleryUser()
        } else if (process.env.SLDX_RUNNER_EXEC == 'playwright') {
            user = this.getPlaywrightUser()
        } else {
            throw new Error(`Unknown value for SLDX_RUNNER_EXEC [${process.env.SLDX_RUNNER_EXEC}]`)
        }
        this.config = {
            proxyUrl: process.env.SLDX_PROXY_URL ?? 'http://localhost:2020',
            admin: {
                user: process.env.SSLDX_ADMIN_USER,
                name: process.env.SSLDX_ADMIN_PASSWORD ?? ''
            },
            user: {
                id: user,
                password: process.env.SLDX_USER_PWD ?? 'seira'
            },
            mongo: {
                host: process.env.SLDX_MONGO_HOST,
                port: process.env.SLDX_MONGO_PORT,
            }
        }
        this.log(`Config:\n${JSON.stringify(this.config, null, 2)}`)
    }
    fullUrl = (path) => {
        return `${this.config.proxyUrl}${path}`
    }
    pwPageId() {
        const url = new URL(`${this.pwPage.url()}?`)
        return url.pathname.substring(url.pathname.lastIndexOf('/'))
    }
    async waitPage() {
        this.pageIdx++
        await pause(1000);
        this.log(`page[${this.pageIdx}] ${this.pwPageId()}`)
    }
    async gotoPage(path) {
        this.log(`gotoPage ${path} (${this.fullUrl(path)})`)
        await this.pwPage.goto(this.fullUrl(path))
        await this.waitPage()
    }
    async fillLabel(label, value) {
        this.log(`fillLabel '${label}'`)
        return this.pwPage.getByLabel(label).fill(value)
    }
    async clickBySelector(selector) {
        this.log(`clickBySelector '${selector}'`)
        await this.pwPage.locator(`${selector}`).click()
        await this.waitPage(this.pwPage)
    }
    async clickButton(name) {
        await this.clickByRole('button', name)
    }
    async clickByRole(role, name) {
        this.log(`clickByRole '${role}' '${name}'`)
        await this.pwPage.getByRole(role, { name: name }).click()
        await this.waitPage(this.pwPage)
    }
    async clickLink(name) {
        await this.clickByRole('link', name)
    }
    async clickText(text) {
        this.log(`clickText '${text}'`)
        await this.pwPage.getByText(text).click();
        await this.waitPage(this.pwPage)
    }
    async clickTile(title) {
        this.log(`clickTile ${title}`)
        await this.pwPage.getByTitle(title).click();
        await this.waitPage(this.pwPage)
    }
    log(...args) {
        myConsole.lowlight.apply(myConsole, args)
    }
    async run() {
        try {
            myConsole.superhighlight(`BEGIN ${this.name} user[${this.config.user.id}]`)
            const traceEnv = []
            for (const [key, value] of Object.entries(process.env)) {
                (key == 'LOCAL_WORKER_ID' || key.startsWith('SLDX')) && traceEnv.push(`${key}=${value}`)
            }
            this.log(`SLDX Variables:\n${traceEnv.join('\n')}\n`)
            await this.login()
            await this.afterLogin()
            await this.beforeEnd()
        } catch (e) {
            myConsole.error(`END ${this.name} ERROR user[${this.config.user.id}]`, e)
            throw e
        }
        myConsole.superhighlight(`END ${this.name} OK user[${this.config.user.id}]`)
    }
    async login() {
        myConsole.highlight(`Login ${this.config.user.id}/${this.config.user.password}`)
        await this.gotoPage(`/client`);
        await this.fillLabel('Veuillez entrer votre identifiant ou e-mail *', this.config.user.id)
        await this.fillLabel('Mot de passe : *', this.config.user.password)
        await this.clickButton('Connexion')
    }
    async afterLogin() {
        /** your code there */
        myConsole.highlight(`afterLogin`)
    }
    async beforeEnd() {
        await pause(1000);
    }
}
