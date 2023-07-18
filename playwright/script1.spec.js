// @ts-check
const { test, expect } = require('@playwright/test');
const Script1 = require('../src/scripts/Script1')

/** npm run playwright.script1 --  --sldxenv=fdalbo --sldxpwuser=user3  */
test('RUN SCRIPT 1', async ({ page }) => {
  await new Script1(__filename, page).run()
});
