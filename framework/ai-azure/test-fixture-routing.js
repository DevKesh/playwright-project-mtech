/**
 * Reproduces EXACTLY what tc.ai.fixture.js does at module-load:
 *   1. require ai.config (loads dotenv internally)
 *   2. loadAIConfig()
 *   3. new LocatorHealerAgent(config)  -> calls createAIClient(config)
 *   4. Print which client class the healer actually got.
 *
 * If this says "AzureAIClient" you know the smoke run is correctly wired.
 * If it says "AIClient" the factory routing is broken in some way.
 *
 * Run: node framework/ai-azure/test-fixture-routing.js
 */

const { loadAIConfig } = require('../ai/config/ai.config');
const config = loadAIConfig();

console.log('--- Simulating tc.ai.fixture.js module load ---');
console.log('process.env.AI_PROVIDER          =', process.env.AI_PROVIDER);
console.log('process.env.AI_HEALING_ENABLED   =', process.env.AI_HEALING_ENABLED);
console.log('config.enabled                   =', config.enabled);
console.log('config.locatorHealing            =', config.locatorHealing);
console.log('config.openaiApiKey starts with  =', (config.openaiApiKey || '').slice(0, 8) + '...');
console.log('config.healingModel              =', config.healingModel);
console.log('config.analysisModel             =', config.analysisModel);
console.log('config.metricsEnabled            =', config.metricsEnabled);
console.log('');

const { LocatorHealerAgent } = require('../ai/agents/locator-healer.agent');
const agent = new LocatorHealerAgent(config);
console.log('Healer agent created. Inner AI client class =', agent.aiClient.constructor.name);
console.log('(If "AzureAIClient" -> routing is correct. If "AIClient" -> routing failed.)');
