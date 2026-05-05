/**
 * Markdown Test Suite Parser
 *
 * Parses a structured .md file into an array of test case objects.
 * Each test case becomes an independent NL authoring run.
 *
 * Expected format:
 *
 *   # Suite Name
 *   Optional description text (ignored)
 *
 *   > login: true
 *   > locators: getByRole, getByLabel, getByText
 *   > output: tests/generated/smoke
 *   > pages: framework/pages/generated/smoke
 *   > tags: @smoke @tc @tc-plan
 *
 *   ## TC-001: Login and verify dashboard
 *   **Entry:** User is on login page
 *   **Exit:** User sees the home dashboard
 *   login to the app
 *   dismiss cookie popup
 *   verify dashboard is visible
 *
 *   ## TC-002: Navigate to devices
 *   **Entry:** User is logged in and on home page
 *   **Exit:** Devices page is visible with at least one device
 *   go to devices page
 *   verify device list is visible
 *
 * Headings:
 *   # (h1) = Suite name
 *   ## (h2) = Test case — everything until the next ## is the instruction block
 *
 * The text after "## " is the test case ID + title (split on first ":")
 * Lines starting with > are treated as config overrides (e.g. > login: true)
 *   Suite-level > lines (before first ##) apply as defaults to all test cases.
 *   Test-case-level > lines override suite defaults.
 * Lines starting with **Entry:** define the precondition for a test case.
 * Lines starting with **Exit:** define the expected postcondition.
 */

const fs = require('fs');
const path = require('path');

/**
 * Parse a single blockquote option line into key/value.
 * @param {string} line - The raw line (after stripping > prefix)
 * @returns {{ key: string, value: string } | null}
 */
function parseOptionLine(line) {
  const optLine = line.replace(/^>\s*/, '').trim();
  const eqIdx = optLine.indexOf(':');
  if (eqIdx <= 0) return null;
  const key = optLine.substring(0, eqIdx).trim().toLowerCase();
  const val = optLine.substring(eqIdx + 1).trim();
  return { key, value: val };
}

/**
 * Apply a parsed option to an options object.
 * @param {object} options - The options object to mutate
 * @param {string} key
 * @param {string} val
 */
function applyOption(options, key, val) {
  if (key === 'login') options.autoLogin = val === 'true';
  else if (key === 'url') options.url = val;
  else if (key === 'headless') options.headless = val === 'true';
  else if (key === 'tags') options.tags = val;
  else if (key === 'locators') options.preferredLocators = val.split(',').map(s => s.trim());
  else if (key === 'output') options.outputDir = val;
  else if (key === 'pages') options.pagesDir = val;
  else if (key === 'cache') options.domCache = val === 'true';
}

/**
 * Parse a markdown test suite file.
 * @param {string} filePath - Absolute path to the .md file
 * @returns {{ suiteName: string, suiteFile: string, suiteOptions: object, testCases: Array<{id: string, title: string, instructions: string, entryCriteria: string, exitCriteria: string, options: object}> }}
 */
function parseMdSuite(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Suite file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  let suiteName = path.basename(filePath, '.md');
  const suiteOptions = {};  // Suite-level defaults (> lines before first ##)
  const testCases = [];
  let current = null;
  let inSuiteHeader = true;  // True until first ## is encountered

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // H1 → suite name
    if (/^# /.test(line) && !/^## /.test(line)) {
      suiteName = line.replace(/^# /, '').trim();
      continue;
    }

    // H2 → new test case
    if (/^## /.test(line)) {
      inSuiteHeader = false;

      // Save previous test case
      if (current) {
        current.instructions = current._lines.join('\n').trim();
        delete current._lines;
        if (current.instructions) testCases.push(current);
      }

      const heading = line.replace(/^## /, '').trim();
      const colonIdx = heading.indexOf(':');
      let id, title;
      if (colonIdx > 0) {
        id = heading.substring(0, colonIdx).trim();
        title = heading.substring(colonIdx + 1).trim();
      } else {
        id = `TC-${String(testCases.length + 1).padStart(3, '0')}`;
        title = heading;
      }

      // Start with suite-level defaults merged into options
      current = { id, title, _lines: [], options: { ...suiteOptions }, entryCriteria: '', exitCriteria: '' };
      continue;
    }

    // Inside a test case
    if (current) {
      // Blockquote lines → config overrides (test-case level)
      if (/^>\s*/.test(line)) {
        const parsed = parseOptionLine(line);
        if (parsed) applyOption(current.options, parsed.key, parsed.value);
        continue;
      }

      // Entry/Exit criteria (bold markers)
      if (/^\*\*Entry/i.test(line.trim())) {
        current.entryCriteria = line.trim().replace(/^\*\*Entry\s*:?\*\*\s*/i, '').trim();
        continue;
      }
      if (/^\*\*Exit/i.test(line.trim())) {
        current.exitCriteria = line.trim().replace(/^\*\*Exit\s*:?\*\*\s*/i, '').trim();
        continue;
      }

      // Skip blank lines and markdown noise but include instruction text
      if (line.trim() === '' || /^---+$/.test(line.trim())) continue;
      // Skip comment lines (HTML comments)
      if (/^<!--.*-->$/.test(line.trim())) continue;

      current._lines.push(line.trim());
    }

    // Suite-level blockquote options (before first ##)
    if (inSuiteHeader && /^>\s*/.test(line)) {
      const parsed = parseOptionLine(line);
      if (parsed) applyOption(suiteOptions, parsed.key, parsed.value);
    }
  }

  // Save last test case
  if (current) {
    current.instructions = current._lines.join('\n').trim();
    delete current._lines;
    if (current.instructions) testCases.push(current);
  }

  return {
    suiteName,
    suiteFile: path.basename(filePath),
    suiteOptions,
    testCases,
  };
}

module.exports = { parseMdSuite };
