/**
 * Central configuration for the AI Self-Healing framework.
 * All settings are driven by environment variables with sensible defaults.
 * Loads .env file from project root automatically.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

function loadAIConfig() {
  const enabled = process.env.AI_HEALING_ENABLED === 'true';

  return {
    enabled,
    openaiApiKey: process.env.OPENAI_API_KEY || '',

    // Models
    healingModel: process.env.AI_HEALING_MODEL || 'gpt-4o-mini',
    analysisModel: process.env.AI_ANALYSIS_MODEL || 'gpt-4o',

    // Feature flags (only active when master switch is on)
    locatorHealing: enabled && process.env.AI_HEALING_LOCATOR !== 'false',
    failureAnalysis: enabled && process.env.AI_HEALING_ANALYSIS !== 'false',
    testCaseHealing: enabled && process.env.AI_HEALING_TEST_CASE === 'true',

    // Healing parameters
    maxRetries: parseInt(process.env.AI_HEALING_MAX_RETRIES || '3', 10),
    confidenceThreshold: parseFloat(process.env.AI_HEALING_CONFIDENCE_THRESHOLD || '0.7'),

    // Timeouts (ms)
    openaiTimeout: parseInt(process.env.AI_OPENAI_TIMEOUT || '30000', 10),

    // DOM extraction limits (characters)
    maxDomLength: parseInt(process.env.AI_MAX_DOM_LENGTH || '60000', 10),

    // Metrics tracking
    metricsEnabled: process.env.AI_METRICS_ENABLED !== 'false',

    // Audit trail
    auditEnabled: enabled && process.env.AI_AUDIT_ENABLED !== 'false',

    // RAG (Retrieval Augmented Generation)
    ragEnabled: enabled && process.env.AI_RAG_ENABLED === 'true',
    embeddingModel: process.env.AI_EMBEDDING_MODEL || 'text-embedding-3-small',

    // Lifecycle orchestration
    lifecycleEnabled: enabled && process.env.AI_LIFECYCLE_ENABLED === 'true',

    // Exploratory test generation
    explorationEnabled: enabled && process.env.AI_EXPLORATION_ENABLED === 'true',
  };
}

module.exports = { loadAIConfig };
