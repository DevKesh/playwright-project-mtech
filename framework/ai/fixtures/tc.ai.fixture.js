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
const { attachFailureArtifacts } = require('../../utils/test-artifacts');

function createHealer() {
  if (process.env.AI_HEALING_ENABLED !== 'true' ||
      (process.env.CI && process.env.CI !== 'false') || process.env.GITHUB_ACTIONS === 'true') {
    return null;
  }
  const { loadAIConfig, validateAIConfig } = require('../config/ai.config');
  const config = loadAIConfig();
  validateAIConfig(config);
  if (!config.locatorHealing) return null;
  const { LocatorHealerAgent } = require('../agents/locator-healer.agent');
  return { healerAgent: new LocatorHealerAgent(config), config };
}

async function withoutHealing(page, action) {
  page.__aiHealingSuppressed = (page.__aiHealingSuppressed || 0) + 1;
  try {
    return await action();
  } finally {
    page.__aiHealingSuppressed -= 1;
  }
}

const test = base.test.extend({
  page: async ({ page }, use, testInfo) => {
    const healing = createHealer();
    if (healing) {
      // Monkey-patch locator-creating methods directly on the page object
      // (Playwright's fixture system strips JS Proxies, so we patch instead)
      patchPageWithHealing(page, healing);
      // Give the healing graph enough time (DOM extract → GPT → retry)
      testInfo.setTimeout(120_000);
    }

    await use(page);

    await attachFailureArtifacts(page, testInfo);
  },
});

/**
 * Monkey-patch all locator-creating methods on a Page to return healing-capable locators.
 */
function patchPageWithHealing(page, { healerAgent, config }) {
  if (!healerAgent || !config?.locatorHealing || page.__rawLocatorMethods) return;
  const { createLocatorProxy } = require('../core/locator-proxy');
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

module.exports = { test, expect: base.expect, createHealer, patchPageWithHealing, withoutHealing };
