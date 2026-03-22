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
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function buildTestSpecGenPrompt({ flow, pageObjects, patternExample, appName }) {
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
9. Use realistic test data (emails, passwords, names) appropriate for the app
10. Keep tests focused — one flow per test, with positive and optionally negative scenarios
11. Do NOT import from fixture files that don't exist — use \`@playwright/test\` directly

You MUST respond with valid JSON:
{
  "fileName": "kebab-case-flow-name.spec.js",
  "code": "// The complete test spec source code as a single string",
  "testCases": [
    { "title": "test title", "steps": ["step 1 description", "step 2 description"] }
  ]
}`;

  // Build PO summary for the prompt
  const poSummary = pageObjects.map(po => {
    return `**${po.className}** (${po.fileName})
  Locators: ${(po.locators || []).map(l => `${l.name} → ${l.strategy}(${l.selector})`).join(', ')}
  Methods: ${(po.methods || []).map(m => `${m.name}() — ${m.description}`).join(', ')}`;
  }).join('\n\n');

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

**PATTERN EXAMPLE — follow this style exactly:**
\`\`\`javascript
${patternExample}
\`\`\`

Generate the test spec file matching this pattern. Use the Page Object classes listed above.`;

  return { systemPrompt, userPrompt };
}

module.exports = { buildTestSpecGenPrompt };
