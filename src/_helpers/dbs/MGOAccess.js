"use strict";
import _ from 'lodash'
import assert from 'assert'
import { MongoClient } from 'mongodb'
import { format as prettyFormat } from 'pretty-format'
import myConsole from '#commons/myConsole'
import SSHTunnel from 'ssh/SSHTunnel'

export default class MGOAccess {
    #sshTunnel = null
    #mongoClient = null
    #mongoDb = null
    #options = null
    constructor(options) {
        this.#options = Object.assign({
            ssh: true,
            verbose: false
        }, options ?? {})
    }
    get options() {
        return this.#options
    }
    get verbose() {
        return this.options.verbose === true
    }
    get useSSH() {
        return this.options.ssh === true
    }
    async destroy() {
        await this.close()
    }
    get sshConfig() {
        return this.#sshTunnel && this.#sshTunnel.config
    }
    mongoConfig(host, port) {
        host ??= process.env.SLDX_MONGO_HOST
        port ??= process.env.SLDX_MONGO_PORT
        return `mongodb://${host}:${port}`
    }
    async close() {
        const log = this.verbose === true
        log&& myConsole.highlight('mgoaccess.close')
        if (this.#mongoClient) {
            log && myConsole.lowlight('-> 1.mgoaccess.mongoClient.close')
            await this.#mongoClient.close()
            log && myConsole.lowlight('-> 1.mgoaccess.mongoClient.closed')
        }
        if (this.#sshTunnel) {
            log && myConsole.lowlight('-> 2.mgoaccess.sshTunnel.close')
            await this.#sshTunnel.destroy()
            log && myConsole.lowlight('-> 2.mgoaccess.sshTunnel.closed')
        }
        this.#mongoClient = null
        this.#mongoDb = null
        this.#sshTunnel = null
        myConsole.highlight('mgoaccess.closed')
    }
    async connect(dbName) {
        const log = this.verbose === true
        assert(_.isEmpty(this.#mongoClient), `Mongo client tunnel already connected`)
        assert(_.isEmpty(this.#sshTunnel), `ssh tunnel already opened`)
        try {
            log && myConsole.highlight(`mgoaccess.connect dbName[${dbName}}]`)
            let sgbdHost = this.useSSH === true ? '127.0.0.1' : process.env.SLDX_MONGO_HOST
            if (this.useSSH) {
                log && myConsole.lowlight('-> 1.mgoaccess.sshTunnel.open')
                this.#sshTunnel = new SSHTunnel({
                    verbose: this.verbose,
                    superVerbose: this.options.superVerbose == true,
                    sshOptions: {
                        host: process.env.SLDX_MONGO_HOST
                    },
                    forwardOptions: {
                        srcPort: process.env.SLDX_MONGO_PORT,
                        dstAddr: process.env.SLDX_MONGO_HOST
                    }
                })
                await this.#sshTunnel.open()
                log && myConsole.lowlight('-> 1.mgoaccess.sshTunnel.opened')
            } else {
                this.#sshTunnel = null
                throw new Error(`Connection to Mongo is available only through a ssh tunnel`)
            }
            log && myConsole.lowlight('-> 2.mgoaccess.mongoClient.connect')
            const mongoCfg = this.mongoConfig(sgbdHost)
            log && myConsole.lowlight(`mongoConnect [${mongoCfg}]`)
            this.#mongoClient = new MongoClient(mongoCfg)
            await this.#mongoClient.connect()
            assert(!_.isEmpty(dbName), `Mongo database name is empty (dbName)`)
            this.#mongoDb = this.#mongoClient.db(dbName)
            log && myConsole.lowlight('-> 2.mgoaccess.mongoClient.connected')
            myConsole.highlight(`mgoaccess.connected`)
        } catch (error) {
            myConsole.lowlightRed(`mgoaccess.connect.ssh.error\n${error.message}`)
            await this.close()
            throw error
        }
    }
    get db() {
        assert(!_.isEmpty(this.#mongoClient), `Unexpected null mongo client`)
        assert(!_.isEmpty(this.#mongoDb), `Unexpected null mongo db`)
        return this.#mongoDb
    }
    /**
     * Just to log query call
     */
    get query() {
        myConsole.highlight('mgoaccess.query')
        return this.db
    }
}
