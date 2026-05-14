#!/usr/bin/env node
/**
 * Locator Validator: Opens the browser, navigates to each page, and VERIFIES
 * every locator in the registry resolves correctly (exactly 1 match, or handles .first()).
 *
 * GROUND RULE: The app MUST be fully logged in and confirmed at
 * https://qa2.totalconnect2.com/home before ANY validation begins.
 * No locator checks, no GPT calls, no alternative strategies run until
 * the home page URL is explicitly confirmed.
 *
 * Usage:
 *   node framework/ai/scripts/validate-registry.js --page HomePage
 *   node framework/ai/scripts/validate-registry.js --all
 *   node framework/ai/scripts/validate-registry.js --page HomePage --fix
 *
 * With --fix: Attempts to auto-fix broken locators using Playwright's locator resolution.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const REGISTRY_DIR = path.join(PROJECT_ROOT, 'framework', 'pages', 'registry');

let testDataConfig = {};
try {
  testDataConfig = require('../../config/test-data.config').testDataConfig;
} catch {}

const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
};
const hasFlag = (flag) => args.includes(flag);

const targetPage = getArg('--page');
const validateAll = hasFlag('--all');
const autoFix = hasFlag('--fix');

const HOME_URL = 'https://qa2.totalconnect2.com/home';

/**
 * GROUND RULE GATE: Confirms the browser is truly at /home and the app is ready.
 * Polls the actual URL every second for up to maxWait ms.
 * Returns true only if page.url() === HOME_URL (or starts with it).
 */
async function confirmAtHome(page, maxWait = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const currentUrl = page.url();
    if (currentUrl.startsWith(HOME_URL)) {
      return true;
    }
    await page.waitForTimeout(1000);
  }
  return false;
}

/**
 * Validate a single locator in the registry.
 * Returns { valid, count, error }
 */
async function validateLocator(page, selectorStr) {
  try {
    // Convert selector string to actual locator
    // e.g., "page.getByText('ARM HOME')" → evaluate
    const countFn = new Function('page', `return (async () => {
      const locator = ${selectorStr};
      const count = await locator.count();
      return count;
    })()`);

    const count = await countFn(page);

    if (count === 0) {
      return { valid: false, count: 0, error: 'Element not found on page' };
    }
    if (count === 1) {
      return { valid: true, count: 1, error: null };
    }
    // Multiple matches — valid but needs .first()
    return { valid: true, count, error: `Multiple matches (${count}) — using .first() is recommended` };
  } catch (err) {
    return { valid: false, count: 0, error: err.message };
  }
}

/**
 * Try alternative locator strategies for a broken element.
 */
async function tryAlternativeLocators(page, elementName, originalSelector) {
  // Extract text content from the original selector to try alternatives
  const textMatch = originalSelector.match(/['"]([^'"]+)['"]/);
  if (!textMatch) return null;

  const text = textMatch[1];
  const alternatives = [
    `page.locator('button', { hasText: '${text}' }).first()`,
    `page.getByText('${text}', { exact: true }).first()`,
    `page.getByRole('button', { name: '${text}' }).first()`,
    `page.locator('[aria-label*="${text}" i]').first()`,
    `page.locator('button:has-text("${text}")').first()`,
  ];

  for (const alt of alternatives) {
    const result = await validateLocator(page, alt);
    if (result.valid && result.count >= 1) {
      return { selector: alt, count: result.count };
    }
  }

  return null;
}

/**
 * Main validation loop.
 */
