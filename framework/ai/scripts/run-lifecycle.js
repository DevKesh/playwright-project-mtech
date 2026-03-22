#!/usr/bin/env node

/**
 * CLI Script: Run the 6-phase QA lifecycle orchestration.
 *
 * Usage:
 *   node framework/ai/scripts/run-lifecycle.js --phase pre    (phases 1-3: Discovery, Strategy, Pre-Execution)
 *   node framework/ai/scripts/run-lifecycle.js --phase post   (phase 6: Synthesis)
 *   node framework/ai/scripts/run-lifecycle.js --phase full   (all phases: 1-3, then 6)
 *
 * The full lifecycle (npm run ai:lifecycle:full) runs:
 *   1. Pre-execution phases (1-3)
 *   2. npx playwright test (with AI healing)
 *   3. Post-execution synthesis (phase 6)
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const { loadAIConfig } = require('../config/ai.config');
const { createLifecycleGraph } = require('../graph/lifecycle-graph');

async function main() {
  // Parse --phase argument
  let mode = 'full';
  const phaseIdx = process.argv.indexOf('--phase');
  if (phaseIdx !== -1 && process.argv[phaseIdx + 1]) {
    mode = process.argv[phaseIdx + 1];
  }

  if (!['pre', 'post', 'full'].includes(mode)) {
    console.error(`Invalid phase: "${mode}". Use: pre, post, or full`);
    process.exit(1);
  }

  console.log(`\n=== AI QA Lifecycle Orchestration (mode: ${mode}) ===\n`);
  console.log('Phases:');
  if (mode === 'pre' || mode === 'full') {
    console.log('  1. Discovery — scan codebase, catalog components');
    console.log('  2. Strategy — AI risk analysis, prioritize actions');
    console.log('  3. Pre-Execution — proactive drift detection');
  }
  if (mode === 'full') {
    console.log('  4. Execution — [external: npx playwright test]');
    console.log('  5. Post-Mortem — [external: healing graph via reporter]');
  }
  if (mode === 'post' || mode === 'full') {
    console.log('  6. Synthesis — aggregate metrics, update knowledge base');
  }
  console.log('');

  const config = loadAIConfig();
  // Override enabled for lifecycle scripts
  config.enabled = true;

  if (!config.openaiApiKey) {
    console.error('ERROR: OPENAI_API_KEY is required. Set it in .env');
    process.exit(1);
  }

  // Create and invoke the lifecycle graph
  const graph = createLifecycleGraph(config);
  const result = await graph.invoke({ mode });

  // Print summary
  console.log('\n=== Lifecycle Summary ===\n');

  if (result.pageObjects && result.pageObjects.length > 0) {
    console.log(`Discovery: ${result.pageObjects.length} page objects, ${(result.testSpecs || []).length} tests`);
  }

  if (result.riskAssessment && result.riskAssessment.length > 0) {
    console.log(`Strategy: ${result.riskAssessment.length} components assessed`);
    for (const ra of result.riskAssessment.slice(0, 3)) {
      console.log(`  - ${ra.pageObject}: risk ${ra.riskScore}/100`);
    }
  }

  if (result.preExecutionComplete) {
    console.log(`Pre-Execution: ${(result.driftReports || []).length} drift checks completed`);
  }

  if (result.synthesisReport) {
    const sr = result.synthesisReport;
    console.log(`Synthesis:`);
    console.log(`  Pass@1: ${((sr.metrics?.passAt1?.passRate || 0) * 100).toFixed(1)}%`);
    console.log(`  SHE: ${((sr.metrics?.she?.she || 0) * 100).toFixed(1)}%`);
    console.log(`  Data: ${sr.dataSources?.healingEvents || 0} heals, ${sr.dataSources?.testRuns || 0} runs`);
    console.log(`  Knowledge base updated: ${sr.knowledgeBaseUpdated}`);
  }

  const errors = result.errors || [];
  if (errors.length > 0) {
    console.log(`\nWarnings/Errors: ${errors.length}`);
    for (const err of errors) {
      console.log(`  - [${err.phase}] ${err.error}`);
    }
  }

  console.log('\nReports saved to: ai-reports/lifecycle/');
}

main().catch(err => {
  console.error('Lifecycle orchestration failed:', err.message);
  process.exit(1);
});
