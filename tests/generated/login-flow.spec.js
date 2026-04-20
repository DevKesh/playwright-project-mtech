const { test, expect } = require('../../framework/ai/fixtures/tc.ai.fixture');
const allure = require('allure-js-commons');
const { testDataConfig } = require('../../framework/config/test-data.config');
const { TotalConnect2LoginPage } = require('../../framework/pages/generated/TotalConnect2LoginPage');

test.describe('@smoke @tc @tc-plan Login Flow', () => {
  test('TC01 - User should be able to log into Total Connect 2.0', async ({ page }) => {
    await allure.epic('Total Connect');
    await allure.feature('Authentication');
    await allure.story('User Login');
    await allure.severity('critical');
    await allure.tags('smoke', 'tc', 'login', 'authentication', 'positive');

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

    await test.step('Fill login form and submit', async () => {
      await loginPage.fillLoginForm(
        testDataConfig.targetApp.credentials.email,
        testDataConfig.targetApp.credentials.password
      );
      await loginPage.clickSignIn();
    });

    await test.step('Verify successful login — redirected away from login page', async () => {
      await expect(page).toHaveURL(/.*\/home/, { timeout: 15000 });
    });
  });
});
