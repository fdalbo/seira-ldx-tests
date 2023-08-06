/**
 * THIS IS THE JS FILE CALLED BY ARTILLERY (SEE .YML ABOVE)
 */
module.exports = { testRunScript1, testInitScript1, testVUsers };
const {
  isMainThread,
  threadId
} = require('worker_threads');
const Script1 = require('#scripts/Script1')
const myConsole = require('#commons/myConsole')
const ToolsBaseApi = require('#tools/ToolsBaseApi')
const appRootDir = require('app-root-dir')
const _ = require('lodash')
const chalk = require('chalk')
const path = require('path')
const assert = require('assert')
// eslint-disable-next-line no-unused-vars
const { format: prettyFormat } = require('pretty-format')
const {
  getLearnerShortName
} = require(`${appRootDir.get()}/config.base`)

let _learnerCounter = (() => {
  const wasConsoleEnabled = process.env.SLDX_CONSOLE_TRACE === 'true'
  try {
    /* force console for init phase **/
    myConsole.enableConsole(true)
    /** 
     * We've a console per worker or main thread
     * 'ScriptMonitoring' and 'testInitScript1' log in main thread log file
     * It's artillery that manages the dispatching of the tests execution into the threads
     */
    myConsole.initLoggerFromModule(`artillery.test`)
    if (isMainThread) {
      return
    }
    /**
     * learnerCounter is used to calculate the learnerName per test/thread
     * -> testperfs.learner.${learnerCounter}
     * We need to have a unic learnerName whatever the thread/worker
     * Script is expected to run in a worker starting from threadid=1
     * We expect that the users have been created before running the test
     * If we use 'arrivalCount' (advised) to manage the ramp-up, Artillery will run all the tests in the same thread (worker 1)
     * - We don't have learnerNames' conflicts
     * If we use 'arrivalRate' (number of tests/vusers created per second) to manage the rampup, Artillery can potentially run the tests in multiple threads
     * - We can have learnerNames' conflicts and it's why we need to calculate a unic learnerName
     */
    const threadOffset = (() => {
      const offset = process.env.SLDX_ARTILLERY_WORKER_OFFSET
      const result = parseInt(offset)
      assert(_.isInteger(result), `Thread[${threadId}] - Unexpected non-integer offset[${offset}] (check SLDX_ARTILLERY_WORKER_OFFSET)`)
      assert(result > 100, `Thread[${threadId}] - Unexpected < 100 SLDX_ARTILLERY_WORKER_OFFSET`)
      return result
    })()
    const threadNumericId = parseInt(threadId)
    assert(_.isInteger(threadNumericId), `Thread[${threadId}] - Unexpected non-integer threadId[${threadId}]`)
    /*
     * learnerCounter MUST BE UNIC PAR THREAD AND SCRIPT
     * For SLDX_ARTILLERY_WORKER_OFFSET = 500
     * Worker thread N°1 with offset 500 tesperfs.learner.1, 2,... (threadid-1)*SLDX_ARTILLERY_WORKER_OFFSET
     * Worker thread N°2 with offset 500 tesperfs.learner.501, 502,...
     */
    const learnerCounter = threadOffset * (threadNumericId - 1)
    myConsole.superhighlight(`Load ${path.basename(__filename)} threadId[${threadId}] threadOffset[${threadOffset}] learnerCounter[${learnerCounter}]`)
    return learnerCounter
  } finally {
    myConsole.enableConsole(wasConsoleEnabled)
  }
})()

const _calculateLearnerInfo = () => {
  _learnerCounter += 1
  const learnerName = `${process.env.SLDX_LEARNER_PREFIX}${_learnerCounter}`
  const learnerShortName = getLearnerShortName(learnerName)
  const learnerPassword = process.env.SLDX_LEARNER_PWD
  myConsole.highlight(`learnername[${learnerName}] learnershortname[${learnerShortName}] password[${learnerPassword}]`)
  return { learnerName, learnerShortName, learnerPassword }
}

/**************************************************************************************************
 * RUN 'Script1' with playwright engine
 * !!! testRunScript1 must be called before launching this test (see .yml before\n flow\n  -funcion: initTest\n)
 * --> Initialization of seiradb
 * @param {*} pwPage      playwright Page (browser)
 * @param {*} userContext artillery context 
 **************************************************************************************************/
async function testRunScript1(pwPage, userContext, event) {
  assert(!isMainThread, 'artillery is not supposed to lanch a script in the main thread')
  /**
   * If we use a .csv file (payload.path) in yml file, the user name is provided by artillery (userContext.vars.learnername)
   * The problem is that artillery read the .csv file from the beginning for each thread/worker
   * -> We can use this feature as we need a unic learnerName per thread
   */
  myConsole.superhighlight(`Artillery run test '${Script1.name}`)
  const { learnerName, learnerShortName, learnerPassword } = _calculateLearnerInfo()
  await Script1.factoryRun.apply(Script1, [__filename, pwPage, myConsole, learnerName, learnerShortName, learnerPassword])
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
   * Init Script si expected to be launched by artilery in main thread 
   */
  assert(isMainThread, `Unexpected thread Expected[MAIN] Got[${threadId}]`)
  /**
   * MAIN PROCESS 
   * We can open a listener on the BroadcastChannel to receive the messages (metrics) sent by the workers
   * - It's a workaround because we don't have access to the worker (created by artillery) in order to open a channel
   * - BroadcastChannel is needed to monitor (ScriptMonitoring) the execution and store/display the metrics 
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
  /** now we're ready to launch the tests */
  return done()
}

/***************************************************************************************************
 * VUser tests
 * - test-vusers-mainthread.yml: srcipt expected to run in the workers 1 (W0001)
 *   - learner name: testperfs.learner.1, 2, 3
 * - test-vusers-workers.yml   : srcipt expected to run in multiple workers
 **************************************************************************************************/
async function testVUsers(pwPage, userContext) {
  assert(!isMainThread, 'artillery is not supposed to lanch a script in the main thread')
  myConsole.enableConsole(true)
  const { learnerName, learnerShortName } = _calculateLearnerInfo()
  myConsole.superhighlight(`Artillery run testVUsers ${chalk.green(`learnerName[${learnerName}] _learnerCounter[${_learnerCounter}]`)}`)
  await new Promise((resolve) => {
    setTimeout(() => {
      /** _learnerCounter should display the value of the last worker launched by artillery */
      myConsole.highlight(`END learnerName[${learnerName}] learnerShortName[${learnerShortName}] _learnerCounter[${_learnerCounter}]`)
      resolve()
    }, 10 * 1000)
  })
}