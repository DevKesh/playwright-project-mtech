const { test, expect } = require('../../framework/ai/fixtures/tc.ai.fixture');
const allure = require('allure-js-commons');
const { testDataConfig } = require('../../framework/config/test-data.config');
const { LoginPage } = require('../../framework/pages/generated/LoginPage.js');
const { HomePage } = require('../../framework/pages/generated/HomePage.js');

test.describe('Arm Home All Partitions', () => {
  test('User arms all partitions to Home mode', async ({ page }) => {
    await allure.epic('Security Management');
    await allure.feature('Partition Control');
    await allure.story('User arms all partitions to Home mode');
    await allure.severity('critical');
    await allure.tag('security', 'partition', 'arm-home');

    const loginPage = new LoginPage(page);
    const homePage = new HomePage(page);

    await test.step('Navigate to the login page', async () => {
      await loginPage.open();
      await page.waitForLoadState('domcontentloaded');
    });

    await test.step('Fill in login credentials and submit', async () => {
      await loginPage.fillLoginForm(testDataConfig.targetApp.credentials.email, testDataConfig.targetApp.credentials.password);
      await page.getByRole('button', { name: 'Sign In' }).click();
      await expect(page).toHaveURL(/\/home/, { timeout: 15000 });
    });

    await test.step('Dismiss cookie popup if visible', async () => {
      await homePage.dismissCookiePopup();
    });

    await test.step('Close any popup by clicking on DONE', async () => {
      await homePage.closePopup();
    });

    await test.step('Select all partitions', async () => {
      await homePage.selectAllPartitions();
    });

    await test.step('Arm all partitions to Home mode', async () => {
      await homePage.armHomeAll();
    });

    await test.step('Verify the partition status shows Armed Home', async () => {
      await homePage.verifyArmedHomeStatus();
    });
  });
});