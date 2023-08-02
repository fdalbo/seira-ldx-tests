module.exports = { script1, testVUsers, initTest };
const Script1 = require('#scripts/Script1')
const myConsole = require('#commons/myConsole')
const ToolsBaseApi = require('#tools/ToolsBaseApi')
const { format: prettyFormat } = require('pretty-format')

myConsole.initLoggerFromModule(__filename)
/**
 * THIS IS THE JS FILE CALLED BY ARTILLERY (SEE .YML ABOVE)
 */

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
 * RUN 'Script1' with playwright engine
 * @param {*} pwPage      playwright Page (browser)
 * @param {*} userContext artillery context 
 */
async function script1(pwPage, userContext, event) {
  if (!process.env.SLDX_CPT_RUN) {
    process.env.SLDX_CPT_RUN = '1'
  }
  myConsole.superhighlight(`ARTILLERY RUN SCRIPT1 THREAD[${myConsole.threadId}] CPT[${getcpt('SLDX_CPT_RUN')}]`)
  if (process.env.SLDX_LOADED == 'true') {
    /**
     * Currently we can't run multiple scripts in the same worker (the way artillery is working)
     */
    myConsole.highlight(`ARTILLERY RUN TEST.JS - ALREADY LOADED - SKIP`)
    return
  }
  process.env.SLDX_LOADED = 'true'
  myConsole.highlight(`ARTILLERY RUN TEST.JS`)
  await Script1.factoryRun(__filename, pwPage)
}
/**
 * VUser tests
 * - !! multiple vusers can be launched by artillery in the same worker (it was not expected)
 * - we've to change the way the script is running in order to be able tp launch multiple scripts in the same worker
 * @param {*} pwPage      playwright Page (browser)
 * @param {*} userContext artillery context 
 */
async function testVUsers() {
  if (!process.env.SLDX_CPT_RUN) {
    process.env.SLDX_CPT_RUN = '1'
  }
  myConsole.superhighlight(`ARTILLERY RUN SCRIPT1 THREAD[${myConsole.threadId}] CPT[${getcpt('SLDX_CPT_RUN')}]`)
}
async function initTest(userContext, event, done) {
  myConsole.superhighlight(`ARTILLERY INIT TESTS`)
  const api = new ToolsBaseApi({
    dryrun: false,
    scriptId: Script1.name.toLowerCase()
  })
  await api.resetTestEnvironment()
  return done()
}