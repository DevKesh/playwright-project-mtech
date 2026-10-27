/**
 * Single-Shot Spec Generator (Registry-Based)
 * 
 * This is the OPTIMIZED authoring path that replaces the per-step DOM approach.
 * Instead of N+3 API calls (one per step + parse + PO + spec), this uses:
 *   1. ONE call to generate the complete spec from NL + page registry knowledge
 *   2. ONE optional call to generate/update the page object
 * 
 * Total: 2 API calls vs 13+ in the old approach = ~7x faster, ~8x cheaper
 * 
 * Architecture:
 *   NL Instructions + Page Registries → GPT (single prompt) → Complete Spec + PO
 *   No browser needed during authoring. Browser only used by Healer on failure.
 */

const fs = require('fs');
const path = require('path');
const { createAIClient } = require('../core/ai-client-factory');
const { testDataConfig } = require('../../config/test-data.config');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const REGISTRY_DIR = path.join(PROJECT_ROOT, 'framework', 'pages', 'registry');

// ── Registry Loader ────────────────────────────────────────────────

/**
 * Load all page registries from disk.
 * @returns {Object} Map of pageName → registry data
 */
function loadAllRegistries() {
  const registries = {};
  if (!fs.existsSync(REGISTRY_DIR)) return registries;

  const files = fs.readdirSync(REGISTRY_DIR).filter(f => f.endsWith('.registry.json'));
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(REGISTRY_DIR, file), 'utf-8'));
      registries[data.pageName] = data;
    } catch (err) {
      console.warn(`[REGISTRY] Failed to load ${file}: ${err.message}`);
    }
  }
  return registries;
}

/**
 * Select relevant registries for a given set of instructions.
 * Uses keyword matching to avoid sending ALL registries (saves tokens).
 */
function selectRelevantRegistries(instructions, allRegistries) {
  const lower = instructions.toLowerCase();
  const relevant = {};

  // Always include LoginPage if instructions mention login
  if (lower.includes('login') || lower.includes('sign in')) {
    if (allRegistries.LoginPage) relevant.LoginPage = allRegistries.LoginPage;
  }

  // Always include HomePage for most tests (it's the hub)
  if (allRegistries.HomePage) relevant.HomePage = allRegistries.HomePage;

  // Match by keywords
  const keywordMap = {
    DevicesPage: ['device', 'automation', 'thermostat', 'lock', 'switch'],
    CamerasPage: ['camera', 'video', 'feed', 'live'],
    ActivityPage: ['activity', 'event', 'log', 'history'],
  };

  for (const [pageName, keywords] of Object.entries(keywordMap)) {
    if (keywords.some(kw => lower.includes(kw)) && allRegistries[pageName]) {
      relevant[pageName] = allRegistries[pageName];
    }
  }

  return relevant;
}

/**
 * Format registries into a compact prompt context.
 */
function formatRegistriesForPrompt(registries) {
  const sections = [];
  for (const [pageName, reg] of Object.entries(registries)) {
    const elements = Object.entries(reg.elements)
      .map(([name, el]) => `    ${name}: ${el.selector} [${el.action}] — ${el.context}${el.optional ? ' (OPTIONAL - wrap in if/visible check)' : ''}${el.visibleAfter ? ` (only visible after: ${el.visibleAfter})` : ''}`)
      .join('\n');

    const transitions = Object.entries(reg.stateTransitions || {})
      .map(([trigger, t]) => `    ${trigger}: ${t.description}${t.waitFor ? ` → ${t.waitFor}` : ''}`)
      .join('\n');

    const bindings = Object.entries(reg.dataBindings || {})
      .map(([key, path]) => `    ${key} → ${path}`)
      .join('\n');

    sections.push(`## ${pageName} (${reg.url})
  ${reg.description}
  
  Elements:
${elements}
${transitions ? `\n  State Transitions:\n${transitions}` : ''}
${bindings ? `\n  Data Bindings:\n${bindings}` : ''}`);
  }
  return sections.join('\n\n');
}

// ── Prompt Builder ─────────────────────────────────────────────────

