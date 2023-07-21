module.exports = { script1 };
const { runScript } = require('#scripts/factory')
const myConsole = require('#commons/myConsole')

myConsole.highlight(`ARTILLERY LOAD TEST.JS]`)

/**
 * TEST1
 * @param {*} pwPage 
 */
async function script1(pwPage) {
  if (process.env.SLDX_LOADED == 'true'){
    myConsole.highlight(`ARTILLERY RUN TEST.JS - ALREADY LOADED - SKIP`)
    return
  }
  process.env.SLDX_LOADED = 'true'
  myConsole.highlight(`ARTILLERY RUN TEST.JS`)
  await runScript('Script1', __filename, pwPage)
}