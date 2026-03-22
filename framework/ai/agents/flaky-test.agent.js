/**
 * Flaky Test Detection Agent: analyzes test run history to identify
 * unstable tests and suggest fixes.
 *
 * Reads accumulated run history from ai-reports/run-history.json
 * (populated by the AI Healing Reporter) and sends aggregated
 * statistics to GPT for pattern classification.
 */

const { AIClient } = require('../core/openai-client');
const { buildFlakyTestPrompt } = require('../prompts/flaky-test.prompt');
const { loadRunHistory } = require('../storage/healing-history');

class FlakyTestAgent {
  constructor(config) {
    this.config = config;
    this.aiClient = new AIClient(config);
  }

  /**
   * Aggregate test statistics from run history.
   * @returns {Array<object>} Per-test aggregated stats.
   */
  aggregateStats() {
    const history = loadRunHistory();
    if (history.length < 2) {
      return []; // Need at least 2 runs to detect flakiness
    }

    // Build a map of testTitle -> { passes, failures, durations, errors }
    const statsMap = new Map();

    for (const run of history) {
      for (const test of run.tests || []) {
        const key = `${test.testFile}|||${test.testTitle}`;
        if (!statsMap.has(key)) {
          statsMap.set(key, {
            testFile: test.testFile,
            testTitle: test.testTitle,
            passes: 0,
            failures: 0,
            durations: [],
            errors: [],
          });
        }

        const entry = statsMap.get(key);
        if (test.status === 'passed') {
          entry.passes++;
        } else if (test.status === 'failed') {
          entry.failures++;
          if (test.error) {
            entry.errors.push(test.error.substring(0, 200));
          }
        }
        if (test.duration) {
          entry.durations.push(test.duration);
        }
      }
    }

    // Compute derived stats
    const results = [];
    for (const entry of statsMap.values()) {
      const totalRuns = entry.passes + entry.failures;
      if (totalRuns < 2) continue; // Need multiple runs

      const avgDuration =
        entry.durations.length > 0
          ? Math.round(entry.durations.reduce((a, b) => a + b, 0) / entry.durations.length)
          : 0;

      const variance =
        entry.durations.length > 1
          ? entry.durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) /
            (entry.durations.length - 1)
          : 0;
      const durationStdDev = Math.round(Math.sqrt(variance));

      const flakinessPct =
        totalRuns > 0
          ? Math.round((Math.min(entry.passes, entry.failures) / totalRuns) * 100 * 2)
          : 0;

      results.push({
        testFile: entry.testFile,
        testTitle: entry.testTitle,
        totalRuns,
        passes: entry.passes,
        failures: entry.failures,
        avgDuration,
        durationStdDev,
        flakinessPct: Math.min(flakinessPct, 100),
        errors: entry.errors,
      });
    }

    return results;
  }

  /**
   * Analyze flaky tests and produce a report.
   * @returns {Promise<object>} Flaky test analysis report.
   */
  async analyze() {
    const testStats = this.aggregateStats();

    if (testStats.length === 0) {
      return {
        timestamp: new Date().toISOString(),
        flakyTests: [],
        stableTests: 0,
        summary: 'Insufficient run history. Need at least 2 test runs to analyze flakiness.',
      };
    }

    // Only send to GPT if there are potentially flaky tests
    const hasFlaky = testStats.some((s) => s.flakinessPct > 0);
    if (!hasFlaky) {
      return {
        timestamp: new Date().toISOString(),
        flakyTests: [],
        stableTests: testStats.length,
        summary: `All ${testStats.length} tests are stable across ${testStats[0]?.totalRuns || 0} runs. No flakiness detected.`,
      };
    }

    const { systemPrompt, userPrompt } = buildFlakyTestPrompt({ testStats });

    const report = await this.aiClient.chatCompletionJSON(systemPrompt, userPrompt, {
      model: this.config.analysisModel,
    });

    return {
      timestamp: new Date().toISOString(),
      ...report,
    };
  }
}

module.exports = { FlakyTestAgent };
