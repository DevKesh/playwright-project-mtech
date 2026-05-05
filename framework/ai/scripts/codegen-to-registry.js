#!/usr/bin/env node
/**
 * Codegen-to-Registry: Records interactions via Playwright codegen,
 * then parses the output to build/update the page registry with VERIFIED locators.
 *
 * Usage:
 *   node framework/ai/scripts/codegen-to-registry.js --page HomePage --url /home
 *   node framework/ai/scripts/codegen-to-registry.js --page HomePage --url /home --login
 *   node framework/ai/scripts/codegen-to-registry.js --parse path/to/codegen-output.js --page HomePage
 *
 * Workflow:
 *   1. Launches Playwright codegen (interactive recording)
 *   2. Engineer clicks through the page — codegen generates perfect locators
 *   3. Saves the codegen output, parses it, and updates the registry
 *
 * OR (non-interactive):
 *   1. Reads an existing codegen output file
 *   2. Parses locators from it
 *   3. Updates the registry
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const REGISTRY_DIR = path.join(PROJECT_ROOT, 'framework', 'pages', 'registry');
const CODEGEN_OUTPUT_DIR = path.join(PROJECT_ROOT, 'ai-reports', 'codegen-recordings');

// Ensure directories exist
fs.mkdirSync(REGISTRY_DIR, { recursive: true });
fs.mkdirSync(CODEGEN_OUTPUT_DIR, { recursive: true });

// Parse CLI args
const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
};
const hasFlag = (flag) => args.includes(flag);

const pageName = getArg('--page') || 'UnknownPage';
const pageUrl = getArg('--url') || '/';
const parseFile = getArg('--parse');
const doLogin = hasFlag('--login');
const baseUrl = process.env.TC_BASE_URL || 'https://qa2.totalconnect2.com';

/**
 * Parse Playwright codegen output and extract locators.
 * Codegen output looks like:
 *   await page.getByRole('button', { name: 'ARM HOME' }).click();
 *   await page.getByText('SELECT ALL').click();
 *   await page.locator('#submenu-AutomationMenu').click();
 */
function parseCodegenOutput(code) {
  const elements = [];
  const lines = code.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('await page.') && !trimmed.startsWith('page.')) continue;

    // Extract the locator part (everything between 'page.' and the action like '.click()', '.fill()')
    const actionMatch = trimmed.match(/(?:await\s+)?page\.(.*?)\.(click|fill|check|uncheck|press|selectOption|hover)\((.*?)\);?/);
    if (!actionMatch) {
      // Try assertion patterns
      const assertMatch = trimmed.match(/(?:await\s+)?expect\(page\.(.*?)\)\.(toBeVisible|toHaveText|toContainText)\((.*?)\);?/);
      if (assertMatch) {
        elements.push({
          selector: `page.${assertMatch[1]}`,
          action: 'assert',
          assertionType: assertMatch[2],
          value: assertMatch[3] || null,
        });
      }
      continue;
    }

    const [, locatorChain, action, actionValue] = actionMatch;
    elements.push({
      selector: `page.${locatorChain}`,
      action,
      value: actionValue || null,
    });
  }

  return elements;
}

/**
 * Generate a camelCase element name from the locator.
 */
