const base = require('@playwright/test');
const { AuthPage } = require('../pages/AuthPage');
const { ProductsPage } = require('../pages/ProductsPage');
const { createAuthFlow } = require('../flows/auth/AuthFlow');
const { createCartFlow } = require('../flows/cart/CartFlow');
const { createCheckoutFlow } = require('../flows/checkout/CheckoutFlow');
const { createOrdersFlow } = require('../flows/orders/OrdersFlow');
const { scenarioData } = require('../data/authAndCart.data');
const { attachFailureArtifacts } = require('../utils/test-artifacts');

const test = base.test.extend({
  // Auto-attach failure artifacts (screenshot, URL, page source) to every test
  page: async ({ page }, use, testInfo) => {
    await use(page);
    await attachFailureArtifacts(page, testInfo, { includeHtml: true });
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
