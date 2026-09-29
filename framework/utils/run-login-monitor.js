const { spawn } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const cli = require.resolve('@playwright/test/cli');

function integerSetting(name, fallback, minimum) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < minimum || value > 2147483647) {
    throw new Error(`${name} must be an integer between ${minimum} and 2147483647.`);
  }
  return value;
}

const interval = integerSetting('LOGIN_MONITOR_INTERVAL_MS', 30000, 1000);
// Zero means run until Ctrl+C. A finite limit is useful for unattended checks.
const maxBatches = integerSetting('LOGIN_MONITOR_MAX_BATCHES', 0, 0);
let child;
let timer;
let stopping = false;
let completed = 0;
let failed = 0;

function stop() {
  if (stopping) return;
  stopping = true;
  clearTimeout(timer);
  console.log('\n[login-monitor] Stopping; no more batches will start.');
  if (child) child.kill('SIGTERM');
  process.exitCode = 130;
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);

function runBatch() {
  if (stopping) return;
  console.log(`\n[login-monitor] ${new Date().toISOString()} Starting batch ${completed + 1}. Ctrl+C to stop.`);
  child = spawn(process.execPath, [
    cli, 'test', '--config', 'playwright.login-monitor.config.js',
    ...process.argv.slice(2),
  ], { cwd: root, stdio: 'inherit', shell: false });

  child.once('error', error => {
    console.error(`[login-monitor] Could not start Playwright: ${error.message}`);
    stopping = true;
    process.exitCode = 1;
  });

  child.once('close', (code, signal) => {
    child = undefined;
    if (stopping) return;
    completed += 1;
    if (code !== 0) failed += 1;
    console.log(`[login-monitor] ${new Date().toISOString()} Batch ${completed}: ${code === 0 ? 'PASS' : 'FAIL'} (exit=${code}, signal=${signal || 'none'}). Failed batches: ${failed}/${completed}.`);
    if (signal || (code !== 0 && code !== 1)) {
      console.error('[login-monitor] Runner interrupted or could not complete; stopping.');
      process.exitCode = code || 1;
      return;
    }
    if (maxBatches && completed >= maxBatches) {
      process.exitCode = failed ? 1 : 0;
      return;
    }
    console.log(`[login-monitor] Next batch in ${interval / 1000}s. Test failures do not stop monitoring.`);
    timer = setTimeout(runBatch, interval);
  });
}

runBatch();