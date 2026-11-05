const base = require('@playwright/test');
const { setTimeout: pace } = require('node:timers/promises');
const { LoginPage } = require('../pages/tc2/LoginPage');
const { securitySettings } = require('../utils/login-security');
const { liveAccess } = require('./live-access');

const test = base.test.extend({
  _liveAccess: [liveAccess, { auto: true }],
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  _securityPacing: [async ({}, use) => {
    const { intervalMs } = securitySettings();
    try {
      await use();
    } finally {
      await pace(intervalMs);
    }
  }, { auto: true }],
});

module.exports = { test, expect: base.expect };