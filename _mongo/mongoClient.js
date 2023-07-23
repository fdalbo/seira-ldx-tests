const { SEIRASSO_COLLECTIONS, SeiraMongoClient } = require('./helpers')
const prompts = require('prompts')
const parseArguments = require('minimist')
const _ = require('lodash')

/**
 * COMMAND: node ./_mongo/mongoClient.js --url mongodb://host:port
 * Default url is mongodb://localhost:27017
 */
class MyClient extends SeiraMongoClient {
    #loginCollection = null
    get loginCollection() {
        return this.#loginCollection
    }
    async runBefore() {
        this.#loginCollection = await this.seirassoCollection(SEIRASSO_COLLECTIONS.LOGINS)
        /** this.logCollection(DBNAMES.SEIRASSO, SEIRASSO_COLLECTIONS.LOGINS) */
    }
    async updatePwd() {
        const docs = await this.loginCollection.find({ login: { $regex: 'user[0-9]+' }, password: 'NOT_DEFINED' }).toArray()
        let modifiedCount = 0
        for await (const doc of docs) {
            this.log(JSON.stringify(doc))
            const result = await this.loginCollection.updateOne(doc, { $set: { password: `pwd${new Date().getSeconds()}` } })
            modifiedCount+= result.modifiedCount
        }
        this.loghighlight(`updatePwd ${modifiedCount} docs modified`)
    }
    async updateUserName() {
        const docs = await this.loginCollection.find({ login: { $regex: 'user[0-9]+' } }).toArray()
        let modifiedCount = 0
        for await (const doc of docs) {
            this.log(JSON.stringify(doc))
           // const result = await this.loginCollection.updateOne(doc, { $set: { password: `pwd${new Date().getSeconds()}` } })
           const result = {modifiedCount:1}
           modifiedCount+= result.modifiedCount
        }
        this.loghighlight(`updatePwd ${modifiedCount} docs modified`)
    }
}


(async () => {
    const minimistOpts = {
        string: ['url']
    }
    const args = parseArguments(process.argv.slice(2), minimistOpts)
    const url = args.url ?? 'mongodb://localhost:27017'
    const response = await prompts({
        type: 'confirm',
        name: 'value',
        message: `Confirm DB Url '${url}'`,
        initial: false
    })
    if (response.value !== true) {
        process.exit(1)
    }
    const client = new MyClient(url)
    await client.askAndExecAction()
})()

