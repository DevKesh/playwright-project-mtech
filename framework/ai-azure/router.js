/**
 * Provider-aware AI client router (PARALLEL to framework/ai/core/ai-client-factory.js).
 *
 * Reads the AI_PROVIDER env var and returns the correct client implementation:
 *   AI_PROVIDER=azure   -> framework/ai-azure (Anthropic passthrough on Azure)
 *   AI_PROVIDER=openai  -> framework/ai (original OpenAI client)  [default]
 *   (anything else)     -> configuration error
 *
 * Public API is intentionally identical to the original factory so agents can
 * swap requires with a single line change later:
 *
 *   // OLD: const { createAIClient } = require('../core/ai-client-factory');
 *   // NEW: const { createAIClient } = require('../../ai-azure/router');
 *
 * No existing files are modified by adding this router. It is opt-in.
 */

const { createAIClient } = require('../ai/core/ai-client-factory');
const { getAIProvider } = require('../ai/config/ai.config');

function getActiveProvider() {
  return getAIProvider();
}

module.exports = { createAIClient, getActiveProvider };
