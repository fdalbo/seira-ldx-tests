'use strict';

const appRootDir = require('app-root-dir')
const chalk = require('chalk')
const _ = require('lodash')
const path = require('path')
const { BroadcastChannel } = require('worker_threads')
const Loggable = require('#helpers/Loggable')
const prettyMS = require('pretty-ms')
// eslint-disable-next-line no-unused-vars
const { format: prettyFormat } = require('pretty-format')
const Stats = require('stats-incremental')
const assert = require('assert')
const numeral = require('numeral')
const CSVStream = require('#helpers/CsvStream')

const tableColor = chalk.cyan
const tableTitleolor = chalk.cyanBright
const titleColor = chalk.magentaBright
const highlight = chalk.greenBright
const astable = require('as-table').configure({
    /** delimiter: chalk.cyanBright(' | '), */
    title: x => tableTitleolor(x),
    dash: '',
    delimiter: '  '
})


const {
    initConfig,
    STATUS_ERROR,
    STATUS_BEGIN,
    STATUS_END_KO,
    STATUS_LIST,
    MESSAGE_STATUS,
    MESSAGE_METRICS,
    MESSAGE_BROADCAST_CHANNEL,
    METRICS
} = require(`${appRootDir.get()}/config.base`);

const PRETTY_MS_OPTS = {
    secondsDecimalDigits: 0,
    separateMilliseconds: false
}
const _statusColor = (status, value) => {
    if (status == STATUS_END_KO || status == STATUS_ERROR) return chalk.redBright(value)
    return chalk.greenBright(value)
}