function buildSingleShotPrompt({ instructions, registries, testMeta, existingPageObjects }) {
  const registryContext = formatRegistriesForPrompt(registries);

  const systemPrompt = `You are a Playwright test automation expert. Generate a COMPLETE, RUNNABLE test spec from natural language instructions using the provided Page Registry.

## MOST CRITICAL RULE — LOCATORS:
**COPY locators EXACTLY from the Page Registry. Do NOT modify, rephrase, or "improve" them.**
- If registry says: page.locator('button', { hasText: 'ARM HOME' }).first()
  → Use EXACTLY that in the constructor: this.armHomeButton = page.locator('button', { hasText: 'ARM HOME' }).first()
  → Do NOT change to: page.getByRole('button', { name: 'ARM HOME' })
  → Do NOT change to: page.getByText('ARM HOME')
- The registry locators are VERIFIED against the live app via Playwright codegen. Changing them WILL break the test.
- If you cannot find an element in the registry, leave a comment "// REGISTRY MISSING: describe element" — do NOT guess.

## OTHER RULES:
1. Every Playwright action MUST use await
2. NEVER use waitForLoadState('networkidle') — BANNED (causes 2-min timeouts on SPAs)
3. For optional elements (popups, banners), wrap in: if (await element.isVisible({ timeout: 3000 }).catch(() => false)) { await element.click(); }
4. After clicks that trigger arming/state change, use the waitFor from stateTransitions
5. Authentication is owned by fixtures; never hardcode or read credentials in generated specs
6. Generate a complete Page Object class + test spec file
7. Follow Playwright best practices: auto-waiting, no artificial delays

## Output Format (STRICT JSON):
{
  "testName": "kebab-case-name",
  "testTitle": "Human readable title",
  "tags": ["@smoke", "@tc", "@tc-plan"],
  "testId": "TC-SMOKE-XXX",
  "pageObject": {
    "className": "PascalCasePage",
    "fileName": "PascalCasePage.js",
    "code": "// Full page object source code"
  },
  "spec": {
    "fileName": "kebab-case-name.spec.js",
    "code": "// Full spec source code"
  }
}

## Page Object Rules:
- CommonJS: module.exports = { ClassName }
- Constructor takes page, defines locators COPIED VERBATIM from registry
- Methods for each logical action group
- Import expect from @playwright/test if assertions needed
- Optional elements: check isVisible before acting
- For verification methods: use BROAD locators that check for actual visible content
  * text patterns (regex matching multiple possible words) 
  * semantic locators (getByRole headings, lists, etc.)
  * Do NOT guess CSS class names — they are unreliable and app-specific
  * If no registry entry exists, use text-based or role-based verification
- For navigation methods: click element + waitForURL with URL pattern
- For popup/dialog dismissal: wrap in isVisible() check with catch(() => false)
- For arming operations: include error dialog detection that throws on system errors

## Spec Rules:
- Authenticated business tests import { test, expect } from '../../../framework/fixtures/smoke.fixture'.
- Request named fixtures as destructured test parameters: authenticatedPage, loginPage, homePage, devicesPage, camerasPage, activityPage.
- Every test gets a fresh browser/context and authenticated /home page. The fixture owns createLoginSession and cleanup, with a separate 180000ms setup/teardown budget.
- LOGIN_MONITOR_USERNAME and LOGIN_MONITOR_PASSWORD must supply the approved account; no fallback. Do not import testDataConfig, chromium, or manually construct smoke POMs in business specs.
- Public login/recovery uses @playwright/test and its native unauthenticated page, never smoke.fixture. Synthetic security may use '../../../framework/fixtures/login-security.fixture' for page, loginPage, and pacing. Do not authenticate or heal these flows.
- CRITICAL IMPORT PATHS: The spec file lives at tests/generated/smoke/. Relative paths MUST use '../../../framework/...' (3 levels up). NEVER use '../../framework/...' (2 levels). NEVER invent paths like 'pages/total-connect/'.
- Use ONLY page object classes that exist in the "Existing Page Objects" list below. Match the EXACT class names and file names.
- Use test.describe with tags in title
- Use default describe mode with independent tests, not serial skip-on-failure.
- Do not use shared mutable pages or beforeAll/afterAll sessions. Smoke remains single-worker, fullyParallel false, because the physical panel is shared.
- Each test case is a separate test() block inside the describe
- Each test should navigate back to home if needed before its flow
- Use test.step() for each logical action within a test
- Add meaningful expect() assertions for verification steps
- Business navigation must use homePage methods; no manual goto/waitForURL/URL assertions. Public navigation assertions are allowed when they are the tested behavior.
- Camera tests call test.setTimeout(90000); arm/disarm tests call test.setTimeout(300000), as their first statement.
- Arm/disarm: ensureDisarmed, selectAllPartitions, then try { armHome/armAway; verify matching Armed Home/Armed Away status; } finally { selectAllPartitions; disarm; }. Verify Disarmed afterward. Preserve assertions and do not retry physical commands.
- Include Allure epic/feature/story/severity/tag inside each test.

## CONSOLIDATED SUITE TEMPLATE (follow this pattern exactly):
\`\`\`javascript
const { test, expect } = require('../../../framework/fixtures/smoke.fixture');
const allure = require('allure-js-commons');

test.describe('@smoke @tc @tc-plan Suite Name', () => {
  test('TC-XXX: Verify device categories', async ({ homePage, devicesPage }) => {
    await allure.epic('Total Connect');
    await allure.feature('Devices');
    await allure.story('Device categories are visible');
    await allure.severity('critical');
    await allure.tag('nl-authored');
    await test.step('Navigate to Devices', async () => {
      await homePage.navigateToDevices();
    });
    await test.step('Verify device categories', async () => {
      await devicesPage.verifyDeviceCategoriesVisible();
    });
  });
});
\`\`\``;

  const userPrompt = `## Test Instructions (Natural Language):
${instructions}

## Page Registry (KNOWN selectors — USE THESE):
${registryContext}

## Test Metadata:
- Test ID: ${testMeta.testId || 'TC-SMOKE-002'}
- Tags: ${(testMeta.tags || ['@smoke', '@tc', '@tc-plan']).join(' ')}
- Entry Criteria: ${testMeta.entry || 'User is on login page'}
- Exit Criteria: ${testMeta.exit || 'Test assertions pass'}

## Test Environment:
- Credentials belong to the authenticated fixture and must not be emitted in generated code.
- testDataConfig.targetApp.loginUrl = "${testDataConfig.targetApp.loginUrl}"
- testDataConfig.targetApp.baseUrl = "${testDataConfig.targetApp.baseUrl}"

## Existing Page Objects (reuse if applicable):
${existingPageObjects || 'None — generate fresh page objects'}

Generate the complete test spec and page object. Use ONLY registry selectors.`;

  return { systemPrompt, userPrompt };
}

