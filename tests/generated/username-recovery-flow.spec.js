const { test, expect } = require('@playwright/test');
const allure = require('allure-js-commons');
const { testDataConfig } = require('../../framework/config/test-data.config');
const { TotalConnect2LoginPage } = require('../../framework/pages/generated/TotalConnect2LoginPage');
const { TotalConnectForgotUsernamePage } = require('../../framework/pages/generated/TotalConnectForgotUsernamePage');

test.describe('@smoke @tc @tc-plan Username Recovery Flow', () => {
  test('TC03 - Navigate to forgot username page and verify form', async ({ page }) => {
    await allure.epic('Total Connect');
    await allure.feature('Account Recovery');
    await allure.story('Username Recovery Navigation');
    await allure.severity('high');
    await allure.tags('smoke', 'tc', 'username', 'recovery', 'navigation', 'positive');

    const loginPage = new TotalConnect2LoginPage(page);

    await test.step('Navigate to login page', async () => {
      await loginPage.open(testDataConfig.targetApp.baseUrl);
      await expect(page).toHaveURL(/totalconnect/);
    });

    await test.step('Dismiss cookie consent if visible', async () => {
      try {
        await loginPage.acceptConsent();
      } catch {
        // No consent banner present
      }
    });

    await test.step('Click Problems Signing In link', async () => {
      await loginPage.clickProblemsSigningIn();
      await expect(page).toHaveURL(/problemsigningin/, { timeout: 10000 });
    });

    await test.step('Click Forgot Username link', async () => {
      const forgotUsernameLink = page.locator('a[href*="forgotusername"]');
      await forgotUsernameLink.click();
      await expect(page).toHaveURL(/forgotusername/, { timeout: 10000 });
    });

    await test.step('Verify forgot username form is displayed', async () => {
      const forgotUsernamePage = new TotalConnectForgotUsernamePage(page);
      await expect(forgotUsernamePage.emailOrPhoneInput).toBeVisible({ timeout: 10000 });
      await expect(forgotUsernamePage.submitButton).toBeVisible();
    });
  });
});
