'use strict';

const { test } = require('@playwright/test');
const Script1 = require('../src/scripts/Script1');

/** 
 * npm run playwright.script1 --  --sldxenv=fdalbo --sldxpwuser=user3  
 * npm run playwright.script1 --  --sldxenv=fdalbo --sldxpwuser=user3 --debug
 * npm run playwright.script1 --  --sldxenv=fdalbo --sldxpwuser=user3 --ui
 */
test('RUN SCRIPT1', async ({ page }) => {
  /** https://playwright.dev/docs/test-timeouts */
  test.setTimeout(Script1.scriptTimeout());
  await Script1.runScript(__filename, page)
});
