/**
 * Smoke test for framework/ai-azure/router.js.
 *
 * Run from project root:
 *   node framework/ai-azure/test-router.js
 *
 * Verifies:
 *   1. With AI_PROVIDER=azure, the router returns the AzureAIClient and
 *      a tiny chat call succeeds against the Azure Anthropic endpoint.
 *   2. With AI_PROVIDER unset (default openai), the router returns the
 *      original AIClient class WITHOUT making a network call. (We don't
 *      hit OpenAI because the existing key in .env is invalid \u2014 we only
 *      assert the class wiring.)
 *
 * Does NOT touch any existing framework files.
 */

const path = require('path');

// Ensure .env is loaded for the Azure provider path
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

function setProvider(p) {
  if (p === undefined) delete process.env.AI_PROVIDER;
  else process.env.AI_PROVIDER = p;
  // Bust router cache so getActiveProvider() re-reads the env var
  delete require.cache[require.resolve('./router')];
}

(async () => {
  let failures = 0;

  // ---------------------------------------------------------------- 1 / 2
  console.log('=== Test 1: AI_PROVIDER=azure -> AzureAIClient + live call ===');
  setProvider('azure');
  try {
    const { createAIClient, getActiveProvider } = require('./router');
    const { AzureAIClient } = require('./core/azure-ai-client');
    const provider = getActiveProvider();
    if (provider !== 'azure') throw new Error(`Expected provider 'azure', got '${provider}'`);
    const client = createAIClient();
    if (!(client instanceof AzureAIClient)) {
      throw new Error(`Expected AzureAIClient, got ${client?.constructor?.name}`);
    }
    console.log('  Provider resolved: azure  [OK]');
    console.log('  Class resolved   : AzureAIClient  [OK]');

    const t0 = Date.now();
    const result = await client.chatCompletionJSON(
      'You are a router connectivity tester.',
      'Reply with JSON {"router":"ok"}.',
      { maxTokens: 64, retries: 0 }
    );
    const ms = Date.now() - t0;
    console.log(`  Live call OK in ${ms} ms:`, JSON.stringify(result));
  } catch (err) {
    failures++;
    console.error('  [FAIL]', err.message);
  }

  // ---------------------------------------------------------------- 2 / 2
  console.log('');
  console.log('=== Test 2: AI_PROVIDER unset -> falls back to OpenAI AIClient (no network) ===');
  setProvider(undefined);
  try {
    const { createAIClient, getActiveProvider } = require('./router');
    const { AIClient } = require('../ai/core/openai-client');
    const provider = getActiveProvider();
    if (provider !== 'openai') throw new Error(`Expected provider 'openai', got '${provider}'`);
    const { loadAIConfig } = require('../ai/config/ai.config');
    const cfg = loadAIConfig();
    const client = createAIClient(cfg);
    if (!(client instanceof AIClient)) {
      throw new Error(`Expected AIClient, got ${client?.constructor?.name}`);
    }
    console.log('  Provider resolved: openai  [OK]');
    console.log('  Class resolved   : AIClient  [OK]');
  } catch (err) {
    failures++;
    console.error('  [FAIL]', err.message);
  }

  console.log('');
  if (failures === 0) {
    console.log('All router tests passed.');
    process.exit(0);
  } else {
    console.log(`${failures} router test(s) failed.`);
    process.exit(1);
  }
})();
