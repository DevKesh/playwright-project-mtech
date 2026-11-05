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
 *   the OpenAI path is used. Unknown explicit providers are rejected.
 */

const { wrapWithLatencyTracking } = require('../metrics/latency-tracker');
const { getAIProvider, validateAIConfig } = require('../config/ai.config');

/**
 * Create an AIClient instance, optionally wrapped with latency tracking.
 * @param {object} config - AI config from ai.config.js
 * @returns {AIClient} A ready-to-use AI client.
 */
function createAIClient(config = {}) {
  const provider = getAIProvider(config.provider);

  if (provider === 'azure') {
    // Lazy-require so the original code path doesn't load the Azure module
    // unless explicitly opted in. Azure client exposes the same public API
    // (chatCompletionJSON / visionCompletionJSON) as AIClient.
    const { AzureAIClient } = require('../../ai-azure/core/azure-ai-client');
    const {
      loadAzureAIConfig,
      validateAzureAIConfig,
    } = require('../../ai-azure/config/ai.azure.config');

    const azureDefaults = loadAzureAIConfig();
    const azureCfg = { ...azureDefaults, ...config, provider };
    azureCfg.healingModel = azureCfg.model;
    azureCfg.analysisModel = azureCfg.model;
    azureCfg.openaiTimeout = azureCfg.timeout;
    validateAzureAIConfig(azureCfg);
    const azureClient = new AzureAIClient(azureCfg);

    if (azureCfg.metricsEnabled) {
      return wrapWithLatencyTracking(azureClient);
    }
    return azureClient;
  }

  validateAIConfig({ ...config, provider });
  const { AIClient } = require('./openai-client');
  const client = new AIClient(config);

  if (config.metricsEnabled) {
    return wrapWithLatencyTracking(client);
  }

  return client;
}

module.exports = { createAIClient };

