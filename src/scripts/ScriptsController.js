'use strict';

const appRootDir = require('app-root-dir')
const { BroadcastChannel } = require('worker_threads')
const Loggable = require('#helpers/Loggable')
const {
    METRIC_CARDS,
    METRIC_QUIZ,
    METRIC_NAV,
    STATUS_ERROR,
    MESSAGE_STATUS,
    MESSAGE_METRICS,
    MESSAGE_BROADCAST_CHANNEL,
    METRICS
} = require(`${appRootDir.get()}/config.base`)
const path = require('path')
const _ = require('lodash')
const Stats = require('stats-incremental')
const assert = require('assert')
const numeral =  require('numeral')
const CSVStream = require('#helpers/CsvStream')


module.exports = class ScriptsControler extends Loggable {
    #broadCastChannel = null
    #csvStreamMetrics = null
    #csvStreamSatus = null
    constructor(opts) {
        super(opts)
        /**
         * broadCastChannel is used by scripts to send message and by main thread to receive /Process them
         * see ScriptsController and ScriptRunner
         */
        this.#broadCastChannel = new BroadcastChannel(MESSAGE_BROADCAST_CHANNEL)
        this.broadCastChannel.onmessage = this.onmessage.bind(this)
    }
    /** overriden */
    async asyncInit() {
        this.#csvStreamSatus = new CSVStream({
            headers: true,
            override: true,
            filePath: path.resolve(process.env.SLDX_METRICS_DIR_PATH, `${this.threadId}-status.csv`),
            writeProperties: ['learner', 'message']
        })
        /** Metrics */
        if (process.env.SLDX_METRICS_ENABLED == 'true') {
            this.#csvStreamMetrics = new CSVStream({
                headers: true,
                override: true,
                filePath: path.resolve(process.env.SLDX_METRICS_DIR_PATH, `${this.threadId}-metrics.csv`),
                writeProperties: ['learner', 'value', 'n', 'min', 'max', 'mean', 'stdtdev', 'label']
            })
            this.metrics = {
                lastUpdate: null,
                stats: {}
            }
            /** Init incremental stat calculator per metric */
            for (const metricId of METRICS) {
                this.metrics.stats[metricId] = Stats()
            }
            this.loghighlight(`Metrics are enabled [${METRICS.join(',')}]`)
        } else {
            this.loghighlight(`Metrics are disabled (SLDX_METRICS_ENABLED!=true)`)
        }
    }
    get broadCastChannel() {
        return this.#broadCastChannel
    }
    get csvStreamMetrics() {
        return this.#csvStreamMetrics
    }
    get csvStreamSatus() {
        return this.#csvStreamSatus
    }
    destroy() {
        super.destroy()
        this.broadCastChannel && this.broadCastChannel.close()
        this.#broadCastChannel = null
        this.csvStreamMetrics && this.csvStreamMetrics.destroy()
        this.#csvStreamMetrics = null
        this.csvStreamSatus && this.csvStreamSatus.destroy()
        this.#csvStreamSatus = null
    }
    getStat(id) {
        return this.metrics.stats[id]
    }
    onmessage(event) {
        const data = event.data
        if (_.isNil(event) || _.isNil(data)) {
            this.logcolor(('cyan', `${this.className}.onmessage received null`))
            return
        }
        data.data ??= {}
        this.logjson('onmessage.data', data)
        let additionalLogInfo = null
        switch (event.data.type) {
            case MESSAGE_METRICS:
                additionalLogInfo = this.processMetrics(data)
                break
            case MESSAGE_STATUS:
                additionalLogInfo = this.processStatus(data)
                break
        }
        this.logcolor('cyan', `onmessage.${data.data.learner}.${data.type}.${data.id}${additionalLogInfo ?? ''}`)
    }
    /*
        const data = {
            type: MESSAGE_METRICS,
            id: clickInfo.metric,
            emitter: this.threadId,
            data: {
                duration: duration,
                label: `${clickInfo.type}.${clickInfo.label}`
            }
        }
     */
    processMetrics(data) {
        /** calculated incremental stats based for all workers */
        const stats = this.getStat(data.id)
        if (!stats) {
            this.logwarning(`Metric id[${metricId}] not found`)
            return
        }
        stats.update(data.data.duration)
        const csvData = {
            learner: data.data.learner,
            value: data.data.duration,
            n: stats.n,
            min: stats.min,
            max: stats.max,
            mean: Math.floor(stats.mean),
            stdtdev: numeral(stats.standard_deviation).format('0.00'),
            label: data.data.label
        }
        this.csvStreamMetrics.write(data.emitter, data.id, csvData)
        return `.${csvData.value}.mean.${csvData.mean}.n.${csvData.n}`
    }
    processStatus(data) {
        const csvData = {
            learner: data.data.learner,
            text: ''
        }
        if (data.id === STATUS_ERROR) {
            csvData.text = data.data.message ?? 'no message'
        }
        this.#csvStreamSatus.write(data.emitter, data.id, data.data)
        switch (data.id) {
        }
    }
    static async factory(myConsole) {
        const controller = new this(myConsole)
        await controller.asyncInit()
        return controller
    }
}