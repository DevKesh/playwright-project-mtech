/**
 * AI Healing Reporter: a custom Playwright reporter that captures failure data
 * and triggers the LangGraph healing workflow for intelligent post-test analysis.
 *
 * Uses the HealingGraph to:
 * - Classify failures (locator, assertion, network, etc.)
 * - Route to the appropriate healing agent based on failure type
 * - Skip healing for infra issues (network errors, timeouts)
 * - Generate structured reports
 * - Inject healing evidence directly into Allure result files
 *
 * Also records audit trail events for full traceability (Objective 4).
 *
 * Enable by adding to playwright.config.js:
 *   reporter: [['html'], ['./framework/ai/reporters/ai-healing-reporter.js']]
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadAIConfig } = require('../config/ai.config');
const { createHealingGraph } = require('../graph/healing-graph');
const { appendRunHistory } = require('../storage/healing-history');
const { AuditTrail } = require('../audit/audit-trail');

class AIHealingReporter {
  constructor() {
    this.config = loadAIConfig();
    this.testResults = [];
    this.healedTests = [];
    this.healingGraph = null;
    this._pendingHealings = [];
    this.auditTrail = new AuditTrail();
    this.runId = this.auditTrail.generateRunId();
    this.allureResultsDir = path.join(process.cwd(), 'allure-results');

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

    // Run the healing graph asynchronously — track the promise so onEnd() can await it
    const healingPromise = this._runHealing({
      testFile,
      testTitle,
      errorMessage: result.error?.message || 'Unknown error',
      errorStack: result.error?.stack || '',
      steps,
      screenshotPath,
      correlationId,
      failureAuditId,
    });
    this._pendingHealings.push(healingPromise);
  }

  async _runHealing({ testFile, testTitle, errorMessage, errorStack, steps, screenshotPath, correlationId, failureAuditId }) {
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
        errorMessage,
        errorStack,
        steps,
        screenshotPath,
        correlationId,
        runId: this.runId,
      });

      console.log(
        `[AI-REPORTER] Graph complete: category=${graphResult.failureCategory}, decision=${graphResult.decision}`
      );

      // Store healing data for Allure injection
      if (graphResult.decision === 'healing_suggested') {
        this.healedTests.push({
          testTitle,
          testFile,
          failureCategory: graphResult.failureCategory,
          decision: graphResult.decision,
          classificationConfidence: graphResult.confidence,
          failureAnalysis: graphResult.failureAnalysis,
          testCaseHealResult: graphResult.testCaseHealResult,
          correlationId,
          runId: this.runId,
          timestamp: new Date().toISOString(),
        });
      }

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

    // Wait for all pending healing graph invocations to finish
    if (this._pendingHealings.length > 0) {
      console.log(`[AI-REPORTER] Waiting for ${this._pendingHealings.length} healing graph(s) to complete...`);
      await Promise.allSettled(this._pendingHealings);
    }

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
          passes: this.testResults.filter((t) => t.status === 'passed').length,
        },
      });
    }

    // Inject healing evidence into Allure results
    if (this.healedTests.length > 0) {
      try {
        this._injectHealingIntoAllure();
        this._updateAllureCategories();
        console.log(
          `[AI-REPORTER] Injected healing evidence into ${this.healedTests.length} Allure result(s)`
        );
      } catch (err) {
        console.log(`[AI-REPORTER] Failed to inject healing into Allure: ${err.message}`);
      }
    }

    // Always update environment with healing stats
    try {
      this._updateAllureEnvironment();
    } catch (err) {
      console.log(`[AI-REPORTER] Failed to update Allure environment: ${err.message}`);
    }

    // Summary
    const failures = this.testResults.filter((t) => t.status === 'failed');
    if (failures.length > 0) {
      console.log(
        `[AI-REPORTER] ${failures.length} failure(s) processed via LangGraph. Reports in ai-reports/`
      );
    }
  }

  /**
   * Post-process allure-results/ to inject healing evidence into result JSON files.
   * For each healed test, finds the matching *-result.json, adds a healing step
   * with a markdown attachment, and adds self-healed tags.
   */
  _injectHealingIntoAllure() {
    if (!fs.existsSync(this.allureResultsDir)) return;

    const resultFiles = fs
      .readdirSync(this.allureResultsDir)
      .filter((f) => f.endsWith('-result.json'));

    for (const healedTest of this.healedTests) {
      // Extract the clean test name from the full title path
      // testTitle = " > tc-smoke > file.spec.js > describe block > TC04 - ..."
      // Allure result name = "TC04 - ..."
      const testNameParts = healedTest.testTitle.split(' > ');
      const cleanTestName = testNameParts[testNameParts.length - 1].trim();

      for (const file of resultFiles) {
        try {
          const filePath = path.join(this.allureResultsDir, file);
          const resultJson = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

          // Match by test name
          if (resultJson.name !== cleanTestName) continue;

          // Generate the healing evidence markdown
          const markdown = this._buildHealingMarkdown(healedTest);

          // Write the markdown attachment file
          const attachUuid = crypto.randomUUID();
          const attachFileName = `${attachUuid}-attachment.md`;
          fs.writeFileSync(path.join(this.allureResultsDir, attachFileName), markdown, 'utf-8');

          // Write the healing JSON data as a separate attachment
          const jsonAttachUuid = crypto.randomUUID();
          const jsonAttachFileName = `${jsonAttachUuid}-attachment.json`;
          const healingData = {
            failureCategory: healedTest.failureCategory,
            classificationConfidence: healedTest.classificationConfidence,
            decision: healedTest.decision,
            rootCause: healedTest.failureAnalysis?.rootCause || 'N/A',
            affectedLocator: healedTest.failureAnalysis?.affectedLocator || 'N/A',
            suggestedChanges: healedTest.testCaseHealResult?.suggestedChanges || [],
            healingConfidence: healedTest.testCaseHealResult?.confidence || 0,
            correlationId: healedTest.correlationId,
            runId: healedTest.runId,
            timestamp: healedTest.timestamp,
          };
          fs.writeFileSync(
            path.join(this.allureResultsDir, jsonAttachFileName),
            JSON.stringify(healingData, null, 2),
            'utf-8'
          );

          // Add a pseudo-step "AI Self-Healing Analysis" with the attachments
          const now = Date.now();
          const healingStep = {
            statusDetails: {},
            stage: 'finished',
            steps: [],
            attachments: [
              {
                name: 'AI Self-Healing Report',
                source: attachFileName,
                type: 'text/markdown',
              },
              {
                name: 'Healing Data (JSON)',
                source: jsonAttachFileName,
                type: 'application/json',
              },
            ],
            parameters: [],
            start: now,
            name: `AI Self-Healing: ${healedTest.failureCategory} (confidence: ${(healedTest.classificationConfidence * 100).toFixed(0)}%)`,
            stop: now,
          };

          // Insert the healing step before "After Hooks" (or at the end)
          const afterHooksIdx = resultJson.steps.findIndex(
            (s) => s.name === 'After Hooks'
          );
          if (afterHooksIdx >= 0) {
            resultJson.steps.splice(afterHooksIdx, 0, healingStep);
          } else {
            resultJson.steps.push(healingStep);
          }

          // Add self-healed labels/tags
          resultJson.labels.push({ name: 'tag', value: 'self-healed' });
          resultJson.labels.push({ name: 'tag', value: 'ai-healing' });
          resultJson.labels.push({
            name: 'tag',
            value: `healed:${healedTest.failureCategory}`,
          });

          // Prefix the test name so it's immediately visible in the test list
          resultJson.name = `[AI-INTERVENTION] ${resultJson.name}`;

          // Set descriptionHtml so the healing report renders prominently
          // at the top of the test detail page in Allure
          resultJson.descriptionHtml = this._buildHealingHtml(healedTest);

          // Write modified result back
          fs.writeFileSync(filePath, JSON.stringify(resultJson), 'utf-8');

          console.log(
            `[AI-REPORTER] Allure: Injected healing evidence for "${cleanTestName}" -> ${file}`
          );
          break; // Found the matching result file for this healed test
        } catch (err) {
          // Skip malformed result files
          continue;
        }
      }
    }
  }

  /**
   * Build a human-readable Markdown report for the Allure attachment.
   */
  _buildHealingMarkdown(healedTest) {
    const fa = healedTest.failureAnalysis || {};
    const heal = healedTest.testCaseHealResult || {};
    const changes = heal.suggestedChanges || [];

    let md = `# AI Self-Healing Report\n\n`;
    md += `> This test failure was automatically analyzed and a fix was suggested by the AI Self-Healing Agent.\n\n`;

    // Classification table
    md += `## Failure Classification\n\n`;
    md += `| Field | Value |\n`;
    md += `|-------|-------|\n`;
    md += `| **Category** | \`${healedTest.failureCategory}\` |\n`;
    md += `| **Classification Confidence** | ${(healedTest.classificationConfidence * 100).toFixed(0)}% |\n`;
    md += `| **Severity** | ${fa.severity || 'N/A'} |\n`;
    md += `| **Decision** | \`${healedTest.decision}\` |\n`;
    md += `| **Healing Confidence** | ${heal.confidence ? (heal.confidence * 100).toFixed(0) + '%' : 'N/A'} |\n\n`;

    // Root cause
    md += `## Root Cause Analysis\n\n`;
    md += `${fa.rootCause || 'Not available'}\n\n`;
    if (fa.explanation) {
      md += `**Detailed Explanation:** ${fa.explanation}\n\n`;
    }

    // Affected locator
    if (fa.affectedLocator) {
      md += `## Affected Locator\n\n`;
      md += `\`\`\`\n${fa.affectedLocator}\n\`\`\`\n\n`;
    }

    // Suggested changes
    if (changes.length > 0) {
      md += `## Suggested Fix\n\n`;
      md += `${heal.analysis || ''}\n\n`;

      for (const change of changes) {
        md += `### File: \`${change.file}\`\n`;
        if (change.lineRange) {
          md += `**Lines:** ${change.lineRange}\n\n`;
        }
        md += `**Current Code:**\n\`\`\`javascript\n${change.currentCode}\n\`\`\`\n\n`;
        md += `**Suggested Code:**\n\`\`\`javascript\n${change.suggestedCode}\n\`\`\`\n\n`;
        md += `**Reason:** ${change.explanation}\n\n`;
      }
    }

    // Audit trail reference
    md += `## Audit Trail\n\n`;
    md += `| Field | Value |\n`;
    md += `|-------|-------|\n`;
    md += `| **Run ID** | \`${healedTest.runId}\` |\n`;
    md += `| **Correlation ID** | \`${healedTest.correlationId || 'N/A'}\` |\n`;
    md += `| **Timestamp** | ${new Date(healedTest.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })} IST |\n`;
    md += `| **Change Type** | \`${heal.changeType || 'N/A'}\` |\n\n`;

    return md;
  }

  /**
   * Build a prominent HTML report that renders at the top of the test detail page.
   */
  _buildHealingHtml(healedTest) {
    const fa = healedTest.failureAnalysis || {};
    const heal = healedTest.testCaseHealResult || {};
    const changes = heal.suggestedChanges || [];
    const classConf = (healedTest.classificationConfidence * 100).toFixed(0);
    const healConf = heal.confidence ? (heal.confidence * 100).toFixed(0) : 'N/A';

    let html = `
<div style="border:2px solid #e74c3c; border-radius:8px; padding:16px; margin-bottom:16px; background:#fdf2f2;">
  <h2 style="color:#e74c3c; margin-top:0;">AI Self-Healing Report</h2>
  <p style="color:#555;">This test failure was <strong>automatically diagnosed</strong> by the AI Self-Healing Agent (LangGraph + GPT-4o).</p>
  <table style="width:100%; border-collapse:collapse; margin:12px 0;">
    <tr style="background:#f8d7da;"><td style="padding:6px; border:1px solid #ddd;"><strong>Category</strong></td><td style="padding:6px; border:1px solid #ddd;"><code>${healedTest.failureCategory}</code></td></tr>
    <tr><td style="padding:6px; border:1px solid #ddd;"><strong>Classification Confidence</strong></td><td style="padding:6px; border:1px solid #ddd;">${classConf}%</td></tr>
    <tr style="background:#f8d7da;"><td style="padding:6px; border:1px solid #ddd;"><strong>Healing Confidence</strong></td><td style="padding:6px; border:1px solid #ddd;">${healConf}%</td></tr>
    <tr><td style="padding:6px; border:1px solid #ddd;"><strong>Severity</strong></td><td style="padding:6px; border:1px solid #ddd;">${fa.severity || 'N/A'}</td></tr>
    <tr style="background:#f8d7da;"><td style="padding:6px; border:1px solid #ddd;"><strong>Decision</strong></td><td style="padding:6px; border:1px solid #ddd;"><code>${healedTest.decision}</code></td></tr>
  </table>
</div>

<div style="border:2px solid #3498db; border-radius:8px; padding:16px; margin-bottom:16px; background:#eaf4fd;">
  <h3 style="color:#2980b9; margin-top:0;">Root Cause</h3>
  <p>${fa.rootCause || 'Not available'}</p>
  ${fa.affectedLocator ? `<p><strong>Broken Locator:</strong> <code style="background:#fce4ec; padding:2px 6px; border-radius:3px;">${fa.affectedLocator}</code></p>` : ''}
</div>`;

    if (changes.length > 0) {
      html += `
<div style="border:2px solid #27ae60; border-radius:8px; padding:16px; margin-bottom:16px; background:#eafaf1;">
  <h3 style="color:#27ae60; margin-top:0;">Suggested Fix</h3>
  <p>${heal.analysis || ''}</p>`;

      for (const change of changes) {
        html += `
  <div style="background:#fff; border:1px solid #ccc; border-radius:4px; padding:12px; margin:8px 0;">
    <p><strong>File:</strong> <code>${change.file}</code>${change.lineRange ? ` (Lines: ${change.lineRange})` : ''}</p>
    <p style="color:#c0392b;"><strong>Current (broken):</strong></p>
    <pre style="background:#fdf2f2; padding:8px; border-radius:4px; overflow-x:auto;">${change.currentCode}</pre>
    <p style="color:#27ae60;"><strong>Suggested (fixed):</strong></p>
    <pre style="background:#eafaf1; padding:8px; border-radius:4px; overflow-x:auto;">${change.suggestedCode}</pre>
    <p><em>${change.explanation}</em></p>
  </div>`;
      }
      html += `</div>`;
    }

    const istTimestamp = new Date(healedTest.timestamp).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', second: '2-digit',
      hour12: true,
    });

    html += `
<div style="border:2px solid #8e44ad; border-radius:8px; padding:16px; background:#f5eef8;">
  <h3 style="color:#8e44ad; margin-top:0;">Audit Trail</h3>
  <table style="width:100%; border-collapse:collapse;">
    <tr><td style="padding:4px; border:1px solid #ddd;"><strong>Run ID</strong></td><td style="padding:4px; border:1px solid #ddd;"><code>${healedTest.runId}</code></td></tr>
    <tr><td style="padding:4px; border:1px solid #ddd;"><strong>Correlation ID</strong></td><td style="padding:4px; border:1px solid #ddd;"><code>${healedTest.correlationId || 'N/A'}</code></td></tr>
    <tr><td style="padding:4px; border:1px solid #ddd;"><strong>Timestamp</strong></td><td style="padding:4px; border:1px solid #ddd;">${istTimestamp} IST</td></tr>
  </table>
</div>`;

    return html;
  }

  /**
   * Add a "Self-Healed (AI)" category to allure-results/categories.json.
   */
  _updateAllureCategories() {
    const catPath = path.join(this.allureResultsDir, 'categories.json');
    let categories = [];

    if (fs.existsSync(catPath)) {
      try {
        categories = JSON.parse(fs.readFileSync(catPath, 'utf-8'));
      } catch {
        categories = [];
      }
    }

    // Add self-healed category if not already present
    const hasHealedCategory = categories.some((c) => c.name === 'AI Intervention');
    if (!hasHealedCategory) {
      categories.push({
        name: 'AI Intervention',
        messageRegex: '.*waiting for locator.*|.*toBeVisible.*|.*not found.*',
        matchedStatuses: ['broken', 'failed'],
        description:
          'Tests that failed due to locator drift or DOM changes — automatically diagnosed by the AI agent with fix recommendations pending human approval.',
      });
    }

    fs.writeFileSync(catPath, JSON.stringify(categories, null, 2), 'utf-8');
  }

  /**
   * Append AI healing stats to allure-results/environment.properties.
   */
  _updateAllureEnvironment() {
    const envPath = path.join(this.allureResultsDir, 'environment.properties');
    let envContent = '';

    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');
    }

    // Remove any existing ai_ lines (from previous runs)
    const lines = envContent.split('\n').filter((l) => !l.startsWith('ai_'));

    // Add healing stats
    lines.push(`ai_healing_enabled=${this.config.enabled}`);
    lines.push(`ai_healing_model=${this.config.healingModel || 'gpt-4o-mini'}`);
    lines.push(`ai_analysis_model=${this.config.analysisModel || 'gpt-4o'}`);
    lines.push(`ai_healed_tests=${this.healedTests.length}`);

    if (this.healedTests.length > 0) {
      const avgConfidence =
        this.healedTests.reduce((sum, t) => sum + (t.classificationConfidence || 0), 0) /
        this.healedTests.length;
      lines.push(`ai_avg_classification_confidence=${(avgConfidence * 100).toFixed(0)}%`);

      const healConfidences = this.healedTests
        .map((t) => t.testCaseHealResult?.confidence || 0)
        .filter((c) => c > 0);
      if (healConfidences.length > 0) {
        const avgHealConf =
          healConfidences.reduce((sum, c) => sum + c, 0) / healConfidences.length;
        lines.push(`ai_avg_healing_confidence=${(avgHealConf * 100).toFixed(0)}%`);
      }

      const categories = [...new Set(this.healedTests.map((t) => t.failureCategory))];
      lines.push(`ai_failure_categories=${categories.join(', ')}`);
    }

    lines.push(`ai_run_id=${this.runId}`);

    fs.writeFileSync(envPath, lines.filter(Boolean).join('\n') + '\n', 'utf-8');
  }
}

module.exports = AIHealingReporter;
