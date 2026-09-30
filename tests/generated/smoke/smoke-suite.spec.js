const { test, expect } = require('@playwright/test');
const { createLoginSession } = require('../../../framework/utils/login-session');
const { LoginPage } = require('../../../framework/pages/generated/smoke/LoginPage');
const { TotalConnectHomePage } = require('../../../framework/pages/generated/smoke/TotalConnectHomePage');
const { DevicesPage } = require('../../../framework/pages/generated/smoke/DevicesPage');
const { CamerasPage } = require('../../../framework/pages/generated/smoke/CamerasPage');
const { ActivityPage } = require('../../../framework/pages/generated/smoke/ActivityPage');

// AI Self-Healing: patch page with healing when enabled
const { patchPageWithHealing, healerAgent } = require('../../../framework/ai/fixtures/tc.ai.fixture');
const { loadAIConfig } = require('../../../framework/ai/config/ai.config');
const aiConfig = loadAIConfig();

test.describe('@smoke @tc @tc-plan TC Smoke Suite', () => {
  // Tests continue executing even if one fails — gives full report with all 8 results
  test.describe.configure({ mode: 'default' });

  /** @type {import('@playwright/test').Page} */
  let page;
  /** @type {import('@playwright/test').BrowserContext} */
  let context;
  /** @type {import('@playwright/test').Browser} */
  let browser;

  /** @type {LoginPage} */   let loginPage;
  /** @type {TotalConnectHomePage} */    let homePage;
  /** @type {DevicesPage} */ let devicesPage;
  /** @type {CamerasPage} */ let camerasPage;
  /** @type {ActivityPage} */ let activityPage;

  /** Navigate to /home and wait for content to be ready (Devices button visible). */
  async function ensureOnHomePage() {
    await homePage.navigateToHome();
  }

  test.beforeAll(async () => {
    test.setTimeout(180000);

    // Single function call handles: launch browser → cookie consent → login → wait for home
    // Explicitly use the user-approved monitor account, never silently fall back
    // to the old smoke account (ARIZONA has no cameras/devices and an offline panel).
    const username = process.env.LOGIN_MONITOR_USERNAME;
    const password = process.env.LOGIN_MONITOR_PASSWORD;
    if (!username || !password) {
      throw new Error('Smoke requires LOGIN_MONITOR_USERNAME and LOGIN_MONITOR_PASSWORD for the approved equipment-enabled account.');
    }
    const session = await createLoginSession({ username, password });
    browser = session.browser;
    context = session.context;
    page = session.page;

    // Apply AI self-healing to the page when enabled
    if (healerAgent) {
      patchPageWithHealing(page, { healerAgent, config: aiConfig });
      console.log('[SMOKE-SUITE] AI self-healing is ACTIVE on this page');
    }

    loginPage = new LoginPage(page);
    homePage = new TotalConnectHomePage(page);
    devicesPage = new DevicesPage(page);
    // Observed live-camera inventory for the approved smoke account/location.
    camerasPage = new CamerasPage(page, [
      'BULLET QA 1', 'vx5 reg test QA', 'Dome QA 02', 'Bullet QA 02',
      'vx5 reg test QA 2', 'turret 03', 'BULLET QA 01', 'Front Door',
    ]);
    activityPage = new ActivityPage(page);
    await homePage.dismissTransientPopups();
  });

  test.afterAll(async () => {
    if (browser) await browser.close();
  });

  test('TC-001: Verify home page is loaded after login', async () => {
    await test.step('Verify authenticated home content', async () => {
      await expect.poll(() => new URL(page.url()).pathname).toBe('/home');
      await expect(homePage.devicesNav).toBeVisible();
      await expect(homePage.camerasNav).toBeVisible();
      // Authentication readiness is not the same as panel availability (TC-002).
      await expect(homePage.securityNav).toBeVisible();
      await expect(loginPage.passwordInput).toBeHidden();
    });
  });

  test('TC-002: Arm Home and Disarm partitions', async () => {
    test.setTimeout(300000); // Precondition, arm, and disarm each await panel confirmation.
    await test.step('Navigate back to home page', async () => {
      await ensureOnHomePage();
    });

    await test.step('Ensure all partitions are disarmed before test', async () => {
      await homePage.ensureDisarmed();
    });

    await test.step('Select all partitions', async () => {
      await homePage.selectAllPartitions();
    });

    // Always attempt cleanup after sending an arm command, even when its status
    // assertion fails. Cleanup errors remain failures; no commands are retried.
    try {
      await test.step('Arm Home', async () => {
        await homePage.armHome();
      });

      await test.step('Verify partition shows Armed Home', async () => {
        await homePage.verifyPartitionStatus('Armed Home');
      });
    } finally {
      await test.step('Select all partitions again', async () => {
        await homePage.selectAllPartitions();
      });

      await test.step('Disarm', async () => {
        await homePage.disarm();
      });
    }

    await test.step('Verify partition shows Disarmed', async () => {
      await homePage.verifyPartitionStatus('Disarmed');
    });
  });

  test('TC-003: Navigate to Devices page', async () => {
    await test.step('Navigate back to home page', async () => {
      await ensureOnHomePage();
    });

    await test.step('Navigate to Devices page', async () => {
      await homePage.navigateToDevices();
    });

    await test.step('Verify device categories are visible', async () => {
      await devicesPage.verifyDeviceCategoriesVisible();
    });
  });

  test('TC-004: Navigate to Cameras page', async () => {
    test.setTimeout(90000); // Cameras load async — first visit takes longer
    await test.step('Navigate back to home page', async () => {
      await ensureOnHomePage();
    });

    await test.step('Navigate to Cameras page', async () => {
      await homePage.navigateToCameras();
    });

    await test.step('Verify camera content is visible on the page', async () => {
      await camerasPage.verifyCamerasPageLoaded();
    });
  });

  test('TC-005: Navigate to Activity page and verify log', async () => {
    await test.step('Navigate back to home page', async () => {
      await ensureOnHomePage();
    });

    await test.step('Navigate to Activity page', async () => {
      await homePage.navigateToActivity();
    });

    await test.step('Verify activity log entries are displayed', async () => {
      await activityPage.verifyActivityLogEntries();
    });
  });

  test('TC-006: Verify all cameras are visible on Cameras page', async () => {
    test.setTimeout(90000);
    await test.step('Navigate back to home page', async () => {
      await ensureOnHomePage();
    });

    await test.step('Navigate to Cameras page', async () => {
      await homePage.navigateToCameras();
    });

    await test.step('Verify all cameras are visible and present', async () => {
      const count = await camerasPage.verifyAllCamerasVisible();
      console.log(`[TC-006] Found ${count} camera elements on the page`);
    });
  });

  test('TC-007: Verify camera names are displayed on Cameras page', async () => {
    test.setTimeout(90000);
    await test.step('Navigate to Cameras page', async () => {
      await homePage.navigateToCameras();
    });

    await test.step('Verify each camera has a visible name', async () => {
      const count = await camerasPage.verifyCameraNames();
      console.log(`[TC-007] Found ${count} camera name labels on the page`);
    });
  });

  test('TC-008: Verify camera feed sections load on Cameras page', async () => {
    test.setTimeout(90000);
    await test.step('Navigate to Cameras page', async () => {
      await homePage.navigateToCameras();
    });

    await test.step('Verify camera feeds are loaded and visible', async () => {
      const count = await camerasPage.verifyCameraFeedsLoaded();
      console.log(`[TC-008] Found ${count} camera feed elements on the page`);
    });
  });
});
