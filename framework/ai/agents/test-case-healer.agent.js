/**
 * Test Case Healer Agent: analyzes failed tests and suggests code fixes
 * for broken test logic, assertions, or flow steps.
 *
 * This agent is triggered AFTER locator healing has been attempted and
 * the test still fails, indicating the issue is in the test logic itself.
 *
 * Important: This agent produces SUGGESTIONS ONLY — changes are never
 * auto-applied. They are saved to ai-reports/test-healing/ for human review.
 */

const fs = require('fs');
const path = require('path');
const { createAIClient } = require('../core/ai-client-factory');
const { buildTestCaseHealingPrompt } = require('../prompts/test-case-healing.prompt');
const { loadHealingLog } = require('../storage/healing-history');

class TestCaseHealerAgent {
  constructor(config) {
    this.config = config;
    this.aiClient = createAIClient(config);
  }

  /**
   * Extract require()'d file paths from a source file.
   * @param {string} source - JavaScript source code.
   * @param {string} baseDir - Directory of the source file.
   * @returns {string[]} Resolved absolute paths.
   */
  _extractRequiredFiles(source, baseDir) {
    const paths = [];
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let match;

    while ((match = requireRegex.exec(source)) !== null) {
      const reqPath = match[1];
      // Only resolve local files (starting with . or ..)
      if (reqPath.startsWith('.')) {
        let resolved = path.resolve(baseDir, reqPath);
        // Add .js extension if missing
        if (!path.extname(resolved)) {
          resolved += '.js';
        }
        if (fs.existsSync(resolved)) {
          paths.push(resolved);
        }
      }
    }

    return paths;
  }

  /**
   * Analyze a failed test and suggest code fixes.
   * @param {object} params
   * @param {string} params.testFile - Absolute path to the test file.
   * @param {string} params.testTitle - Full test title.
   * @param {string} params.errorMessage - Error message.
   * @param {string} params.errorStack - Stack trace.
   * @returns {Promise<object>} Test case healing report.
   */
  async analyze({ testFile, testTitle, errorMessage, errorStack }) {
    // Read the test source
    let testSource = '';
    try {
      if (fs.existsSync(testFile)) {
        testSource = fs.readFileSync(testFile, 'utf-8');
      }
    } catch {
      testSource = '// Unable to read test source';
    }

    // Read related files (page objects, flows imported by the test)
    const relatedSources = {};
    const baseDir = path.dirname(testFile);
    const requiredFiles = this._extractRequiredFiles(testSource, baseDir);

    for (const filePath of requiredFiles) {
      try {
        const source = fs.readFileSync(filePath, 'utf-8');
        relatedSources[path.relative(process.cwd(), filePath)] = source;

        // Also follow one level of transitive requires (e.g., fixture -> page objects)
        const transitiveFiles = this._extractRequiredFiles(source, path.dirname(filePath));
        for (const transFile of transitiveFiles) {
          if (!relatedSources[path.relative(process.cwd(), transFile)]) {
            try {
              relatedSources[path.relative(process.cwd(), transFile)] =
                fs.readFileSync(transFile, 'utf-8');
            } catch {
              // Skip unreadable files
            }
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    // Check if locator healing was attempted for this test
    const healingLog = loadHealingLog();
    const healingAttempts = healingLog.filter(
      (h) => h.testTitle === testTitle || h.testTitle === 'runtime-healing'
    ).slice(-5); // Last 5 relevant attempts

    const { systemPrompt, userPrompt } = buildTestCaseHealingPrompt({
      testFile: path.relative(process.cwd(), testFile),
      testTitle,
      testSource,
      relatedSources,
      errorMessage,
      errorStack,
      healingAttempts,
    });

    const report = await this.aiClient.chatCompletionJSON(systemPrompt, userPrompt, {
      model: this.config.analysisModel,
      maxTokens: 4096,
    });

    return {
      timestamp: new Date().toISOString(),
      testFile: path.relative(process.cwd(), testFile),
      testTitle,
      errorMessage,
      healingAttemptsCount: healingAttempts.length,
      ...report,
    };
  }
}

module.exports = { TestCaseHealerAgent };
