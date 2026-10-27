/**
 * AI Client Factory: creates AIClient instances with optional latency tracking.
 *
 * All agents should use this factory instead of directly constructing AIClient.
 * When metricsEnabled is true in config, calls are automatically timed and
 * logged to ai-reports/latency-log.json.
 *
 * Provider selection:
 *   Set AI_PROVIDER=azure in .env to route ALL calls to the Azure AI Foundry
 *   Anthropic passthrough (see framework/ai-azure/). When AI_PROVIDER is unset
 *   or any other value, the original OpenAI path is used unchanged.
 */

const { AIClient } = require('./openai-client');
const { wrapWithLatencyTracking } = require('../metrics/latency-tracker');

/**
 * Create an AIClient instance, optionally wrapped with latency tracking.
 * @param {object} config - AI config from ai.config.js
 * @returns {AIClient} A ready-to-use AI client.
 */
function createAIClient(config) {
  const provider = (process.env.AI_PROVIDER || 'openai').trim().toLowerCase();

  if (provider === 'azure') {
    // Lazy-require so the original code path doesn't load the Azure module
    // unless explicitly opted in. Azure client exposes the same public API
    // (chatCompletionJSON / visionCompletionJSON) as AIClient.
    const { AzureAIClient } = require('../../ai-azure/core/azure-ai-client');
    const {
      loadAzureAIConfig,
      validateAzureAIConfig,
    } = require('../../ai-azure/config/ai.azure.config');

    const azureCfg = { ...loadAzureAIConfig(), ...(config || {}) };
    validateAzureAIConfig(azureCfg);
    const azureClient = new AzureAIClient(azureCfg);

    if (azureCfg.metricsEnabled) {
      return wrapWithLatencyTracking(azureClient);
    }
    return azureClient;
  }

  const client = new AIClient(config);

  if (config.metricsEnabled) {
    return wrapWithLatencyTracking(client);
  }

  return client;
}

module.exports = { createAIClient };

