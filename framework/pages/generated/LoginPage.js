const { expect } = require('@playwright/test');

class LoginPage {
  constructor(page) {
    this.page = page;
    this.usernameInput = page.getByLabel('Username');
    this.passwordInput = page.getByLabel('Password');
  }

  async open() {
    await this.page.goto('https://qa2.totalconnect2.com/login');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async fillLoginForm(username, password) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
  }

  async clickLoginButton() {
    await this.page.getByRole('button', { name: /log\s*in/i }).click();
  }

  async dismissCookiePopup() {
    const cookieBtn = this.page.locator('[id*="cookie"] button, [class*="cookie"] button').first();
    const visible = await cookieBtn.isVisible().catch(() => false);
    if (visible) await cookieBtn.click();
  }

  async closePopup() {
    const doneBtn = this.page.getByRole('button', { name: /done/i });
    const visible = await doneBtn.isVisible().catch(() => false);
    if (visible) await doneBtn.click();
  }
}

module.exports = { LoginPage };