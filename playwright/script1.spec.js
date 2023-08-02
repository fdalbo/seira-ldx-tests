'use strict';

const { test } = require('@playwright/test');
const Script1 = require('../src/scripts/Script1');
const ToolsBaseApi = require('../src/tools/ToolsBaseApi');


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
  await Script1.factoryRun(__filename, page)
});
