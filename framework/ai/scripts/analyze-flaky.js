/**
 * CLI script: Flaky Test Analysis
 *
 * Reads accumulated run history and identifies flaky tests using AI analysis.
 *
 * Prerequisites: Run the test suite at least 2-3 times with the AI reporter
 * active to build up run-history.json.
 *
 * Usage: node framework/ai/scripts/analyze-flaky.js
 * Requires: OPENAI_API_KEY environment variable
 */

const { FlakyTestAgent } = require('../agents/flaky-test.agent');
const { loadAIConfig } = require('../config/ai.config');
const { writeReport } = require('../storage/report-writer');

async function main() {
  const config = loadAIConfig();
  // Override: always enable for CLI scripts
  config.enabled = true;

  if (!config.openaiApiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is required.');
    process.exit(1);
  }

  console.log('=== AI Flaky Test Analysis ===\n');

  const agent = new FlakyTestAgent(config);
  const report = await agent.analyze();

  if (report.flakyTests && report.flakyTests.length > 0) {
    const filename = `flaky-${Date.now()}.json`;
    const filePath = writeReport('flaky-reports', filename, report);
    console.log(`Report saved: ${filePath}\n`);

    console.log(`Flaky tests detected (${report.flakyTests.length}):\n`);
    for (const test of report.flakyTests) {
      console.log(`  [${test.flakinessPct}% flaky] ${test.testTitle}`);
      console.log(`    Pattern: ${test.pattern}`);
      console.log(`    Diagnosis: ${test.diagnosis}`);
      console.log(`    Fix: ${test.suggestedFix}`);
      console.log('');
    }
  } else {
    console.log('No flaky tests detected.');
  }

  console.log(`Summary: ${report.summary}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
