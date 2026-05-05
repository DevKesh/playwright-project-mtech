const { test, expect } = require('../../framework/ai/fixtures/tc.ai.fixture');
const allure = require('allure-js-commons');
const { testDataConfig } = require('../../framework/config/test-data.config');
const { LoginPage } = require('../../framework/pages/generated/LoginPage.js');
const { HomePage } = require('../../framework/pages/generated/HomePage.js');

test.describe('@smoke @tc @tc-plan Authentication Flow', () => {
  test('TC-SMOKE-001: Login and Verify Home Page is Loaded', async ({ page }) => {
    await allure.epic('Authentication');
    await allure.feature('User Login');
    await allure.story('User logs into the app and verifies the home page is loaded');
    await allure.severity('critical');
    await allure.tag('login', 'home-page', 'authentication');

    const loginPage = new LoginPage(page);
    const homePage = new HomePage(page);

    await test.step('Navigate to the login page', async () => {
      await loginPage.open();
      await page.waitForLoadState('domcontentloaded');
    });

    await test.step('Fill in the email and password fields', async () => {
      await loginPage.fillLoginForm(testDataConfig.targetApp.credentials.email, testDataConfig.targetApp.credentials.password);
    });

    await test.step('Click the login button', async () => {
      await loginPage.clickLoginButton();
    });

    await test.step('Dismiss the cookie popup if visible', async () => {
      await loginPage.dismissCookiePopup();
    });

    await test.step('Close any popup by clicking DONE', async () => {
      await loginPage.closePopup();
    });

    await test.step('Verify the home page is loaded', async () => {
      await homePage.verifyHomePageLoaded();
      await expect(page).toHaveURL(testDataConfig.targetApp.baseUrl + 'home', { timeout: 15000 });
    });
  });
});