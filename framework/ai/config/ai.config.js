/**
 * Central configuration for the AI Self-Healing framework.
 * All settings are driven by environment variables with sensible defaults.
 * Environment loading occurs only when loadAIConfig() is called explicitly.
 */

const { loadEnvironment } = require('../../config/environment');

function getAIProvider(provider = process.env.AI_PROVIDER) {
  const selected = provider === undefined ? 'openai' : String(provider).trim().toLowerCase();
  if (!['openai', 'azure'].includes(selected)) {
    throw new Error('AI_PROVIDER must be openai or azure');
  }
  return selected;
}

function validateAIConfig(config) {
  const provider = getAIProvider(config.provider);
  if (provider === 'azure') {
    require('../../ai-azure/config/ai.azure.config').validateAzureAIConfig(config);
  } else if (!config.openaiApiKey?.trim()) {
    throw new Error('Missing required env var: OPENAI_API_KEY');
  }
}

function loadAIConfig() {
  loadEnvironment();
  const provider = getAIProvider();
  const enabled = process.env.AI_HEALING_ENABLED === 'true';

  const config = {
    provider,
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
    confidenceThreshold: parseFloat(process.env.AI_HEALING_CONFIDENCE_THRESHOLD || '0.5'),

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
  if (provider === 'azure') {
    const azure = require('../../ai-azure/config/ai.azure.config').loadAzureAIConfig();
    return { ...config, ...azure, metricsEnabled: config.metricsEnabled };
  }
  return config;
}

module.exports = { loadAIConfig, getAIProvider, validateAIConfig };
