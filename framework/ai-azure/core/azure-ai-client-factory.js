/**
 * Drop-in factory PARALLEL to framework/ai/core/ai-client-factory.js.
 *
 * Usage (when you're ready to swap, in any agent file):
 *   // OLD: const { createAIClient } = require('../core/ai-client-factory');
 *   // NEW: const { createAIClient } = require('../../ai-azure/core/azure-ai-client-factory');
 *
 * Until you swap that one line, the existing framework is 100% untouched.
 */

const { createAIClient: createProviderClient } = require('../../ai/core/ai-client-factory');

/**
 * @param {object} [overrides] Optional partial config to merge over env-loaded config.
 * @returns {AzureAIClient}
 */
function createAIClient(overrides = {}) {
  return createProviderClient({ ...overrides, provider: 'azure' });
}

module.exports = { createAIClient };
