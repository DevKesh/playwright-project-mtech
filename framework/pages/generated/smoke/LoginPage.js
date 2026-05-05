const { expect } = require('@playwright/test');

class LoginPage {
  constructor(page) {
    this.page = page;
    this.usernameInput = page.getByLabel('Username');
    this.passwordInput = page.getByLabel('Password');
    this.signInButton = page.getByRole('button', { name: 'Sign In' });
  }

  async open() {
    await this.page.goto('https://qa2.totalconnect2.com/login');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async fillLoginForm(username, password) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
  }

  async login(username, password) {
    await this.fillLoginForm(username, password);
    await this.signInButton.click();
    await this.page.waitForURL('**/home', { timeout: 15000 });
  }
}

module.exports = { LoginPage };