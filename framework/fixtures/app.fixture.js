const base = require('@playwright/test');
const { AuthPage } = require('../pages/AuthPage');
const { ProductsPage } = require('../pages/ProductsPage');
const { createAuthFlow } = require('../flows/auth/AuthFlow');
const { createCartFlow } = require('../flows/cart/CartFlow');
const { createCheckoutFlow } = require('../flows/checkout/CheckoutFlow');
const { createOrdersFlow } = require('../flows/orders/OrdersFlow');
const { scenarioData } = require('../data/authAndCart.data');

const test = base.test.extend({
  // Auto-attach failure artifacts (screenshot, URL, page source) to every test
  page: async ({ page }, use, testInfo) => {
    await use(page);

    // After the test body runs, capture failure artifacts
    if (testInfo.status !== testInfo.expectedStatus) {
      try {
        // Full-page screenshot at point of failure
        const screenshot = await page.screenshot({ fullPage: true }).catch(() => null);
        if (screenshot) {
          await testInfo.attach('failure-screenshot', { body: screenshot, contentType: 'image/png' });
        }

        // Current URL at failure
        const currentUrl = page.url();
        if (currentUrl) {
          await testInfo.attach('failure-url', { body: currentUrl, contentType: 'text/plain' });
        }

        // Page HTML source for debugging
        const html = await page.content().catch(() => null);
        if (html) {
          await testInfo.attach('failure-page-source', { body: html, contentType: 'text/html' });
        }
      } catch {
        // Browser may already be closed, ignore attachment errors
      }
    }
  },

  authPage: async ({ page }, use) => {
    await use(new AuthPage(page));
  },
  productsPage: async ({ page }, use) => {
    await use(new ProductsPage(page));
  },
  authFlow: async ({ page, authPage }, use) => {
    await use(createAuthFlow({ page, authPage, expect: base.expect }));
  },
  cartFlow: async ({ page, productsPage }, use) => {
    await use(createCartFlow({ page, productsPage, expect: base.expect }));
  },
  checkoutFlow: async ({ page }, use) => {
    await use(createCheckoutFlow({ page, expect: base.expect }));
  },
  ordersFlow: async ({ page }, use) => {
    await use(createOrdersFlow({ page, expect: base.expect }));
  },
  scenarioData: async ({}, use) => {
    await use(scenarioData);
  },
});

module.exports = {
  test,
  expect: base.expect,
};
