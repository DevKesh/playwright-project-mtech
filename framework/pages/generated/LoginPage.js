const { expect } = require('@playwright/test');

class LoginPage {
  constructor(page) {
    this.page = page;
    this.usernameInput = page.locator('#UsernameInput');
    this.passwordInput = page.locator('#PasswordInput');
  }

  async open() {
    await this.page.goto('https://qa2.totalconnect2.com/login');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async fillLoginForm(username, password) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
  }
}

module.exports = { LoginPage };