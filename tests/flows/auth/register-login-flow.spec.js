const { test, expect } = require('../../../framework/fixtures/app.fixture');

test.describe('Register and login flow', () => {
  test('user can register (or reuse existing account) and login successfully', async ({
    page,
    authFlow,
    productsPage,
    scenarioData,
  }) => {
    await authFlow.registerWithRetryThenLogin(scenarioData);

    // Basic business-level assertion for successful authentication.
    await expect(page.locator('button[routerlink*="cart"]')).toBeVisible();

    // Cart behavior is driven by the object in test data; add items only when defined.
    await productsPage.addItemsFromSelection(scenarioData.cartSelection);
    await productsPage.openCartAndVerifyItems(scenarioData.cartSelection);
  });
});
