const { test, expect } = require('../../framework/ai/fixtures/tc.ai.fixture');
const allure = require('allure-js-commons');
const { testDataConfig } = require('../../framework/config/test-data.config');
const { TotalConnect2LoginPage } = require('../../framework/pages/generated/TotalConnect2LoginPage');
const { TotalConnectForgotPasswordPage } = require('../../framework/pages/generated/TotalConnectForgotPasswordPage');

test.describe('@smoke @tc @tc-plan Password Recovery Flow', () => {
  test('TC02 - Navigate to forgot password page and verify form', async ({ page }) => {
    await allure.epic('Total Connect');
    await allure.feature('Password Recovery');
    await allure.story('Forgot Password Navigation');
    await allure.severity('high');
    await allure.tags('smoke', 'tc', 'password', 'recovery', 'navigation', 'positive');

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

    await test.step('Click Forgot Password link', async () => {
      const forgotPasswordLink = page.locator('a[href*="forgotpassword"]');
      await forgotPasswordLink.click();
      await expect(page).toHaveURL(/forgotpassword/, { timeout: 10000 });
    });

    await test.step('Verify forgot password form is displayed', async () => {
      const forgotPasswordPage = new TotalConnectForgotPasswordPage(page);
      await expect(forgotPasswordPage.usernameInput).toBeVisible({ timeout: 10000 });
      await expect(forgotPasswordPage.nextButton).toBeVisible();
    });
  });
});