// ── Main Generator ─────────────────────────────────────────────────

/**
 * Generate a complete test spec + page object from NL instructions in a SINGLE API call.
 * 
 * @param {object} params
 * @param {string} params.instructions - Plain English test description
 * @param {object} params.testMeta - { testId, tags, entry, exit, title }
 * @param {object} [params.config] - AI client config overrides
 * @returns {Promise<{ pageObject: object, spec: object, tokensUsed: number, durationMs: number }>}
 */
async function generateSpecFromRegistry({ instructions, testMeta, config: configOverrides }) {
  const startTime = Date.now();
  
  // Load AI client
  const config = {
    analysisModel: 'gpt-4o',
    ...configOverrides,
  };
  const aiClient = createAIClient(config);

  // Load and select relevant registries
  const allRegistries = loadAllRegistries();
  const relevantRegistries = selectRelevantRegistries(instructions, allRegistries);

  console.log(`[SPEC-GEN] Loaded ${Object.keys(relevantRegistries).length} relevant page registries: ${Object.keys(relevantRegistries).join(', ')}`);

  // Check for existing page objects to reuse (include smoke subdirectory)
  let existingPOs = '';
  const poDir = path.join(PROJECT_ROOT, 'framework', 'pages', 'generated');
  if (fs.existsSync(poDir)) {
    const poFiles = fs.readdirSync(poDir).filter(f => f.endsWith('.js'));
    existingPOs = poFiles.map(f => `- ${f} (import: '../../../framework/pages/generated/${f}')`).join('\n');
  }
  const poSmokeDir = path.join(poDir, 'smoke');
  if (fs.existsSync(poSmokeDir)) {
    const smokeFiles = fs.readdirSync(poSmokeDir).filter(f => f.endsWith('.js'));
    existingPOs += '\n' + smokeFiles.map(f => `- smoke/${f} (import: '../../../framework/pages/generated/smoke/${f}')`).join('\n');
  }

  // Build prompt and call GPT ONCE
  const { systemPrompt, userPrompt } = buildSingleShotPrompt({
    instructions,
    registries: relevantRegistries,
    testMeta,
    existingPageObjects: existingPOs || null,
  });

  console.log(`[SPEC-GEN] Prompt size: ${(systemPrompt.length + userPrompt.length).toLocaleString()} chars (~${Math.round((systemPrompt.length + userPrompt.length) / 4).toLocaleString()} tokens)`);
  console.log(`[SPEC-GEN] Calling GPT-4o (single-shot generation)...`);

  const result = await aiClient.chatCompletionJSON(systemPrompt, userPrompt, {
    model: config.analysisModel,
    maxTokens: 8192,
  });

  const durationMs = Date.now() - startTime;
  const tokensUsed = Math.round((systemPrompt.length + userPrompt.length) / 4);

  console.log(`[SPEC-GEN] Generated in ${(durationMs / 1000).toFixed(1)}s (~${tokensUsed.toLocaleString()} input tokens)`);
  console.log(`[SPEC-GEN] → Spec: ${result.spec.fileName}`);
  console.log(`[SPEC-GEN] → Page Object: ${result.pageObject.fileName}`);

  return {
    testName: result.testName,
    testTitle: result.testTitle,
    tags: result.tags,
    testId: result.testId,
    pageObject: result.pageObject,
    spec: result.spec,
    tokensUsed,
    durationMs,
  };
}

