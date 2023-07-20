module.exports = { script1 };
const runScript = require('#scripts/factory')

/**
 * TEST1
 * @param {*} pwPage 
 */
async function script1(pwPage) {
  await  runScript('Script1', __filename, pwPage)
}