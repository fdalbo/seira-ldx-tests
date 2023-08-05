/**
 * THIS IS THE JS FILE CALLED BY ARTILLERY (SEE .YML ABOVE)
 */
module.exports = { testRunScript1, testInitScript1, testVUsers, testWorkers };
const {
  isMainThread,
  BroadcastChannel,
  threadId
} = require('worker_threads');
const Script1 = require('#scripts/Script1')
const myConsole = require('#commons/myConsole')
const ToolsBaseApi = require('#tools/ToolsBaseApi')
const appRootDir = require('app-root-dir')
const _ = require('lodash')
const assert = require('assert')
// eslint-disable-next-line no-unused-vars
const { format: prettyFormat } = require('pretty-format')
const {
  METRIC_CARDS,
  METRIC_QUIZ,
  METRIC_NAV,
  MESSAGE_STATUS,
  MESSAGE_BROADCAST_CHANNEL,
  MESSAGE_METRICS,
  getLearnerShortName
} = require(`${appRootDir.get()}/config.base`)



/** To control the number of scripts per workers (only one) */
const getcpt = (cpt) => {
  const r = parseInt(process.env[cpt])
  process.env[cpt] = `${r + 1}`
  return r
}

if (!process.env.SLDX_CPT_LOAD) {
  process.env.SLDX_CPT_LOAD = '1'
}
myConsole.highlight(`ARTILLERY LOAD TEST.JS [${myConsole.threadId}] [${getcpt('SLDX_CPT_LOAD')}]`)

/** 
 * We've on console per worker or main thread
 * ScriptMonitoring and testInitScript1 log in main thread log file
 * It's artillery that manages the dispatching of the tests' execution into the threads
 */
myConsole.initLoggerFromModule(`artillery.test`)

/**************************************************************************************************
 * RUN 'Script1' with playwright engine
 * !!! testRunScript1 must be called before launching this test (see .yml before\n flow\n  -funcion: initTest\n)
 * --> Initialization of seiradb
 * @param {*} pwPage      playwright Page (browser)
 * @param {*} userContext artillery context 
 **************************************************************************************************/
async function testRunScript1(pwPage, userContext, event) {
  assert(!_.isEmpty(userContext.vars.learnername), 'Unexpected empty userContext.vars.learnername - Check yml file - payload/path/fieldslearnername must provide the learner name')
  /** Set SLDX_LEARNER_NAME with the value given by artillery through the .csv file */
  process.env.SLDX_LEARNER_NAME = userContext.vars.learnername
  process.env.SLDX_LEARNER_SHORTNAME = getLearnerShortName(process.env.SLDX_LEARNER_NAME)
  /** userContext.vars.password not used - same password SLDX_LEARNER_PWD for all leaners */
  if (!process.env.SLDX_CPT_RUN) {
    process.env.SLDX_CPT_RUN = '1'
  }
  // eslint-disable-next-line no-constant-condition
  if (false && process.env.SLDX_LOADED == 'true') {
    /**
     * Currently we can't run multiple scripts in the same worker (the way artillery is working)
     * We need to create as many worker as VUsers (set WORKERS=#VUsers before runing artillery)
     * --> see src/_helpers/env/runner.js
     */
    myConsole.red(`Artillery run script '${Script1.name}' cpt[${getcpt('SLDX_CPT_RUN')}] - ALREADY LOADED - SKIP`)
    return
  }
  process.env.SLDX_LOADED = 'true'
  myConsole.superhighlight(`Artillery run test '${Script1.name}' username[${userContext.vars.learnername}] password[${userContext.vars.password}]`)
  await Script1.factoryRun.apply(Script1, [__filename, pwPage, myConsole])
}

/***************************************************************************************************
 * testInitScript1, 
 * Called once before launching all tests
 * Reset te backend (delete the learning session and all the trackings)
 **************************************************************************************************/
