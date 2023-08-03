'use strict';

const appRootDir = require('app-root-dir')
const chalk = require('chalk')
const { BroadcastChannel } = require('worker_threads')
const Loggable = require('#helpers/Loggable')
const prettyMS = require('pretty-ms')

const { format: prettyFormat } = require('pretty-format')
const {
    initConfig,
    METRIC_CARDS,
    METRIC_QUIZ,
    METRIC_NAV,
    STATUS_ERROR,
    STATUS_BEGIN,
    STATUS_END_OK,
    STATUS_END_KO,
    STATUS_LIST,
    MESSAGE_STATUS,
    MESSAGE_METRICS,
    MESSAGE_BROADCAST_CHANNEL,
    METRICS
} = require(`${appRootDir.get()}/config.base`)
const path = require('path')
const _ = require('lodash')
const Stats = require('stats-incremental')
const assert = require('assert')
const numeral = require('numeral')
const CSVStream = require('#helpers/CsvStream')
const astable = require('as-table');

const PRETTY_MS_OPTS = {
    secondsDecimalDigits: 0,
    separateMilliseconds: false
}

const _statusColor = (status, value) => {
    if (status == STATUS_END_KO || status == STATUS_ERROR) return chalk.red(value)
    return chalk.green(value)
}
const _metricsData = (stats) => ({
    n: stats.n,
    min: stats.n == 0 ? '' : Math.floor(stats.min),
    max: stats.n == 0 ? '' : Math.floor(stats.max),
    mean: stats.n == 0 ? '' : Math.floor(stats.mean),
    stdtdev: stats.n == 0 ? '' : numeral(stats.standard_deviation).format('0.00'),
})

module.exports = class ScriptsController extends Loggable {
    #broadCastChannel = null
    #csvStreamMetrics = null
    #csvStreamSatus = null
    metrics = null
    metricsPerMinute = null
    statusTracking = new Map()
    scriptConfig = null
    scriptName = null
    startUpdate = null
    constructor(opts) {
        super(opts)
        this.scriptName = opts.scriptName
        assert(!_.isEmpty(this.scriptName, 'unexpected empty scriptName'))
        /**
         * broadCastChannel is used by scripts to send message and by main thread to receive /Process them
         * see ScriptsController and ScriptRunner
         */
        this.#broadCastChannel = new BroadcastChannel(MESSAGE_BROADCAST_CHANNEL)
        this.broadCastChannel.onmessage = this.onmessage.bind(this)
    }
    /** overriden */
    async asyncInit() {
        this.scriptConfig = initConfig(this.scriptName)
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
            this.metricsPerMinute = {
                stats: Stats(),
                lastUpdate: null,
                period: 1000,
                counter: 0
            }
            this.loghighlight(`Metrics are enabled [${METRICS.join(',')}]`)
        } else {
            this.loghighlight(`Metrics are disabled (SLDX_METRICS_ENABLED!=true)`)
        }
        this.startUpdate = new Date().getTime()
        STATUS_LIST.forEach(status => this.statusTracking.set(status, 0))
        const updatePeriod = this.scriptConfig.misc.refreshSummaryPeriod
        this.loghighlight(`refreshSummaryPeriod[${updatePeriod}]`)
        assert(_.isInteger(updatePeriod), `config.misc.refreshSummaryPeriod[${updatePeriod}] not numeric`)
        setInterval(this.updatePanel.bind(this), Math.max(1000, updatePeriod))

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
    updatePanel() {
        const baseColor = chalk.hex('#c8c22a')
        const elapsed = new Date().getTime() - this.startUpdate
        console.log(chalk.grey('\n\n-----------------------------------------------------------------------------------'))
        console.log(chalk.green(`script[${this.scriptName}]  runningFor[${prettyMS(elapsed, PRETTY_MS_OPTS)}]  VUsers[${process.env.SLDX_ARTILLERY_NB_VUSERS}]`))
        console.log(chalk.grey(`env[${process.env.SLDX_ENV}]  config[${this.scriptConfig.fileName}] `))
        const statusData = {}
        const it = this.statusTracking.entries()
        let result = it.next();
        while (!result.done) {
            statusData[result.value[0]] = _statusColor(result.value[0], result.value[1])
            result = it.next()
        }
        console.log()
        console.log(baseColor(`${chalk.magenta(`Workers status`)}\n${astable([statusData])}`))
        const metricsTable = []
        let totalStats = 0
        for (const metricId of METRICS) {
            const stat = this.getStat(metricId)
            metricsTable.push({
                id: metricId,
                ..._metricsData(stat)
            })
            totalStats = totalStats + stat.n
        }
        console.log()
        const text =[
            chalk.magenta('Metrics'),
            chalk.green(`total[${totalStats}] perSec[${Math.floor((totalStats * 100) / (elapsed / 1000)) / 100}]`),
            astable(metricsTable)
        ]
        console.log(baseColor(text.join('\n')))
        if (this.metricsPerMinute.stats.n > 0) {
            const metricsPerMinute = {
                n: this.metricsPerMinute.stats.n,
                max: Math.floor(this.metricsPerMinute.stats.max),
                mean: Math.floor(this.metricsPerMinute.stats.mean),
                period: `${Math.floor(this.metricsPerMinute.period / 1000)}sec`
            }
            console.log()
            console.log(chalk.green(`Average per time slot:\n${astable([metricsPerMinute])}`))
        }
        console.log()
    }
    onmessage(eventData) {
        const data = eventData.data
        if (_.isNil(eventData) || _.isNil(data)) {
            this.logcolor(('cyan', `${this.className}.onmessage received null`))
            return
        }
        data.data ??= {}
        this.logjson('onmessage.data', data)
        let additionalLogInfo = null
        switch (eventData.data.type) {
            case MESSAGE_METRICS:
                additionalLogInfo = this.processMetrics(data)
                break
            case MESSAGE_STATUS:
                additionalLogInfo = this.processStatus(data)
                break
        }
        this.logcolor('cyan', `onmessage.${data.data.learner}.${data.type}.${data.id}${additionalLogInfo ?? ''}`)
    }
    processMetrics(data) {
        /** calculated incremental stats based for all workers */
        const stats = this.getStat(data.id)
        if (!stats) {
            this.logwarning(`Metric id[${data.id}] not found`)
            return
        }
        stats.update(data.data.duration)
        const csvData = {
            learner: data.data.learner,
            value: data.data.duration,
            n: stats.n,
            min: Math.floor(stats.min),
            max: Math.floor(stats.max),
            mean: Math.floor(stats.mean),
            stdtdev: numeral(stats.standard_deviation).format('0.00'),
            label: data.data.label
        }
        this.csvStreamMetrics.write(data.emitter, data.id, csvData)
        const now = new Date().getTime()
        const mpm = this.metricsPerMinute
        if (mpm.lastUpdate == null) {
            mpm.lastUpdate = now + mpm.period
            mpm.counter = 1
        } else {
            mpm.counter = mpm.counter + 1
            if (now >= mpm.lastUpdate) {
                mpm.stats.update(mpm.counter)
                mpm.counter = 0
                mpm.lastUpdate = now + mpm.period
            }
        }
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
        this.statusTracking.set(data.id, this.statusTracking.get(data.id) + 1)
    }
    static async factory(myConsole) {
        const controller = new this(myConsole)
        await controller.asyncInit()
        return controller
    }
}