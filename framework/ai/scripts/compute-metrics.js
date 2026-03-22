#!/usr/bin/env node

/**
 * CLI Script: Compute AI self-healing reliability metrics.
 *
 * Reads healing-log.json, run-history.json, and latency-log.json
 * to compute Pass@k, Self-Healing Efficacy (SHE), latency stats,
 * and confidence threshold analysis.
 *
 * Usage:
 *   node framework/ai/scripts/compute-metrics.js
 *   node framework/ai/scripts/compute-metrics.js --json    (output raw JSON)
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const { MetricsEngine } = require('../metrics/metrics-engine');
const { loadHealingLog, loadRunHistory } = require('../storage/healing-history');
const { readLatencyLog } = require('../metrics/latency-tracker');
const { writeReport } = require('../storage/report-writer');

async function main() {
  const jsonMode = process.argv.includes('--json');

  console.log('=== AI Self-Healing Metrics Report ===\n');

  // Load data
  const healingLog = loadHealingLog();
  const runHistory = loadRunHistory();
  const latencyLog = readLatencyLog();

  console.log(`Data sources:`);
  console.log(`  Healing events: ${healingLog.length}`);
  console.log(`  Test runs:      ${runHistory.length}`);
  console.log(`  AI API calls:   ${latencyLog.length}`);
  console.log('');

  // Compute metrics
  const engine = new MetricsEngine();
  const metrics = engine.computeAll(healingLog, runHistory, latencyLog);

  if (jsonMode) {
    console.log(JSON.stringify(metrics, null, 2));
  } else {
    // Pass@k
    console.log('--- Pass@k (Healing Success Rate) ---');
    console.log(`  Pass@1: ${(metrics.passAt1.passRate * 100).toFixed(1)}% (${metrics.passAt1.successfulSessions}/${metrics.passAt1.totalSessions} sessions)`);
    console.log(`  Pass@2: ${(metrics.passAt2.passRate * 100).toFixed(1)}% (${metrics.passAt2.successfulSessions}/${metrics.passAt2.totalSessions} sessions)`);
    console.log(`  Pass@3: ${(metrics.passAt3.passRate * 100).toFixed(1)}% (${metrics.passAt3.successfulSessions}/${metrics.passAt3.totalSessions} sessions)`);
    console.log('');

    // SHE
    const she = metrics.selfHealingEfficacy;
    console.log('--- Self-Healing Efficacy (SHE) ---');
    console.log(`  SHE:                ${(she.she * 100).toFixed(1)}%`);
    console.log(`  Heal success rate:  ${(she.healSuccessRate * 100).toFixed(1)}%`);
    console.log(`  Total heals:        ${she.totalHeals} successful / ${she.totalAttempts} attempted`);
    console.log(`  Total test failures: ${she.totalFailures}`);
    console.log('');

    // Latency
    const lat = metrics.latency;
    console.log('--- AI Inference Latency ---');
    console.log(`  Total API calls:  ${lat.totalCalls}`);
    console.log(`  Mean:             ${lat.mean}ms`);
    console.log(`  Median:           ${lat.median}ms`);
    console.log(`  P95:              ${lat.p95}ms`);
    console.log(`  P99:              ${lat.p99}ms`);
    console.log(`  Min/Max:          ${lat.min}ms / ${lat.max}ms`);
    if (lat.byMethod) {
      for (const [method, stats] of Object.entries(lat.byMethod)) {
        console.log(`  ${method}: ${stats.totalCalls} calls, avg ${stats.avgMs}ms`);
      }
    }
    console.log('');

    // Confidence analysis
    if (metrics.confidenceAnalysis.length > 0) {
      console.log('--- Confidence Threshold Analysis ---');
      console.log('  Threshold | Accepted | Success Rate | Missed Opportunities');
      console.log('  ----------|----------|--------------|---------------------');
      for (const ca of metrics.confidenceAnalysis) {
        console.log(`  ${ca.threshold.toFixed(1)}       | ${String(ca.acceptedCount).padStart(8)} | ${(ca.acceptedSuccessRate * 100).toFixed(1).padStart(11)}% | ${ca.missedOpportunities}`);
      }
      console.log('');
    }
  }

  // Save metrics report
  const filename = `metrics-${Date.now()}.json`;
  const filePath = writeReport('metrics', filename, metrics);
  console.log(`Metrics report saved to: ${filePath}`);
}

main().catch(err => {
  console.error('Failed to compute metrics:', err.message);
  process.exit(1);
});