/**
 * Generate and write spec + PO files to disk.
 */
async function generateAndWriteSpec({ instructions, testMeta, outputDir, pagesDir, config }) {
  const result = await generateSpecFromRegistry({ instructions, testMeta, config });

  // Ensure output directories exist
  const specDir = outputDir || path.join(PROJECT_ROOT, 'tests', 'generated');
  const pageDir = pagesDir || path.join(PROJECT_ROOT, 'framework', 'pages', 'generated');
  fs.mkdirSync(specDir, { recursive: true });
  fs.mkdirSync(pageDir, { recursive: true });

  // Write page object
  const poPath = path.join(pageDir, result.pageObject.fileName);
  fs.writeFileSync(poPath, result.pageObject.code, 'utf-8');
  console.log(`[SPEC-GEN] ✓ Page Object written: ${poPath}`);

  // Write spec (with import path validation)
  let specCode = result.spec.code;
  // Fix common GPT import path mistakes: ensure 3-level relative path from tests/generated/smoke/
  specCode = specCode.replace(/require\(['"]\.\.\/\.\.\/framework\//g, "require('../../../framework/");
  specCode = specCode.replace(/require\(['"]\.\.\/\.\.\/\.\.\/\.\.\/framework\//g, "require('../../../framework/");
  specCode = specCode.replace(/require\(['"](?:\.\.\/)*framework\/pages\/total-connect\//g, "require('../../../framework/pages/generated/smoke/");

  const specPath = path.join(specDir, result.spec.fileName);
  fs.writeFileSync(specPath, specCode, 'utf-8');
  console.log(`[SPEC-GEN] ✓ Spec written: ${specPath}`);

  // Log to audit trail
  const auditEntry = {
    timestamp: new Date().toISOString(),
    action: 'single-shot-generate',
    testId: result.testId,
    testName: result.testName,
    tokensUsed: result.tokensUsed,
    durationMs: result.durationMs,
    specFile: specPath,
    pageObjectFile: poPath,
    registriesUsed: Object.keys(loadAllRegistries()),
  };

  const auditPath = path.join(PROJECT_ROOT, 'ai-reports', 'audit-trail.json');
  try {
    const existing = JSON.parse(fs.readFileSync(auditPath, 'utf-8'));
    existing.push(auditEntry);
    fs.writeFileSync(auditPath, JSON.stringify(existing, null, 2), 'utf-8');
  } catch {
    fs.writeFileSync(auditPath, JSON.stringify([auditEntry], null, 2), 'utf-8');
  }

  return { ...result, specPath, poPath };
}

module.exports = {
  loadAllRegistries,
  selectRelevantRegistries,
  generateSpecFromRegistry,
  generateAndWriteSpec,
};
