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
const { createPageProxy } = require('../core/page-proxy');
const { LocatorHealerAgent } = require('../agents/locator-healer.agent');
const { loadAIConfig } = require('../config/ai.config');

const config = loadAIConfig();

// Create healer agent once per worker (only if healing is enabled + key present)
let healerAgent = null;
if (config.enabled && config.locatorHealing && config.openaiApiKey) {
  healerAgent = new LocatorHealerAgent(config);
}

const test = base.test.extend({
  // Override page to wrap with AI healing proxy when enabled
  page: async ({ page }, use, testInfo) => {
    if (healerAgent) {
      const proxiedPage = createPageProxy(page, { healerAgent, config });
      await use(proxiedPage);
    } else {
      await use(page);
    }

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

module.exports = { test, expect: base.expect };
