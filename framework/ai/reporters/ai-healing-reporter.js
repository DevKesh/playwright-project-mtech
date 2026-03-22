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
 * Also records audit trail events for full traceability (Objective 4).
 *
 * Enable by adding to playwright.config.js:
 *   reporter: [['html'], ['./framework/ai/reporters/ai-healing-reporter.js']]
 */

const { loadAIConfig } = require('../config/ai.config');
const { createHealingGraph } = require('../graph/healing-graph');
const { appendRunHistory } = require('../storage/healing-history');
const { AuditTrail } = require('../audit/audit-trail');

class AIHealingReporter {
  constructor() {
    this.config = loadAIConfig();
    this.testResults = [];
    this.healingGraph = null;
    this.auditTrail = new AuditTrail();
    this.runId = this.auditTrail.generateRunId();

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

      // Record run start in audit trail
      if (this.config.auditEnabled) {
        this.auditTrail.record({
          type: 'run_start',
          runId: this.runId,
          data: { totalTests: suite?.allTests?.().length || 0 },
        });
      }
    }
  }

  onTestBegin(test) {
    // Record test start in audit trail
    if (this.config.auditEnabled) {
      this.auditTrail.record({
        type: 'test_start',
        runId: this.runId,
        testFile: test.location?.file || 'unknown',
        testTitle: test.titlePath().join(' > '),
      });
    }
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

    // Record failure in audit trail
    let failureAuditId = null;
    let correlationId = null;
    if (this.config.auditEnabled) {
      correlationId = this.auditTrail.generateFailureId(this.runId, testTitle);
      failureAuditId = this.auditTrail.record({
        type: 'test_fail',
        correlationId,
        runId: this.runId,
        testFile,
        testTitle,
        data: {
          errorMessage: result.error?.message || 'Unknown error',
          duration: result.duration,
        },
      });
    }

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

      // Record healing attempt in audit trail
      let healAuditId = null;
      if (this.config.auditEnabled) {
        healAuditId = this.auditTrail.record({
          type: 'healing_attempted',
          correlationId,
          runId: this.runId,
          testFile,
          testTitle,
          parentAuditId: failureAuditId,
        });
      }

      const graphResult = await this.healingGraph.invoke({
        testFile,
        testTitle,
        errorMessage: result.error?.message || 'Unknown error',
        errorStack: result.error?.stack || '',
        steps,
        screenshotPath,
        correlationId,
        runId: this.runId,
      });

      console.log(
        `[AI-REPORTER] Graph complete: category=${graphResult.failureCategory}, decision=${graphResult.decision}`
      );

      // Record healing outcome in audit trail
      if (this.config.auditEnabled) {
        const healed = graphResult.decision === 'healing_suggested';
        this.auditTrail.record({
          type: healed ? 'healing_succeeded' : 'healing_failed',
          correlationId,
          runId: this.runId,
          testFile,
          testTitle,
          parentAuditId: healAuditId,
          data: {
            failureCategory: graphResult.failureCategory,
            decision: graphResult.decision,
            confidence: graphResult.confidence,
          },
        });
      }
    } catch (err) {
      console.log(`[AI-REPORTER] Healing graph error: ${err.message}`);

      if (this.config.auditEnabled) {
        this.auditTrail.record({
          type: 'healing_failed',
          correlationId,
          runId: this.runId,
          testFile,
          testTitle,
          data: { error: err.message },
        });
      }
    }
  }

  async onEnd(result) {
    if (!this.config.enabled) return;

    // Write run history for flaky analysis
    if (this.testResults.length > 0) {
      try {
        appendRunHistory({
          runId: this.runId,
          overallStatus: result.status,
          tests: this.testResults,
        });
        console.log(`[AI-REPORTER] Run history updated (${this.testResults.length} tests)`);
      } catch (err) {
        console.log(`[AI-REPORTER] Failed to write run history: ${err.message}`);
      }
    }

    // Record run completion in audit trail
    if (this.config.auditEnabled) {
      const failures = this.testResults.filter((t) => t.status === 'failed');
      this.auditTrail.record({
        type: 'run_complete',
        runId: this.runId,
        data: {
          overallStatus: result.status,
          totalTests: this.testResults.length,
          failures: failures.length,
          passes: this.testResults.filter(t => t.status === 'passed').length,
        },
      });
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
