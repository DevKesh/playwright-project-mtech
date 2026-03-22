/**
 * CLI: Explore a web application and generate Page Objects + Test Specs.
 *
 * Usage:
 *   npm run demo:explore                            (reads URL from test-data.config.js)
 *   npm run demo:explore -- --url https://example.com --maxPages 10 --maxDepth 3
 *
 * Outputs:
 *   framework/pages/generated/   — Generated Page Object files
 *   tests/generated/             — Generated test spec files
 *   ai-reports/exploration/      — Site map, flows, metadata
 */

const { loadAIConfig } = require('../config/ai.config');
const { createExplorationGraph } = require('../graph/exploration-graph');

// Load centralized test data config for defaults
let testDataConfig = {};
try {
  testDataConfig = require('../../config/test-data.config').testDataConfig;
} catch {
  // Config not created yet — CLI args are required
}

async function main() {
  // Parse CLI arguments (override config defaults)
  const args = process.argv.slice(2);
  let url = testDataConfig?.targetApp?.baseUrl || '';
  let maxPages = testDataConfig?.exploration?.maxPages || 10;
  let maxDepth = testDataConfig?.exploration?.maxDepth || 3;
  let autoLogin = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) {
      url = args[++i];
    } else if (args[i] === '--maxPages' && args[i + 1]) {
      maxPages = parseInt(args[++i], 10);
    } else if (args[i] === '--maxDepth' && args[i + 1]) {
      maxDepth = parseInt(args[++i], 10);
    } else if (args[i] === '--login') {
      autoLogin = true;
    } else if (!args[i].startsWith('--') && !url) {
      url = args[i]; // Positional URL argument
    }
  }

  if (!url) {
    console.error('No URL specified. Either:');
    console.error('  1. Create framework/config/test-data.config.js with targetApp.baseUrl');
    console.error('  2. Pass --url <URL> as a CLI argument');
    console.error('');
    console.error('Usage: node framework/ai/scripts/explore-and-generate.js [--url <URL>] [--maxPages N] [--maxDepth N]');
    process.exit(1);
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    console.error(`Invalid URL: ${url}`);
    process.exit(1);
  }

  // Load config
  const config = loadAIConfig();
  if (!config.openaiApiKey) {
    console.error('OPENAI_API_KEY not set. Add it to your .env file.');
    process.exit(1);
  }

  const configSource = testDataConfig?.targetApp?.baseUrl === url ? 'test-data.config.js' : 'CLI argument';

  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║   AI Exploratory Test Generation Agent              ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  URL:       ${url.substring(0, 42).padEnd(42)} ║`);
  console.log(`║  Source:    ${configSource.padEnd(42)} ║`);
  console.log(`║  Max Pages: ${String(maxPages).padEnd(42)} ║`);
  console.log(`║  Max Depth: ${String(maxDepth).padEnd(42)} ║`);
  console.log(`║  Auto-Login: ${String(autoLogin).padEnd(41)} ║`);
  console.log(`║  Model:     ${(config.analysisModel || 'gpt-4o').padEnd(42)} ║`);
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');

  try {
    const graph = createExplorationGraph(config);

    const result = await graph.invoke({
      startUrl: url,
      maxPages,
      maxDepth,
      autoLogin,
    });

    console.log('');
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║   Exploration Results                               ║');
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log(`║  Pages Discovered:    ${String(result.visitedPages?.length || 0).padEnd(32)} ║`);
    console.log(`║  Page Objects:        ${String(result.generatedPageObjects?.length || 0).padEnd(32)} ║`);
    console.log(`║  Test Specs:          ${String(result.generatedTestSpecs?.length || 0).padEnd(32)} ║`);
    console.log(`║  User Flows Found:    ${String(result.identifiedFlows?.length || 0).padEnd(32)} ║`);
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log('║  Output Locations:                                  ║');
    console.log('║    Page Objects → framework/pages/generated/        ║');
    console.log('║    Test Specs  → tests/generated/                   ║');
    console.log('║    Reports     → ai-reports/exploration/            ║');
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log('║  Next Steps:                                       ║');
    console.log('║    npm run demo:test:headed  (run tests visually)  ║');
    console.log('║    npm run demo:report       (generate Allure)     ║');
    console.log('╚══════════════════════════════════════════════════════╝');

    if (result.errors && result.errors.length > 0) {
      console.log(`\nWarnings: ${result.errors.length} error(s) during exploration:`);
      for (const err of result.errors) {
        console.log(`  - [${err.phase}] ${err.url || ''}: ${err.error}`);
      }
    }
  } catch (err) {
    console.error(`\nExploration failed: ${err.message}`);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

main();
