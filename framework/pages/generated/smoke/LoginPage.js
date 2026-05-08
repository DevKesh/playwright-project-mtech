// Full page object source code
const { expect } = require('@playwright/test');

class LoginPage {
  constructor(page) {
    this.page = page;
    this.usernameInput = page.getByLabel('Username');
    this.passwordInput = page.getByLabel('Password');
    this.signInButton = page.getByRole('button', { name: 'Sign In' });
    this.cookieConsentButton = page.locator('#truste-consent-button');
  }

  async login(username, password) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.signInButton.click();
  }

  async dismissCookieConsent() {
    if (await this.cookieConsentButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.cookieConsentButton.click();
    }
  }
}

module.exports = { LoginPage };