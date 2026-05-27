/**
 * NL Authoring — Generate Mode
 *
 * Takes plain English test instructions and generates a RUNNABLE Playwright
 * spec file that uses existing page objects. Unlike the full pipeline (which
 * opens a browser to discover elements), this uses GPT with the available
 * page object API as context — guaranteeing the generated code actually works.
 *
 * Demo flow:
 *   1. npm run ai:author:generate -- --instructions "Navigate to Devices page, verify device categories"
 *   2. GPT generates a spec file using real page objects (~5-10s)
 *   3. npx playwright test tests/generated/nl-authored/<file> --headed
 *
 * Usage:
 *   npm run ai:author:generate -- --instructions "your English description"
 *   npm run ai:author:generate -- --instructions "..." --run   (generate AND run immediately)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { loadAIConfig } = require('../config/ai.config');
const { createAIClient } = require('../core/ai-client-factory');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'tests', 'generated', 'nl-authored');

/**
 * The available page object API that GPT must use.
 * This is included in the prompt so GPT generates code that calls REAL methods.
 */
const PAGE_OBJECT_API = `
## Available Page Objects & Methods

### LoginPage (framework/pages/generated/smoke/LoginPage.js)
- constructor(page)
- login(username, password) — fills username, password, clicks Sign In
- dismissCookieConsent() — dismisses cookie banner if visible

### TotalConnectHomePage (framework/pages/generated/smoke/TotalConnectHomePage.js)
- constructor(page)
- Locators: devicesNav, camerasNav, activityNav, armHomeButton, armAwayButton, disarmButton, partitionStatusText, selectAllCheckbox
- dismissCookiePopup() — dismiss cookie bar
- closeDonePopup() — dismiss "DONE" dialog
- dismissErrorDialog() — dismiss error/status dialogs with OK button
- selectAllPartitions() — click SELECT ALL checkbox (REQUIRED before any arm/disarm action)
- armHome() — arm the system in Home mode (clicks ARM HOME, handles confirmation)
- armAway() — arm the system in Away mode
- disarm() — disarm the system (clicks DISARM, handles confirmation)
- waitForArmedHome() — wait for "Armed Home" status to appear
- waitForArmedAway() — wait for "Armed Away" status to appear
- waitForDisarmed() — wait for "Disarmed" status to appear
- verifyPartitionStatus(status) — assert partition shows given status text (e.g., 'Armed Home', 'Disarmed')
- ensureDisarmed() — if system is armed, disarm it first (MUST be called as precondition before any arming test)
- navigateToDevices() — click Devices nav, wait for /automation URL (takes ~5-10s)
- navigateToCameras() — click Cameras nav, wait for /cameras URL (takes ~10-20s, cameras load async)
- navigateToActivity() — click Activity nav, wait for /events URL (takes ~5-10s)

### DevicesPage (framework/pages/generated/smoke/DevicesPage.js)
- constructor(page)
- verifyDeviceCategoriesVisible() — asserts device categories are visible on the page

### CamerasPage (framework/pages/generated/smoke/CamerasPage.js)
- constructor(page)
- verifyCamerasPageLoaded() — asserts camera content is visible
- verifyAllCamerasVisible() — returns count of camera elements
- verifyCameraNames() — returns count of camera name labels

### ActivityPage (framework/pages/generated/smoke/ActivityPage.js)
- constructor(page)
- verifyActivityLogEntries() — asserts activity log entries are displayed

## Login Helper (framework/utils/login-session.js)
- createLoginSession() — launches browser, logs in, returns { browser, context, page, close }
  - page is already on /home, fully authenticated and ready
  - Login itself takes 15-30s (handled internally)
  - Use in test.beforeAll with test.setTimeout(180000), close browser in test.afterAll

## BEHAVIORAL RULES (TIMING & PRECONDITIONS — MANDATORY):

1. **beforeAll timeout**: ALWAYS set test.setTimeout(180000) in beforeAll — login takes 15-30s.
2. **Cameras timeout**: Any test that navigates to Cameras MUST call test.setTimeout(90000) as the first line inside the test function — cameras load asynchronously and take 10-20s on first visit.
3. **Arm/Disarm precondition**: Before arming (armHome/armAway), ALWAYS:
   a. Call ensureDisarmed() first — system may be in armed state from a prior run
   b. Call selectAllPartitions() — required to select which partitions to arm
4. **Re-select for disarm**: After verifying armed status, call selectAllPartitions() AGAIN before calling disarm() — the selection resets after arming.
5. **Navigation from non-home page**: navigateToDevices/Cameras/Activity can be called from ANY page, not just /home. The page object handles the click regardless of current URL.
6. **No page.goto()**: NEVER use page.goto() for app pages. All navigation is through page object methods.
7. **No page.waitForURL()**: NEVER use page.waitForURL() — the page object navigation methods already wait for the URL internally.
8. **No expect(page).toHaveURL()**: NEVER add URL assertions — navigation methods already verify URLs internally.

## Test Pattern (MUST follow this EXACT structure):
\`\`\`javascript
const { test, expect } = require('@playwright/test');
const allure = require('allure-js-commons');
const { createLoginSession } = require('../../../framework/utils/login-session');
const { TotalConnectHomePage } = require('../../../framework/pages/generated/smoke/TotalConnectHomePage');
// ... other page object imports as needed

test.describe('@nl-authored <Suite Name>', () => {
  let page, browser, homePage;

  test.beforeAll(async () => {
    test.setTimeout(180000);
    const session = await createLoginSession();
    browser = session.browser;
    page = session.page;
    homePage = new TotalConnectHomePage(page);
    // ... instantiate other page objects as needed
  });

  test.afterAll(async () => {
    if (browser) await browser.close();
  });

  test('<Test Title>', async () => {
    // test.setTimeout(90000); ← ADD THIS if test involves Cameras page
    await allure.epic('...');
    await allure.feature('...');
    await allure.story('...');
    await allure.severity('critical');
    await allure.tag('nl-authored');

    await test.step('<Step description>', async () => {
      // ... page object method calls
    });
  });
});
\`\`\`
`;

