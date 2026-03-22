/**
 * GPT prompt builder for the Failure Analysis agent.
 * Constructs prompts for post-failure root cause analysis.
 */

/**
 * Build the prompt for failure analysis.
 * @param {object} params
 * @param {string} params.testFile - Path to the test file.
 * @param {string} params.testTitle - Full test title.
 * @param {string} params.errorMessage - The error message.
 * @param {string} params.errorStack - Stack trace (trimmed).
 * @param {string} [params.testSource] - Source code of the test file.
 * @param {string[]} [params.steps] - List of test.step names executed before failure.
 * @param {boolean} params.hasScreenshot - Whether a screenshot is available.
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function buildFailureAnalysisPrompt({
  testFile,
  testTitle,
  errorMessage,
  errorStack,
  testSource,
  steps,
  hasScreenshot,
}) {
  const systemPrompt = `You are a senior QA automation engineer specializing in Playwright test failure analysis. Given the details of a failed test, you must determine the root cause and categorize the failure.

Failure categories:
- "locator_broken": A selector no longer matches any element in the DOM
- "assertion_mismatch": The element exists but its text/value/state doesn't match the expected assertion
- "timeout": An operation timed out, likely due to slow page load or async timing
- "network_error": An API call or resource failed to load
- "data_issue": Test data is invalid, stale, or conflicting with server state
- "app_bug": The application itself has a bug (not a test issue)
- "test_logic_error": The test steps or assertions have incorrect logic
- "environment_issue": Infrastructure, browser, or environment-specific failure

You MUST respond with valid JSON:
{
  "category": "<one of the categories above>",
  "rootCause": "<1-2 sentence description of the root cause>",
  "explanation": "<detailed paragraph explaining the failure chain: what happened, why, and what evidence supports this>",
  "suggestedFix": "<specific actionable fix for the test or the app>",
  "confidence": <0.0 to 1.0>,
  "affectedLocator": "<the specific selector that failed, if applicable, or null>",
  "relatedFiles": ["<list of files likely needing changes>"],
  "severity": "critical" | "high" | "medium" | "low"
}`;

  let userPrompt = `A Playwright test has failed. Analyze the failure and provide a root cause assessment.

**Test file:** ${testFile}
**Test title:** ${testTitle}
**Error message:** ${errorMessage}

**Stack trace (trimmed):**
\`\`\`
${errorStack || 'N/A'}
\`\`\``;

  if (steps && steps.length > 0) {
    userPrompt += `\n\n**Test steps executed before failure:**\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
  }

  if (testSource) {
    userPrompt += `\n\n**Test source code:**\n\`\`\`js\n${testSource.substring(0, 10000)}\n\`\`\``;
  }

  if (hasScreenshot) {
    userPrompt += '\n\n**Note:** A screenshot of the page at the moment of failure is attached in the vision message.';
  }

  return { systemPrompt, userPrompt };
}

module.exports = { buildFailureAnalysisPrompt };
