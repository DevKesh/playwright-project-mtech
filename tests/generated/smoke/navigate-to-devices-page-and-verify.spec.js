const { test, expect } = require('../../framework/ai/fixtures/tc.ai.fixture');
const allure = require('allure-js-commons');
const { testDataConfig } = require('../../framework/config/test-data.config');
const { LoginPage } = require('../../framework/pages/generated/LoginPage.js');
const { HomePage } = require('../../framework/pages/generated/HomePage.js');
const { DevicesPage } = require('../../framework/pages/generated/DevicesPage.js');

test.describe('Total Connect Navigation Tests', () => {
  test('Navigate to Devices Page and Verify', async ({ page }) => {
    await allure.epic('Total Connect');
    await allure.feature('Navigation');
    await allure.story('User navigates to devices page');
    await allure.severity('normal');
    await allure.tag('navigation', 'devices', 'verification');

    const loginPage = new LoginPage(page);
    const homePage = new HomePage(page);
    const devicesPage = new DevicesPage(page);

    await test.step('Navigate to the login page', async () => {
      await loginPage.open();
      await page.waitForLoadState('domcontentloaded');
    });

    await test.step('Fill in the email and password fields', async () => {
      await loginPage.fillLoginForm(testDataConfig.targetApp.credentials.email, testDataConfig.targetApp.credentials.password);
    });

    await test.step('Click the login button', async () => {
      await homePage.clickLoginButton();
      await page.waitForURL(/./, { timeout: 10000 });
    });

    await test.step('Dismiss the cookie popup if visible', async () => {
      await homePage.dismissCookiePopup();
    });

    await test.step('Close any popup by clicking on DONE', async () => {
      await homePage.closePopup();
    });

    await test.step('Navigate to the Devices page', async () => {
      await devicesPage.navigateToDevices();
      await page.waitForURL(/./, { timeout: 10000 });
    });

    await test.step('Verify the URL contains /automation', async () => {
      await devicesPage.verifyUrlContainsAutomation();
    });

    await test.step('Verify the devices list is visible', async () => {
      await devicesPage.verifyDevicesListVisible();
    });
  });
});