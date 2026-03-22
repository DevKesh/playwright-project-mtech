/**
 * GPT prompt builder for Phase 2: Strategic Risk Analysis.
 *
 * Given the list of page objects and historical failure data,
 * determines which components are highest risk and need proactive drift checking.
 */

/**
 * Build the prompt for risk analysis.
 * @param {object} params
 * @param {Array} params.pageObjects - List of { file, locatorCount } entries
 * @param {Array} params.healingHistory - Recent healing events
 * @param {Array} params.runHistory - Recent run history
 * @param {object} params.coverageMap - { pageObject: [testSpecs] }
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function buildRiskAnalysisPrompt({ pageObjects, healingHistory, runHistory, coverageMap }) {
  const systemPrompt = `You are a QA risk analyst for a Playwright test automation framework. Given a list of page objects, their historical failure rates, and test coverage data, you must:

1. Assign a risk score (0-100) to each page object based on historical failures and healing frequency.
2. Identify the top candidates for proactive drift detection.
3. Recommend a prioritized action plan.

Consider:
- Page objects with more healing events are higher risk (locators are fragile)
- Page objects covering more tests have higher blast radius
- Recent failures weigh more than old ones

You MUST respond with valid JSON:
{
  "riskAssessment": [
    {
      "pageObject": "<file path>",
      "riskScore": <0-100>,
      "factors": ["<reason for risk score>"],
      "locatorCount": <number>,
      "testCount": <number of tests depending on this page object>
    }
  ],
  "driftCandidates": ["<page objects that should be checked for drift, highest risk first>"],
  "prioritizedActions": [
    {
      "action": "<what to do>",
      "target": "<which file/component>",
      "priority": "critical" | "high" | "medium" | "low",
      "rationale": "<why>"
    }
  ],
  "summary": "<1-2 paragraph executive summary of the risk landscape>"
}`;

  // Build context sections
  let userPrompt = `**Page Objects in the project:**\n`;
  for (const po of pageObjects) {
    const tests = coverageMap[po.file] || [];
    userPrompt += `- ${po.file}: ${po.locatorCount} locators, ${tests.length} dependent tests\n`;
  }

  if (healingHistory && healingHistory.length > 0) {
    userPrompt += `\n**Recent Healing Events (last ${healingHistory.length}):**\n`;
    // Group by selector
    const selectorCounts = {};
    for (const event of healingHistory) {
      const key = event.originalSelector || 'unknown';
      selectorCounts[key] = (selectorCounts[key] || 0) + 1;
    }
    for (const [selector, count] of Object.entries(selectorCounts)) {
      userPrompt += `- "${selector}": ${count} healing attempt(s)\n`;
    }
  } else {
    userPrompt += '\n**Healing History:** No healing events recorded yet.\n';
  }

  if (runHistory && runHistory.length > 0) {
    const recentRuns = runHistory.slice(-5);
    userPrompt += `\n**Recent Test Runs (last ${recentRuns.length}):**\n`;
    for (const run of recentRuns) {
      const total = (run.tests || []).length;
      const failed = (run.tests || []).filter(t => t.status === 'failed').length;
      userPrompt += `- ${run.runId || 'unknown'}: ${total} tests, ${failed} failed\n`;
    }
  } else {
    userPrompt += '\n**Run History:** No test runs recorded yet.\n';
  }

  userPrompt += '\nAnalyze the risk landscape and provide your assessment.';

  return { systemPrompt, userPrompt };
}

module.exports = { buildRiskAnalysisPrompt };