const SYSTEM_PROMPT = `You are a Playwright test code generator for the Total Connect 2.0 application (qa2.totalconnect2.com).

Given plain English test instructions, generate a COMPLETE, RUNNABLE Playwright spec file.

CRITICAL RULES:
1. ONLY use the page objects and methods listed in the API reference below. NEVER invent new page objects or methods.
2. ALWAYS use createLoginSession() for authentication — NEVER write manual login code.
3. Use test.step() blocks for each logical step.
4. Follow the exact import paths shown in the API reference.
5. Include allure metadata INSIDE the test function using await allure.epic/feature/story/severity/tag.
6. The test MUST be self-contained and runnable with: npx playwright test <file> --headed
7. Use the test.describe → beforeAll/afterAll pattern shown in the API reference.
8. After login, page is already on /home. Use homePage methods for navigation.
9. NEVER use page.goto(), page.waitForURL(), or expect(page).toHaveURL() — navigation methods handle this.
10. ALWAYS follow the BEHAVIORAL RULES for timeouts and preconditions — these are non-negotiable.
11. Return the JavaScript code in a JSON field called "code". No markdown fences.

You MUST respond with valid JSON: { "code": "...the full JavaScript source code..." }

${PAGE_OBJECT_API}`;

async function main() {
  const args = process.argv.slice(2);
  let instructions = '';
  let autoRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--instructions' && args[i + 1]) {
      instructions = args[++i];
    } else if (args[i] === '--run') {
      autoRun = true;
    }
  }

  if (!instructions) {
    console.error('Usage: npm run ai:author:generate -- --instructions "your test description"');
    console.error('       npm run ai:author:generate -- --instructions "..." --run');
    process.exit(1);
  }

  const config = loadAIConfig();
  if (!config.openaiApiKey) {
    console.error('OPENAI_API_KEY not set. Add it to your .env file.');
    process.exit(1);
  }

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   NL Test Authoring — Generate Mode                         ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Input:   "${instructions.substring(0, 50)}${instructions.length > 50 ? '...' : ''}"`)
  console.log(`║  Mode:    Generate spec file using existing page objects     ║`);
  console.log(`║  Model:   ${(config.analysisModel || 'gpt-4o').padEnd(50)} ║`);
  console.log(`║  Output:  tests/generated/nl-authored/                      ║`);
  if (autoRun) {
    console.log(`║  Action:  Generate → Save → Run (--run flag active)         ║`);
  }
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // Call GPT
  const aiClient = createAIClient(config);
  console.log('[GENERATE] Sending English instructions to GPT...');
  console.log(`[GENERATE] Instructions: "${instructions}"`);
  console.log('');

  const startTime = Date.now();

  const userPrompt = `Generate a Playwright test spec file for these instructions:\n\n"${instructions}"\n\nReturn valid JSON with a "code" field containing the full JavaScript source.`;

  const response = await aiClient.chatCompletionJSON(SYSTEM_PROMPT, userPrompt, {
    model: config.analysisModel || 'gpt-4o',
    maxTokens: 4096,
  });

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[GENERATE] Code generated in ${duration}s`);
  console.log('');

  // Extract code from JSON response
  let code = (response.code || '').trim();
  if (!code) {
    console.error('ERROR: GPT returned no code. Response:', JSON.stringify(response, null, 2));
    process.exit(1);
  }

  // Add the NL instruction header comment
  const header = `/**\n * AUTO-GENERATED by NL Test Authoring Pipeline\n * \n * Original English Instruction:\n *   "${instructions}"\n * \n * Generated: ${new Date().toISOString()}\n * Model: ${config.analysisModel || 'gpt-4o'}\n */\n\n`;
  code = header + code;

  // Create output directory
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Generate filename from instructions
  const fileName = instructions
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .slice(0, 5)
    .join('-') + '.spec.js';

  const filePath = path.join(OUTPUT_DIR, fileName);

  // Write the file
  fs.writeFileSync(filePath, code, 'utf-8');

  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│  GENERATED TEST SPEC:                                       │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log(`│  File: tests/generated/nl-authored/${fileName}`);
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log('│  CODE:                                                      │');
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');
  console.log(code);
  console.log('');
  console.log('─'.repeat(65));
  console.log('');
  console.log(`To run this test:`);
  console.log(`  npx playwright test tests/generated/nl-authored/${fileName} --headed`);
  console.log('');

  // Auto-run if --run flag was specified
  if (autoRun) {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║  Running generated test...                                  ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    try {
      execSync(`npx playwright test "${filePath}" --headed --reporter=list`, {
        cwd: PROJECT_ROOT,
        stdio: 'inherit',
        timeout: 120000,
      });
      console.log('');
      console.log('✓ Test PASSED');
    } catch (err) {
      console.log('');
      console.log('✗ Test FAILED (see output above)');
      process.exit(1);
    }
  }
}

main();
