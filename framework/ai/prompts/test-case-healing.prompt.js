/**
 * GPT prompt builder for the Test Case Healing agent.
 * Constructs prompts for fixing broken test logic/assertions
 * (not just locators, but actual test flow issues).
 */

/**
 * Build the prompt for test case healing.
 * @param {object} params
 * @param {string} params.testFile - Path to the test file.
 * @param {string} params.testTitle - Full test title.
 * @param {string} params.testSource - Source code of the test file.
 * @param {object} params.relatedSources - Map of file path -> source for required files.
 * @param {string} params.errorMessage - Error message.
 * @param {string} params.errorStack - Stack trace.
 * @param {Array} [params.healingAttempts] - Previous locator healing attempts (if any).
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function buildTestCaseHealingPrompt({
  testFile,
  testTitle,
  testSource,
  relatedSources,
  errorMessage,
  errorStack,
  healingAttempts,
  ragContext,
}) {
  const systemPrompt = `You are a senior test automation engineer. A Playwright test is failing NOT because of broken locators (those have been checked) but because the test LOGIC or ASSERTIONS no longer match the application behavior.

Analyze the test code against the error and suggest specific code changes.

Rules:
1. Suggest minimal changes — prefer fixing assertions over rewriting flows.
2. If the app added a new mandatory step (e.g., a confirmation dialog), add it.
3. If assertion text changed, update the expected text.
4. If flow order changed, reorder the steps.
5. If a new field became required, add the fill action.
6. NEVER suggest changes that would hide real bugs — only fix test-app mismatches.
7. Each suggestion should target a specific file and line range.

You MUST respond with valid JSON:
{
  "analysis": "<paragraph explaining what changed in the app and why the test fails>",
  "suggestedChanges": [
    {
      "file": "<which file to change>",
      "lineRange": "<e.g., 45-48>",
      "currentCode": "<the current code snippet>",
      "suggestedCode": "<the replacement code>",
      "explanation": "<why this change is needed>"
    }
  ],
  "confidence": <0.0 to 1.0>,
  "changeType": "assertion_update" | "flow_update" | "data_update" | "new_step" | "step_removal"
}`;

  let userPrompt = `**Test file:** ${testFile}
**Test title:** ${testTitle}

**Error:**
\`\`\`
${errorMessage}
${(errorStack || '').split('\n').slice(0, 15).join('\n')}
\`\`\`

**Test source code:**
\`\`\`js
${testSource}
\`\`\``;

  // Append related source files (page objects, flows)
  if (relatedSources && Object.keys(relatedSources).length > 0) {
    for (const [filePath, source] of Object.entries(relatedSources)) {
      userPrompt += `\n\n**Related file (${filePath}):**\n\`\`\`js\n${source.substring(0, 8000)}\n\`\`\``;
    }
  }

  if (healingAttempts && healingAttempts.length > 0) {
    userPrompt += `\n\n**Locator healing was attempted but did not resolve the failure:**\n${JSON.stringify(healingAttempts, null, 2)}`;
  }

  userPrompt += '\n\nAnalyze the test failure and suggest the minimal code changes to fix this test. Focus on test logic and assertions, not locators.';

  // Append RAG context if available (similar past failures and healing attempts)
  if (ragContext) {
    userPrompt += ragContext;
  }

  return { systemPrompt, userPrompt };
}

module.exports = { buildTestCaseHealingPrompt };
