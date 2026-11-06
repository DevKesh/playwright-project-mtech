const base = require('./tc.fixture');
const { LoginPage } = require('../pages/tc2/LoginPage');
const { TotalConnectHomePage } = require('../pages/tc2/TotalConnectHomePage');
const { DevicesPage } = require('../pages/tc2/DevicesPage');
const { CamerasPage } = require('../pages/tc2/CamerasPage');
const { ActivityPage } = require('../pages/tc2/ActivityPage');
const { startNetworkEvidence } = require('../utils/network-evidence');

const test = base.test.extend({
  authenticatedPage: async ({ authenticatedPage }, use, testInfo) => {
    if (!testInfo?.project?.metadata?.offline && process.env.CI !== 'true' && process.env.AI_HEALING_ENABLED === 'true' && !testInfo?.tags?.includes('@panel')) {
      const { createHealer, patchPageWithHealing } = require('../ai/fixtures/tc.ai.fixture');
      const healing = createHealer();
      if (healing) patchPageWithHealing(authenticatedPage, healing);
    }
    const attachNetwork = testInfo?.tags?.includes('@smoke') ? startNetworkEvidence(authenticatedPage) : null;
    try {
      await use(authenticatedPage);
    } finally {
      try {
        await attachNetwork?.(testInfo);
      } catch {
        testInfo.annotations.push({ type: 'network-capture', description: 'Network evidence capture was incomplete; the original test result is unchanged.' });
      }
    }
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
        if (state.available && testInfo.status !== testInfo.expectedStatus) {
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