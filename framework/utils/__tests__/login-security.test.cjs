const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');
const { observeSecurityChallenge, securitySettings, uniqueInvalidCredentials } = require('../login-security');

test('iteration settings and synthetic credentials support counts above 100', () => {
  for (const attempts of [1, 100, 101, 250, 1000]) {
    assert.equal(securitySettings({ LOGIN_SECURITY_ATTEMPTS: String(attempts) }).attempts, attempts);
    const credentials = uniqueInvalidCredentials(attempts, 'offline-test');
    assert.match(credentials.username, /^qa-neg-/);
    assert.notEqual(credentials.password, uniqueInvalidCredentials(attempts, 'offline-test').password);
  }
  for (const attempts of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => securitySettings({ LOGIN_SECURITY_ATTEMPTS: String(attempts) }));
    assert.throws(() => uniqueInvalidCredentials(attempts, 'offline-test'));
  }
});

test('challenge observation detects immediate and delayed challenges without live requests', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => route.abort());
    await page.setContent('<main>Performing security verification</main>');
    assert.equal((await observeSecurityChallenge(page, 1000)).detected, true);
    await page.setContent('<main>Login</main>');
    assert.equal((await observeSecurityChallenge(page, 200)).detected, false);
    await page.evaluate(() => {
      setTimeout(() => { document.body.innerText = 'Verify you are human'; }, 100);
    });
    assert.equal((await observeSecurityChallenge(page, 1000)).detected, true);
    await page.setContent('<iframe title="Widget containing a Cloudflare security challenge"></iframe>');
    assert.equal((await observeSecurityChallenge(page, 1000)).detected, true);
    await page.setContent('<iframe title="security challenge" style="display:none"></iframe><main>Login</main>');
    assert.equal((await observeSecurityChallenge(page, 200)).detected, false);
    await page.close();
    await assert.rejects(observeSecurityChallenge(page, 200), /closed/i);
  } finally {
    await browser.close();
  }
});