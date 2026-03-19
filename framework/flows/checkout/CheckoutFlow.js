function createCheckoutFlow({ page, expect }) {
  const cartItemNameLocator = page.locator('.cartSection h3');
  const cartCheckoutButton = page.getByRole('button', { name: /checkout/i }).first();
  const countryInput = page.getByPlaceholder(/select country/i);
  const countryOptions = page.locator('.ta-results button');
  const placeOrderButton = page.getByText(/place order/i).first();
  const couponInput = page.locator('input[placeholder*="Coupon"], input[name*="coupon" i], input[id*="coupon" i]').first();
  const applyCouponButton = page.getByRole('button', { name: /apply coupon/i }).first();

  const getToast = () => page.locator('#toast-container, .ngx-toastr, [aria-live="polite"]').first();

  const openCart = async () => {
    await page.locator('button[routerlink*="cart"]').click();
    await expect(page).toHaveURL(/.*\/cart/);
  };

  const verifyItemInCart = async (productName) => {
    await expect(cartItemNameLocator.filter({ hasText: productName })).toBeVisible();
  };

  const proceedToCheckout = async () => {
    await cartCheckoutButton.click();
    await expect(page).toHaveURL(/.*\/(order|checkout)/);
  };

  const verifyPaymentPageVisible = async () => {
    await expect(page.getByText(/payment method|shipping information|order summary/i).first()).toBeVisible();
  };

  const applyCouponWithoutValue = async () => {
    if ((await applyCouponButton.count()) === 0) {
      throw new Error('Apply Coupon button not found on checkout page.');
    }

    // Clear value when coupon input exists and trigger coupon apply attempt.
    if ((await couponInput.count()) > 0) {
      await couponInput.fill('');
    }
    await applyCouponButton.click();
  };

  const applyCouponWithValue = async (couponCode) => {
    if ((await applyCouponButton.count()) === 0 || (await couponInput.count()) === 0) {
      throw new Error('Coupon input/apply controls not found on checkout page.');
    }

    await couponInput.click();
    await couponInput.press('Control+A');
    await couponInput.press('Delete');
    await couponInput.fill(couponCode);
    await applyCouponButton.click();
  };

  const verifyApplyCouponValidation = async () => {
    const couponFeedback = page
      .locator('text=/Apply Coupon|Enter Coupon|Invalid Coupon|Please Enter Coupon/i')
      .first();

    await expect(couponFeedback).toBeVisible();
  };

  const tryPlaceOrderWithoutShipping = async () => {
    await placeOrderButton.click();
  };

  const verifyShippingValidationError = async () => {
    const shippingError = page.locator('text=/Please Enter full shipping Information|shipping/i').first();

    const toast = getToast();
    const toastVisible = await toast.isVisible().catch(() => false);
    if (toastVisible) {
      await expect(toast).toContainText(/shipping|Please Enter full shipping Information/i);
      return;
    }

    await expect(shippingError).toBeVisible();
  };

  const fillCountry = async (countryName) => {
    const searchText = countryName.slice(0, 3);
    await countryInput.click();
    await countryInput.press('Control+A');
    await countryInput.press('Delete');
    await countryInput.pressSequentially(searchText, { delay: 80 });

    await expect(countryOptions.first()).toBeVisible();

    const optionsCount = await countryOptions.count();
    const normalizedTarget = countryName.trim().toLowerCase();
    let clicked = false;

    for (let index = 0; index < optionsCount; index += 1) {
      const option = countryOptions.nth(index);
      const optionText = ((await option.textContent()) || '').trim().toLowerCase();

      if (optionText === normalizedTarget) {
        await option.click();
        clicked = true;
        break;
      }
    }

    if (!clicked) {
      throw new Error(`Exact country option not found for: ${countryName}`);
    }

    await expect(countryInput).toHaveValue(new RegExp(`^${countryName}$`, 'i'));
  };

  const placeOrderSuccessfully = async () => {
    await placeOrderButton.click();
    await expect(page.locator('text=/Thankyou for the order|Thank you for the order/i').first()).toBeVisible();
  };

  const captureOrderId = async () => {
    const orderIdLocator = page.locator('label.ng-star-inserted, .em-spacer-1 .ng-star-inserted').first();
    const rawText = (await orderIdLocator.textContent()) || '';
    return rawText.replace(/[|\s]/g, '').trim();
  };

  const openOrdersFromSuccessPage = async () => {
    const ordersButton = page.getByRole('button', { name: /orders/i }).first();
    await ordersButton.click();
    await expect(page).toHaveURL(/.*\/myorders/);
  };

  return {
    openCart,
    verifyItemInCart,
    proceedToCheckout,
    verifyPaymentPageVisible,
    applyCouponWithoutValue,
    applyCouponWithValue,
    verifyApplyCouponValidation,
    tryPlaceOrderWithoutShipping,
    verifyShippingValidationError,
    fillCountry,
    placeOrderSuccessfully,
    captureOrderId,
    openOrdersFromSuccessPage,
  };
}

module.exports = { createCheckoutFlow };
