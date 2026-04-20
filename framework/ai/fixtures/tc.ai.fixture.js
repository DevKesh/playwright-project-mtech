/**
 * Total Connect AI Healing Fixture
 *
 * Wraps the standard Playwright `page` with the AI self-healing proxy.
 * When AI_HEALING_ENABLED=true and OPENAI_API_KEY is set, any locator
 * failure triggers automatic selector healing via GPT.
 *
 * When healing is disabled (no env vars), this fixture passes through
 * the original `page` unchanged — zero overhead.
 *
 * Usage in generated test specs:
 *   const { test, expect } = require('../../framework/ai/fixtures/tc.ai.fixture');
 *
 * Drop-in replacement for:
 *   const { test, expect } = require('@playwright/test');
 */

const base = require('@playwright/test');
const { createLocatorProxy } = require('../core/locator-proxy');
const { LocatorHealerAgent } = require('../agents/locator-healer.agent');
const { loadAIConfig } = require('../config/ai.config');

const config = loadAIConfig();

// Create healer agent once per worker (only if healing is enabled + key present)
let healerAgent = null;
if (config.enabled && config.locatorHealing && config.openaiApiKey) {
  healerAgent = new LocatorHealerAgent(config);
  console.log('[AI-FIXTURE] Healer agent created — locator self-healing is ACTIVE');
} else {
  console.log(`[AI-FIXTURE] Healer agent NOT created — enabled:${config.enabled} locator:${config.locatorHealing} key:${!!config.openaiApiKey}`);
}

const test = base.test.extend({
  page: async ({ page }, use, testInfo) => {
    if (healerAgent) {
      // Monkey-patch locator-creating methods directly on the page object
      // (Playwright's fixture system strips JS Proxies, so we patch instead)
      patchPageWithHealing(page, { healerAgent, config });
      // Give the healing graph enough time (DOM extract → GPT → retry)
      testInfo.setTimeout(120_000);
    }

    await use(page);

    // Capture failure artifacts
    if (testInfo.status !== testInfo.expectedStatus) {
      try {
        const screenshot = await page.screenshot({ fullPage: true }).catch(() => null);
        if (screenshot) {
          await testInfo.attach('failure-screenshot', { body: screenshot, contentType: 'image/png' });
        }
        await testInfo.attach('failure-url', { body: page.url(), contentType: 'text/plain' });
      } catch { /* browser may be closed */ }
    }
  },
});

/**
 * Monkey-patch all locator-creating methods on a Page to return healing-capable locators.
 */
function patchPageWithHealing(page, { healerAgent, config }) {
  const LOCATOR_CREATORS = ['locator', 'getByRole', 'getByText', 'getByLabel', 'getByPlaceholder', 'getByAltText', 'getByTitle', 'getByTestId'];

  // Store unpatched originals so the healer agent can create locators
  // without triggering recursive healing.
  const rawMethods = {};
  for (const method of LOCATOR_CREATORS) {
    rawMethods[method] = page[method].bind(page);
  }
  page.__rawLocatorMethods = rawMethods;

  for (const method of LOCATOR_CREATORS) {
    const original = rawMethods[method];
    page[method] = function (...args) {
      const locator = original(...args);
      const desc = `page.${method}(${args.map(a => JSON.stringify(a)).join(', ')})`;
      return createLocatorProxy(locator, { page, healerAgent, config, selectorDescription: desc });
    };
  }
}

module.exports = { test, expect: base.expect };
