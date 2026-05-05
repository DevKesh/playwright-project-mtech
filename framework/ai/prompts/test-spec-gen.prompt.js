/**
 * Test Spec Generation Prompt: builds prompts for GPT to generate
 * Playwright test spec files from identified user flows.
 */

const fs = require('fs');
const path = require('path');

/**
 * Load the exploration context markdown file for additional guidance.
 */
function loadExplorationContext() {
  const contextPath = path.join(__dirname, 'exploration-context.md');
  try {
    return fs.readFileSync(contextPath, 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Build prompt for generating a test spec file.
 * @param {object} params
 * @param {object} params.flow - Identified user flow (name, steps, priority).
 * @param {Array} params.pageObjects - Generated page object metadata (className, methods, locators).
 * @param {string} params.patternExample - Source code of an existing spec file as pattern.
 * @param {string} params.appName - Name of the application.
 * @param {object} [params.testDataConfig] - Centralized test data config.
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function buildTestSpecGenPrompt({ flow, pageObjects, patternExample, appName, testDataConfig }) {
  const explorationContext = loadExplorationContext();

  const systemPrompt = `You are a Playwright test engineer. Generate a test spec file that follows the EXACT pattern shown in the example below.

${explorationContext ? `**APPLICATION CONTEXT (use this for test flow design, assertions, and locator usage):**\n${explorationContext}\n` : ''}

**Rules:**
1. Use CommonJS: \`const { test, expect } = require('../../framework/ai/fixtures/tc.ai.fixture');\` — this provides AI self-healing when enabled
2. Import \`allure\` from \`allure-js-commons\`
3. Every test MUST have these allure tags: \`allure.epic()\`, \`allure.feature()\`, \`allure.story()\`, \`allure.severity()\`, \`allure.tags()\`
4. Use \`test.describe()\` to group related tests — add \`@smoke @tc @tc-plan\` tags to the describe title
5. Use \`test.step()\` for each logical step in the test
6. Tests receive \`{ page }\` from the fixture — use \`page\` directly to create locators and perform actions
7. Import Page Object classes using EXACTLY this path pattern: \`const { ClassName } = require('../../framework/pages/generated/ClassName');\` — the path MUST be \`../../framework/pages/generated/\` — NEVER use \`../../framework/page-objects/\` or any other path
8. Add meaningful assertions after key actions using \`expect\`
9. NEVER hardcode test data (emails, passwords, URLs, search terms) inline — ALL test data MUST come from the imported testDataConfig
10. Keep tests focused — one flow per test, with positive and optionally negative scenarios
11. Do NOT import from fixture files that don't exist — use \`@playwright/test\` directly
12. ALWAYS add this import at the top of the file: \`const { testDataConfig } = require('../../framework/config/test-data.config');\`
13. Reference test data ONLY via \`testDataConfig.targetApp.credentials.email\`, \`testDataConfig.targetApp.credentials.password\`, \`testDataConfig.targetApp.baseUrl\`, etc. — NEVER define a local const/var with hardcoded test values
14. For login flows: use \`try { await loginPage.acceptConsent(); } catch {}\` to handle cookie consent — it may or may not appear
15. After login submit, wait for dashboard with: \`await expect(page).toHaveURL(/.*\\/home/, { timeout: 15000 });\` — do NOT use waitForLoadState('networkidle')

**CRITICAL — Async/Await & Wait Rules (mandatory — violating these causes flaky tests):**
- Every Playwright call MUST use \`await\` — .click(), .fill(), .goto(), .waitFor*(), expect().toBe*() are ALL async
- After \`page.goto()\` or Page Object \`.open()\` — add \`await page.waitForLoadState('domcontentloaded');\`
- After a click/submit that navigates to a NEW page/URL — add \`await page.waitForLoadState('domcontentloaded');\`
- After form login that loads a dashboard/home page — add \`await page.waitForLoadState('domcontentloaded');\`
- Do NOT use \`waitForLoadState('networkidle')\` — it causes timeouts on SPAs and real-world apps with background requests
- Do NOT add \`waitForLoadState\` after simple clicks (buttons, checkboxes, toggles on same page) — Playwright auto-waits
- Do NOT add \`waitForTimeout()\` or artificial delays
- NEVER use Promise.all() or parallel execution for sequential UI actions — each action MUST complete before the next begins
- Inside test.step() callbacks, every action must be awaited
- If you call a Page Object method, always \`await\` it

CRITICAL: The "code" field in your JSON response must contain the ACTUAL, COMPLETE, RUNNABLE JavaScript source code for the test spec — NOT a description or placeholder. The code must be a real implementation that can be saved to a .spec.js file and executed by Playwright directly.

IMPORT PATH RULES (MUST follow exactly):
- Fixture: require('../../framework/ai/fixtures/tc.ai.fixture')
- Allure: require('allure-js-commons')
- Test data: require('../../framework/config/test-data.config')
- Page Objects: require('../../framework/pages/generated/ClassName') — use destructured import { ClassName }

You MUST respond with valid JSON:
{
  "fileName": "kebab-case-flow-name.spec.js",
  "code": "const { test, expect } = require('../../framework/ai/fixtures/tc.ai.fixture');\\nconst allure = require('allure-js-commons');\\nconst { testDataConfig } = require('../../framework/config/test-data.config');\\nconst { TotalConnect2LoginPage } = require('../../framework/pages/generated/TotalConnect2LoginPage');\\n\\ntest.describe('@smoke @tc @tc-plan Flow Name', () => {\\n  test('TC01 - test title', async ({ page }) => {\\n    await allure.epic(testDataConfig.targetApp.name);\\n    // ... actual test steps using testDataConfig ...\\n  });\\n});",
  "testCases": [
    { "title": "test title", "steps": ["step 1 description", "step 2 description"] }
  ]
}

The "code" value above is just a structural hint. You must generate real, complete, working test code with ALL steps, assertions, allure tags, and page object usage. All data must come from testDataConfig.`;

  // Build PO summary for the prompt
  const poSummary = pageObjects.map(po => {
    return `**${po.className}** (${po.fileName})
  Locators: ${(po.locators || []).map(l => `${l.name} → ${l.strategy}(${l.selector})`).join(', ')}
  Methods: ${(po.methods || []).map(m => `${m.name}() — ${m.description}`).join(', ')}`;
  }).join('\n\n');

  // Build test data reference for the prompt
  const testDataRef = testDataConfig
    ? `\n**Test Data Configuration (import this, do NOT hardcode data):**
\`\`\`json
${JSON.stringify(testDataConfig, null, 2)}
\`\`\`
Import path: \`const { testDataConfig } = require('../../framework/config/test-data.config');\`
Access data via: \`testDataConfig.targetApp.credentials.email\`, \`testDataConfig.targetApp.baseUrl\`, \`testDataConfig.targetApp.searchData.keywords\`, etc.`
    : '';

  const userPrompt = `Generate a test spec file for this user flow:

**Application:** ${appName || 'Web Application'}

**Flow Name:** ${flow.name}
**Flow Description:** ${flow.description}
**Priority:** ${flow.priority}

**Flow Steps:**
${flow.steps.map((s, i) => `${i + 1}. [${s.pageClassification}] ${s.pageName}: ${(s.actions || []).join(', ')}
   Assertions: ${(s.assertions || []).join(', ')}
   URL: ${s.url || 'N/A'}`).join('\n')}

**Available Page Objects:**
${poSummary}
${testDataRef}

**PATTERN EXAMPLE — follow this style exactly:**
\`\`\`javascript
${patternExample}
\`\`\`

Generate the test spec file matching this pattern. Use the Page Object classes listed above. Import and use testDataConfig for ALL test data.`;

  return { systemPrompt, userPrompt };
}

module.exports = { buildTestSpecGenPrompt };
