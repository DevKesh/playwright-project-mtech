/**
 * AI Healing Reporter: a custom Playwright reporter that captures failure data
 * and triggers the LangGraph healing workflow for intelligent post-test analysis.
 *
 * Uses the HealingGraph to:
 * - Classify failures (locator, assertion, network, etc.)
 * - Route to the appropriate healing agent based on failure type
 * - Skip healing for infra issues (network errors, timeouts)
 * - Generate structured reports
 *
 * Enable by adding to playwright.config.js:
 *   reporter: [['html'], ['./framework/ai/reporters/ai-healing-reporter.js']]
 */

const { loadAIConfig } = require('../config/ai.config');
const { createHealingGraph } = require('../graph/healing-graph');
const { appendRunHistory } = require('../storage/healing-history');

class AIHealingReporter {
  constructor() {
    this.config = loadAIConfig();
    this.testResults = [];
    this.healingGraph = null;

    if (this.config.enabled && this.config.openaiApiKey) {
      try {
        this.healingGraph = createHealingGraph(this.config);
      } catch (err) {
        console.log(`[AI-REPORTER] Failed to create healing graph: ${err.message}`);
      }
    }
  }

  onBegin(config, suite) {
    if (this.config.enabled) {
      console.log('[AI-REPORTER] AI Healing Reporter active (LangGraph orchestration)');
    }
  }

  onTestBegin(test) {
    // Track when each test starts for duration calculation
  }

  async onTestEnd(test, result) {
    const testFile = test.location?.file || 'unknown';
    const testTitle = test.titlePath().join(' > ');

    // Collect result for run history
    this.testResults.push({
      testFile,
      testTitle,
      status: result.status,
      duration: result.duration,
      error: result.error?.message || null,
    });

    // Only analyze failures
    if (result.status !== 'failed') return;
    if (!this.healingGraph) return;

    // Extract screenshot path from attachments
    let screenshotPath = null;
    for (const attachment of result.attachments || []) {
      if (
        (attachment.name === 'screenshot' || attachment.name === 'failure-screenshot') &&
        attachment.path
      ) {
        screenshotPath = attachment.path;
        break;
      }
    }

    // Extract step names that were executed
    const steps = (result.steps || [])
      .filter((s) => s.category === 'test.step')
      .map((s) => `${s.title} [${s.error ? 'FAILED' : 'OK'}]`);

    // Run the healing graph — it handles classification, routing, and healing
    try {
      console.log(`[AI-REPORTER] Invoking healing graph for: ${testTitle}`);
      const graphResult = await this.healingGraph.invoke({
        testFile,
        testTitle,
        errorMessage: result.error?.message || 'Unknown error',
        errorStack: result.error?.stack || '',
        steps,
        screenshotPath,
      });

      console.log(
        `[AI-REPORTER] Graph complete: category=${graphResult.failureCategory}, decision=${graphResult.decision}`
      );
    } catch (err) {
      console.log(`[AI-REPORTER] Healing graph error: ${err.message}`);
    }
  }

  async onEnd(result) {
    if (!this.config.enabled) return;

    // Write run history for flaky analysis
    if (this.testResults.length > 0) {
      try {
        appendRunHistory({
          runId: `run-${Date.now()}`,
          overallStatus: result.status,
          tests: this.testResults,
        });
        console.log(`[AI-REPORTER] Run history updated (${this.testResults.length} tests)`);
      } catch (err) {
        console.log(`[AI-REPORTER] Failed to write run history: ${err.message}`);
      }
    }

    // Summary
    const failures = this.testResults.filter((t) => t.status === 'failed');
    if (failures.length > 0) {
      console.log(
        `[AI-REPORTER] ${failures.length} failure(s) processed via LangGraph. Reports in ai-reports/`
      );
    }
  }
}

module.exports = AIHealingReporter;
