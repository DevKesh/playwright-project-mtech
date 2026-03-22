/**
 * Page Object Generation Prompt: builds prompts for GPT to generate
 * Playwright Page Object classes from discovered page structures.
 */

/**
 * Build prompt for generating a Page Object class.
 * @param {object} params
 * @param {object} params.pageData - Discovered page data (DOM structure, classification, elements).
 * @param {string} params.patternExample - Source code of an existing PO (e.g., AuthPage.js) as pattern.
 * @param {string} params.domSnapshot - Raw DOM snippet for locator accuracy.
 * @param {object} [params.testDataConfig] - Centralized test data config.
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function buildPageObjectGenPrompt({ pageData, patternExample, domSnapshot, testDataConfig }) {
  const baseUrl = testDataConfig?.targetApp?.baseUrl || '';

  const systemPrompt = `You are a Playwright test framework engineer. Generate a Page Object class that follows the EXACT pattern shown in the example below.

**Rules:**
1. The class MUST use CommonJS module syntax: \`module.exports = { ClassName }\`
2. The constructor takes \`page\` and stores locators as properties using \`page.locator()\`, \`page.getByRole()\`, \`page.getByText()\`, \`page.getByLabel()\`, \`page.getByPlaceholder()\`, or \`page.getByTestId()\`
3. Use the most robust locator strategy: prefer \`#id\` over \`.class\`, prefer \`getByRole\` for buttons, prefer \`getByPlaceholder\` for inputs with placeholders, prefer \`getByText\` for unique text
4. Each meaningful user action gets an async method
5. Import \`expect\` from \`@playwright/test\` if assertions are needed
6. If this is an entry page, add \`async open(url)\` method that calls \`this.page.goto(url)\` — do NOT hardcode URLs as default parameter values
7. Use descriptive property names (e.g., \`this.loginButton\`, \`this.emailInput\`)
8. Do NOT add unnecessary comments or documentation — keep it minimal like the example

CRITICAL: The "code" field in your JSON response must contain the ACTUAL, COMPLETE, RUNNABLE JavaScript source code for the Page Object class — NOT a description or placeholder. The code must be a real implementation that can be saved to a .js file and imported directly.

You MUST respond with valid JSON:
{
  "className": "PascalCasePageName",
  "fileName": "PascalCasePageName.js",
  "code": "const { expect } = require('@playwright/test');\\n\\nclass ExamplePage {\\n  constructor(page) {\\n    this.page = page;\\n    // ... actual locators ...\\n  }\\n  // ... actual methods ...\\n}\\n\\nmodule.exports = { ExamplePage };",
  "locators": [
    { "name": "propertyName", "strategy": "locator|getByRole|getByText|etc", "selector": "the selector value" }
  ],
  "methods": [
    { "name": "methodName", "description": "what this method does" }
  ]
}

The "code" value above is just a structural hint. You must generate real, complete, working code with ALL locators and methods for the given page.`;

  const userPrompt = `Generate a Page Object class for this page:

**Page URL:** ${pageData.url}
**Classification:** ${pageData.classification}
**Purpose:** ${pageData.purpose || 'N/A'}
**Page Name:** ${pageData.pageName || 'UnknownPage'}

**Interactive Elements:**
${JSON.stringify(pageData.keyElements || [], null, 2)}

**Form Fields:**
${JSON.stringify(pageData.formFields || [], null, 2)}

**User Actions:**
${JSON.stringify(pageData.userActions || [], null, 2)}

${domSnapshot ? `**DOM Snapshot (for accurate selectors):**\n${domSnapshot.substring(0, 30000)}` : ''}

**PATTERN EXAMPLE — follow this style exactly:**
\`\`\`javascript
${patternExample}
\`\`\`

Generate the Page Object class matching this pattern.`;

  return { systemPrompt, userPrompt };
}

module.exports = { buildPageObjectGenPrompt };
