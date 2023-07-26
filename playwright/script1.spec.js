'use strict';

const { test, expect } = require('@playwright/test');
const ScriptRunner= require('../src/scripts/ScriptRunner')


/** 
 * npm run playwright.script1 --  --sldxenv=fdalbo --sldxpwuser=user3  
 * npm run playwright.script1 --  --sldxenv=fdalbo --sldxpwuser=user3 --debug
 * npm run playwright.script1 --  --sldxenv=fdalbo --sldxpwuser=user3 --ui
 */
test('RUN SCRIPT1', async ({ page }) => {
  /** https://playwright.dev/docs/test-timeouts */
  test.setTimeout(ScriptRunner.scriptTimeout());
  await ScriptRunner.runScript('Script1', __filename, page)
});
