/**
 * Failure Analyzer Agent: performs AI-powered root cause analysis on test failures.
 *
 * Takes the error details, test source code, and optionally a screenshot,
 * and produces a categorized failure report with suggested fixes.
 */

const fs = require('fs');
const { createAIClient } = require('../core/ai-client-factory');
const { buildFailureAnalysisPrompt } = require('../prompts/failure-analysis.prompt');

class FailureAnalyzerAgent {
  constructor(config) {
    this.config = config;
    this.aiClient = createAIClient(config);
  }

  /**
   * Analyze a test failure and produce a root cause report.
   * @param {object} params
   * @param {string} params.testFile - Path to the test file.
   * @param {string} params.testTitle - Full test title.
   * @param {string} params.errorMessage - Error message string.
   * @param {string} params.errorStack - Stack trace string.
   * @param {string[]} [params.steps] - Steps executed before failure.
   * @param {string} [params.screenshotPath] - Path to failure screenshot.
   * @returns {Promise<object>} Failure analysis report.
   */
  async analyze({ testFile, testTitle, errorMessage, errorStack, steps, screenshotPath }) {
    // Read test source code
    let testSource = '';
    try {
      if (fs.existsSync(testFile)) {
        testSource = fs.readFileSync(testFile, 'utf-8');
      }
    } catch {
      // Source not available, proceed without it
    }

    const hasScreenshot = screenshotPath && fs.existsSync(screenshotPath);

    const { systemPrompt, userPrompt } = buildFailureAnalysisPrompt({
      testFile,
      testTitle,
      errorMessage,
      errorStack,
      testSource,
      steps,
      hasScreenshot,
    });

    let report;

    // If we have a screenshot, use the vision API for richer analysis
    if (hasScreenshot) {
      try {
        const imageBuffer = fs.readFileSync(screenshotPath);
        report = await this.aiClient.visionCompletionJSON(systemPrompt, userPrompt, imageBuffer, {
          model: this.config.analysisModel,
        });
      } catch (visionErr) {
        // Fall back to text-only analysis if vision fails
        console.log(`[AI-ANALYZE] Vision API failed, falling back to text: ${visionErr.message}`);
        report = await this.aiClient.chatCompletionJSON(systemPrompt, userPrompt, {
          model: this.config.analysisModel,
        });
      }
    } else {
      report = await this.aiClient.chatCompletionJSON(systemPrompt, userPrompt, {
        model: this.config.analysisModel,
      });
    }

    return {
      timestamp: new Date().toISOString(),
      testFile,
      testTitle,
      status: 'failed',
      screenshotAnalyzed: !!hasScreenshot,
      ...report,
    };
  }
}

module.exports = { FailureAnalyzerAgent };
