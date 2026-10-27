/**
 * Standalone connectivity test for the Azure Anthropic passthrough deployment.
 *
 * Run from the project root:
 *   node framework/ai-azure/test-connection.js
 *
 * Does NOT touch the existing framework. Verifies that your
 * AZURE_ANTHROPIC_* env vars are correctly set and that the deployment responds.
 *
 * Required in .env at project root:
 *   AZURE_ANTHROPIC_ENDPOINT=https://<resource>.services.ai.azure.com/anthropic/v1/messages
 *   AZURE_ANTHROPIC_API_KEY=<your key>
 *   AZURE_ANTHROPIC_MODEL=claude-sonnet-4-5-2
 */

const { loadAzureAIConfig, validateAzureAIConfig } = require('./config/ai.azure.config');
const { AzureAIClient } = require('./core/azure-ai-client');

function redact(s) {
  if (!s) return '(empty)';
  if (s.length <= 8) return '***';
  return `${s.slice(0, 4)}...${s.slice(-4)}`;
}

(async () => {
  console.log('--- Azure Anthropic connectivity test ---');

  let cfg;
  try {
    cfg = loadAzureAIConfig();
    validateAzureAIConfig(cfg);
  } catch (err) {
    console.error('[FAIL] Config error:', err.message);
    process.exit(1);
  }

  console.log('Endpoint   :', cfg.endpoint);
  console.log('Model      :', cfg.model);
  console.log('API version:', cfg.anthropicVersion);
  console.log('API key    :', redact(cfg.apiKey));
  console.log('Timeout    :', cfg.timeout, 'ms');
  console.log('');

  const client = new AzureAIClient(cfg);

  try {
    console.log('Sending a tiny chat call...');
    const t0 = Date.now();
    const result = await client.chatCompletionJSON(
      'You are a connectivity test responder.',
      'Reply with JSON {"status":"ok","model":"<the model you are>"}.',
      { maxTokens: 128, retries: 0 }
    );
    const ms = Date.now() - t0;
    console.log(`[OK] Response in ${ms} ms:`);
    console.log(JSON.stringify(result, null, 2));
    if (result.__usage) console.log('Token usage:', result.__usage);
    process.exit(0);
  } catch (err) {
    console.error('[FAIL] Chat call failed:');
    console.error(err.message);
    if (err.status) console.error('HTTP status:', err.status);
    if (err.code) console.error('Error code :', err.code);
    process.exit(2);
  }
})();
