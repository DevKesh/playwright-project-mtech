/**
 * CLI script: Review AI Healing Log
 *
 * Displays all AI healing events for developer review.
 * Shows what selectors were healed, confidence scores, and whether
 * the healing was successfully applied.
 *
 * Usage: node framework/ai/scripts/review-healing-log.js
 */

const { loadHealingLog } = require('../storage/healing-history');

function main() {
  const log = loadHealingLog();

  if (log.length === 0) {
    console.log('No healing events recorded yet.');
    console.log('Run tests with AI_HEALING_ENABLED=true to start collecting data.');
    return;
  }

  const applied = log.filter((e) => e.applied);
  const failed = log.filter((e) => !e.applied);

  console.log(`\n=== AI Healing Log (${log.length} events) ===`);
  console.log(`  Applied: ${applied.length} | Failed: ${failed.length}\n`);

  for (const entry of log) {
    const status = entry.applied ? 'APPLIED' : 'FAILED ';
    const time = entry.timestamp
      ? new Date(entry.timestamp).toLocaleString()
      : 'N/A';

    console.log(`[${status}] ${time}`);
    console.log(`  Test: ${entry.testTitle}`);
    console.log(`  Original: ${entry.originalSelector}`);
    console.log(`  Healed:   ${entry.healedSelector || 'N/A'}`);
    console.log(`  Confidence: ${entry.confidence}`);
    console.log(`  Explanation: ${entry.explanation}`);
    if (entry.analysis) {
      console.log(`  Analysis: ${entry.analysis}`);
    }
    console.log(`  Duration: ${entry.durationMs || 0}ms`);
    console.log('');
  }

  // Summary stats
  if (applied.length > 0) {
    const avgConfidence =
      applied.reduce((sum, e) => sum + (e.confidence || 0), 0) / applied.length;
    const avgDuration =
      applied.reduce((sum, e) => sum + (e.durationMs || 0), 0) / applied.length;
    console.log('--- Summary (applied healings) ---');
    console.log(`  Avg confidence: ${avgConfidence.toFixed(2)}`);
    console.log(`  Avg duration: ${Math.round(avgDuration)}ms`);

    // Group by original selector
    const bySelector = {};
    for (const e of applied) {
      bySelector[e.originalSelector] = bySelector[e.originalSelector] || [];
      bySelector[e.originalSelector].push(e.healedSelector);
    }
    console.log(`  Unique selectors healed: ${Object.keys(bySelector).length}`);
    console.log('');

    console.log('Consider updating these page objects with the healed selectors:');
    for (const [orig, healed] of Object.entries(bySelector)) {
      console.log(`  ${orig} → ${healed[healed.length - 1]}`);
    }
  }
}

main();
