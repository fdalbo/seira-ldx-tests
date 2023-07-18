module.exports = { script1 };
const Script1 = require('#scripts/Script1')

/**
 * TEST1
 * @param {*} pwPage 
 */
async function script1(pwPage) {
  await  new Script1(__filename, pwPage).run()
}