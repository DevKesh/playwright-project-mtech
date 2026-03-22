#!/usr/bin/env node

/**
 * CLI Script: Generate an audit report with full traceability and provenance.
 *
 * Usage:
 *   node framework/ai/scripts/generate-audit-report.js
 *   node framework/ai/scripts/generate-audit-report.js --runId run-1234567890
 *   node framework/ai/scripts/generate-audit-report.js --json
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const { AuditReportGenerator } = require('../audit/audit-report-generator');

async function main() {
  const jsonMode = process.argv.includes('--json');

  // Parse --runId argument
  let runId = null;
  const runIdIdx = process.argv.indexOf('--runId');
  if (runIdIdx !== -1 && process.argv[runIdIdx + 1]) {
    runId = process.argv[runIdIdx + 1];
  }

  console.log('=== AI Self-Healing Audit Report ===\n');

  const generator = new AuditReportGenerator();
  const report = await generator.generateRunReport({ runId });

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  // Formatted output
  console.log(`Run ID: ${report.runId}`);
  console.log(`Generated: ${report.generatedAt}`);
  console.log('');

  // Audit summary
  console.log('--- Audit Trail Summary ---');
  console.log(`  Total audit events: ${report.auditSummary.totalAuditEvents}`);
  console.log(`  Failure correlations: ${report.auditSummary.failureCorrelations}`);
  if (Object.keys(report.auditSummary.eventTypes).length > 0) {
    console.log('  Event types:');
    for (const [type, count] of Object.entries(report.auditSummary.eventTypes)) {
      console.log(`    ${type}: ${count}`);
    }
  }
  console.log('');

  // Traceability
  const trace = report.traceability;
  console.log('--- Traceability Matrix ---');
  console.log(`  Total requirements: ${trace.summary.totalRequirements}`);
  console.log(`  Passed:  ${trace.summary.passedRequirements}`);
  console.log(`  Failed:  ${trace.summary.failedRequirements}`);
  console.log(`  Coverage: ${trace.summary.coverageRate}%`);
  console.log(`  Total tests mapped: ${trace.summary.totalTests}`);
  console.log('');

  if (trace.requirements.length > 0) {
    for (const req of trace.requirements) {
      const status = req.status === 'passed' ? '[PASS]' : req.status === 'failed' ? '[FAIL]' : '[----]';
      console.log(`  ${status} [${req.type}] ${req.name} (${req.testCount || req.tests.length} tests)`);
    }
    console.log('');
  }

  // Metrics snapshot
  console.log('--- Metrics Snapshot ---');
  console.log(`  Pass@1: ${(report.metrics.passAt1.passRate * 100).toFixed(1)}%`);
  console.log(`  SHE:    ${(report.metrics.selfHealingEfficacy.she * 100).toFixed(1)}%`);
  console.log(`  Latency (mean): ${report.metrics.latency.mean}ms`);
  console.log(`  AI calls: ${report.metrics.latency.totalCalls}`);
  console.log('');

  // Healing provenance
  if (report.healingProvenance.length > 0) {
    console.log('--- Healing Provenance Chains ---');
    for (const chain of report.healingProvenance) {
      console.log(`  Chain for ${chain.event.testTitle || 'unknown'}:`);
      for (const event of chain.provenance) {
        console.log(`    → [${event.type}] ${event.timestamp} (${event.auditId.substring(0, 12)}...)`);
      }
    }
    console.log('');
  }

  console.log(`Report saved to: ${report._savedTo}`);
}

main().catch(err => {
  console.error('Failed to generate audit report:', err.message);
  process.exit(1);
});
