const { test, expect } = require('../../../framework/fixtures/app.fixture');
const allure = require('allure-js-commons');

test.describe('Register and login flow', () => {
  test('user can register (or reuse existing account) and login successfully', async ({
    page,
    authFlow,
    productsPage,
    scenarioData,
  }) => {
    await allure.epic('E-Commerce App');
    await allure.feature('Authentication');
    await allure.story('Registration + Login');
    await allure.severity('blocker');
    await allure.tags('auth', 'registration', 'login', 'e2e', 'smoke');

    await authFlow.registerWithRetryThenLogin(scenarioData);

    // Basic business-level assertion for successful authentication.
    await expect(page.locator('button[routerlink*="cart"]')).toBeVisible();

    // Cart behavior is driven by the object in test data; add items only when defined.
    await productsPage.addItemsFromSelection(scenarioData.cartSelection);
    await productsPage.openCartAndVerifyItems(scenarioData.cartSelection);
  });
});
