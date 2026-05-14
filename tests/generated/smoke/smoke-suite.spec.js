const { test, expect, chromium } = require('@playwright/test');
const { testDataConfig } = require('../../../framework/config/test-data.config');
const { LoginPage } = require('../../../framework/pages/generated/smoke/LoginPage');
const { HomePage } = require('../../../framework/pages/generated/smoke/HomePage');
const { DevicesPage } = require('../../../framework/pages/generated/smoke/DevicesPage');
const { CamerasPage } = require('../../../framework/pages/generated/smoke/CamerasPage');
const { ActivityPage } = require('../../../framework/pages/generated/smoke/ActivityPage');

// AI Self-Healing: patch page with healing when enabled
const { patchPageWithHealing, healerAgent } = require('../../../framework/ai/fixtures/tc.ai.fixture');
const { loadAIConfig } = require('../../../framework/ai/config/ai.config');
const aiConfig = loadAIConfig();

test.describe('@smoke @tc @tc-plan TC Smoke Suite', () => {
  // Run tests sequentially (workers:1 in config) but don't skip remaining on failure
  test.describe.configure({ mode: 'default' });

  /** @type {import('@playwright/test').Page} */
  let page;
  /** @type {import('@playwright/test').BrowserContext} */
  let context;
  /** @type {import('@playwright/test').Browser} */
  let browser;

  /** @type {LoginPage} */   let loginPage;
  /** @type {HomePage} */    let homePage;
  /** @type {DevicesPage} */ let devicesPage;
  /** @type {CamerasPage} */ let camerasPage;
  /** @type {ActivityPage} */ let activityPage;

  test.beforeAll(async () => {
    browser = await chromium.launch({ headless: false });
    context = await browser.newContext();
    page = await context.newPage();

    // Apply AI self-healing to the page when enabled
    if (healerAgent) {
      patchPageWithHealing(page, { healerAgent, config: aiConfig });
      console.log('[SMOKE-SUITE] AI self-healing is ACTIVE on this page');
    }

    loginPage = new LoginPage(page);
    homePage = new HomePage(page);
    devicesPage = new DevicesPage(page);
    camerasPage = new CamerasPage(page);
    activityPage = new ActivityPage(page);

    // Login once for the entire suite
    await page.goto(testDataConfig.targetApp.loginUrl);
    await loginPage.dismissCookieConsent();
    await loginPage.login(
      testDataConfig.targetApp.credentials.email,
      testDataConfig.targetApp.credentials.password
    );
    await page.waitForURL('**/home', { timeout: 30000 });
    await homePage.dismissCookiePopup();
    await homePage.closeDonePopup();
  });

  test.afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('TC-001: Verify home page is loaded after login', async () => {
    await test.step('Verify URL contains /home', async () => {
      await expect(page).toHaveURL(/.*\/home/);
    });
  });

  test('TC-002: Arm Home and Disarm partitions', async () => {
    test.setTimeout(180000);

    await test.step('Navigate back to home page', async () => {
      if (!page.url().includes('/home')) {
        await page.goto(testDataConfig.targetApp.loginUrl.replace('/login', '/home'));
        await page.waitForURL('**/home', { timeout: 15000 });
      }
    });

    await test.step('Ensure all partitions are disarmed before test', async () => {
      await homePage.ensureDisarmed();
    });

    await test.step('Select all partitions', async () => {
      await homePage.selectAllPartitions();
    });

    await test.step('Arm Home', async () => {
      await homePage.armHome();
    });

    await test.step('Verify partition shows Armed Home', async () => {
      await homePage.verifyPartitionStatus('Armed Home');
    });

    await test.step('Select all partitions again', async () => {
      await homePage.selectAllPartitions();
    });

    await test.step('Disarm', async () => {
      await homePage.disarm();
    });

    await test.step('Verify partition shows Disarmed', async () => {
      await homePage.verifyPartitionStatus('Disarmed');
    });
  });

  test('TC-003: Navigate to Devices page', async () => {
    await test.step('Navigate back to home page', async () => {
      if (!page.url().includes('/home')) {
        await page.goto(testDataConfig.targetApp.loginUrl.replace('/login', '/home'));
        await page.waitForURL('**/home', { timeout: 15000 });
      }
    });

    await test.step('Navigate to Devices page', async () => {
      await homePage.navigateToDevices();
    });

    await test.step('Verify URL contains /automation', async () => {
      await expect(page).toHaveURL(/.*\/automation/);
    });

    await test.step('Verify device categories are visible', async () => {
      await devicesPage.verifyDeviceCategoriesVisible();
    });
  });

  test('TC-004: Navigate to Cameras page', async () => {
    await test.step('Navigate back to home page', async () => {
      if (!page.url().includes('/home')) {
        await page.goto(testDataConfig.targetApp.loginUrl.replace('/login', '/home'));
        await page.waitForURL('**/home', { timeout: 15000 });
      }
    });

    await test.step('Navigate to Cameras page', async () => {
      await homePage.navigateToCameras();
    });

    await test.step('Verify URL contains /cameras', async () => {
      await expect(page).toHaveURL(/.*\/cameras/);
    });

    await test.step('Verify camera content is visible on the page', async () => {
      await camerasPage.verifyCamerasPageLoaded();
    });
  });

  test('TC-005: Navigate to Activity page and verify log', async () => {
    await test.step('Navigate back to home page', async () => {
      if (!page.url().includes('/home')) {
        await page.goto(testDataConfig.targetApp.loginUrl.replace('/login', '/home'));
        await page.waitForURL('**/home', { timeout: 15000 });
      }
    });

    await test.step('Navigate to Activity page', async () => {
      await homePage.navigateToActivity();
    });

    await test.step('Verify URL contains /events', async () => {
      await expect(page).toHaveURL(/.*\/events/);
    });

    await test.step('Verify activity log entries are displayed', async () => {
      await activityPage.verifyActivityLogEntries();
    });
  });

  test('TC-006: Verify all cameras are visible on Cameras page', async () => {
    await test.step('Navigate back to home page', async () => {
      if (!page.url().includes('/home')) {
        await page.goto(testDataConfig.targetApp.loginUrl.replace('/login', '/home'));
        await page.waitForURL('**/home', { timeout: 15000 });
      }
    });

    await test.step('Navigate to Cameras page', async () => {
      await homePage.navigateToCameras();
    });

    await test.step('Verify URL contains /cameras', async () => {
      await expect(page).toHaveURL(/.*\/cameras/);
    });

    await test.step('Verify all cameras are visible and present', async () => {
      const count = await camerasPage.verifyAllCamerasVisible();
      console.log(`[TC-006] Found ${count} camera elements on the page`);
    });
  });

  test('TC-007: Verify camera names are displayed on Cameras page', async () => {
    await test.step('Navigate back to home page', async () => {
      if (!page.url().includes('/home')) {
        await page.goto(testDataConfig.targetApp.loginUrl.replace('/login', '/home'));
        await page.waitForURL('**/home', { timeout: 15000 });
      }
    });

    await test.step('Navigate to Cameras page', async () => {
      await homePage.navigateToCameras();
    });

    await test.step('Verify URL contains /cameras', async () => {
      await expect(page).toHaveURL(/.*\/cameras/);
    });

    await test.step('Verify each camera has a visible name', async () => {
      const count = await camerasPage.verifyCameraNames();
      console.log(`[TC-007] Found ${count} camera name labels on the page`);
    });
  });

  test('TC-008: Verify camera feed sections load on Cameras page', async () => {
    await test.step('Navigate back to home page', async () => {
      if (!page.url().includes('/home')) {
        await page.goto(testDataConfig.targetApp.loginUrl.replace('/login', '/home'));
        await page.waitForURL('**/home', { timeout: 15000 });
      }
    });

    await test.step('Navigate to Cameras page', async () => {
      await homePage.navigateToCameras();
    });

    await test.step('Verify URL contains /cameras', async () => {
      await expect(page).toHaveURL(/.*\/cameras/);
    });

    await test.step('Verify camera feeds are loaded and visible', async () => {
      const count = await camerasPage.verifyCameraFeedsLoaded();
      console.log(`[TC-008] Found ${count} camera feed elements on the page`);
    });
  });
});
