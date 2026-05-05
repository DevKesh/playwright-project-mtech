const { test, expect } = require('../../framework/ai/fixtures/tc.ai.fixture');
const allure = require('allure-js-commons');
const { testDataConfig } = require('../../framework/config/test-data.config');
const { LoginPage } = require('../../framework/pages/generated/LoginPage.js');
const { HomePage } = require('../../framework/pages/generated/HomePage.js');

test.describe('Authentication Flow', () => {
  test('Login and Verify Home Page', async ({ page }) => {
    await allure.epic('Authentication');
    await allure.feature('User Login');
    await allure.story('User logs into the app and verifies the home page');
    await allure.severity('critical');
    await allure.tag('login', 'home-page', 'authentication');

    const loginPage = new LoginPage(page);
    const homePage = new HomePage(page);

    await test.step('Navigate to the Total Connect login page', async () => {
      await loginPage.open();
      await page.waitForLoadState('domcontentloaded');
    });

    await test.step('Fill in the email field with the user\'s email', async () => {
      await loginPage.fillLoginForm(testDataConfig.targetApp.credentials.email, testDataConfig.targetApp.credentials.password);
    });

    await test.step('Click the login button', async () => {
      await loginPage.clickLoginButton();
      await page.waitForURL(/./, { timeout: 10000 });
    });

    await test.step('Dismiss the cookie popup if visible', async () => {
      await loginPage.dismissCookiePopup();
    });

    await test.step('Close any popup by clicking on DONE', async () => {
      await loginPage.closeDonePopup();
    });

    await test.step('Verify the home page is loaded and the URL contains /home', async () => {
      await homePage.verifyHomePageLoaded();
    });

    await test.step('Verify the security panel status is visible on the home page', async () => {
      await homePage.verifySecurityPanelStatusVisible();
    });
  });
});