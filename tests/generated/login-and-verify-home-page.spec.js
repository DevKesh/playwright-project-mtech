const { test, expect } = require('../../framework/fixtures/tc.fixture');
const allure = require('allure-js-commons');

test.describe('@smoke @tc Authentication Flow', () => {

  test('TC-SMOKE-001: Login and Verify Home Page is Loaded', async ({ page, tc }) => {
    await allure.epic('Total Connect');
    await allure.feature('Authentication');
    await allure.story('User logs in and verifies the home page is loaded');
    await allure.severity('critical');
    await allure.tags('smoke', 'tc', 'login', 'home-page', 'authentication');

    await test.step('Open the login page', async () => {
      await tc.openLoginPage();
    });

    await test.step('Accept consent banner if visible', async () => {
      await tc.acceptConsentIfVisible();
    });

    await test.step('Fill in configured credentials', async () => {
      await tc.fillConfiguredCredentials();
    });

    await test.step('Submit login and verify redirect to home', async () => {
      await tc.submitLogin();
    });

    await test.step('Verify Cameras nav link is visible on home page', async () => {
      await expect(tc.homePage.camerasNav).toBeVisible({ timeout: 10000 });
    });
  });

});