async function main() {
  // Find registries to validate
  const registryFiles = [];
  if (targetPage) {
    const file = path.join(REGISTRY_DIR, `${targetPage}.registry.json`);
    if (fs.existsSync(file)) registryFiles.push(file);
    else { console.error(`Registry not found: ${file}`); process.exit(1); }
  } else if (validateAll) {
    const files = fs.readdirSync(REGISTRY_DIR).filter(f => f.endsWith('.registry.json'));
    registryFiles.push(...files.map(f => path.join(REGISTRY_DIR, f)));
  } else {
    console.log('Usage: --page PageName | --all');
    process.exit(1);
  }

  console.log(`\n[VALIDATOR] Validating ${registryFiles.length} registry file(s)...\n`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // ── STEP 1: Login and CONFIRM at /home — NOTHING proceeds until this passes ──
  console.log(`[VALIDATOR] Step 1: Logging in and confirming home page...`);
  console.log(`[VALIDATOR]   GROUND RULE: App must be fully at ${HOME_URL} before any validation.`);
  try {
    const creds = testDataConfig?.targetApp?.credentials;
    const loginUrl = testDataConfig?.targetApp?.loginUrl || 'https://qa2.totalconnect2.com/login';

    if (!creds || !creds.email || !creds.password) {
      throw new Error('Credentials missing in test-data.config.js → targetApp.credentials');
    }

    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log(`[VALIDATOR]   → Login page loaded: ${page.url()}`);

    // Dismiss cookie banner (non-blocking)
    try { await page.locator('#truste-consent-button').click({ timeout: 3000 }); } catch {}

    // Fill credentials and submit
    await page.locator('#UsernameInput').fill(creds.email);
    await page.locator('#PasswordInput').fill(creds.password);
    await page.locator('#LoginButton').click();
    console.log(`[VALIDATOR]   → Credentials submitted, waiting for /home...`);

    // Wait for URL to become /home (the app may take time due to API calls after login)
    await page.waitForURL('**/home', { timeout: 60000 });

    // Dismiss popups that appear after login (DONE button, notifications, etc.)
    try {
      const doneBtn = page.getByRole('button', { name: 'DONE' });
      if (await doneBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
        await doneBtn.click();
        console.log(`[VALIDATOR]   → Dismissed DONE popup`);
      }
    } catch {}

    // Wait for a known home page element to confirm the app is truly loaded
    // (Security nav button is verified in the registry — it's always present on /home)
    try {
      await page.getByRole('button', { name: 'Security' }).first().waitFor({ state: 'visible', timeout: 15000 });
    } catch {
      // If Security button isn't found, fall back to waiting for any sidebar nav
      await page.waitForTimeout(3000);
    }

    // ═══ GROUND RULE CHECK: Confirm URL is EXACTLY /home ═══
    const confirmedAtHome = await confirmAtHome(page, 10000);
    if (!confirmedAtHome) {
      throw new Error(`After login, URL is "${page.url()}" — NOT at ${HOME_URL}. Login may have failed silently.`);
    }

    console.log(`[VALIDATOR]   ✓ CONFIRMED at home: ${page.url()}`);
    console.log(`[VALIDATOR]   ✓ App is fully loaded. Proceeding to validation.\n`);
  } catch (loginErr) {
    console.error(`[VALIDATOR]   ✗ LOGIN FAILED: ${loginErr.message}`);
    console.error(`[VALIDATOR]   ABORTING — cannot validate locators without a confirmed /home session.`);
    console.error(`[VALIDATOR]   Fix: Ensure the app is reachable and credentials in test-data.config.js are correct.`);
    await browser.close();
    process.exit(1);
  }

  console.log(`[VALIDATOR] Step 2: Validating locators on each page...\n`);

  // Load HomePage registry for navigation buttons
  let homeRegistry = null;
  const homeRegPath = path.join(REGISTRY_DIR, 'HomePage.registry.json');
  if (fs.existsSync(homeRegPath)) {
    homeRegistry = JSON.parse(fs.readFileSync(homeRegPath, 'utf-8'));
  }

  // Map page URLs to their nav button selectors + waitFor patterns
  const navMap = {};
  if (homeRegistry && homeRegistry.stateTransitions) {
    const transitionToNav = {
      afterDevicesNav: { nav: 'devicesNav', url: '/automation' },
      afterCamerasNav: { nav: 'camerasNav', url: '/cameras' },
      afterActivityNav: { nav: 'activityNav', url: '/events' },
    };
    for (const [key, mapping] of Object.entries(transitionToNav)) {
      const transition = homeRegistry.stateTransitions[key];
      const navElement = homeRegistry.elements[mapping.nav];
      if (transition && navElement) {
        navMap[mapping.url] = {
          selector: navElement.selector,
          waitFor: transition.waitFor,
          expectedUrl: transition.expectedUrl,
        };
      }
    }
  }

  let totalElements = 0;
  let validCount = 0;
  let brokenCount = 0;
  let fixedCount = 0;
  let skippedPages = 0;

  for (const registryFile of registryFiles) {
    const registry = JSON.parse(fs.readFileSync(registryFile, 'utf-8'));
    console.log(`[VALIDATOR] ─── ${registry.pageName} (${registry.url}) ───`);

    // Navigate to the target page using nav buttons (like a real user)
    let navigationSuccess = false;
    try {
      const targetUrl = registry.url;

      // If already on the correct page, skip navigation
      const currentPath = new URL(page.url()).pathname;
      if (currentPath.includes(targetUrl.replace('/', ''))) {
        navigationSuccess = true;
        console.log(`[VALIDATOR]   ✓ Already on page: ${page.url()}`);
      }
      // HomePage: just go back to /home
      else if (targetUrl === '/home') {
        await page.goto('https://qa2.totalconnect2.com/home', { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(2000);
        navigationSuccess = true;
        console.log(`[VALIDATOR]   ✓ On page: ${page.url()}`);
      }
      // Other pages: click the nav button from home (like a real user)
      else if (navMap[targetUrl]) {
        // First ensure we're back at /home (ground rule: always navigate FROM home)
        if (!page.url().startsWith(HOME_URL)) {
          await page.goto(HOME_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await page.waitForTimeout(2000);
          const backAtHome = await confirmAtHome(page, 10000);
          if (!backAtHome) {
            console.log(`[VALIDATOR]   ✗ Could not return to /home (at "${page.url()}") — skipping ${registry.pageName}`);
            skippedPages++;
            continue;
          }
        }

        const nav = navMap[targetUrl];
        console.log(`[VALIDATOR]   → Clicking nav button: ${nav.selector}`);

        // Click the nav button
        const navFn = new Function('page', `return (async () => {
          const locator = ${nav.selector};
          await locator.click({ timeout: 10000 });
        })()`);
        await navFn(page);

        // Wait for URL change (non-blocking — if it times out we still check where we are)
        if (nav.waitFor) {
          try {
            const waitFn = new Function('page', `return (async () => { await ${nav.waitFor}; })()`);
            await waitFn(page);
          } catch {
            // waitForURL timed out — we'll check actual URL below
          }
        }
        await page.waitForTimeout(2000); // Let SPA render

        // NOW extract the actual URL and verify we're on the right page
        const actualUrl = page.url();
        const actualPath = new URL(actualUrl).pathname;
        if (actualPath.includes(targetUrl.replace('/', ''))) {
          navigationSuccess = true;
          console.log(`[VALIDATOR]   ✓ Navigated to: ${actualUrl}`);
        } else {
          console.log(`[VALIDATOR]   ✗ Clicked nav but landed on "${actualPath}" instead of "${targetUrl}"`);
        }
      }
      // Fallback: direct URL (for pages without a nav button mapping)
      else {
        console.log(`[VALIDATOR]   → No nav button found, trying direct URL...`);
        await page.goto(`https://qa2.totalconnect2.com${targetUrl}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(3000);

        const afterUrl = new URL(page.url()).pathname;
        if (afterUrl.includes(targetUrl.replace('/', ''))) {
          navigationSuccess = true;
          console.log(`[VALIDATOR]   ✓ On page: ${page.url()}`);
        }
      }

      if (!navigationSuccess) {
        console.log(`[VALIDATOR]   ✗ NAVIGATION FAILED — ended up at "${page.url()}" instead of "${targetUrl}"`);
        console.log(`[VALIDATOR]   ⏭ SKIPPING ${registry.pageName}`);
        console.log('');
        skippedPages++;
        continue;
      }
    } catch (navErr) {
      console.log(`[VALIDATOR]   ✗ NAVIGATION ERROR: ${navErr.message}`);
      console.log(`[VALIDATOR]   ⏭ SKIPPING ${registry.pageName}`);
      console.log('');
      skippedPages++;
      continue;
    }

    const elements = registry.elements;
    let modified = false;

    for (const [name, el] of Object.entries(elements)) {
      totalElements++;

      // Skip elements that only appear after certain interactions
      if (el.visibleAfter) {
        console.log(`  ⏭  ${name}: skipped (requires ${el.visibleAfter} first)`);
        continue;
      }

      const result = await validateLocator(page, el.selector);

      if (result.valid && result.count === 1) {
        console.log(`  ✓  ${name}: ${el.selector} → OK`);
        validCount++;
        el.verified = true;
        el.verifiedAt = new Date().toISOString();
      } else if (result.valid && result.count > 1) {
        console.log(`  ⚠  ${name}: ${el.selector} → ${result.count} matches`);
        if (autoFix && !el.selector.includes('.first()')) {
          el.selector = el.selector + '.first()';
          console.log(`     → Fixed: ${el.selector}`);
          fixedCount++;
          modified = true;
        }
        validCount++;
      } else {
        console.log(`  ✗  ${name}: ${el.selector} → BROKEN (${result.error})`);
        brokenCount++;

        if (autoFix) {
          const fix = await tryAlternativeLocators(page, name, el.selector);
          if (fix) {
            el.selector = fix.selector;
            el.verified = true;
            el.verifiedAt = new Date().toISOString();
            el.autoFixed = true;
            console.log(`     → Auto-fixed: ${fix.selector} (${fix.count} match(es))`);
            fixedCount++;
            modified = true;
          } else {
            console.log(`     → Could not auto-fix. Manual codegen recording needed.`);
            el.verified = false;
            el.brokenSince = new Date().toISOString();
            modified = true;
          }
        }
      }
    }

    // Save updated registry
    if (modified) {
      registry.metadata = registry.metadata || {};
      registry.metadata.lastValidated = new Date().toISOString();
      fs.writeFileSync(registryFile, JSON.stringify(registry, null, 2), 'utf-8');
      console.log(`  → Registry updated: ${registryFile}`);
    }

    console.log('');
  }

  await browser.close();

  console.log(`\n[VALIDATOR] ═══ Summary ═══`);
  console.log(`  Total elements:  ${totalElements}`);
  console.log(`  Valid:            ${validCount}`);
  console.log(`  Broken:           ${brokenCount}`);
  console.log(`  Auto-fixed:       ${fixedCount}`);
  if (skippedPages > 0) {
    console.log(`  Pages skipped:    ${skippedPages} (navigation failed — NOT counted as broken)`);
  }
  const validatable = totalElements > 0 ? totalElements : 1;
  console.log(`  Pass rate:        ${Math.round((validCount / validatable) * 100)}% (of elements that were actually validated)\n`);

  if (skippedPages > 0) {
    console.log(`  ⚠ ${skippedPages} page(s) were skipped because the browser could not navigate to them.`);
    console.log(`    This does NOT mean locators are broken — it means login/navigation failed.`);
    console.log(`    Ensure the app is reachable and credentials are correct, then retry.\n`);
  }

  if (brokenCount > 0 && !autoFix) {
    console.log(`  💡 Run with --fix to attempt auto-repair, or use codegen to re-record:\n`);
    console.log(`     npm run codegen:record -- --page HomePage --url /home --login\n`);
  }
}

main().catch(err => {
  console.error('[VALIDATOR] Fatal:', err.message);
  process.exit(1);
});
