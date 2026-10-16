const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('@playwright/test');
const { LoginPage } = require('../pages/generated/smoke/LoginPage');

const ALARMNET_LOGIN_URL = 'https://services.qa.alarmnet.com/AlarmNet360/AlarmNetDirectV/Login/Login/SignIn?lang=en-US';
const STORAGE_STATE_PATH = path.resolve(__dirname, '../../test-results/alarmnet-storage-state.json');

module.exports = async function globalSetup() {
  fs.mkdirSync(path.dirname(STORAGE_STATE_PATH), { recursive: true });

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: process.env.CI === 'true' || process.env.HEADLESS === 'true',
  });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(ALARMNET_LOGIN_URL, { waitUntil: 'domcontentloaded' });

    const login = new LoginPage(page);
    await login.dismissCookieConsent();
    await context.storageState({ path: STORAGE_STATE_PATH });
    await context.close();
  } finally {
    await browser.close();
  }
};