function generateElementName(selector, action) {
  // Extract meaningful text from selector
  let name = '';

  const roleMatch = selector.match(/getByRole\('(\w+)',\s*\{\s*name:\s*['"](.+?)['"]/);
  if (roleMatch) {
    name = roleMatch[2].replace(/[^a-zA-Z0-9\s]/g, '').trim();
    name = name.split(/\s+/).map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
    name += roleMatch[1].charAt(0).toUpperCase() + roleMatch[1].slice(1);
    return name;
  }

  const textMatch = selector.match(/getByText\(['"](.+?)['"]\)/);
  if (textMatch) {
    name = textMatch[1].replace(/[^a-zA-Z0-9\s]/g, '').trim();
    name = name.split(/\s+/).map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
    name += 'Text';
    return name;
  }

  const labelMatch = selector.match(/getByLabel\(['"](.+?)['"]\)/);
  if (labelMatch) {
    name = labelMatch[1].replace(/[^a-zA-Z0-9\s]/g, '').trim();
    name = name.split(/\s+/).map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
    name += 'Input';
    return name;
  }

  const idMatch = selector.match(/locator\(['"]#(.+?)['"]\)/);
  if (idMatch) {
    return idMatch[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  }

  const hasTextMatch = selector.match(/locator\('(\w+)',\s*\{\s*hasText:\s*['"](.+?)['"]\s*\}/);
  if (hasTextMatch) {
    name = hasTextMatch[2].replace(/[^a-zA-Z0-9\s]/g, '').trim();
    name = name.split(/\s+/).map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
    name += hasTextMatch[1].charAt(0).toUpperCase() + hasTextMatch[1].slice(1);
    return name;
  }

  return `element${Date.now() % 10000}`;
}

/**
 * Build or update the registry from parsed codegen elements.
 */
function buildRegistry(parsedElements, existingRegistry = null) {
  const registry = existingRegistry || {
    pageName,
    url: pageUrl,
    urlPattern: `**${pageUrl}`,
    description: `Page object registry for ${pageName}`,
    elements: {},
    stateTransitions: {},
    metadata: {
      source: 'playwright-codegen',
      lastUpdated: new Date().toISOString(),
      verified: true,
    },
  };

  // Update metadata
  registry.metadata = registry.metadata || {};
  registry.metadata.lastUpdated = new Date().toISOString();
  registry.metadata.source = 'playwright-codegen';
  registry.metadata.verified = true;

  for (const el of parsedElements) {
    const name = generateElementName(el.selector, el.action);

    registry.elements[name] = {
      selector: el.selector,
      type: el.action === 'fill' ? 'input' : el.action === 'assert' ? 'text' : 'button',
      action: el.action,
      context: `Recorded via Playwright codegen — verified locator`,
      ...(el.value ? { value: el.value } : {}),
      verified: true,
      recordedAt: new Date().toISOString(),
    };
  }

  return registry;
}

/**
 * Launch Playwright codegen interactively.
 */
function launchCodegen(url) {
  const outputFile = path.join(CODEGEN_OUTPUT_DIR, `${pageName}-${Date.now()}.js`);

  console.log(`\n[CODEGEN] Launching Playwright codegen for ${pageName}...`);
  console.log(`[CODEGEN] URL: ${url}`);
  console.log(`[CODEGEN] Output will be saved to: ${outputFile}`);
  console.log(`[CODEGEN] \n  👉 Interact with the page — every click/fill is recorded with perfect locators.`);
  console.log(`[CODEGEN]    Close the browser when done.\n`);

  try {
    // Launch codegen — this blocks until the user closes the browser
    execSync(
      `npx playwright codegen "${url}" --output "${outputFile}"`,
      { stdio: 'inherit', cwd: PROJECT_ROOT }
    );

    if (fs.existsSync(outputFile)) {
      console.log(`\n[CODEGEN] Recording saved: ${outputFile}`);
      return outputFile;
    } else {
      console.log(`[CODEGEN] No output generated.`);
      return null;
    }
  } catch (err) {
    // User might close the window — check if file was saved
    if (fs.existsSync(outputFile)) {
      console.log(`\n[CODEGEN] Recording saved: ${outputFile}`);
      return outputFile;
    }
    console.log(`[CODEGEN] Codegen exited: ${err.message}`);
    return null;
  }
}

/**
 * Main execution
 */
async function main() {
  let codegenFile = parseFile;

  if (!codegenFile) {
    // Launch interactive codegen
    const targetUrl = doLogin ? `${baseUrl}/login` : `${baseUrl}${pageUrl}`;
    codegenFile = launchCodegen(targetUrl);
  }

  if (!codegenFile || !fs.existsSync(codegenFile)) {
    console.error('[CODEGEN] No codegen output to parse. Exiting.');
    process.exit(1);
  }

  // Parse the codegen output
  console.log(`\n[CODEGEN] Parsing codegen output: ${codegenFile}`);
  const code = fs.readFileSync(codegenFile, 'utf-8');
  const parsedElements = parseCodegenOutput(code);

  console.log(`[CODEGEN] Found ${parsedElements.length} interactions:`);
  parsedElements.forEach((el, i) => {
    console.log(`  ${i + 1}. [${el.action}] ${el.selector}`);
  });

  // Load existing registry if present
  const registryFile = path.join(REGISTRY_DIR, `${pageName}.registry.json`);
  let existingRegistry = null;
  if (fs.existsSync(registryFile)) {
    existingRegistry = JSON.parse(fs.readFileSync(registryFile, 'utf-8'));
    console.log(`\n[CODEGEN] Updating existing registry: ${registryFile}`);
  } else {
    console.log(`\n[CODEGEN] Creating new registry: ${registryFile}`);
  }

  // Build/update registry
  const registry = buildRegistry(parsedElements, existingRegistry);

  // Save registry
  fs.writeFileSync(registryFile, JSON.stringify(registry, null, 2), 'utf-8');
  console.log(`[CODEGEN] Registry saved with ${Object.keys(registry.elements).length} elements.`);
  console.log(`\n[CODEGEN] ✓ Done. Run 'npm run ai:gen:smoke' to generate specs from this registry.\n`);
}

main().catch(err => {
  console.error('[CODEGEN] Error:', err.message);
  process.exit(1);
});
