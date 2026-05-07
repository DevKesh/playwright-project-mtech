const { expect } = require('@playwright/test');

class TotalConnect2LoginPage {
  constructor(page) {
    this.page = page;
    this.usernameInput = page.getByLabel('Username');
    this.passwordInput = page.getByLabel('Password');
    this.signInButton = page.getByRole('button', { name: 'Sign In' });
    this.consentButton = page.locator('#truste-consent-button');
  }

  async open(url) {
    await this.page.goto(url || 'https://qa2.totalconnect2.com/login');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async acceptConsent() {
    await this.consentButton.click({ timeout: 3000 });
  }

  async fillLoginForm(username, password) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
  }

  async clickSignIn() {
    await this.signInButton.click();
  }
}

module.exports = { TotalConnect2LoginPage };
