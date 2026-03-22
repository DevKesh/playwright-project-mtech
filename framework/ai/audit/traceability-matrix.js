/**
 * Traceability Matrix: maps requirements (via allure tags) to test specs and outcomes.
 *
 * Scans test spec files for allure metadata (epic, feature, story, severity, tag)
 * and builds a requirement-to-test mapping. Enriches with run outcomes and healing data.
 */

const fs = require('fs');
const path = require('path');

class TraceabilityMatrix {
  /**
   * Build a requirement-to-test mapping by scanning test spec files for allure tags.
   * @param {string[]} testSpecPaths - Absolute paths to test spec files
   * @returns {object} { requirements: [{ id, type, name, tests }] }
   */
  buildFromTestSpecs(testSpecPaths) {
    const requirementMap = new Map();

    for (const specPath of testSpecPaths) {
      let source;
      try {
        source = fs.readFileSync(specPath, 'utf-8');
      } catch {
        continue;
      }

      const relativePath = path.relative(process.cwd(), specPath);

      // Extract allure tags
      const epics = this._extractAllureCall(source, 'epic');
      const features = this._extractAllureCall(source, 'feature');
      const stories = this._extractAllureCall(source, 'story');
      const severities = this._extractAllureCall(source, 'severity');
      const tags = this._extractAllureCall(source, 'tag');

      // Extract test titles
      const testTitles = this._extractTestTitles(source);

      // Build requirements from allure metadata
      const allReqs = [
        ...epics.map(name => ({ type: 'epic', name })),
        ...features.map(name => ({ type: 'feature', name })),
        ...stories.map(name => ({ type: 'story', name })),
      ];

      // If no allure tags found, create a requirement from the file name
      if (allReqs.length === 0) {
        allReqs.push({
          type: 'file',
          name: path.basename(specPath, '.spec.js'),
        });
      }

      for (const req of allReqs) {
        const key = `${req.type}:${req.name}`;
        if (!requirementMap.has(key)) {
          requirementMap.set(key, {
            id: key,
            type: req.type,
            name: req.name,
            tests: [],
          });
        }

        for (const title of testTitles) {
          requirementMap.get(key).tests.push({
            testFile: relativePath,
            testTitle: title,
            severity: severities[0] || 'normal',
            tags,
          });
        }
      }
    }

    return {
      requirements: Array.from(requirementMap.values()),
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Enrich the matrix with test outcomes from run history.
   * @param {object} matrix - Output from buildFromTestSpecs
   * @param {Array} runHistory - Run history entries
   * @returns {object} Enriched matrix with pass/fail status
   */
  enrichWithOutcomes(matrix, runHistory) {
    if (!runHistory || runHistory.length === 0) return matrix;

    // Get the latest run's test results
    const latestRun = runHistory[runHistory.length - 1];
    const resultMap = new Map();
    for (const test of latestRun.tests || []) {
      resultMap.set(test.testTitle, test);
    }

    for (const req of matrix.requirements) {
      for (const test of req.tests) {
        const result = resultMap.get(test.testTitle);
        if (result) {
          test.latestStatus = result.status;
          test.latestDuration = result.duration;
          test.latestError = result.error || null;
        } else {
          test.latestStatus = 'unknown';
        }
      }

      // Compute requirement-level status
      const statuses = req.tests.map(t => t.latestStatus);
      req.status = statuses.every(s => s === 'passed') ? 'passed'
        : statuses.some(s => s === 'failed') ? 'failed'
          : 'partial';
      req.testCount = req.tests.length;
      req.passCount = statuses.filter(s => s === 'passed').length;
      req.failCount = statuses.filter(s => s === 'failed').length;
    }

    matrix.enrichedAt = new Date().toISOString();
    matrix.latestRunId = latestRun.runId || null;
    return matrix;
  }

  /**
   * Enrich with healing data from healing log.
   * @param {object} matrix - Matrix to enrich
   * @param {Array} healingLog - Healing events
   * @returns {object} Matrix with healing annotations
   */
  enrichWithHealingData(matrix, healingLog) {
    if (!healingLog || healingLog.length === 0) return matrix;

    const healMap = new Map();
    for (const event of healingLog) {
      const key = event.testTitle || 'runtime-healing';
      if (!healMap.has(key)) {
        healMap.set(key, { attempts: 0, successes: 0, events: [] });
      }
      const entry = healMap.get(key);
      entry.attempts++;
      if (event.applied) entry.successes++;
      entry.events.push({
        originalSelector: event.originalSelector,
        healedSelector: event.healedSelector,
        applied: event.applied,
        confidence: event.confidence,
      });
    }

    for (const req of matrix.requirements) {
      for (const test of req.tests) {
        const healData = healMap.get(test.testTitle);
        if (healData) {
          test.healingAttempts = healData.attempts;
          test.healingSuccesses = healData.successes;
          test.healingEvents = healData.events.slice(-3); // Last 3
        }
      }
    }

    return matrix;
  }

  /**
   * Generate a formatted summary of the traceability matrix.
   * @param {object} matrix
   * @returns {object} Summary report
   */
  generateReport(matrix) {
    const totalReqs = matrix.requirements.length;
    const passedReqs = matrix.requirements.filter(r => r.status === 'passed').length;
    const failedReqs = matrix.requirements.filter(r => r.status === 'failed').length;
    const totalTests = matrix.requirements.reduce((sum, r) => sum + (r.testCount || r.tests.length), 0);

    return {
      summary: {
        totalRequirements: totalReqs,
        passedRequirements: passedReqs,
        failedRequirements: failedReqs,
        coverageRate: totalReqs > 0 ? +((passedReqs / totalReqs) * 100).toFixed(1) : 0,
        totalTests,
      },
      requirements: matrix.requirements,
      generatedAt: matrix.generatedAt,
      enrichedAt: matrix.enrichedAt || null,
      latestRunId: matrix.latestRunId || null,
    };
  }

  // --- Private helpers ---

  _extractAllureCall(source, method) {
    const regex = new RegExp(`allure\\.${method}\\s*\\(\\s*['"\`]([^'"\`]+)['"\`]\\s*\\)`, 'g');
    const results = [];
    let match;
    while ((match = regex.exec(source)) !== null) {
      results.push(match[1]);
    }
    return results;
  }

  _extractTestTitles(source) {
    const titles = [];
    // Match test('title', ...) and test.only('title', ...)
    const regex = /test(?:\.only)?\s*\(\s*['"`]([^'"`]+)['"`]/g;
    let match;
    while ((match = regex.exec(source)) !== null) {
      titles.push(match[1]);
    }
    return titles;
  }
}

module.exports = { TraceabilityMatrix };
