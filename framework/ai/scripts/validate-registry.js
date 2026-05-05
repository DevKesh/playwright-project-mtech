#!/usr/bin/env node
/**
 * Locator Validator: Opens the browser, navigates to each page, and VERIFIES
 * every locator in the registry resolves correctly (exactly 1 match, or handles .first()).
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

/**
 * Login to the app and return the page.
 */
async function loginAndNavigate(page, targetUrl) {
  const creds = testDataConfig?.targetApp?.credentials;
  const loginUrl = testDataConfig?.targetApp?.loginUrl || 'https://qa2.totalconnect2.com/login';

  await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Dismiss cookie
  try {
    await page.locator('#truste-consent-button').click({ timeout: 3000 });
  } catch {}

  // Fill login
  await page.locator('#UsernameInput').fill(creds.email);
  await page.locator('#PasswordInput').fill(creds.password);
  await page.locator('#LoginButton').click();

  // Wait for home page
  await page.waitForURL('**/home', { timeout: 20000 });

  // Dismiss DONE popup if visible
  try {
    const doneBtn = page.getByRole('button', { name: 'DONE' });
    if (await doneBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await doneBtn.click();
    }
  } catch {}

  // Navigate to target if not home
  if (targetUrl && !targetUrl.includes('/home')) {
    await page.goto(`https://qa2.totalconnect2.com${targetUrl}`, { waitUntil: 'domcontentloaded' });
  }
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

  let totalElements = 0;
  let validCount = 0;
  let brokenCount = 0;
  let fixedCount = 0;

  for (const registryFile of registryFiles) {
    const registry = JSON.parse(fs.readFileSync(registryFile, 'utf-8'));
    console.log(`[VALIDATOR] ─── ${registry.pageName} (${registry.url}) ───`);

    // Login and navigate to the page
    await loginAndNavigate(page, registry.url);
    await page.waitForTimeout(2000); // Let SPA render

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
  console.log(`  Total elements: ${totalElements}`);
  console.log(`  Valid:           ${validCount}`);
  console.log(`  Broken:          ${brokenCount}`);
  console.log(`  Auto-fixed:      ${fixedCount}`);
  console.log(`  Pass rate:       ${totalElements > 0 ? Math.round((validCount / totalElements) * 100) : 0}%\n`);

  if (brokenCount > 0 && !autoFix) {
    console.log(`  💡 Run with --fix to attempt auto-repair, or use codegen to re-record:\n`);
    console.log(`     npm run codegen:record -- --page HomePage --url /home --login\n`);
  }
}

main().catch(err => {
  console.error('[VALIDATOR] Fatal:', err.message);
  process.exit(1);
});
