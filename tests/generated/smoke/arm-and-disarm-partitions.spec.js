const { test, expect } = require('@playwright/test');
const { testDataConfig } = require('../../../framework/config/test-data.config');
const { LoginPage } = require('../../../framework/pages/generated/smoke/LoginPage');
const { HomePage } = require('../../../framework/pages/generated/smoke/HomePage');

test.describe('@smoke @tc @tc-plan TC-SMOKE-002: Arm Home and Disarm', () => {
  test('should arm home and disarm partitions successfully', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const homePage = new HomePage(page);

    // Login
    await test.step('Navigate to login page', async () => {
      await loginPage.open();
    });

     // Dismiss popups
    await test.step('Dismiss cookie popup if visible', async () => {
      await homePage.dismissCookiePopup();
    });


    await test.step('Login with credentials', async () => {
      await loginPage.login(testDataConfig.targetApp.credentials.email, testDataConfig.targetApp.credentials.password);
    });

 

    await test.step('Close DONE popup if visible', async () => {
      await homePage.closeDonePopup();
    });

    // Arm Home flow
    await test.step('Select all partitions', async () => {
      await homePage.selectAllPartitions();
    });

    await test.step('Click Arm Home All', async () => {
      await homePage.armHome();
    });

    await test.step('Wait for Armed Home status', async () => {
      await homePage.waitForArmedHome();
    });

    await test.step('Verify partition shows Armed Home', async () => {
      await homePage.verifyPartitionStatus('Armed Home');
    });

    // Disarm flow
    await test.step('Select all partitions again', async () => {
      await homePage.selectAllPartitions();
    });

    await test.step('Click Disarm All', async () => {
      await homePage.disarm();
    });

    await test.step('Wait for Disarmed status', async () => {
      await homePage.waitForDisarmed();
    });

    await test.step('Verify partition shows Disarmed', async () => {
      await homePage.verifyPartitionStatus('Disarmed');
    });
  });
});