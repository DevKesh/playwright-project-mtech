/**
 * Reports the provider selected by explicit createHealer() initialization.
 * Does not prove live smoke integration or make a provider request.
 *
 * Run: node framework/ai-azure/test-fixture-routing.js
 */

if (require.main === module) {
	const { createHealer } = require('../ai/fixtures/tc.ai.fixture');
	const healing = createHealer();
	console.log(healing ? `Selected provider: ${healing.config.provider}` : 'Healing disabled');
}
