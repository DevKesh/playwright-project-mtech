/**
 * Azure AI Foundry — Anthropic passthrough configuration.
 *
 * Self-contained; does NOT touch framework/ai/config/ai.config.js.
 *
 * Required env vars (in .env at project root):
 *   AZURE_ANTHROPIC_ENDPOINT   e.g. https://qa-01-media-ai-resource.services.ai.azure.com/anthropic/v1/messages
 *   AZURE_ANTHROPIC_API_KEY    the Azure resource key
 *   AZURE_ANTHROPIC_MODEL      e.g. claude-sonnet-4-5-2
 *
 * Optional:
 *   AZURE_ANTHROPIC_VERSION    Anthropic API version header, default 2023-06-01
 *   AZURE_ANTHROPIC_TIMEOUT    Request timeout in ms, default 60000
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

function loadAzureAIConfig() {
  // Trim and strip stray markdown link brackets in case the value was pasted as [url](url)
  const cleanUrl = (v) => {
    if (!v) return '';
    let s = String(v).trim();
    const md = s.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (md) s = md[2];
    return s.replace(/^<|>$/g, '');
  };

  const endpoint = cleanUrl(process.env.AZURE_ANTHROPIC_ENDPOINT);
  const apiKey = (process.env.AZURE_ANTHROPIC_API_KEY || '').trim();
  const model = (process.env.AZURE_ANTHROPIC_MODEL || '').trim();
  const anthropicVersion = (process.env.AZURE_ANTHROPIC_VERSION || '2023-06-01').trim();
  const timeout = parseInt(process.env.AZURE_ANTHROPIC_TIMEOUT || '60000', 10);

  return {
    endpoint,
    apiKey,
    model,
    anthropicVersion,
    timeout,

    // Shape-compatible aliases for any consumer that reads these names
    healingModel: model,
    analysisModel: model,
    openaiTimeout: timeout,
    metricsEnabled: false,
  };
}

function validateAzureAIConfig(cfg) {
  const missing = [];
  if (!cfg.endpoint) missing.push('AZURE_ANTHROPIC_ENDPOINT');
  if (!cfg.apiKey) missing.push('AZURE_ANTHROPIC_API_KEY');
  if (!cfg.model) missing.push('AZURE_ANTHROPIC_MODEL');
  if (missing.length) {
    throw new Error(
      `[ai-azure] Missing required env vars: ${missing.join(', ')}. ` +
      `Set them in .env at the project root.`
    );
  }
}

module.exports = { loadAzureAIConfig, validateAzureAIConfig };
