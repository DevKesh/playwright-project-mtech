/**
 * Natural Language Test Authoring Prompts
 *
 * Converts plain English test descriptions into structured action steps,
 * and maps DOM snapshots to Playwright selectors for live execution.
 */

/**
 * Build prompt to parse natural language test instructions into structured steps.
 * @param {object} params
 * @param {string} params.instructions - Plain English test description from the user.
 * @param {object} [params.testDataConfig] - Centralized test data config for context.
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function buildParseInstructionsPrompt({ instructions, testDataConfig }) {
  const systemPrompt = `You are a QA automation architect. The user has described a test scenario in plain English.
Parse it into an ordered list of structured action steps that can be executed in a browser.

Each step must be ONE of these action types:
- "navigate": Go to a URL
- "click": Click an element (button, link, tab, menu item)
- "fill": Type text into an input field
- "select": Choose an option from a dropdown
- "hover": Hover over an element
- "assert_visible": Verify an element is visible on the page
- "assert_text": Verify text content on the page
- "assert_url": Verify the current URL matches a pattern
- "wait": Wait for a condition (page load, element appear, etc.)
- "screenshot": Take a screenshot for verification
- "press": Press a keyboard key (Enter, Tab, Escape, etc.)

For "fill" actions, determine the value from the instructions or from testDataConfig if credentials/data are needed.
Use testDataConfig references like "testDataConfig.targetApp.credentials.email" when the user mentions logging in or using configured data.

You MUST respond with valid JSON:
{
  "testName": "descriptive-kebab-case-name",
  "testTitle": "Human readable test title",
  "epic": "App area (e.g., Total Connect, Authentication)",
  "feature": "Feature name (e.g., Navigation, Device Management)",
  "story": "User story (e.g., User navigates to devices page)",
  "severity": "critical|normal|minor",
  "tags": ["tag1", "tag2"],
  "steps": [
    {
      "stepNumber": 1,
      "description": "Human readable step description",
      "action": "navigate|click|fill|select|hover|assert_visible|assert_text|assert_url|wait|screenshot|press",
      "target": "Description of what element to interact with (e.g., 'the login button', 'the username input field')",
      "value": "Value to fill/select/assert (if applicable)",
      "valueSource": "literal|testDataConfig.path.to.value",
      "urlPattern": "URL regex pattern (for navigate/assert_url actions)",
      "expectedPage": "What page we expect to be on after this step (e.g., 'Login Page', 'Dashboard')"
    }
  ]
}`;

  const testDataRef = testDataConfig
    ? `\n\nAvailable test data configuration (use references to these paths instead of hardcoding values):\n${JSON.stringify(testDataConfig, null, 2)}`
    : '';

  const userPrompt = `Parse these test instructions into structured steps:

"""
${instructions}
"""
${testDataRef}

Generate the structured steps. Be thorough — include navigation, actions, AND verification/assertion steps.`;

  return { systemPrompt, userPrompt };
}

/**
 * Build prompt to determine the Playwright action for a single step given the current DOM.
 * @param {object} params
 * @param {object} params.step - The structured step to execute.
 * @param {string} params.domSnapshot - Current page DOM snapshot.
 * @param {string} params.currentUrl - Current page URL.
 * @param {string} params.pageTitle - Current page title.
 * @param {Array} params.previousActions - Actions already executed (for context).
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function buildResolveActionPrompt({ step, domSnapshot, currentUrl, pageTitle, previousActions }) {
  const systemPrompt = `You are a Playwright automation expert. Given a test step description and the current page DOM, determine the EXACT Playwright code to execute this step.

You must choose the most robust selector strategy:
1. Prefer #id selectors when available
2. Use getByRole() for buttons, links, headings with accessible names
3. Use getByPlaceholder() for inputs with placeholders
4. Use getByLabel() for labeled form fields
5. Use getByText() for unique visible text
6. Use CSS selectors as a last resort

You MUST respond with valid JSON:
{
  "playwrightCode": "The exact Playwright code line(s) to execute — use 'page' as the Page object variable",
  "selector": "The primary selector used (for recording in the page object)",
  "selectorStrategy": "locator|getByRole|getByText|getByLabel|getByPlaceholder|getByTestId",
  "elementName": "camelCase property name for the page object (e.g., loginButton, emailInput)",
  "isAssertion": true/false,
  "confidence": 0.0-1.0,
  "fallbackCode": "Alternative code if primary fails (or null)",
  "notes": "Any caveats or observations"
}

IMPORTANT:
- Every line of code MUST use await — Playwright operations are async. Never call .click(), .fill(), .check(), .goto(), .waitFor*(), expect().toBe*() etc. without await.
- For assertions, use expect() from @playwright/test — always with await (e.g., await expect(locator).toBeVisible())
- If the element is not found in the DOM, set confidence to 0 and explain in notes
- Handle potential popups/modals that might obscure the target element
- Do NOT add waitForLoadState() calls in the generated code — the execution engine handles page readiness automatically
- Do NOT add waitForTimeout() or artificial delays — Playwright's auto-waiting handles element readiness
- Playwright locators auto-wait for elements to be actionable (visible, stable, enabled) before performing actions
- Keep the generated code minimal — just the action, no extra waits`;

  const prevActionsStr = previousActions.length > 0
    ? `\n**Actions already performed in this session:**\n${previousActions.map((a, i) => `${i + 1}. ${a.description} → ${a.playwrightCode}`).join('\n')}`
    : '';

  const userPrompt = `Execute this test step:

**Step #${step.stepNumber}:** ${step.description}
**Action type:** ${step.action}
**Target element:** ${step.target || 'N/A'}
**Value to use:** ${step.value || 'N/A'}
**Value source:** ${step.valueSource || 'literal'}
**Expected page after:** ${step.expectedPage || 'Same page'}

**Current page URL:** ${currentUrl}
**Current page title:** ${pageTitle}
${prevActionsStr}

**Current DOM snapshot:**
${domSnapshot}

Determine the exact Playwright code to execute this step.`;

  return { systemPrompt, userPrompt };
}

/**
 * Build prompt to generate a Page Object from recorded actions.
 * @param {object} params
 * @param {Array} params.recordedActions - All recorded actions with selectors.
 * @param {string} params.pageName - PascalCase page name.
 * @param {string} params.pageUrl - URL of the page.
 * @param {string} params.patternExample - Existing PO source code as pattern.
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function buildRecordedActionsToPageObjectPrompt({ recordedActions, pageName, pageUrl, patternExample }) {
  const systemPrompt = `You are a Playwright test framework engineer. Generate a Page Object class from recorded browser actions.

**Rules:**
1. CommonJS module syntax: \`module.exports = { ClassName }\`
2. Constructor takes \`page\` and stores locators as properties
3. Each unique element gets a locator property in the constructor
4. Each user action gets an async method (group related actions into meaningful methods)
5. Import \`expect\` from \`@playwright/test\` if assertions are needed
6. Add an \`async open(url)\` method if navigation was recorded
7. Use descriptive property names matching the recorded elementName values
8. Keep it clean and minimal — follow the pattern example exactly
9. Do NOT duplicate locators — if the same element is used in multiple steps, define it once
10. Group related fill actions into a single method (e.g., fillLoginForm(username, password))

**CRITICAL — Async/Await & Wait Rules (mandatory in every method):**
- Every Playwright call MUST use \`await\` — .click(), .fill(), .check(), .selectOption(), .goto(), .waitFor*(), expect().toBe*() are all async
- After \`this.page.goto()\` — add \`await this.page.waitForLoadState('domcontentloaded');\`
- After a click that triggers a full page navigation (new URL) — add \`await this.page.waitForLoadState('networkidle');\`
- After form login / submit that loads a new page — add \`await this.page.waitForLoadState('networkidle');\`
- Do NOT add \`waitForLoadState\` after simple clicks (buttons, tabs, toggles on the same page) — Playwright auto-waits
- Do NOT add \`waitForTimeout()\` or artificial delays
- NEVER fire-and-forget: every action must complete before the next line runs

CRITICAL: The "code" field in your JSON response must contain the ACTUAL, COMPLETE, RUNNABLE JavaScript source code for the Page Object class — NOT a description or placeholder. The code must be a real implementation that can be saved to a .js file and imported directly.

You MUST respond with valid JSON:
{
  "className": "PascalCasePageName",
  "fileName": "PascalCasePageName.js",
  "code": "const { expect } = require('@playwright/test');\\n\\nclass ExamplePage {\\n  constructor(page) {\\n    this.page = page;\\n    this.myButton = page.locator('#myBtn');\\n  }\\n  async open(url) {\\n    await this.page.goto(url);\\n    await this.page.waitForLoadState('domcontentloaded');\\n  }\\n  async clickMyButton() {\\n    await this.myButton.click();\\n  }\\n}\\n\\nmodule.exports = { ExamplePage };",
  "locators": [{ "name": "propName", "strategy": "strategy", "selector": "value" }],
  "methods": [{ "name": "methodName", "description": "what it does" }]
}

The "code" value above is just a structural hint. You must generate real, complete, working code with ALL locators and methods for the given page.`;

  const userPrompt = `Generate a Page Object from these recorded browser actions:

**Page Name:** ${pageName}
**Page URL:** ${pageUrl}

**Recorded Actions:**
${recordedActions.map((a, i) => `${i + 1}. [${a.action}] ${a.description}
   Element: ${a.elementName || 'N/A'} → ${a.selectorStrategy}(${a.selector})
   Code: ${a.playwrightCode}`).join('\n')}

**PATTERN EXAMPLE — follow this style exactly:**
\`\`\`javascript
${patternExample}
\`\`\`

Generate the Page Object class.`;

  return { systemPrompt, userPrompt };
}

/**
 * Build prompt to generate a test spec from recorded actions.
 * @param {object} params
 * @param {object} params.parsedInstructions - The original parsed instructions (testName, steps, etc.).
 * @param {Array} params.recordedActions - All recorded actions with Playwright code.
 * @param {Array} params.pageObjects - Generated page object metadata.
 * @param {string} params.patternExample - Existing spec source code as pattern.
 * @param {object} [params.testDataConfig] - Centralized test data config.
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function buildRecordedActionsToSpecPrompt({ parsedInstructions, recordedActions, pageObjects, patternExample, testDataConfig }) {
  const systemPrompt = `You are a Playwright test engineer. Generate a test spec file from recorded browser actions and generated page objects.

**Rules:**
1. Use CommonJS: \`const { test, expect } = require('../../framework/ai/fixtures/tc.ai.fixture');\` — this provides AI self-healing when enabled
2. Import \`allure\` from \`allure-js-commons\`
3. Every test MUST have allure tags: epic, feature, story, severity, tags
4. Use \`test.describe()\` to group related tests
5. Use \`test.step()\` for each logical step
6. Import and use the generated Page Object classes — instantiate them in the test
7. Add meaningful assertions after key actions
8. NEVER hardcode test data — use testDataConfig for all credentials, URLs, data
9. Add this import: \`const { testDataConfig } = require('../../framework/config/test-data.config');\`
10. The spec file goes in tests/generated/ so import paths should use ../../framework/
11. Make the test self-contained and independently runnable

**CRITICAL — Async/Await & Wait Rules (mandatory — violating these causes flaky tests):**
- Every Playwright call MUST use \`await\` — .click(), .fill(), .goto(), .waitFor*(), expect().toBe*() are ALL async
- After \`page.goto()\` or Page Object \`.open()\` — add \`await page.waitForLoadState('domcontentloaded');\`
- After a click/submit that navigates to a NEW page/URL — add \`await page.waitForLoadState('networkidle');\`
- After form login that loads a dashboard/home page — add \`await page.waitForLoadState('networkidle');\`
- Do NOT add \`waitForLoadState\` after simple clicks (buttons, checkboxes, toggles on same page) — Playwright auto-waits
- Do NOT add \`waitForTimeout()\` or artificial delays
- NEVER use Promise.all() or parallel execution for sequential UI actions — each action MUST complete before the next begins
- Inside test.step() callbacks, every action must be awaited
- If you call a Page Object method, always \`await\` it

CRITICAL: Generate REAL, COMPLETE, RUNNABLE JavaScript code. The "code" field must contain actual working source code, NOT a placeholder.

You MUST respond with valid JSON:
{
  "fileName": "kebab-case-name.spec.js",
  "code": "const { test, expect } = require('../../framework/ai/fixtures/tc.ai.fixture');\\nconst allure = require('allure-js-commons');\\nconst { testDataConfig } = require('../../framework/config/test-data.config');\\n\\ntest.describe('Flow Name', () => {\\n  test('test title', async ({ page }) => {\\n    await allure.epic('Epic');\\n    await allure.feature('Feature');\\n    // ... real test steps ...\\n  });\\n});",
  "testCases": [{ "title": "test title", "steps": ["step1", "step2"] }]
}

The "code" value above is just a structural hint. You must generate real, complete, working code with ALL test steps, assertions and imports for the given test scenario.`;

  const poSummary = pageObjects.map(po =>
    `**${po.className}** (${po.fileName})\n  Import: const { ${po.className} } = require('../../framework/pages/generated/${po.fileName}');\n  Methods: ${(po.methods || []).map(m => `${m.name}()`).join(', ')}`
  ).join('\n\n');

  const testDataRef = testDataConfig
    ? `\n**Test Data Configuration (use this, do NOT hardcode):**\n\`\`\`json\n${JSON.stringify(testDataConfig, null, 2)}\n\`\`\``
    : '';

  const userPrompt = `Generate a test spec from these recorded actions:

**Test Name:** ${parsedInstructions.testName}
**Test Title:** ${parsedInstructions.testTitle}
**Epic:** ${parsedInstructions.epic}
**Feature:** ${parsedInstructions.feature}
**Story:** ${parsedInstructions.story}
**Severity:** ${parsedInstructions.severity}
**Tags:** ${(parsedInstructions.tags || []).join(', ')}

**Recorded Actions (in execution order):**
${recordedActions.map((a, i) => `${i + 1}. [${a.action}] ${a.description}
   Code: ${a.playwrightCode}
   Page: ${a.expectedPage || 'Unknown'}`).join('\n')}

**Available Page Objects:**
${poSummary}
${testDataRef}

**PATTERN EXAMPLE — follow this style exactly:**
\`\`\`javascript
${patternExample}
\`\`\`

Generate the test spec file.`;

  return { systemPrompt, userPrompt };
}

module.exports = {
  buildParseInstructionsPrompt,
  buildResolveActionPrompt,
  buildRecordedActionsToPageObjectPrompt,
  buildRecordedActionsToSpecPrompt,
};
