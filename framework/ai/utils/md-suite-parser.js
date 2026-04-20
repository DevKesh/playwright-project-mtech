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
 *   ## TC-001: Login and verify dashboard
 *   login to the app
 *   dismiss cookie popup
 *   verify dashboard is visible
 *
 *   ## TC-002: Navigate to devices
 *   login to the app
 *   go to devices page
 *   verify device list is visible
 *
 * Headings:
 *   # (h1) = Suite name
 *   ## (h2) = Test case — everything until the next ## is the instruction block
 *
 * The text after "## " is the test case ID + title (split on first ":")
 * Lines starting with > are treated as config overrides (e.g. > login: true)
 */

const fs = require('fs');
const path = require('path');

/**
 * Parse a markdown test suite file.
 * @param {string} filePath - Absolute path to the .md file
 * @returns {{ suiteName: string, suiteFile: string, testCases: Array<{id: string, title: string, instructions: string, options: object}> }}
 */
function parseMdSuite(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Suite file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  let suiteName = path.basename(filePath, '.md');
  const testCases = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // H1 → suite name
    if (/^# /.test(line) && !/^## /.test(line)) {
      suiteName = line.replace(/^# /, '').trim();
      continue;
    }

    // H2 → new test case
    if (/^## /.test(line)) {
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

      current = { id, title, _lines: [], options: {} };
      continue;
    }

    // Inside a test case
    if (current) {
      // Blockquote lines → config overrides
      if (/^>\s*/.test(line)) {
        const optLine = line.replace(/^>\s*/, '').trim();
        const eqIdx = optLine.indexOf(':');
        if (eqIdx > 0) {
          const key = optLine.substring(0, eqIdx).trim().toLowerCase();
          const val = optLine.substring(eqIdx + 1).trim();
          if (key === 'login') current.options.autoLogin = val === 'true';
          else if (key === 'url') current.options.url = val;
          else if (key === 'headless') current.options.headless = val === 'true';
          else if (key === 'tags') current.options.tags = val;
        }
        continue;
      }

      // Skip blank lines and markdown noise but include instruction text
      if (line.trim() === '' || /^---+$/.test(line.trim())) continue;
      // Skip comment lines (HTML comments)
      if (/^<!--.*-->$/.test(line.trim())) continue;

      current._lines.push(line.trim());
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
    testCases,
  };
}

module.exports = { parseMdSuite };
