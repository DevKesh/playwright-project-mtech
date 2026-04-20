const { test, expect } = require('../../framework/fixtures/tc.fixture');
const allure = require('allure-js-commons');

test.describe('@tc-only @tc-perf Full page load timing sweep across Total Connect', () => {
  test.describe.configure({ mode: 'serial' });

  test('TC-PERF-01 - login page and dashboard load timings', async ({ page, tc, perf }, testInfo) => {
    await allure.epic('Total Connect');
    await allure.feature('Performance');
    await allure.story('Login and Dashboard Load');
    await allure.severity('critical');
    await allure.tags('tc-only', 'tc-perf', 'login', 'dashboard');

    const loginMetrics = await perf.measureNavigation(page, async () => {
      await tc.openLoginPage();
      await tc.acceptConsentIfVisible();
    }, { label: 'login-page', readySelector: '#UsernameInput' });

    await perf.attachLoadMetrics(testInfo, 'login-page', loginMetrics);
    perf.assertOptionalLoadThreshold(expect, loginMetrics);

    await tc.fillConfiguredCredentials();

    const dashboardMetrics = await perf.measureNavigation(page, async () => {
      await tc.submitLogin();
    }, { label: 'home-dashboard', readySelector: '#body-container-layout' });

    await perf.attachLoadMetrics(testInfo, 'home-dashboard', dashboardMetrics);
    perf.assertOptionalLoadThreshold(expect, dashboardMetrics);
  });

  test('TC-PERF-02 - security page load timing', async ({ page, tcLoggedIn, perf }, testInfo) => {
    await allure.epic('Total Connect');
    await allure.feature('Performance');
    await allure.story('Security Page Load');
    await allure.severity('high');
    await allure.tags('tc-only', 'tc-perf', 'security');

    const metrics = await perf.measureNavigation(page, async () => {
      await tcLoggedIn.navigateToSecurity();
    }, { label: 'security-page', readySelector: 'md-tab-item' });

    await perf.attachLoadMetrics(testInfo, 'security-page', metrics);
    perf.assertOptionalLoadThreshold(expect, metrics);
  });

  test('TC-PERF-03 - devices page load timing', async ({ page, tcLoggedIn, perf }, testInfo) => {
    await allure.epic('Total Connect');
    await allure.feature('Performance');
    await allure.story('Devices Page Load');
    await allure.severity('high');
    await allure.tags('tc-only', 'tc-perf', 'devices');

    const metrics = await perf.measureNavigation(page, async () => {
      await tcLoggedIn.navigateToDevices();
    }, { label: 'devices-page', readySelector: '#body-container-layout' });

    await perf.attachLoadMetrics(testInfo, 'devices-page', metrics);
    perf.assertOptionalLoadThreshold(expect, metrics);
  });

  test('TC-PERF-04 - cameras page load timing', async ({ page, tcLoggedIn, perf }, testInfo) => {
    await allure.epic('Total Connect');
    await allure.feature('Performance');
    await allure.story('Cameras Page Load');
    await allure.severity('high');
    await allure.tags('tc-only', 'tc-perf', 'cameras');

    const metrics = await perf.measureNavigation(page, async () => {
      await tcLoggedIn.navigateToCameras();
    }, { label: 'cameras-page', readySelector: '#body-container-layout' });

    await perf.attachLoadMetrics(testInfo, 'cameras-page', metrics);
    perf.assertOptionalLoadThreshold(expect, metrics);
  });

  test('TC-PERF-05 - activity page load timing', async ({ page, tcLoggedIn, perf }, testInfo) => {
    await allure.epic('Total Connect');
    await allure.feature('Performance');
    await allure.story('Activity Page Load');
    await allure.severity('high');
    await allure.tags('tc-only', 'tc-perf', 'activity');

    const metrics = await perf.measureNavigation(page, async () => {
      await tcLoggedIn.navigateToActivity();
    }, { label: 'activity-page', readySelector: '#body-container-layout' });

    await perf.attachLoadMetrics(testInfo, 'activity-page', metrics);
    perf.assertOptionalLoadThreshold(expect, metrics);
  });

  test('TC-PERF-06 - scenes page load timing', async ({ page, tcLoggedIn, perf }, testInfo) => {
    await allure.epic('Total Connect');
    await allure.feature('Performance');
    await allure.story('Scenes Page Load');
    await allure.severity('medium');
    await allure.tags('tc-only', 'tc-perf', 'scenes');

    const metrics = await perf.measureNavigation(page, async () => {
      await tcLoggedIn.navigateToScenes();
    }, { label: 'scenes-page', readySelector: '#body-container-layout' });

    await perf.attachLoadMetrics(testInfo, 'scenes-page', metrics);
    perf.assertOptionalLoadThreshold(expect, metrics);
  });

  test('TC-PERF-07 - my profile page load timing', async ({ page, tcLoggedIn, perf }, testInfo) => {
    await allure.epic('Total Connect');
    await allure.feature('Performance');
    await allure.story('My Profile Page Load');
    await allure.severity('medium');
    await allure.tags('tc-only', 'tc-perf', 'profile');

    const metrics = await perf.measureNavigation(page, async () => {
      await tcLoggedIn.navigateToMyProfile();
    }, { label: 'my-profile-page', readySelector: '#body-container-layout' });

    await perf.attachLoadMetrics(testInfo, 'my-profile-page', metrics);
    perf.assertOptionalLoadThreshold(expect, metrics);
  });

  test('TC-PERF-08 - locations page load timing', async ({ page, tcLoggedIn, perf }, testInfo) => {
    await allure.epic('Total Connect');
    await allure.feature('Performance');
    await allure.story('Locations Page Load');
    await allure.severity('medium');
    await allure.tags('tc-only', 'tc-perf', 'locations');

    const metrics = await perf.measureNavigation(page, async () => {
      await tcLoggedIn.navigateToLocations();
    }, { label: 'locations-page', readySelector: '#body-container-layout' });

    await perf.attachLoadMetrics(testInfo, 'locations-page', metrics);
    perf.assertOptionalLoadThreshold(expect, metrics);
  });
});
