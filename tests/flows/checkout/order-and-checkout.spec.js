const { test, expect } = require('../../../framework/fixtures/app.fixture');
const { logStep } = require('../../../framework/utils/steps');
const { buildCartItemRequest } = require('../../../framework/utils/runtimeInput');

const checkoutScenario = {
  shippingCountry: 'India',
  couponCode: 'RAHULSHETTYACADMEY',
};

test.describe('Checkout + Orders flow', () => {
  test('P1/N1/N2 - verify checkout journey and orders visibility with key validations', async ({
    page,
    authFlow,
    cartFlow,
    checkoutFlow,
    ordersFlow,
    scenarioData,
  }) => {
    let selectedProductName;
    let placedOrderId;
    const cartItemRequest = buildCartItemRequest(scenarioData);

    await test.step('Login with valid credentials', async () => {
      logStep('Login with valid credentials');
      await authFlow.loginWithValidUser(scenarioData.baseUrl, scenarioData.loginData);
      await expect(page).toHaveURL(/.*\/dashboard/);
    });

    await test.step('Add product to cart using dynamic runtime selection', async () => {
      const resolved = await cartFlow.resolveProductCard(cartItemRequest);
      selectedProductName = resolved.productName;
      logStep(`Add ${selectedProductName} to cart`);
      await cartFlow.addSingleProductAndValidateBasics(selectedProductName);
    });

    await test.step('Validate cart item details and open checkout page', async () => {
      logStep('Validate selected item details in cart and proceed to checkout');
      await checkoutFlow.openCart();
      await checkoutFlow.verifyItemInCart(selectedProductName);
      await checkoutFlow.proceedToCheckout();
      await checkoutFlow.verifyPaymentPageVisible();
    });

    await test.step('N1 - try Place Order without shipping info and validate error', async () => {
      logStep('Validate missing shipping info error when placing order');
      await checkoutFlow.tryPlaceOrderWithoutShipping();
      await checkoutFlow.verifyShippingValidationError();
    });

    await test.step('N2 - apply coupon without entering value and validate error', async () => {
      logStep('Validate coupon error when applying without coupon value');
      await checkoutFlow.applyCouponWithoutValue();
      await checkoutFlow.verifyApplyCouponValidation();
    });

    await test.step('Apply coupon with provided value', async () => {
      logStep(`Apply coupon: ${checkoutScenario.couponCode}`);
      await checkoutFlow.applyCouponWithValue(checkoutScenario.couponCode);
    });

    await test.step('Fill shipping info and place order successfully', async () => {
      logStep('Fill shipping country and place order');
      await checkoutFlow.fillCountry(checkoutScenario.shippingCountry);
      await checkoutFlow.placeOrderSuccessfully();
      placedOrderId = await checkoutFlow.captureOrderId();
      expect(placedOrderId).not.toEqual('');
    });

    await test.step('Open Orders page and verify order details', async () => {
      logStep('Open orders and verify placed order item details');
      await checkoutFlow.openOrdersFromSuccessPage();
      const matchedOrderId = await ordersFlow.verifyExactOrderIdInOrdersPage(placedOrderId);
      expect(matchedOrderId).toBe(ordersFlow.normalizeOrderId(placedOrderId));
      await ordersFlow.openOrderDetails(placedOrderId);
      await ordersFlow.verifyProductInOrderDetails(selectedProductName);
    });
  });
});
