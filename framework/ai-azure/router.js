/**
 * Provider-aware AI client router (PARALLEL to framework/ai/core/ai-client-factory.js).
 *
 * Reads the AI_PROVIDER env var and returns the correct client implementation:
 *   AI_PROVIDER=azure   -> framework/ai-azure (Anthropic passthrough on Azure)
 *   AI_PROVIDER=openai  -> framework/ai (original OpenAI client)  [default]
 *   (anything else)     -> original OpenAI client (safe fallback)
 *
 * Public API is intentionally identical to the original factory so agents can
 * swap requires with a single line change later:
 *
 *   // OLD: const { createAIClient } = require('../core/ai-client-factory');
 *   // NEW: const { createAIClient } = require('../../ai-azure/router');
 *
 * No existing files are modified by adding this router. It is opt-in.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { createAIClient: createOpenAIClient } = require('../ai/core/ai-client-factory');
const { AzureAIClient } = require('./core/azure-ai-client');
const { loadAzureAIConfig, validateAzureAIConfig } = require('./config/ai.azure.config');

function getActiveProvider() {
  const raw = (process.env.AI_PROVIDER || 'openai').trim().toLowerCase();
  return raw === 'azure' ? 'azure' : 'openai';
}

/**
 * Create an AI client. Same signature as the original factory.
 * @param {object} [config] Optional config; merged over the env-loaded config
 *                          for the active provider.
 */
function createAIClient(config = {}) {
  const provider = getActiveProvider();

  if (provider === 'azure') {
    const azureCfg = { ...loadAzureAIConfig(), ...config };
    validateAzureAIConfig(azureCfg);
    return new AzureAIClient(azureCfg);
  }

  // Default: untouched original OpenAI path
  return createOpenAIClient(config);
}

module.exports = { createAIClient, getActiveProvider };
