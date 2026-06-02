const { test, expect } = require('@playwright/test');
const allure = require('allure-js-commons');
const { createTotalConnectFlow } = require('../../framework/flows/totalconnect/TotalConnectFlow');
const {
  attachLoadMetrics,
  assertOptionalLoadThreshold,
  measureNavigation,
} = require('../../framework/utils/pageLoadMetrics');

test.describe('@tc-only @tc-basic Total Connect isolated smoke and performance lane', () => {
  let totalConnectFlow;

  test.beforeEach(async ({ page }) => {
    totalConnectFlow = createTotalConnectFlow({ page, expect });
  });

  test('TC-BASIC-01 - login page and home dashboard load with measurable timings', async ({ page }, testInfo) => {
    await allure.epic('Total Connect');
    await allure.feature('Performance Baseline');
    await allure.story('Login Page and Dashboard Load');
    await allure.severity('critical');
    await allure.tags('tc-only', 'tc-basic', 'performance', 'login', 'dashboard');

    const loginPageMetrics = await measureNavigation(page, async () => {
      await totalConnectFlow.openLoginPage();
      await totalConnectFlow.acceptConsentIfVisible();
    }, {
      label: 'login-page',
      readySelector: '#UsernameInput',
    });

    await attachLoadMetrics(testInfo, 'login-page', loginPageMetrics);
    assertOptionalLoadThreshold(expect, loginPageMetrics);

    await totalConnectFlow.fillConfiguredCredentials();

    const dashboardMetrics = await measureNavigation(page, async () => {
      await totalConnectFlow.submitLogin();
    }, {
      label: 'home-dashboard',
      readySelector: '#body-container-layout',
    });

    await attachLoadMetrics(testInfo, 'home-dashboard', dashboardMetrics);
    assertOptionalLoadThreshold(expect, dashboardMetrics);

    const dashboardSignalVisible =
      await totalConnectFlow.homePage.todaysActivities.isVisible().catch(() => false) ||
      await totalConnectFlow.homePage.locationLabel.isVisible().catch(() => false);

    expect(dashboardSignalVisible).toBeTruthy();
  });

  test('TC-BASIC-02 - devices page basic navigation and load time are captured', async ({ page }, testInfo) => {
    await allure.epic('Total Connect');
    await allure.feature('Devices');
    await allure.story('Devices Navigation Baseline');
    await allure.severity('high');
    await allure.tags('tc-only', 'tc-basic', 'devices', 'performance', 'navigation');

    await totalConnectFlow.loginWithConfiguredUser();

    const devicesMetrics = await measureNavigation(page, async () => {
      await totalConnectFlow.navigateToDevices();
    }, {
      label: 'devices-page',
      readySelector: '#body-container-layout',
    });

    await attachLoadMetrics(testInfo, 'devices-page', devicesMetrics);
    assertOptionalLoadThreshold(expect, devicesMetrics);

    await expect(page.locator('#body-container-layout')).toBeVisible();
  });

  test('TC-BASIC-03 - activity page basic navigation and load time are captured', async ({ page }, testInfo) => {
    await allure.epic('Total Connect');
    await allure.feature('Activity');
    await allure.story('Activity Navigation Baseline');
    await allure.severity('high');
    await allure.tags('tc-only', 'tc-basic', 'activity', 'performance', 'navigation');

    await totalConnectFlow.loginWithConfiguredUser();

    const activityMetrics = await measureNavigation(page, async () => {
      await totalConnectFlow.navigateToActivity();
    }, {
      label: 'activity-page',
      readySelector: '#body-container-layout',
    });

    await attachLoadMetrics(testInfo, 'activity-page', activityMetrics);
    assertOptionalLoadThreshold(expect, activityMetrics);

    await expect(page.locator('#body-container-layout')).toBeVisible();
  });

  test('TC-BASIC-04 - scenes page basic navigation and load time are captured', async ({ page }, testInfo) => {
    await allure.epic('Total Connect');
    await allure.feature('Scenes');
    await allure.story('Scenes Navigation Baseline');
    await allure.severity('medium');
    await allure.tags('tc-only', 'tc-basic', 'scenes', 'performance', 'navigation');

    await totalConnectFlow.loginWithConfiguredUser();

    const scenesMetrics = await measureNavigation(page, async () => {
      await totalConnectFlow.navigateToScenes();
    }, {
      label: 'scenes-page',
      readySelector: '#body-container-layout',
    });

    await attachLoadMetrics(testInfo, 'scenes-page', scenesMetrics);
    assertOptionalLoadThreshold(expect, scenesMetrics);

    await expect(page.locator('#body-container-layout')).toBeVisible();
  });
});