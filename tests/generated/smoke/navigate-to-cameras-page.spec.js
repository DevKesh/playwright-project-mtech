const { test, expect } = require('../../framework/ai/fixtures/tc.ai.fixture');
const allure = require('allure-js-commons');
const { testDataConfig } = require('../../framework/config/test-data.config');
const { LoginPage } = require('../../framework/pages/generated/LoginPage.js');
const { HomePage } = require('../../framework/pages/generated/HomePage.js');
const { CamerasPage } = require('../../framework/pages/generated/CamerasPage.js');

test.describe('Total Connect Navigation', () => {
  test('Navigate to Cameras Page and Verify Camera Feed', async ({ page }) => {
    await allure.epic('Total Connect');
    await allure.feature('Navigation');
    await allure.story('User navigates to cameras page');
    await allure.severity('normal');
    await allure.tag('navigation', 'cameras', 'verification');

    const loginPage = new LoginPage(page);
    const homePage = new HomePage(page);
    const camerasPage = new CamerasPage(page);

    await test.step('Navigate to the login page', async () => {
      await loginPage.open();
      await page.waitForLoadState('domcontentloaded');
    });

    await test.step('Fill in the login form', async () => {
      await loginPage.fillLoginForm(testDataConfig.targetApp.credentials.email, testDataConfig.targetApp.credentials.password);
    });

    await test.step('Click the login button', async () => {
      await homePage.clickLoginButton();
      await page.waitForURL(/./, { timeout: 10000 });
    });

    await test.step('Dismiss cookie popup if visible', async () => {
      await homePage.dismissCookiePopup();
    });

    await test.step('Close any pop-up by clicking on DONE', async () => {
      await homePage.closePopup();
    });

    await test.step('Navigate to the Cameras page', async () => {
      await camerasPage.navigateToCamerasPage();
      await page.waitForURL(/./, { timeout: 10000 });
    });

    await test.step('Verify the Cameras page is loaded', async () => {
      await camerasPage.verifyCamerasPageLoaded();
    });

    await test.step('Verify the camera feed section is visible', async () => {
      await camerasPage.verifyCameraFeedVisible();
    });
  });
});