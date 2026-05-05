const { test, expect } = require('../../framework/ai/fixtures/tc.ai.fixture');
const allure = require('allure-js-commons');
const { testDataConfig } = require('../../framework/config/test-data.config');
const { LoginPage } = require('../../framework/pages/generated/LoginPage.js');
const { HomePage } = require('../../framework/pages/generated/HomePage.js');

test.describe('Total Connect - Security Management', () => {
  test('Arm Home Security System', async ({ page }) => {
    await allure.epic('Total Connect');
    await allure.feature('Security Management');
    await allure.story('User arms the home security system');
    await allure.severity('critical');
    await allure.tag('security', 'arm', 'home');

    const loginPage = new LoginPage(page);
    const homePage = new HomePage(page);

    await test.step('Navigate to the login page', async () => {
      await loginPage.open();
      await page.waitForLoadState('domcontentloaded');
    });

    await test.step('Fill in the login form', async () => {
      await loginPage.fillLoginForm(testDataConfig.targetApp.credentials.email, testDataConfig.targetApp.credentials.password);
    });

    await test.step('Click the login button', async () => {
      await homePage.clickLoginButton();
      await expect(page).toHaveURL(/\/home/, { timeout: 15000 });
    });

    await test.step('Dismiss cookie popup if visible', async () => {
      await homePage.dismissCookiePopup();
    });

    await test.step('Close any popup by clicking on DONE', async () => {
      await homePage.closePopup();
    });

    await test.step('Select all and arm home', async () => {
      await homePage.selectAll();
      await homePage.armHome();
    });

    await test.step('Verify the status shows Armed Home', async () => {
      await homePage.verifyArmedHomeStatus();
    });
  });
});