const { SEIRASSO_COLLECTIONS, DBNAMES, SeiraMongoClient } = require('./helpers')

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
        //const docs = await this.loginCollection.find({ login: 'user*' }).toArray()
        const docs = await this.loginCollection.find({ login: { $regex: 'user[0-9]+' }, password: 'NOT_DEFINED' }).toArray()

        for await (const doc of docs) {
            this.log(JSON.stringify(doc))
            continue
            const result = await this.loginCollection.updateOne(doc, { $set: { password: `pwd${new Date().getSeconds()}` } })
            this.log(`updatePwd ${result.modifiedCount} docs modified`)
        }
    }
}
(async (url = 'mongodb://localhost:27017') => {
    const client = new MyClient(url)
    await client.run(client.updatePwd)
})()

