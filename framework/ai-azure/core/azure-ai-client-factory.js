/**
 * Drop-in factory PARALLEL to framework/ai/core/ai-client-factory.js.
 *
 * Usage (when you're ready to swap, in any agent file):
 *   // OLD: const { createAIClient } = require('../core/ai-client-factory');
 *   // NEW: const { createAIClient } = require('../../ai-azure/core/azure-ai-client-factory');
 *
 * Until you swap that one line, the existing framework is 100% untouched.
 */

const { AzureAIClient } = require('./azure-ai-client');
const { loadAzureAIConfig, validateAzureAIConfig } = require('../config/ai.azure.config');

/**
 * @param {object} [overrides] Optional partial config to merge over env-loaded config.
 * @returns {AzureAIClient}
 */
function createAIClient(overrides = {}) {
  const cfg = { ...loadAzureAIConfig(), ...overrides };
  validateAzureAIConfig(cfg);
  return new AzureAIClient(cfg);
}

module.exports = { createAIClient };
