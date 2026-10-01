const { randomBytes } = require('node:crypto');

const QA_ORIGIN = 'https://qa2.totalconnect2.com';

function integerSetting(value, fallback, min, max, name) {
  const number = Number(value === undefined ? fallback : value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}.`);
  }
  return number;
}

function securitySettings(env = process.env) {
  return {
    attempts: integerSetting(env.LOGIN_SECURITY_ATTEMPTS, 5, 1, 100, 'LOGIN_SECURITY_ATTEMPTS'),
    intervalMs: integerSetting(env.LOGIN_SECURITY_INTERVAL_MS, 10000, 5000, 60000, 'LOGIN_SECURITY_INTERVAL_MS'),
  };
}

function uniqueInvalidCredentials(attempt, runId, now = Date.now()) {
  if (!Number.isInteger(attempt) || attempt < 1 || attempt > 100) throw new Error('Invalid attempt number.');
  // Never derive synthetic credentials from real account names or passwords.
  const suffix = `${now}-${attempt}-${randomBytes(6).toString('hex')}`;
  return {
    username: `qa-neg-${runId.slice(0, 8)}-${suffix}`,
    password: `Qa!${suffix}-${randomBytes(8).toString('hex')}`,
  };
}

// Retain only HTTP status/method/resource type, never URLs, headers, bodies,
// cookies, tokens, or submitted values. Ignore unrelated third-party telemetry.
// Observation only: responses never change test execution or skip attempts.
function observeLoginNetwork(page, origin = QA_ORIGIN) {
  const responses = [];
  let pageErrors = 0;
  const onResponse = response => {
    if (new URL(response.url()).origin !== origin) return;
    const status = response.status();
    const request = response.request();
    const resourceType = request.resourceType();
    if (['xhr', 'fetch', 'document'].includes(resourceType) || status >= 400) {
      responses.push({ status, method: request.method(), resourceType });
    }
  };
  const onPageError = () => { pageErrors++; };
  page.on('response', onResponse);
  page.on('pageerror', onPageError);
  return {
    responses,
    get pageErrors() { return pageErrors; },
    close() { page.off('response', onResponse); page.off('pageerror', onPageError); },
  };
}

module.exports = {
  QA_ORIGIN, securitySettings, uniqueInvalidCredentials, observeLoginNetwork,
};