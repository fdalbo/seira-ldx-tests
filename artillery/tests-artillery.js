/**
 * THIS IS THE JS FILE CALLED BY ARTILLERY (SEE .YML ABOVE)
 */
module.exports = { script1, testVUsers, initTest, testWorkers };
const {
  isMainThread,
  BroadcastChannel,
  threadId
} = require('worker_threads')
const Script1 = require('#scripts/Script1')
const myConsole = require('#commons/myConsole')
const { pause } = require('#commons/promises')
const ToolsBaseApi = require('#tools/ToolsBaseApi')
const appRootDir = require('app-root-dir')
const {
  METRIC_CARDS,
  METRIC_QUIZ,
  METRIC_NAV,
  MESSAGE_STATUS,
  MESSAGE_BROADCAST_CHANNEL,
  MESSAGE_METRICS
} = require(`${appRootDir.get()}/config.base`)

myConsole.initLoggerFromModule(__filename)

if (isMainThread) {
  /**
   * Main process 
   * We can open a listener on the BroadcastChannel to receive messages from the workers
   * - It's a workaround because we do'nt hace acces to the worker (doen by artillery)
   * - It's needed to control the execution and store our metrics 
   * - Artillery metrics are very poor with playwright because we stay always on the same page (perhaps there's a way to measure chromium httprequests)
   */
  (async () => {
    const ScriptsController = require('#scripts/ScriptsController')
    myConsole.superhighlight(`mainWorkerThread ${myConsole.threadId}`)
    const scriptsController = await ScriptsController.factory({
      myConsole: myConsole
    })
  })()
}

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

/**************************************************************************************************
 * RUN 'Script1' with playwright engine
 * !!! initTest must be called before (see .yml before\n flow\n  -funcion: initTest\n)
 * @param {*} pwPage      playwright Page (browser)
 * @param {*} userContext artillery context 
 **************************************************************************************************/
async function script1(pwPage, userContext, event) {
  if (!process.env.SLDX_CPT_RUN) {
    process.env.SLDX_CPT_RUN = '1'
  }
  myConsole.superhighlight(`ARTILLERY RUN SCRIPT1 THREAD[${myConsole.threadId}] CPT[${getcpt('SLDX_CPT_RUN')}]`)
  if (process.env.SLDX_LOADED == 'true') {
    /**
     * Currently we can't run multiple scripts in the same worker (the way artillery is working)
     * We need to create as many worker as VUsers (set WORKERS=#VUsers before runing artillery)
     * --> see src/_helpers/env/runner.js
     */
    myConsole.highlight(`ARTILLERY RUN TEST.JS - ALREADY LOADED - SKIP`)
    return
  }
  process.env.SLDX_LOADED = 'true'
  myConsole.highlight(`ARTILLERY RUN TEST.JS`)
  await Script1.factoryRun.apply(Script1, [__filename, pwPage, myConsole])
}

/***************************************************************************************************
 * initTest
 * Called once before launching all tests
 * Reset te backend (delete the learning session and all the trackings)
 **************************************************************************************************/
async function initTest(userContext, event, done) {
  myConsole.superhighlight(`ARTILLERY INIT TESTS`)
  const api = new ToolsBaseApi({
    dryrun: false,
    scriptId: Script1.name.toLowerCase()
  })
  await api.resetTestEnvironment()
  return done()
}

/***************************************************************************************************
 * VUser tests
 * - !! multiple vusers can be launched by artillery in the same worker (it was not expected)
 * - we've to change the way the script is running in order to be able tp launch multiple scripts in the same worker
 **************************************************************************************************/
async function testVUsers() {
  if (!process.env.SLDX_CPT_RUN) {
    process.env.SLDX_CPT_RUN = '1'
  }
  myConsole.superhighlight(`ARTILLERY RUN testVUsers THREAD[${myConsole.threadId}] CPT[${getcpt('SLDX_CPT_RUN')}]`)
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
     * see ScriptsController and ScriptRunner
     * ScriptsController below create a listener on this channel
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

