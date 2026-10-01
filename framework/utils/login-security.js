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

module.exports = {
  QA_ORIGIN, securitySettings, uniqueInvalidCredentials,
};