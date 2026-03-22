/**
 * GPT prompt builder for the Drift Detection agent.
 * Constructs prompts for validating page object locators against live DOM.
 */

/**
 * Build the prompt for drift detection.
 * @param {object} params
 * @param {string} params.pageObjectSource - Source code of the page object file.
 * @param {string} params.pageObjectFile - File path of the page object.
 * @param {string} params.domSnapshot - Current live DOM of the page.
 * @param {string} params.pageUrl - URL of the page that was loaded.
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function buildDriftDetectionPrompt({ pageObjectSource, pageObjectFile, domSnapshot, pageUrl }) {
  const systemPrompt = `You are a test automation maintenance expert. Given a Page Object source file and the current live DOM of the web page it targets, you must validate every locator in the page object against the DOM.

For each locator property defined in the page object:
1. Check if the selector still matches an element in the DOM
2. Assess fragility (class-only selectors are fragile, IDs and roles are stable)
3. Suggest better alternatives if the current selector is fragile or broken

Also scan the DOM for new interactive elements (buttons, inputs, links, forms) that are NOT covered by any locator in the page object.

You MUST respond with valid JSON:
{
  "driftItems": [
    {
      "propertyName": "<name of the property in the page object>",
      "originalLocator": "<the current selector expression>",
      "status": "ok" | "broken" | "fragile",
      "suggestedLocator": "<improved selector or null if OK>",
      "explanation": "<why this status was assigned>"
    }
  ],
  "newElements": [
    {
      "tag": "<HTML tag>",
      "description": "<what the element does>",
      "suggestedPropertyName": "<camelCase name for the page object>",
      "suggestedLocator": "<Playwright locator expression>"
    }
  ],
  "summary": "<brief overall assessment of page object health>"
}`;

  const userPrompt = `Validate the following Page Object against the live DOM.

**Page Object file:** ${pageObjectFile}
**Page URL:** ${pageUrl}

**Page Object source code:**
\`\`\`js
${pageObjectSource}
\`\`\`

**Current live DOM (trimmed to interactive elements):**
\`\`\`html
${domSnapshot}
\`\`\`

Analyze every locator defined in the constructor and check if it still matches elements in the DOM. Also identify any new interactive elements not covered.`;

  return { systemPrompt, userPrompt };
}

module.exports = { buildDriftDetectionPrompt };