const _clickResponseColor = {
    fast: chalk.blue,
    ok: chalk.green,
    warning: chalk.yellow,
    danger: chalk.red
}
module.exports = class ScriptMonitoring extends Loggable {
    #broadCastChannel = null
    #csvStreamMetrics = null
    #csvStreamSatus = null
    metrics = null
    metricsPerTimeSlot = null
    statusTracking = new Map()
    scriptConfig = null
    scriptName = null
    startUpdate = null
    lastUpdate = null
    lastMessage = null
    forceUpdate = false
    startTime = null
    constructor(opts) {
        super(opts)
        this.scriptName = opts.scriptName
        assert(!_.isEmpty(this.scriptName, 'unexpected empty scriptName'))
        /**
         * broadCastChannel is used by scripts to send message and by main thread to receive /Process them
         * see ScriptMonitoring and ScriptRunner
         */
        this.#broadCastChannel = new BroadcastChannel(MESSAGE_BROADCAST_CHANNEL)
        this.broadCastChannel.onmessage = this.onmessage.bind(this)
    }
    /** overriden */
    async asyncInit() {
        this.startTime = new Date().getTime()
        this.scriptConfig = initConfig(this.scriptName)
        this.#csvStreamSatus = new CSVStream({
            headers: true,
            override: true,
            filePath: path.resolve(process.env.SLDX_METRICS_DIR_PATH, `${this.threadId}-status.csv`),
            writeProperties: ['learner', 'message', 'duration']
        })
        /** Metrics */
        if (process.env.SLDX_METRICS_ENABLED == 'true') {
            this.#csvStreamMetrics = new CSVStream({
                headers: true,
                override: true,
                filePath: path.resolve(process.env.SLDX_METRICS_DIR_PATH, `${this.threadId}-metrics.csv`),
                writeProperties: ['learner', 'value', 'n', 'min', 'max', 'mean', 'stddev', 'label']
            })
            this.metrics = {
                lastUpdate: null,
                stats: {},
                counters: {}
            }
            /** Init incremental stat calculator per metric */
            for (const metricId of METRICS) {
                this.metrics.stats[metricId] = Stats()
                this.metrics.counters[metricId] = {
                    fast: 0,
                    ok: 0,
                    warning: 0,
                    danger: 0
                }
            }
            this.metricsPerTimeSlot = {
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
        STATUS_LIST.forEach(status => this.statusTracking.set(status, {
            counter: 0,
            times: []
        }))
        const updatePeriod = this.scriptConfig.misc.refreshMonitoringPeriod
        this.loghighlight(`refreshMonitoringPeriod[${updatePeriod}]`)
        assert(_.isInteger(updatePeriod), `config.misc.refreshMonitoringPeriod[${updatePeriod}] not numeric`)
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
    getCounters(id) {
        return this.metrics.counters[id]
    }
    metricsData(stats, counters) {
        const color = (value) => {
            value = Math.floor(value)
            if (value < this.scriptConfig.misc.clickResponseTimeOk) {
                return _clickResponseColor.fast(value)
            } else if (value < this.scriptConfig.misc.clickResponseTimeWarning) {
                return _clickResponseColor.ok(value)
            } else if (value < this.scriptConfig.misc.clickResponseTimeDanger) {
                return _clickResponseColor.warning(value)
            } else {
                return _clickResponseColor.danger(value)
            }
        }
        return {
            n: stats.n,
            min: stats.n == 0 ? '' : color(stats.min),
            max: stats.n == 0 ? '' : color(stats.max),
            mean: stats.n == 0 ? '' : color(stats.mean),
            fast: _clickResponseColor.fast(counters.fast),
            ok: _clickResponseColor.ok(counters.ok),
            warn: _clickResponseColor.warning(counters.warning),
            danger: _clickResponseColor.danger(counters.danger)
        }
    }
    updatePanel() {
        if (this.lastMessage == null) {
            return
        }
        if (this.forceUpdate != true && this.lastUpdate != null && this.lastMessage < this.lastUpdate) {
            /** update only if new messages */
            return
        }
        const now = new Date().getTime()
        this.lastUpdate = now
        this.forceUpdate = false
        const elapsed = now - this.startUpdate
        const artilleryCfg = JSON.parse(process.env.SLDX_ARTILLERY_JSON_CFG)
        console.log(chalk.yellowBright('\n\n-----------------------------------------------------------------------------------'))
        console.log(chalk.yellowBright(`SCRIPT ${this.scriptName.toUpperCase()} running for ${chalk.greenBright(prettyMS(elapsed, PRETTY_MS_OPTS))}`))
        console.log(chalk.yellowBright('-----------------------------------------------------------------------------------'))
        console.log(chalk.grey(`env[${process.env.SLDX_ENV}] config[${path.basename(this.scriptConfig.fileName)}]`))
        console.log(titleColor(`Artillery config:`))
        console.log(tableColor(astable([{
            duration: artilleryCfg.duration ?? 'empty',
            arrivalCount: artilleryCfg.arrivalCount ?? 'empty',
            arrivalRate: artilleryCfg.arrivalRate ?? 'empty',
            config: path.basename(process.env.SLDX_RUNNER_SCRIPT_NAME)
        }])))
        const statusData = {}
        const it = this.statusTracking.entries()
        let result = it.next();
        while (!result.done) {
            const id = result.value[0]
            const data = result.value[1]
            statusData[id] = _statusColor(id, data.counter)
            if (data.times.length > 0) {
                let sum = 0
                if (id === STATUS_BEGIN) {
                    /** sum of the time diff with previous time */
                    data.times.forEach((time, idx) => {
                        sum = sum + (idx === 0 ? time : time - data.times[idx - 1])
                    })
                } else {
                    /** sum of the durations */
                    sum = data.times.reduce((sum, x) => x + sum, 0)
                }
                statusData[`${id}Time`] = prettyMS(sum / data.times.length, PRETTY_MS_OPTS)
            }
            result = it.next()
        }
        console.log(titleColor(`Tests/Chromiums instances status (see arrivalCount above):`))
        console.log(tableColor(astable([statusData])))
        const metricsTable = []
        let totalStats = 0
        for (const metricId of METRICS) {
            const stat = this.getStat(metricId)
            const counters = this.getCounters(metricId)
            metricsTable.push({
                id: metricId,
                ...this.metricsData(stat, counters)
            })
            totalStats = totalStats + stat.n
        }
        console.log(titleColor(`Clicks:`))
        console.log(tableColor(astable([{
            total: highlight(totalStats),
            averagePerSec: Math.floor((totalStats * 100) / (elapsed / 1000)) / 100
        }])))
        if (this.metricsPerTimeSlot.stats.n > 0) {
            console.log(titleColor(`Clicks per time slot:`))
            console.log(tableColor(astable([{
                slotPeriod: `${Math.floor(this.metricsPerTimeSlot.period / 1000)}sec`,
                nbOccurences: this.metricsPerTimeSlot.stats.n,
                maxNbClicks: highlight(Math.floor(this.metricsPerTimeSlot.stats.max)),
                mean: Math.floor(this.metricsPerTimeSlot.stats.mean)
            }])))
        }
        console.log(titleColor(`Metrics:`))
        console.log(tableColor(astable(metricsTable)))
        console.log()
    }
    onmessage(eventData) {
        this.lastMessage = new Date().getTime()
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
                this.forceUpdate = true
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
        const counters = this.getCounters(data.id)
        if (data.data.duration < this.scriptConfig.misc.clickResponseTimeOk) {
            counters.fast = counters.fast + 1
        } else if (data.data.duration < this.scriptConfig.misc.clickResponseTimeWarning) {
            counters.ok = counters.ok + 1
        } else if (data.data.duration < this.scriptConfig.misc.clickResponseTimeDanger) {
            counters.warning = counters.warning + 1
        } else {
            counters.danger = counters.danger + 1
        }
        const csvData = {
            learner: data.data.learner,
            value: data.data.duration,
            n: stats.n,
            min: Math.floor(stats.min),
            max: Math.floor(stats.max),
            mean: Math.floor(stats.mean),
            stddev: numeral(stats.standard_deviation).format('0.0'),
            label: data.data.label
        }
        this.csvStreamMetrics.write(data.emitter, data.id, csvData)
        const now = new Date().getTime()
        const mpm = this.metricsPerTimeSlot
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
        const now = new Date().getTime()
        data.data.message ??= ''
        data.data.duration ??= ''
        this.#csvStreamSatus.write(data.emitter, data.id, data.data)
        const status = this.statusTracking.get(data.id)
        status.counter = status.counter + 1
        if (data.id === STATUS_BEGIN) {
            status.times.push(now - this.startTime)
        } else if (data.data.duration) {
            status.times.push(data.data.duration)
        }
        this.statusTracking.set(data.id, status)
    }
    static async factory(myConsole) {
        const controller = new this(myConsole)
        await controller.asyncInit()
        return controller
    }
}