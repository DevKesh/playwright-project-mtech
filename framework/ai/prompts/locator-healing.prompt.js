/**
 * GPT prompt builder for the Locator Healing agent.
 * Constructs system and user prompts for asking GPT to suggest
 * alternative selectors when one breaks.
 */

/**
 * Build the prompt for locator healing.
 * @param {object} params
 * @param {string} params.failedSelector - The selector expression that failed.
 * @param {string} params.errorMessage - The error message from Playwright.
 * @param {string} params.action - The action that was attempted (click, fill, etc.).
 * @param {string} params.domSnapshot - Trimmed DOM of the page.
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function buildLocatorHealingPrompt({ failedSelector, errorMessage, action, domSnapshot }) {
  const systemPrompt = `You are a Playwright test automation expert specializing in element selectors. A test selector has failed to find an element on a web page. Your job is to analyze the page DOM and suggest corrected selectors.

Rules:
1. Suggest exactly 3 alternative selectors, ranked by confidence (highest first).
2. Prefer Playwright-native locator strategies in this priority order:
   - getByRole (most resilient to UI changes)
   - getByText / getByLabel / getByPlaceholder
   - CSS selectors with IDs or data attributes
   - CSS selectors with classes (least preferred)
3. NEVER suggest XPath selectors.
4. Each suggestion must be a valid Playwright locator expression that can be passed to page.locator() or used as page.getByRole(), etc.
5. For page.locator() suggestions, provide the CSS/text selector string only.
6. For getByRole/getByText/etc., provide the full method call as a string like: getByRole('button', { name: /submit/i })
7. Analyze the DOM carefully to ensure the suggested selector actually matches an element.
8. Consider that the page may have changed — the element might have moved, been renamed, or had its attributes altered.

You MUST respond with valid JSON in this exact format:
{
  "analysis": "<brief explanation of why the original selector failed and what changed>",
  "suggestions": [
    {
      "type": "locator" | "getByRole" | "getByText" | "getByLabel" | "getByPlaceholder" | "getByAltText" | "getByTitle" | "getByTestId",
      "selector": "<the selector string or method arguments>",
      "confidence": <0.0 to 1.0>,
      "explanation": "<why this suggestion should work>"
    }
  ]
}`;

  const userPrompt = `A Playwright locator has failed during a test execution.

**Failed selector:** ${failedSelector}
**Action attempted:** ${action}
**Error:** ${errorMessage}

**Current page DOM (trimmed to interactive elements):**
\`\`\`html
${domSnapshot}
\`\`\`

Analyze the DOM and suggest 3 alternative selectors that would find the intended element.`;

  return { systemPrompt, userPrompt };
}

module.exports = { buildLocatorHealingPrompt };
