// @ts-check
const { test, expect } = require('@playwright/test');
const { scriptTimeout, runScript } = require('../src/scripts/factory')


/** 
 * npm run playwright.script1 --  --sldxenv=fdalbo --sldxpwuser=user3  
 * npm run playwright.script1 --  --sldxenv=fdalbo --sldxpwuser=user3 --debug
 * npm run playwright.script1 --  --sldxenv=fdalbo --sldxpwuser=user3 --ui
 */
test('RUN SCRIPT1', async ({ page }) => {
  /** https://playwright.dev/docs/test-timeouts */
  test.setTimeout(scriptTimeout());
  await runScript('Script1', __filename, page)
});
