const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');
const { LoginPage } = require('../../pages/generated/smoke/LoginPage');

let browser;
before(async () => {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
});
after(async () => { await browser?.close(); });

async function withPage(run) {
  const page = await browser.newPage();
  page.setDefaultTimeout(2000);
  try {
    await page.setContent('<a href="#recovery" id="recovery">Problems signing in?</a>');
    await run(page, new LoginPage(page));
  } finally {
    await page.close();
  }
}

async function showConsent(page, label = 'ACCEPT ALL', id = '') {
  await page.evaluate(({ label, id }) => {
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-label', 'Cookie Information');
    dialog.style.cssText = 'position:fixed;inset:0;z-index:9999;background:white';
    const text = document.createElement('p');
    text.textContent = 'This website uses cookies.';
    const button = document.createElement('button');
    button.textContent = label;
    button.id = id;
    button.onclick = () => dialog.remove();
    dialog.append(text, button);
    document.body.append(dialog);
  }, { label, id });
}

test('dismisses an already visible Cookie Information dialog', () => withPage(async (page, login) => {
  await showConsent(page);
  await login.dismissCookieConsent();
  await expect(page.getByRole('dialog')).toBeHidden();
}));

test('handles consent arriving AFTER initial dismissal and again during recovery', () => withPage(async (page, login) => {
  await login.dismissCookieConsent();
  await showConsent(page);
  await page.getByRole('link', { name: 'Problems signing in?' }).click();
  assert.match(page.url(), /#recovery$/);
  await page.setContent('<a href="#login">Return To Sign In</a>');
  await showConsent(page);
  await page.getByRole('link', { name: 'Return To Sign In' }).click();
  assert.match(page.url(), /#login$/);
}));

test('supports CONFIRM MY CHOICES without an ACCEPT ALL button', () => withPage(async (page, login) => {
  await showConsent(page, 'CONFIRM MY CHOICES');
  await login.dismissCookieConsent();
  await expect(page.getByRole('dialog')).toBeHidden();
}));

for (const label of ['Accept All', 'Confirm my choices']) {
  test(`handles late CI consent "${label}" before Sign In without resubmitting`, () => withPage(async (page, login) => {
    await page.setContent('<label>Username<input id="username"></label><label>Password<input id="password" type="password"></label><button id="signin">Sign In</button>');
    await page.evaluate(() => {
      window.submissions = 0;
      document.querySelector('#signin').onclick = () => { window.submissions++; };
    });
    await login.dismissCookieConsent();
    await login.usernameInput.fill('synthetic-fixture-user');
    await login.passwordInput.fill('synthetic-fixture-password');
    await showConsent(page, label);
    await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      dialog.setAttribute('aria-label', 'Your choices regarding the use of cookies on this site');
      dialog.querySelector('p').textContent = 'We value your privacy. This site uses cookies and related technologies.';
    });
    await login.signInButton.click();
    assert.equal(await page.evaluate(() => window.submissions), 1);
    await expect(page.getByRole('dialog')).toBeHidden();
  }));
}

test('supports the legacy TrustArc consent button', () => withPage(async (page, login) => {
  await login.dismissCookieConsent();
  await showConsent(page, 'Agree', 'truste-consent-button');
  await page.getByRole('link', { name: 'Problems signing in?' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}));

test('handles the cookie OK dialog but never dismisses unrelated OK dialogs', () => withPage(async (page, login) => {
  await login.dismissCookieConsent();
  await showConsent(page, 'OK');
  await page.getByRole('link', { name: 'Problems signing in?' }).click();
  await page.setContent('<div role="dialog">Security system error<button>OK</button></div>');
  await login.dismissCookieConsent();
  await expect(page.getByRole('dialog')).toBeVisible();
}));

test('installs only one handler per page across repeated page object creation', () => withPage(async (page, login) => {
  const addHandler = page.addLocatorHandler.bind(page);
  let registrations = 0;
  page.addLocatorHandler = async (...args) => {
    registrations += 1;
    return addHandler(...args);
  };
  await login.dismissCookieConsent();
  await new LoginPage(page).dismissCookieConsent();
  assert.equal(registrations, 1);
  await page.getByRole('link', { name: 'Problems signing in?' }).click();
}));

test('does not hide failure when the consent button cannot close its overlay', () => withPage(async (page, login) => {
  await login.dismissCookieConsent();
  await showConsent(page);
  // Set up the broken fixture without triggering actionability/consent handling.
  await page.evaluate(() => { document.querySelector('[role="dialog"] button').onclick = null; });
  await assert.rejects(page.getByRole('link', { name: 'Problems signing in?' }).click(), /Timeout/);
  assert.equal(await page.evaluate(() => !!document.querySelector('[role="dialog"]')), true);
}));