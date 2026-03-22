/**
 * Test Spec Generation Prompt: builds prompts for GPT to generate
 * Playwright test spec files from identified user flows.
 */

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
  const systemPrompt = `You are a Playwright test engineer. Generate a test spec file that follows the EXACT pattern shown in the example below.

**Rules:**
1. Use CommonJS: \`const { test, expect } = require('@playwright/test')\`
2. Import \`allure\` from \`allure-js-commons\`
3. Every test MUST have these allure tags: \`allure.epic()\`, \`allure.feature()\`, \`allure.story()\`, \`allure.severity()\`, \`allure.tags()\`
4. Use \`test.describe()\` to group related tests
5. Use \`test.step()\` for each logical step in the test
6. Tests receive \`{ page }\` from the fixture — use \`page\` directly to create locators and perform actions
7. Import Page Object classes and instantiate them in the test with \`new PageClass(page)\`
8. Add meaningful assertions after key actions using \`expect\`
9. NEVER hardcode test data (emails, passwords, URLs, search terms) inline — ALL test data MUST come from the imported testDataConfig
10. Keep tests focused — one flow per test, with positive and optionally negative scenarios
11. Do NOT import from fixture files that don't exist — use \`@playwright/test\` directly
12. ALWAYS add this import at the top of the file: \`const { testDataConfig } = require('../../framework/config/test-data.config');\`
13. Reference test data ONLY via \`testDataConfig.targetApp.credentials.email\`, \`testDataConfig.targetApp.searchData.keywords\`, \`testDataConfig.targetApp.baseUrl\`, etc. — NEVER define a local const/var with hardcoded test values

CRITICAL: The "code" field in your JSON response must contain the ACTUAL, COMPLETE, RUNNABLE JavaScript source code for the test spec — NOT a description or placeholder. The code must be a real implementation that can be saved to a .spec.js file and executed by Playwright directly.

You MUST respond with valid JSON:
{
  "fileName": "kebab-case-flow-name.spec.js",
  "code": "const { test, expect } = require('@playwright/test');\\nconst allure = require('allure-js-commons');\\nconst { testDataConfig } = require('../../framework/config/test-data.config');\\n\\ntest.describe('Flow Name', () => {\\n  test('test title', async ({ page }) => {\\n    await allure.epic(testDataConfig.targetApp.name);\\n    // ... actual test steps using testDataConfig ...\\n  });\\n});",
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
