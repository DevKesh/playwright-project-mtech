/**
 * AI Client Factory: creates AIClient instances with optional latency tracking.
 *
 * All agents should use this factory instead of directly constructing AIClient.
 * When metricsEnabled is true in config, calls are automatically timed and
 * logged to ai-reports/latency-log.json.
 */

const { AIClient } = require('./openai-client');
const { wrapWithLatencyTracking } = require('../metrics/latency-tracker');

/**
 * Create an AIClient instance, optionally wrapped with latency tracking.
 * @param {object} config - AI config from ai.config.js
 * @returns {AIClient} A ready-to-use AI client.
 */
function createAIClient(config) {
  const client = new AIClient(config);

  if (config.metricsEnabled) {
    return wrapWithLatencyTracking(client);
  }

  return client;
}

module.exports = { createAIClient };