async function testInitScript1(userContext, event, done) {
  const scriptName = Script1.name.toLowerCase()
  myConsole.superhighlight(`Artillery init test '${scriptName}'`)
  /**
   * Init Script si launched by artilery in main thread 
   */
  assert(isMainThread, `Unexpected thread Expected[MAIN] Got[${threadId}]`)
  /**
   * MAIN PROCESS 
   * We can open a listener on the BroadcastChannel to receive the messages from the workers
   * - It's a workaround because we do'nt hace acces to the worker (doen by artillery)
   * - It's needed to control the execution and store our metrics 
   * - Artillery metrics are very poor with playwright because we stay always on the same page (perhaps there's a way to measure chromium httprequests)
   */
  const ScriptMonitoring = require('#scripts/ScriptMonitoring')
  await ScriptMonitoring.factory({
    myConsole: myConsole,
    scriptName: Script1.name.toLowerCase()
  })
  /**
   * Init seira DB
   */
  const api = new ToolsBaseApi({
    dryrun: false,
    scriptId: scriptName
  })
  await api.resetTestEnvironment()
  return done()
}

/***************************************************************************************************
 * VUser tests
 * - !! multiple vusers can be launched by artillery in the same worker (it was not expected)
 * - we've to change the way the script is running in order to be able tp launch multiple scripts in the same worker
 **************************************************************************************************/
async function testVUsers(pwPage, userContext) {
  if (!process.env.SLDX_CPT_RUN) {
    process.env.SLDX_CPT_RUN = '1'
  }
  myConsole.superhighlight(`ARTILLERY RUN testVUsers CPT[${getcpt('SLDX_CPT_RUN')}] username[${userContext.vars.learnername}] password[${userContext.vars.password}]`)

  return new Promise((resolve) => {
    const cpt = getcpt('SLDX_CPT_RUN')
    setTimeout(() => {
      myConsole.highlight(`END ${cpt}`)
      resolve()
    }, 60 * 1000)
  })
}

/***************************************************************************************************
 * testWorkers
 * - Test messaging between main process (main thread) and workers through the broadCastChannel
 **************************************************************************************************/
async function testWorkers() {
  myConsole.superhighlight(`testWrokers ${myConsole.threadId}`)
  if (isMainThread) {
    return
  }
  if (!process.env.SLDX_CPT_RUN) {
    process.env.SLDX_CPT_RUN = '1'
  }
  myConsole.superhighlight(`cpt[${getcpt('SLDX_CPT_RUN')}]`)
  return new Promise((res, rej) => {
    let cpt = 0
    let threadNum = parseInt(threadId)
    /**
     * broadCastChannel used by scripts to send message and by main thread to receive /Process them
     * see ScriptMonitoring and ScriptRunner
     * ScriptMonitoring below create a listener on this channel
     */
    const broadCastChannel = new BroadcastChannel(MESSAGE_BROADCAST_CHANNEL);
    setInterval(async () => {
      myConsole.lowlight(`${myConsole.threadId} broadCastChannel.postMessage`)
      broadCastChannel.postMessage({
        type: MESSAGE_METRICS,
        id: cpt % 2 == 0 ? METRIC_CARDS : cpt % 3 == 0 ? METRIC_QUIZ : METRIC_NAV,
        emitter: myConsole.threadId,
        data: {
          value: 10,
          n: 11,
          min: 12,
          max: 13,
          mean: 14,
          variance: 15,
          label: `label`
        }
      })
      cpt++
      if (cpt > 30) {
        broadCastChannel.postMessage({
          type: MESSAGE_STATUS,
          id: cpt % 2 == 0 ? METRIC_CARDS : cpt % 3 == 0 ? METRIC_QUIZ : METRIC_NAV,
          emitter: myConsole.threadId,
          data: {
            value: 10,
            n: 11,
            min: 12,
            max: 13,
            mean: 14,
            variance: 15,
            label: `label`
          }
        })
        res()
      }
    }, threadNum * 1000)
  })
}

