'use strict';

const { test } = require('@playwright/test');
const Script1 = require('../src/scripts/Script1');
const ToolsBaseApi = require('../src/tools/ToolsBaseApi');
const myConsole = require('#commons/myConsole');
const {
  getLearnerShortName
} = require(`../config.base`)


/** 
 * npm run playwright.script1 --  --sldxenv=fdalbo --sldxpwuser=user3  
 * npm run playwright.script1 --  --sldxenv=fdalbo --sldxpwuser=user3 --debug
 * npm run playwright.script1 --  --sldxenv=fdalbo --sldxpwuser=user3 --ui
 */
test('RUN SCRIPT1', async ({ page }) => {
  const api = new ToolsBaseApi({
    dryrun: false,
    scriptId: Script1.name.toLowerCase()
  })
  await api.resetTestEnvironment()
  /** https://playwright.dev/docs/test-timeouts */
  test.setTimeout(Script1.scriptTimeout());
  /** learnerName: testperfs.learner.1 */
  const learnerName = `${process.env.SLDX_LEARNER_PREFIX}1`
  const learnerShortName = getLearnerShortName(learnerName)
  const learnerPassword = process.env.SLDX_LEARNER_PWD
  myConsole.superhighlight(`Playwright run test '${Script1.name}' learnername[${learnerName}] learnershortname[${learnerShortName}]  password[${learnerPassword}]`)
  await Script1.factoryRun.apply(Script1, [__filename, page, myConsole, learnerName, learnerShortName, learnerPassword])
});
