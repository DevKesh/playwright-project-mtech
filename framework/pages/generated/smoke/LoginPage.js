// Full page object source code
const { expect } = require('@playwright/test');

class LoginPage {
  constructor(page) {
    this.page = page;
    this.usernameInput = page.getByLabel('Username');
    this.passwordInput = page.getByLabel('Password');
    this.signInButton = page.getByRole('button', { name: 'Sign In' });
    // Cookie consent selectors — try multiple (OneTrust / TrustArc variants)
    this.cookieAcceptAll = page.getByRole('button', { name: 'ACCEPT ALL' });
    this.cookieConsentButton = page.locator('#truste-consent-button');
  }

  async login(username, password) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.signInButton.click();
  }

  async dismissCookieConsent() {
    try {
      // Try the new "ACCEPT ALL" button first (OneTrust-style banner)
      const acceptAll = this.cookieAcceptAll;
      if (await acceptAll.isVisible({ timeout: 5000 }).catch(() => false)) {
        await acceptAll.click();
        await acceptAll.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
        return;
      }
      // Fallback: old TrustArc button
      if (await this.cookieConsentButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await this.cookieConsentButton.click();
      }
    } catch {
      // Banner not present — continue
    }
  }
}

module.exports = { LoginPage };