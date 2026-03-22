/**
 * AI-Enhanced Fixture: extends the base app fixture to inject the
 * self-healing page proxy. Tests that import from this file get AI
 * healing automatically; tests using the original fixture are unaffected.
 *
 * Usage in test files:
 *   const { test, expect } = require('../../framework/ai/fixtures/app.ai.fixture');
 */

const base = require('@playwright/test');
const { AuthPage } = require('../../pages/AuthPage');
const { ProductsPage } = require('../../pages/ProductsPage');
const { createAuthFlow } = require('../../flows/auth/AuthFlow');
const { createCartFlow } = require('../../flows/cart/CartFlow');
const { createCheckoutFlow } = require('../../flows/checkout/CheckoutFlow');
const { createOrdersFlow } = require('../../flows/orders/OrdersFlow');
const { scenarioData } = require('../../data/authAndCart.data');
const { createPageProxy } = require('../core/page-proxy');
const { LocatorHealerAgent } = require('../agents/locator-healer.agent');
const { loadAIConfig } = require('../config/ai.config');

const config = loadAIConfig();

// Create the healer agent once (shared across all tests in the worker)
let healerAgent = null;
if (config.enabled && config.locatorHealing && config.openaiApiKey) {
  healerAgent = new LocatorHealerAgent(config);
}

const test = base.test.extend({
  // Override the page fixture to wrap it with the AI proxy
  aiPage: async ({ page }, use) => {
    if (healerAgent) {
      const proxiedPage = createPageProxy(page, { healerAgent, config });
      await use(proxiedPage);
    } else {
      await use(page);
    }
  },

  // Page objects receive the AI-enhanced page
  authPage: async ({ aiPage }, use) => {
    await use(new AuthPage(aiPage));
  },
  productsPage: async ({ aiPage }, use) => {
    await use(new ProductsPage(aiPage));
  },

  // Flows receive the AI-enhanced page
  authFlow: async ({ aiPage, authPage }, use) => {
    await use(createAuthFlow({ page: aiPage, authPage, expect: base.expect }));
  },
  cartFlow: async ({ aiPage, productsPage }, use) => {
    await use(createCartFlow({ page: aiPage, productsPage, expect: base.expect }));
  },
  checkoutFlow: async ({ aiPage }, use) => {
    await use(createCheckoutFlow({ page: aiPage, expect: base.expect }));
  },
  ordersFlow: async ({ aiPage }, use) => {
    await use(createOrdersFlow({ page: aiPage, expect: base.expect }));
  },
  scenarioData: async ({}, use) => {
    await use(scenarioData);
  },
});

module.exports = {
  test,
  expect: base.expect,
};
