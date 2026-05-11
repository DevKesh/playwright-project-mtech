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
const { getCostSummary, clearCostLog } = require('../metrics/cost-tracker');

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

      // Clear cost log for fresh tracking this run
      try { clearCostLog(); } catch { /* ignore */ }

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

    // Only analyze failures (Playwright uses 'failed' for assertion errors
    // and 'timedOut' for timeout errors — both are failures we want to analyze)
    if (result.status !== 'failed' && result.status !== 'timedOut') return;

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

    // Build a comprehensive error message from all available sources
    const primaryMessage = result.error?.message || 'Unknown error';
    const primaryStack = result.error?.stack || '';
    
    // Collect additional error details from result.errors[] (Playwright provides multiple error objects)
    const allErrorMessages = (result.errors || []).map(e => e.message || '').filter(Boolean);
    
    // Collect locator info from nested step titles (e.g. "Click locator('span.menuName').filter({ hasText: 'CCTV' })")
    const stepLocatorInfo = [];
    for (const s of (result.steps || [])) {
      for (const ns of (s.steps || [])) {
        if (ns.error && ns.title) {
          stepLocatorInfo.push(ns.title);
        }
      }
    }
    
    // Build combined error text for analysis
    const combinedErrorMessage = [primaryMessage, ...allErrorMessages, ...stepLocatorInfo]
      .filter((v, i, a) => a.indexOf(v) === i) // dedupe
      .join('\n');

    // Run the healing graph asynchronously — track the promise so onEnd() can await it
    const healingPromise = this._runHealing({
      testFile,
      testTitle,
      errorMessage: combinedErrorMessage,
      errorStack: primaryStack,
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

    // Inject healing evidence into Allure results (post-mortem healed tests)
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
   * Inject runtime healing evidence into Allure results for tests that PASSED
   * because the AI healed broken locators at runtime.
   */
  _injectRuntimeHealingIntoAllure(runtimeEvents) {
    if (!fs.existsSync(this.allureResultsDir)) return;

    const resultFiles = fs
      .readdirSync(this.allureResultsDir)
      .filter((f) => f.endsWith('-result.json'));

    // Group runtime events — all events belong to tests that passed via healing
    // Try to match events to specific tests, or inject all events into relevant tests.
    let injectedCount = 0;
    for (const file of resultFiles) {
      try {
        const filePath = path.join(this.allureResultsDir, file);
        const resultJson = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        // Only inject into passing tests (runtime healing makes tests pass)
        if (resultJson.status !== 'passed') continue;

        // Skip tests already marked with [AI-INTERVENTION]
        if (resultJson.name?.startsWith('[AI-INTERVENTION]')) continue;

        // Collect all step names (including nested) for matching
        const allStepText = (resultJson.steps || [])
          .flatMap((s) => [
            s.name || '',
            ...(s.steps || []).map((ss) => ss.name || ''),
          ])
          .join(' ');

        // Find runtime events relevant to this specific test
        const relevantEvents = runtimeEvents.filter((evt) => {
          // Check if any step in this test references content related to the healed selector
          const selectorLower = (evt.originalSelector || '').toLowerCase();
          const testNameLower = (resultJson.name || '').toLowerCase();
          const stepsLower = allStepText.toLowerCase();

          // Extract key words from selector (e.g., "Devices", "Cameras", "Activity")
          const selectorWords = selectorLower.match(/[a-z]{4,}/gi) || [];
          return selectorWords.some((w) =>
            testNameLower.includes(w) || stepsLower.includes(w)
          );
        });

        // If no specific match found but we haven't injected yet, use all events
        // (fallback for consolidated suites where matching is ambiguous)
        const eventsToInject = relevantEvents.length > 0
          ? relevantEvents
          : (injectedCount === 0 ? runtimeEvents : []);

        if (eventsToInject.length === 0) continue;

        // Build the runtime healing HTML report
        const htmlReport = this._buildRuntimeHealingHtml(relevantEvents);

        // Write markdown attachment
        const attachUuid = crypto.randomUUID();
        const attachFileName = `${attachUuid}-attachment.md`;
        const markdown = this._buildRuntimeHealingMarkdown(relevantEvents);
        fs.writeFileSync(path.join(this.allureResultsDir, attachFileName), markdown, 'utf-8');

        // Write JSON attachment
        const jsonAttachUuid = crypto.randomUUID();
        const jsonAttachFileName = `${jsonAttachUuid}-attachment.json`;
        fs.writeFileSync(
          path.join(this.allureResultsDir, jsonAttachFileName),
          JSON.stringify({ runtimeHealingEvents: relevantEvents }, null, 2),
          'utf-8'
        );

        // Add healing step
        const now = Date.now();
        const healingStep = {
          statusDetails: {},
          stage: 'finished',
          steps: [],
          attachments: [
            { name: 'AI Self-Healing Report', source: attachFileName, type: 'text/markdown' },
            { name: 'Healing Data (JSON)', source: jsonAttachFileName, type: 'application/json' },
          ],
          parameters: [],
          start: now,
          name: `AI Self-Healing: ${relevantEvents.length} locator(s) healed at runtime`,
          stop: now,
        };

        const afterHooksIdx = resultJson.steps.findIndex((s) => s.name === 'After Hooks');
        if (afterHooksIdx >= 0) {
          resultJson.steps.splice(afterHooksIdx, 0, healingStep);
        } else {
          resultJson.steps.push(healingStep);
        }

        // Add tags
        resultJson.labels.push({ name: 'tag', value: 'self-healed' });
        resultJson.labels.push({ name: 'tag', value: 'ai-healing' });
        resultJson.labels.push({ name: 'tag', value: 'runtime-healed' });

        // Prefix the test name
        resultJson.name = `[AI-INTERVENTION] ${resultJson.name}`;

        // Set description HTML
        resultJson.descriptionHtml = htmlReport;

        fs.writeFileSync(filePath, JSON.stringify(resultJson), 'utf-8');
        console.log(`[AI-REPORTER] Allure: Injected runtime healing for "${resultJson.name}" -> ${file}`);
        injectedCount++;
      } catch {
        continue;
      }
    }
  }

  /**
   * Build HTML report for runtime healing events — exact format:
   * Red box: AI Self-Healing Report (table with category, confidence, severity, decision)
   * Blue box: Root Cause (broken locator with code-style display)
   * Green box: Suggested Fix (file, line numbers, current broken code, suggested fixed code, explanation)
   * Purple box: Audit Trail
   */
  _buildRuntimeHealingHtml(events) {
    const istTimestamp = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', second: '2-digit',
      hour12: true,
    });

    let html = '';

    for (const evt of events) {
      const conf = evt.confidence ? (evt.confidence * 100).toFixed(0) : 'N/A';

      // Search source files to find the actual line where the broken locator is defined
      const sourceInfo = this._findLocatorInSource(evt.originalSelector);
      const brokenLocatorDisplay = this._formatLocatorForDisplay(evt.originalSelector);
      const healedLocatorDisplay = evt.healedSelector || 'N/A';

      // Build analysis text explaining WHY the locator broke
      const analysisText = this._buildHealingAnalysis(evt, sourceInfo);

      html += `
<div style="border:2px solid #e74c3c; border-radius:8px; padding:16px; margin-bottom:16px; background:#fdf2f2;">
  <h2 style="color:#e74c3c; margin-top:0;">AI Self-Healing Report</h2>
  <p style="color:#555;">This test failure was <strong>automatically diagnosed</strong> by the AI Self-Healing Agent (LangGraph + GPT-4o).</p>
  <table style="width:auto; border-collapse:collapse; margin:12px 0;">
    <tr style="background:#f8d7da;"><td style="padding:6px 12px; border:1px solid #ddd;"><strong>Category</strong></td><td style="padding:6px 12px; border:1px solid #ddd;"><code>locator_broken</code></td></tr>
    <tr><td style="padding:6px 12px; border:1px solid #ddd;"><strong>Classification Confidence</strong></td><td style="padding:6px 12px; border:1px solid #ddd;">${conf}%</td></tr>
    <tr style="background:#f8d7da;"><td style="padding:6px 12px; border:1px solid #ddd;"><strong>Healing Confidence</strong></td><td style="padding:6px 12px; border:1px solid #ddd;">${conf}%</td></tr>
    <tr><td style="padding:6px 12px; border:1px solid #ddd;"><strong>Severity</strong></td><td style="padding:6px 12px; border:1px solid #ddd;">high</td></tr>
    <tr style="background:#f8d7da;"><td style="padding:6px 12px; border:1px solid #ddd;"><strong>Decision</strong></td><td style="padding:6px 12px; border:1px solid #ddd;"><code>healing_applied</code></td></tr>
  </table>
</div>

<div style="border:2px solid #3498db; border-radius:8px; padding:16px; margin-bottom:16px; background:#eaf4fd;">
  <h3 style="color:#2980b9; margin-top:0;">Root Cause</h3>
  <p>The locator ${sourceInfo.propertyName ? `<code>${this._escapeHtml(sourceInfo.propertyName)}</code> using ` : ''}<code>${this._escapeHtml(brokenLocatorDisplay)}</code> did not match any elements in the DOM.</p>
  <p><strong>Broken Locator:</strong> <code style="background:#fce4ec; padding:2px 6px; border-radius:3px;">${this._escapeHtml(brokenLocatorDisplay)}</code></p>
</div>

<div style="border:2px solid #27ae60; border-radius:8px; padding:16px; margin-bottom:16px; background:#eafaf1;">
  <h3 style="color:#27ae60; margin-top:0;">Suggested Fix</h3>
  <p>${this._escapeHtml(analysisText)}</p>
  <div style="background:#fff; border:1px solid #ccc; border-radius:4px; padding:12px; margin:8px 0;">
    <p><strong>File:</strong> <code>${this._escapeHtml(sourceInfo.relativeFile)}</code>${sourceInfo.lineNumber ? ` (Lines: ${sourceInfo.lineNumber}-${sourceInfo.lineNumber + 1})` : ''}</p>
    <p style="color:#c0392b;"><strong>Current (broken):</strong></p>
    <pre style="background:#fdf2f2; padding:8px; border-radius:4px; overflow-x:auto;">${this._escapeHtml(sourceInfo.currentCode || evt.originalSelector)}</pre>
    <p style="color:#27ae60;"><strong>Suggested (fixed):</strong></p>
    <pre style="background:#eafaf1; padding:8px; border-radius:4px; overflow-x:auto;">${this._escapeHtml(sourceInfo.suggestedCode || healedLocatorDisplay)}</pre>
    <p><em>${this._escapeHtml(this._buildFixExplanation(evt, sourceInfo))}</em></p>
  </div>
</div>

<div style="border:2px solid #8e44ad; border-radius:8px; padding:16px; margin-bottom:16px; background:#f5eef8;">
  <h3 style="color:#8e44ad; margin-top:0;">Audit Trail</h3>
  <table style="width:100%; border-collapse:collapse;">
    <tr><td style="padding:4px; border:1px solid #ddd;"><strong>Run ID</strong></td><td style="padding:4px; border:1px solid #ddd;"><code>${this.runId}</code></td></tr>
    <tr><td style="padding:4px; border:1px solid #ddd;"><strong>Healing Type</strong></td><td style="padding:4px; border:1px solid #ddd;">Runtime (live DOM analysis via GPT-4o-mini)</td></tr>
    <tr><td style="padding:4px; border:1px solid #ddd;"><strong>Attempts</strong></td><td style="padding:4px; border:1px solid #ddd;">${evt.attempts || 1}</td></tr>
    <tr><td style="padding:4px; border:1px solid #ddd;"><strong>Timestamp</strong></td><td style="padding:4px; border:1px solid #ddd;">${istTimestamp} IST</td></tr>
  </table>
</div>
<hr style="margin:24px 0;">`;
    }

    // Add healing flow diagram for runtime healing
    html += this._buildRuntimeFlowDiagram(events);

    // Add cost summary
    html += this._buildCostSummaryHtml();

    return html;
  }

  /**
   * Search page object source files to find the exact line where a broken locator is defined.
   * Returns { relativeFile, lineNumber, currentCode, suggestedCode, propertyName }.
   */
  _findLocatorInSource(originalSelector) {
    const result = {
      relativeFile: 'unknown',
      lineNumber: null,
      currentCode: null,
      suggestedCode: null,
      propertyName: null,
    };

    // Extract the key part of the selector for searching
    // e.g., from 'page.getByRole("button", {"name":"Automation Devices Menu"}).first()'
    // extract search terms like "Automation Devices Menu" or the method pattern
    let searchTerms = [];

    // Extract quoted strings from the selector
    const quotedMatches = originalSelector.match(/["']([^"']+)["']/g);
    if (quotedMatches) {
      searchTerms = quotedMatches.map((m) => m.replace(/["']/g, ''));
    }

    // Search in page object directories
    const searchDirs = [
      path.join(process.cwd(), 'framework', 'pages', 'generated', 'smoke'),
      path.join(process.cwd(), 'framework', 'pages', 'generated'),
      path.join(process.cwd(), 'framework', 'pages'),
    ];

    for (const dir of searchDirs) {
      if (!fs.existsSync(dir)) continue;

      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));
      for (const file of files) {
        try {
          const filePath = path.join(dir, file);
          const lines = fs.readFileSync(filePath, 'utf-8').split('\n');

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Check if this line contains any of our search terms
            const matchesTerm = searchTerms.some((term) => line.includes(term));
            if (!matchesTerm) continue;

            // Check if it's an assignment line (this.xxx = page.xxx)
            const propMatch = line.match(/this\.(\w+)\s*=\s*page\./);
            if (propMatch) {
              result.relativeFile = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
              result.lineNumber = i + 1;
              result.currentCode = line.trim();
              result.propertyName = propMatch[1];
              return result;
            }
          }
        } catch {
          continue;
        }
      }
    }

    return result;
  }

  /**
   * Convert a selector description like 'page.getByRole("button", {"name":"X"}).first()'
   * into the Playwright API form for display.
   */
  _formatLocatorForDisplay(selector) {
    if (!selector) return 'N/A';
    // Clean up JSON-style quotes to single quotes for readability
    return selector
      .replace(/page\./, '')
      .replace(/"/g, "'");
  }

  /**
   * Build the analysis paragraph explaining why the locator broke and how it was healed.
   */
  _buildHealingAnalysis(evt, sourceInfo) {
    const propName = sourceInfo.propertyName || 'the target element';
    const originalDisplay = this._formatLocatorForDisplay(evt.originalSelector);
    const healedDisplay = evt.healedSelector || 'unknown';

    if (sourceInfo.currentCode) {
      return `The test is failing because the locator for '${propName}' is not found. ` +
        `The locator uses '${originalDisplay}', but the element in the application DOM ` +
        `has changed. The AI Self-Healing Agent inspected the live DOM and determined that ` +
        `'${healedDisplay}' correctly identifies the intended element.`;
    }

    return `The locator '${originalDisplay}' could not find the target element in the DOM. ` +
      `The AI Self-Healing Agent analyzed the live page structure and identified ` +
      `'${healedDisplay}' as the correct replacement.`;
  }

  /**
   * Build the explanation text shown below the code diff in the Suggested Fix section.
   */
  _buildFixExplanation(evt, sourceInfo) {
    const propName = sourceInfo.propertyName || 'element';
    const healedDisplay = evt.healedSelector || 'the healed selector';

    if (sourceInfo.currentCode) {
      // Build the suggested code by replacing the locator in the source line
      const suggestedLine = this._buildSuggestedCodeLine(sourceInfo.currentCode, evt.healedSelector);
      sourceInfo.suggestedCode = suggestedLine;

      return `The '${propName}' locator was automatically healed at runtime. ` +
        `Updating the page object to use '${healedDisplay}' should make the test pass without runtime healing.`;
    }

    return `The locator was healed at runtime during the '${evt.action}' action. ` +
      `The healed selector resolved successfully and the test continued without interruption.`;
  }

  /**
   * Build a suggested fixed code line by replacing the locator method call in the current line.
   */
  _buildSuggestedCodeLine(currentCode, healedSelector) {
    if (!healedSelector || !currentCode) return healedSelector || currentCode;

    // Parse the healed selector type: locator(xxx) or getByRole(xxx) etc.
    const healedMatch = healedSelector.match(/^(\w+)\((.+)\)$/);
    if (!healedMatch) return currentCode;

    const [, method, selectorValue] = healedMatch;

    // Replace everything after "page." up to the semicolon
    const pageIdx = currentCode.indexOf('page.');
    if (pageIdx === -1) return currentCode;

    const prefix = currentCode.substring(0, pageIdx);
    const suffix = currentCode.endsWith(';') ? ';' : '';

    if (method === 'locator') {
      return `${prefix}page.locator('${selectorValue}')${suffix}`;
    } else if (method === 'getByRole') {
      return `${prefix}page.${healedSelector}${suffix}`;
    } else if (method === 'getByText') {
      return `${prefix}page.${healedSelector}${suffix}`;
    }

    return `${prefix}page.${healedSelector}${suffix}`;
  }

  /**
   * Build markdown report for runtime healing events.
   */
  _buildRuntimeHealingMarkdown(events) {
    let md = `# AI Self-Healing Report (Runtime)\n\n`;
    md += `> ${events.length} locator(s) were automatically healed at runtime by the AI Self-Healing Agent.\n\n`;

    for (let i = 0; i < events.length; i++) {
      const evt = events[i];
      md += `## Healing Event ${i + 1}\n\n`;
      md += `| Field | Value |\n`;
      md += `|-------|-------|\n`;
      md += `| Category | locator_broken |\n`;
      md += `| Confidence | ${evt.confidence ? (evt.confidence * 100).toFixed(0) : 'N/A'}% |\n`;
      md += `| Action | ${evt.action} |\n`;
      md += `| Decision | healing_applied |\n\n`;
      md += `### Broken Locator\n\n`;
      md += `\`\`\`\n${evt.originalSelector}\n\`\`\`\n\n`;
      md += `### Healed To\n\n`;
      md += `\`\`\`\n${evt.healedSelector}\n\`\`\`\n\n`;
      md += `---\n\n`;
    }

    return md;
  }

  /**
   * Escape HTML entities to prevent XSS in report output.
   */
  _escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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

    // Add healing flow diagram
    html += this._buildHealingFlowDiagram(healedTest);

    // Add cost summary
    html += this._buildCostSummaryHtml();

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

    // Add cost tracking data
    try {
      const costSummary = getCostSummary();
      if (costSummary.totalCalls > 0) {
        lines.push(`ai_total_api_calls=${costSummary.totalCalls}`);
        lines.push(`ai_total_tokens=${costSummary.totalTokens}`);
        lines.push(`ai_total_prompt_tokens=${costSummary.totalPromptTokens}`);
        lines.push(`ai_total_completion_tokens=${costSummary.totalCompletionTokens}`);
        lines.push(`ai_estimated_cost_usd=$${costSummary.totalCostUSD.toFixed(4)}`);
        for (const [model, data] of Object.entries(costSummary.byModel)) {
          const safeModel = model.replace(/[^a-zA-Z0-9_-]/g, '_');
          lines.push(`ai_cost_${safeModel}=$${data.costUSD.toFixed(4)} (${data.calls} calls, ${data.tokens} tokens)`);
        }
      }
    } catch { /* cost tracking is optional */ }

    fs.writeFileSync(envPath, lines.filter(Boolean).join('\n') + '\n', 'utf-8');
  }

  /**
   * Build a flow diagram for runtime healing (locator healed live, test passed).
   */
  _buildRuntimeFlowDiagram(events) {
    const count = events.length;
    const avgConf = events.reduce((s, e) => s + (e.confidence || 0), 0) / (count || 1);
    const confStr = (avgConf * 100).toFixed(0) + '%';

    return `
<div style="border:2px solid #2c3e50; border-radius:8px; padding:20px; margin:16px 0; background:linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);">
  <h3 style="color:#e94560; margin-top:0; text-align:center; font-size:18px;">AI Self-Healing Pipeline (Runtime)</h3>
  <div style="display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:8px; padding:16px 0;">
    <div style="text-align:center;">
      <div style="background:#e74c3c; color:white; border-radius:12px; padding:12px 16px; font-weight:bold; font-size:13px; box-shadow:0 4px 12px rgba(231,76,60,0.4); min-width:100px;">LOCATOR FAILED</div>
      <div style="color:#e74c3c; font-size:10px; margin-top:4px;">${count} locator(s)</div>
    </div>
    <div style="color:#e94560; font-size:24px; font-weight:bold; animation: pulse 1.5s infinite;">&#10132;</div>
    <div style="text-align:center;">
      <div style="background:#f39c12; color:white; border-radius:12px; padding:12px 16px; font-weight:bold; font-size:13px; box-shadow:0 4px 12px rgba(243,156,18,0.4); min-width:100px;">DOM EXTRACTED</div>
      <div style="color:#f39c12; font-size:10px; margin-top:4px;">Live page snapshot</div>
    </div>
    <div style="color:#e94560; font-size:24px; font-weight:bold; animation: pulse 1.5s infinite 0.3s;">&#10132;</div>
    <div style="text-align:center;">
      <div style="background:#3498db; color:white; border-radius:12px; padding:12px 16px; font-weight:bold; font-size:13px; box-shadow:0 4px 12px rgba(52,152,219,0.4); min-width:100px;">GPT-4o-mini</div>
      <div style="color:#3498db; font-size:10px; margin-top:4px;">CSS → Role → Text</div>
    </div>
    <div style="color:#e94560; font-size:24px; font-weight:bold; animation: pulse 1.5s infinite 0.6s;">&#10132;</div>
    <div style="text-align:center;">
      <div style="background:#9b59b6; color:white; border-radius:12px; padding:12px 16px; font-weight:bold; font-size:13px; box-shadow:0 4px 12px rgba(155,89,182,0.4); min-width:100px;">HEALED</div>
      <div style="color:#9b59b6; font-size:10px; margin-top:4px;">${confStr} confidence</div>
    </div>
    <div style="color:#e94560; font-size:24px; font-weight:bold; animation: pulse 1.5s infinite 0.9s;">&#10132;</div>
    <div style="text-align:center;">
      <div style="background:#27ae60; color:white; border-radius:12px; padding:12px 16px; font-weight:bold; font-size:13px; box-shadow:0 4px 12px rgba(39,174,96,0.4); min-width:100px;">TEST PASSED</div>
      <div style="color:#27ae60; font-size:10px; margin-top:4px;">Action completed</div>
    </div>
  </div>
  <style>
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  </style>
</div>`;
  }

  /**
   * Build an animated SVG flow diagram showing the healing pipeline.
   * Stages: Test Failed → AI Analyzed → Strategy Selected → Locator Healed → Test Passed
   */
  _buildHealingFlowDiagram(healedTest) {
    const category = healedTest.failureCategory || 'locator_broken';
    const confidence = healedTest.classificationConfidence
      ? (healedTest.classificationConfidence * 100).toFixed(0) + '%'
      : 'N/A';
    const decision = healedTest.decision || 'healing_suggested';
    const strategy = healedTest.testCaseHealResult?.suggestedChanges?.[0]
      ? 'Code Fix'
      : 'Locator Replacement';

    return `
<div style="border:2px solid #2c3e50; border-radius:8px; padding:20px; margin:16px 0; background:linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);">
  <h3 style="color:#e94560; margin-top:0; text-align:center; font-size:18px;">AI Self-Healing Pipeline</h3>
  <div style="display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:8px; padding:16px 0;">
    <!-- Stage 1: Test Failed -->
    <div style="text-align:center; animation: fadeIn 0.5s ease-in;">
      <div style="background:#e74c3c; color:white; border-radius:12px; padding:12px 16px; font-weight:bold; font-size:13px; box-shadow:0 4px 12px rgba(231,76,60,0.4); min-width:100px;">
        TEST FAILED
      </div>
      <div style="color:#e74c3c; font-size:10px; margin-top:4px;">${this._escapeHtml(category)}</div>
    </div>
    <!-- Arrow -->
    <div style="color:#e94560; font-size:24px; font-weight:bold; animation: pulse 1.5s infinite;">&#10132;</div>
    <!-- Stage 2: AI Analyzed -->
    <div style="text-align:center; animation: fadeIn 0.8s ease-in;">
      <div style="background:#f39c12; color:white; border-radius:12px; padding:12px 16px; font-weight:bold; font-size:13px; box-shadow:0 4px 12px rgba(243,156,18,0.4); min-width:100px;">
        AI ANALYZED
      </div>
      <div style="color:#f39c12; font-size:10px; margin-top:4px;">GPT-4o (${confidence})</div>
    </div>
    <!-- Arrow -->
    <div style="color:#e94560; font-size:24px; font-weight:bold; animation: pulse 1.5s infinite 0.3s;">&#10132;</div>
    <!-- Stage 3: Strategy Selected -->
    <div style="text-align:center; animation: fadeIn 1.1s ease-in;">
      <div style="background:#3498db; color:white; border-radius:12px; padding:12px 16px; font-weight:bold; font-size:13px; box-shadow:0 4px 12px rgba(52,152,219,0.4); min-width:100px;">
        STRATEGY
      </div>
      <div style="color:#3498db; font-size:10px; margin-top:4px;">${this._escapeHtml(strategy)}</div>
    </div>
    <!-- Arrow -->
    <div style="color:#e94560; font-size:24px; font-weight:bold; animation: pulse 1.5s infinite 0.6s;">&#10132;</div>
    <!-- Stage 4: Locator Healed -->
    <div style="text-align:center; animation: fadeIn 1.4s ease-in;">
      <div style="background:#9b59b6; color:white; border-radius:12px; padding:12px 16px; font-weight:bold; font-size:13px; box-shadow:0 4px 12px rgba(155,89,182,0.4); min-width:100px;">
        HEALED
      </div>
      <div style="color:#9b59b6; font-size:10px; margin-top:4px;">${this._escapeHtml(decision)}</div>
    </div>
    <!-- Arrow -->
    <div style="color:#e94560; font-size:24px; font-weight:bold; animation: pulse 1.5s infinite 0.9s;">&#10132;</div>
    <!-- Stage 5: Fix Ready -->
    <div style="text-align:center; animation: fadeIn 1.7s ease-in;">
      <div style="background:#27ae60; color:white; border-radius:12px; padding:12px 16px; font-weight:bold; font-size:13px; box-shadow:0 4px 12px rgba(39,174,96,0.4); min-width:100px;">
        FIX READY
      </div>
      <div style="color:#27ae60; font-size:10px; margin-top:4px;">Pending Review</div>
    </div>
  </div>
  <style>
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  </style>
</div>`;
  }

  /**
   * Build an HTML cost summary section showing OpenAI token usage and estimated costs.
   */
  _buildCostSummaryHtml() {
    try {
      const summary = getCostSummary();
      if (summary.totalCalls === 0) return '';

      let modelRows = '';
      for (const [model, data] of Object.entries(summary.byModel)) {
        modelRows += `
    <tr>
      <td style="padding:6px 12px; border:1px solid #ddd;"><code>${this._escapeHtml(model)}</code></td>
      <td style="padding:6px 12px; border:1px solid #ddd; text-align:center;">${data.calls}</td>
      <td style="padding:6px 12px; border:1px solid #ddd; text-align:right;">${data.tokens.toLocaleString()}</td>
      <td style="padding:6px 12px; border:1px solid #ddd; text-align:right; font-weight:bold;">$${data.costUSD.toFixed(4)}</td>
    </tr>`;
      }

      return `
<div style="border:2px solid #e67e22; border-radius:8px; padding:16px; margin:16px 0; background:#fef9e7;">
  <h3 style="color:#e67e22; margin-top:0;">OpenAI Cost Tracking</h3>
  <table style="width:100%; border-collapse:collapse; margin:8px 0;">
    <thead>
      <tr style="background:#fdebd0;">
        <th style="padding:8px 12px; border:1px solid #ddd; text-align:left;">Model</th>
        <th style="padding:8px 12px; border:1px solid #ddd; text-align:center;">API Calls</th>
        <th style="padding:8px 12px; border:1px solid #ddd; text-align:right;">Tokens</th>
        <th style="padding:8px 12px; border:1px solid #ddd; text-align:right;">Est. Cost</th>
      </tr>
    </thead>
    <tbody>
      ${modelRows}
    </tbody>
    <tfoot>
      <tr style="background:#fdebd0; font-weight:bold;">
        <td style="padding:8px 12px; border:1px solid #ddd;">TOTAL</td>
        <td style="padding:8px 12px; border:1px solid #ddd; text-align:center;">${summary.totalCalls}</td>
        <td style="padding:8px 12px; border:1px solid #ddd; text-align:right;">${summary.totalTokens.toLocaleString()}</td>
        <td style="padding:8px 12px; border:1px solid #ddd; text-align:right; color:#e74c3c;">$${summary.totalCostUSD.toFixed(4)}</td>
      </tr>
    </tfoot>
  </table>
  <p style="color:#888; font-size:11px; margin-bottom:0;">Prompt tokens: ${summary.totalPromptTokens.toLocaleString()} | Completion tokens: ${summary.totalCompletionTokens.toLocaleString()}</p>
</div>`;
    } catch {
      return '';
    }
  }
}

module.exports = AIHealingReporter;
