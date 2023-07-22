module.exports = { script1, testVUsers };
const { runScript } = require('#scripts/factory')
const myConsole = require('#commons/myConsole')

const getcpt = (cpt)=>{
  const r = parseInt(process.env[cpt])
  process.env[cpt] = `${r+1}`
  return r
}
if (!process.env.SLDX_CPT_LOAD){
  process.env.SLDX_CPT_LOAD = '1'
}
myConsole.highlight(`ARTILLERY LOAD TEST.JS [${myConsole.threadId}] [${getcpt('SLDX_CPT_LOAD')}]`)

/**
 * TEST1
 * @param {*} pwPage 
 */
async function script1(pwPage) {
  if (!process.env.SLDX_CPT_RUN){
    process.env.SLDX_CPT_RUN = '1'
  }
  myConsole.warning(`ARTILLERY RUN SCRIPT1 THREAD[${myConsole.threadId}] CPT[${getcpt('SLDX_CPT_RUN')}]`)
  return
  if (process.env.SLDX_LOADED == 'true'){
    myConsole.highlight(`ARTILLERY RUN TEST.JS - ALREADY LOADED - SKIP`)
    return
  }
  process.env.SLDX_LOADED = 'true'
  myConsole.highlight(`ARTILLERY RUN TEST.JS`)
  await runScript('Script1', __filename, pwPage)
}
/**
 * TEST1
 * @param {*} pwPage 
 */
async function testVUsers(pwPage) {
  if (!process.env.SLDX_CPT_RUN){
    process.env.SLDX_CPT_RUN = '1'
  }
  myConsole.warning(`ARTILLERY RUN SCRIPT1 THREAD[${myConsole.threadId}] CPT[${getcpt('SLDX_CPT_RUN')}]`)
}