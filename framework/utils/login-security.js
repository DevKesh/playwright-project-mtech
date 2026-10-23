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
    attempts: integerSetting(env.LOGIN_SECURITY_ATTEMPTS, 5, 1, Number.MAX_SAFE_INTEGER, 'LOGIN_SECURITY_ATTEMPTS'),
    intervalMs: integerSetting(env.LOGIN_SECURITY_INTERVAL_MS, 10000, 5000, 60000, 'LOGIN_SECURITY_INTERVAL_MS'),
  };
}

function uniqueInvalidCredentials(attempt, runId, now = Date.now()) {
  if (!Number.isSafeInteger(attempt) || attempt < 1) throw new Error('Invalid attempt number.');
  // Never derive synthetic credentials from real account names or passwords.
  const suffix = `${now}-${attempt}-${randomBytes(6).toString('hex')}`;
  return {
    username: `qa-neg-${runId.slice(0, 8)}-${suffix}`,
    password: `Qa!${suffix}-${randomBytes(8).toString('hex')}`,
  };
}

async function observeSecurityChallenge(page, observationMs = 10000) {
  let detected = false;
  try {
    const handle = await page.waitForFunction(() => {
      const challengeText = /Performing security verification|Verify you are human|verifies you are not a bot/i;
      if (challengeText.test(document.body?.innerText || '')) return true;
      return Array.from(document.querySelectorAll('iframe')).some(frame => {
        const bounds = frame.getBoundingClientRect();
        const style = getComputedStyle(frame);
        return bounds.width > 0 && bounds.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
          && (/challenges\.cloudflare\.com/i.test(frame.src) || /security challenge/i.test(frame.title));
      });
    }, undefined, { timeout: observationMs, polling: 100 });
    await handle.dispose();
    detected = true;
  } catch (error) {
    if (error.name !== 'TimeoutError') throw error;
  }
  return { detected, observationMs, finalUrl: page.url() };
}

module.exports = {
  QA_ORIGIN, securitySettings, uniqueInvalidCredentials, observeSecurityChallenge,
};