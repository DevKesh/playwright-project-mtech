const base = require('./tc.fixture');
const { LoginPage } = require('../pages/generated/smoke/LoginPage');
const { TotalConnectHomePage } = require('../pages/generated/smoke/TotalConnectHomePage');
const { DevicesPage } = require('../pages/generated/smoke/DevicesPage');
const { CamerasPage } = require('../pages/generated/smoke/CamerasPage');
const { ActivityPage } = require('../pages/generated/smoke/ActivityPage');
const { patchPageWithHealing, healerAgent } = require('../ai/fixtures/tc.ai.fixture');
const { loadAIConfig } = require('../ai/config/ai.config');

const test = base.test.extend({
  authenticatedPage: async ({ authenticatedPage }, use) => {
    if (healerAgent) {
      patchPageWithHealing(authenticatedPage, { healerAgent, config: loadAIConfig() });
    }
    await use(authenticatedPage);
  },
  loginPage: async ({ authenticatedPage }, use) => {
    await use(new LoginPage(authenticatedPage));
  },
  homePage: async ({ authenticatedPage }, use) => {
    const homePage = new TotalConnectHomePage(authenticatedPage);
    await homePage.dismissTransientPopups();
    await use(homePage);
  },
  devicesPage: async ({ authenticatedPage }, use) => {
    await use(new DevicesPage(authenticatedPage));
  },
  camerasPage: async ({ authenticatedPage }, use, testInfo) => {
    const camerasPage = new CamerasPage(authenticatedPage, { dynamicInventory: true });
    try {
      await use(camerasPage);
    } finally {
      try {
        const state = await camerasPage.captureLiveState();
        await testInfo.attach('camera-live-state', {
          body: JSON.stringify(state, null, 2),
          contentType: 'application/json',
        });
        if (state.available) {
          const screenshot = await camerasPage.liveCameras.screenshot({
            timeout: 3000,
            animations: 'disabled',
            style: 'input, textarea, [contenteditable] { visibility: hidden !important; }',
          });
          await testInfo.attach('camera-live-section', { body: screenshot, contentType: 'image/png' });
        }
      } catch {
        testInfo.annotations.push({ type: 'camera-capture', description: 'Camera evidence capture was incomplete; the original test result is unchanged.' });
      }
    }
  },
  activityPage: async ({ authenticatedPage }, use) => {
    await use(new ActivityPage(authenticatedPage));
  },
});

module.exports = { test, expect: base.expect };