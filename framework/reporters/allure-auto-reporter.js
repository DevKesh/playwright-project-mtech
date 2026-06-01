const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const runtime = require('../config/runtime.config');

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
      // Generate report (always sync — we need the files to exist)
      console.log(`[AllureAutoReporter] Generating report → ${reportDir}`);
      // Remove existing report dir if present (Allure 3.x doesn't support --clean)
      if (fs.existsSync(reportDir)) {
        fs.rmSync(reportDir, { recursive: true, force: true });
      }
      execSync(
        `npx allure generate ./${this.resultsDir} -o "${reportDir}"`,
        { stdio: 'inherit', cwd: process.cwd() }
      );
      console.log(`[AllureAutoReporter] ✔ Report saved: ${reportDir}`);
      console.log(`[AllureAutoReporter]   Status: ${result.status} | Duration: ${this._formatDuration(result.duration)}`);

      // Also generate/refresh the standard allure-report/ for slack-notify to read
      const stdReport = path.resolve(process.cwd(), 'allure-report');
      if (fs.existsSync(stdReport)) fs.rmSync(stdReport, { recursive: true, force: true });
      execSync(
        `npx allure generate ./${this.resultsDir} -o allure-report`,
        { stdio: 'pipe', cwd: process.cwd() }
      );

      // Open report in browser WITHOUT blocking (so slack-notify can run after)
      if (runtime.reporting.openAfterRun) {
        const { exec } = require('child_process');
        exec(`npx allure open "${reportDir}"`, (err) => {
          if (err) console.error('[AllureAutoReporter] Could not open report:', err.message);
        });
      }

      // Send Slack notification if enabled (fires regardless of how tests were invoked)
      if (runtime.reporting.slackEnabled) {
        const slackScript = path.resolve(__dirname, '../utils/slack-notify.js');
        try {
          execSync(`node "${slackScript}"`, {
            stdio: 'inherit',
            cwd: process.cwd(),
            env: {
              ...process.env,
              TEST_OUTCOME: result.status === 'passed' ? 'success' : 'failure',
            },
          });
        } catch (slackErr) {
          console.error('[AllureAutoReporter] Slack notification failed:', slackErr.message);
        }
      }
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
