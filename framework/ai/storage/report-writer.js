/**
 * Write structured JSON reports to ai-reports/ subdirectories.
 */

const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.resolve(__dirname, '../../../ai-reports');

/**
 * Write a report to a subdirectory of ai-reports/.
 * @param {string} subdirectory - e.g., 'failure-reports', 'drift-reports'
 * @param {string} filename - e.g., 'failure-register-1234.json'
 * @param {object} data - The report data to write.
 */
function writeReport(subdirectory, filename, data) {
  const dir = path.join(REPORTS_DIR, subdirectory);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  return filePath;
}

/**
 * Read all JSON reports from a subdirectory.
 * @param {string} subdirectory
 * @returns {Array<object>}
 */
function readReports(subdirectory) {
  const dir = path.join(REPORTS_DIR, subdirectory);
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

module.exports = { writeReport, readReports, REPORTS_DIR };
