const { test, expect } = require('@playwright/test');
const allure = require('allure-js-commons');
const { createTotalConnectFlow } = require('../../framework/flows/totalconnect/TotalConnectFlow');
const {
  attachLoadMetrics,
  assertOptionalLoadThreshold,
  measureNavigation,
} = require('../../framework/utils/pageLoadMetrics');

test.describe('@tc-only @tc-perf Full page load timing sweep across Total Connect', () => {
  let tc;

  test.beforeEach(async ({ page }) => {
    tc = createTotalConnectFlow({ page, expect });
  });

  test('TC-PERF-01 - login page and dashboard load timings', async ({ page }, testInfo) => {
    await allure.epic('Total Connect');
    await allure.feature('Performance');
    await allure.story('Login and Dashboard Load');
    await allure.severity('critical');
    await allure.tags('tc-only', 'tc-perf', 'login', 'dashboard');

    const loginMetrics = await measureNavigation(page, async () => {
      await tc.openLoginPage();
      await tc.acceptConsentIfVisible();
    }, { label: 'login-page', readySelector: '#UsernameInput' });

    await attachLoadMetrics(testInfo, 'login-page', loginMetrics);
    assertOptionalLoadThreshold(expect, loginMetrics);

    await tc.fillConfiguredCredentials();

    const dashboardMetrics = await measureNavigation(page, async () => {
      await tc.submitLogin();
    }, { label: 'home-dashboard', readySelector: '#body-container-layout' });

    await attachLoadMetrics(testInfo, 'home-dashboard', dashboardMetrics);
    assertOptionalLoadThreshold(expect, dashboardMetrics);
  });

  test('TC-PERF-02 - security page load timing', async ({ page }, testInfo) => {
    await allure.epic('Total Connect');
    await allure.feature('Performance');
    await allure.story('Security Page Load');
    await allure.severity('high');
    await allure.tags('tc-only', 'tc-perf', 'security');

    await tc.loginWithConfiguredUser();

    const metrics = await measureNavigation(page, async () => {
      await tc.navigateToSecurity();
    }, { label: 'security-page', readySelector: 'md-tab-item' });

    await attachLoadMetrics(testInfo, 'security-page', metrics);
    assertOptionalLoadThreshold(expect, metrics);
  });

  test('TC-PERF-03 - devices page load timing', async ({ page }, testInfo) => {
    await allure.epic('Total Connect');
    await allure.feature('Performance');
    await allure.story('Devices Page Load');
    await allure.severity('high');
    await allure.tags('tc-only', 'tc-perf', 'devices');

    await tc.loginWithConfiguredUser();

    const metrics = await measureNavigation(page, async () => {
      await tc.navigateToDevices();
    }, { label: 'devices-page', readySelector: '#body-container-layout' });

    await attachLoadMetrics(testInfo, 'devices-page', metrics);
    assertOptionalLoadThreshold(expect, metrics);
  });

  test('TC-PERF-04 - cameras page load timing', async ({ page }, testInfo) => {
    await allure.epic('Total Connect');
    await allure.feature('Performance');
    await allure.story('Cameras Page Load');
    await allure.severity('high');
    await allure.tags('tc-only', 'tc-perf', 'cameras');

    await tc.loginWithConfiguredUser();

    const metrics = await measureNavigation(page, async () => {
      await tc.navigateToCameras();
    }, { label: 'cameras-page', readySelector: '#body-container-layout' });

    await attachLoadMetrics(testInfo, 'cameras-page', metrics);
    assertOptionalLoadThreshold(expect, metrics);
  });

  test('TC-PERF-05 - activity page load timing', async ({ page }, testInfo) => {
    await allure.epic('Total Connect');
    await allure.feature('Performance');
    await allure.story('Activity Page Load');
    await allure.severity('high');
    await allure.tags('tc-only', 'tc-perf', 'activity');

    await tc.loginWithConfiguredUser();

    const metrics = await measureNavigation(page, async () => {
      await tc.navigateToActivity();
    }, { label: 'activity-page', readySelector: '#body-container-layout' });

    await attachLoadMetrics(testInfo, 'activity-page', metrics);
    assertOptionalLoadThreshold(expect, metrics);
  });

  test('TC-PERF-06 - scenes page load timing', async ({ page }, testInfo) => {
    await allure.epic('Total Connect');
    await allure.feature('Performance');
    await allure.story('Scenes Page Load');
    await allure.severity('medium');
    await allure.tags('tc-only', 'tc-perf', 'scenes');

    await tc.loginWithConfiguredUser();

    const metrics = await measureNavigation(page, async () => {
      await tc.navigateToScenes();
    }, { label: 'scenes-page', readySelector: '#body-container-layout' });

    await attachLoadMetrics(testInfo, 'scenes-page', metrics);
    assertOptionalLoadThreshold(expect, metrics);
  });

  test('TC-PERF-07 - my profile page load timing', async ({ page }, testInfo) => {
    await allure.epic('Total Connect');
    await allure.feature('Performance');
    await allure.story('My Profile Page Load');
    await allure.severity('medium');
    await allure.tags('tc-only', 'tc-perf', 'profile');

    await tc.loginWithConfiguredUser();

    const metrics = await measureNavigation(page, async () => {
      await tc.navigateToMyProfile();
    }, { label: 'my-profile-page', readySelector: '#body-container-layout' });

    await attachLoadMetrics(testInfo, 'my-profile-page', metrics);
    assertOptionalLoadThreshold(expect, metrics);
  });

  test('TC-PERF-08 - locations page load timing', async ({ page }, testInfo) => {
    await allure.epic('Total Connect');
    await allure.feature('Performance');
    await allure.story('Locations Page Load');
    await allure.severity('medium');
    await allure.tags('tc-only', 'tc-perf', 'locations');

    await tc.loginWithConfiguredUser();

    const metrics = await measureNavigation(page, async () => {
      await tc.navigateToLocations();
    }, { label: 'locations-page', readySelector: '#body-container-layout' });

    await attachLoadMetrics(testInfo, 'locations-page', metrics);
    assertOptionalLoadThreshold(expect, metrics);
  });
});
