const { test, expect } = require('../../../framework/fixtures/app.fixture');
const { logStep } = require('../../../framework/utils/steps');
const { buildCartItemRequest } = require('../../../framework/utils/runtimeInput');

test.describe('Cart flow - add specific item', () => {
  test('P1 - login and add target item to cart with cart validations', async ({
    page,
    authFlow,
    cartFlow,
    scenarioData,
  }) => {
    let selectedProductName;
    const cartItemRequest = buildCartItemRequest(scenarioData);

    await test.step('Login with working username and password', async () => {
      logStep('Login with working username and password');
      await authFlow.loginWithValidUser(scenarioData.baseUrl, scenarioData.loginData);
      await expect(page).toHaveURL(/.*\/dashboard/);
    });

    await test.step('Add target product to cart from products page', async () => {
      const resolved = await cartFlow.resolveProductCard(cartItemRequest);
      selectedProductName = resolved.productName;
      logStep(`Add ${selectedProductName} to cart (matched by: ${resolved.matchedBy})`);
      await cartFlow.addSingleProductAndValidateBasics(selectedProductName);
    });

    await test.step('Verify cart icon count after adding one item', async () => {
      logStep('Verify cart badge count equals 1');
      await cartFlow.verifyCartBadgeCount(1);
    });

    await test.step('Open cart and assert item is present', async () => {
      logStep('Open cart and verify selected product is present');
      await cartFlow.openCartAndVerifyItem(selectedProductName);
    });
  });
});
