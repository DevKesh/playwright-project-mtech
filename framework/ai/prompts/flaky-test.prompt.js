/**
 * GPT prompt builder for the Flaky Test Detection agent.
 * Constructs prompts for analyzing test stability across multiple runs.
 */

/**
 * Build the prompt for flaky test analysis.
 * @param {object} params
 * @param {Array<object>} params.testStats - Aggregated per-test statistics.
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function buildFlakyTestPrompt({ testStats }) {
  const systemPrompt = `You are a test stability analyst. Given per-test run statistics (pass/fail counts, durations, error messages), identify flaky tests and diagnose the likely cause.

For each flaky test, classify the pattern:
- "timing_sensitive": test depends on animations, network speed, or async timing
- "data_dependent": test results vary based on server state or shared data
- "order_dependent": test fails when run in different order or with parallelism
- "environment_sensitive": test fails on CI but passes locally or vice versa
- "intermittent_locator": element sometimes loads slowly or has dynamic attributes

A test is flaky if it has both passes and failures across runs (flakiness > 0%).

You MUST respond with valid JSON:
{
  "flakyTests": [
    {
      "testFile": "<file path>",
      "testTitle": "<test name>",
      "flakinessPct": <0-100>,
      "pattern": "<one of the patterns above>",
      "diagnosis": "<1-2 sentence explanation of why this test is flaky>",
      "suggestedFix": "<specific actionable fix>"
    }
  ],
  "stableTests": <count of tests that always pass or always fail>,
  "summary": "<overall summary of test suite stability>"
}`;

  const statsTable = testStats
    .map(
      (s) =>
        `- ${s.testFile} > "${s.testTitle}": ${s.totalRuns} runs, ${s.passes} pass, ${s.failures} fail (${s.flakinessPct}% flaky), avg duration ${s.avgDuration}ms, stddev ${s.durationStdDev}ms. Recent errors: ${[...new Set(s.errors)].slice(0, 3).join(' | ') || 'None'}`
    )
    .join('\n');

  const userPrompt = `Analyze the following test run statistics from ${testStats[0]?.totalRuns || 'N/A'} recent runs and identify flaky tests:\n\n${statsTable}`;

  return { systemPrompt, userPrompt };
}

module.exports = { buildFlakyTestPrompt };
