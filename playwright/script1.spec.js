'use strict';

const { test } = require('@playwright/test');
const Script1 = require('../src/scripts/Script1');
const ToolsBaseApi = require('../src/tools/ToolsBaseApi');
const myConsole = require('#commons/myConsole');


/** 
 * npm run playwright.script1 --  --sldxenv=fdalbo --sldxpwuser=user3  
 * npm run playwright.script1 --  --sldxenv=fdalbo --sldxpwuser=user3 --debug
 * npm run playwright.script1 --  --sldxenv=fdalbo --sldxpwuser=user3 --ui
 */
test('RUN SCRIPT1', async ({ pwPage }) => {
  const api = new ToolsBaseApi({
    dryrun: false,
    scriptId: Script1.name.toLowerCase()
  })
  await api.resetTestEnvironment()
  /** https://playwright.dev/docs/test-timeouts */
  test.setTimeout(Script1.scriptTimeout());
  await Script1.factoryRun(__filename, pwPage)
  await Script1.factoryRun.apply(Script1, [__filename, pwPage, myConsole])
});
