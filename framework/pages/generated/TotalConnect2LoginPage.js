const { expect } = require('@playwright/test');

class TotalConnect2LoginPage {
  constructor(page) {
    this.page = page;
    this.usernameInput = page.locator('#UsernameInput');
    this.passwordInput = page.locator('#PasswordInput');
    this.signInButton = page.locator('#LoginButton');
    this.problemsSigningInLink = page.locator('#problemSigingInLink');
    this.showPasswordButton = page.locator('.changeInputType');
    this.consentOkButton = page.locator('#truste-consent-button');
  }

  async open(url) {
    await this.page.goto(url);
  }

  async fillLoginForm(username, password) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
  }

  async clickSignIn() {
    await this.signInButton.click();
  }

  async clickProblemsSigningIn() {
    await this.problemsSigningInLink.click();
  }

  async togglePasswordVisibility() {
    await this.showPasswordButton.click();
  }

  async acceptConsent() {
    await this.consentOkButton.click();
  }
}

module.exports = { TotalConnect2LoginPage };