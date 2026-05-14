const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Custom Playwright reporter that auto-generates a timestamped Allure HTML report
 * after every test run. Reports are saved to:
 *   allure-reports-history/allure-report-YYYY-MM-DD_HH-MM-SS/
 */
class AllureAutoReporter {
  constructor(options = {}) {
    this.resultsDir = options.resultsDir || 'allure-results';
    this.outputBase = options.outputDir || 'allure-reports-history';
  }

  onBegin() {
    // Record start time for the report folder name
    this._startTime = new Date();
  }

  onEnd(result) {
    const timestamp = this._formatTimestamp(this._startTime || new Date());
    const reportDir = path.join(this.outputBase, `allure-report-${timestamp}`);

    // Ensure the history directory exists
    if (!fs.existsSync(this.outputBase)) {
      fs.mkdirSync(this.outputBase, { recursive: true });
    }

    // Verify allure-results has data
    if (!fs.existsSync(this.resultsDir) || fs.readdirSync(this.resultsDir).length === 0) {
      console.log('[AllureAutoReporter] No allure results found. Skipping report generation.');
      return;
    }

    try {
      console.log(`[AllureAutoReporter] Generating report → ${reportDir}`);
      execSync(
        `npx allure generate ./${this.resultsDir} -o "${reportDir}" --open`,
        { stdio: 'inherit', cwd: process.cwd() }
      );
      console.log(`[AllureAutoReporter] ✔ Report saved: ${reportDir}`);
      console.log(`[AllureAutoReporter]   Status: ${result.status} | Duration: ${this._formatDuration(result.duration)}`);
    } catch (err) {
      console.error('[AllureAutoReporter] ✖ Failed to generate Allure report:', err.message);
    }
  }

  /**
   * Format a Date to YYYY-MM-DD_HH-MM-SS
   */
  _formatTimestamp(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate()),
    ].join('-') + '_' + [
      pad(date.getHours()),
      pad(date.getMinutes()),
      pad(date.getSeconds()),
    ].join('-');
  }

  /**
   * Format milliseconds to human-readable duration
   */
  _formatDuration(ms) {
    if (!ms) return 'N/A';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  }
}

module.exports = AllureAutoReporter;
