/**
 * Verifies that the EXISTING factory at framework/ai/core/ai-client-factory.js
 * now routes through Azure when AI_PROVIDER=azure.
 *
 * Run: node framework/ai-azure/test-factory-routing.js
 */
require('dotenv').config();

const { createAIClient } = require('../ai/core/ai-client-factory');
const { loadAIConfig } = require('../ai/config/ai.config');
const { AzureAIClient } = require('./core/azure-ai-client');
const { AIClient } = require('../ai/core/openai-client');

(async () => {
  const provider = process.env.AI_PROVIDER || '(unset)';
  console.log(`AI_PROVIDER = ${provider}`);

  const cfg = loadAIConfig();
  const client = createAIClient(cfg);
  console.log(`Client class : ${client.constructor.name}`);

  if (provider.toLowerCase() === 'azure') {
    if (!(client instanceof AzureAIClient)) {
      console.error('[FAIL] Expected AzureAIClient');
      process.exit(1);
    }
    console.log('[OK] Factory returned AzureAIClient.');

    console.log('Sending live chat call via the original factory...');
    const result = await client.chatCompletionJSON(
      'Routing verification responder.',
      'Reply with JSON {"factory":"routed","ok":true}.',
      { maxTokens: 64, retries: 0 }
    );
    console.log('Response:', JSON.stringify(result));
    if (result.__usage) console.log('Usage   :', result.__usage);
    console.log('[OK] Existing factory now routes through Azure when AI_PROVIDER=azure.');
  } else {
    if (!(client instanceof AIClient)) {
      console.error('[FAIL] Expected AIClient (openai)');
      process.exit(1);
    }
    console.log('[OK] Factory returned the original AIClient (OpenAI path).');
  }
})().catch((err) => {
  console.error('[FAIL]', err.message);
  process.exit(2);
});
