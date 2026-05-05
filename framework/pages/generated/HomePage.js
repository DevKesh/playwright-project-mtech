const { expect } = require('@playwright/test');

class HomePage {
  constructor(page) {
    this.page = page;
    this.loginButton = page.getByRole('button', { name: 'Sign In' });
    this.cookieDismissButton = page.getByRole('button', { name: 'Dismiss' });
    this.doneButton = page.getByRole('button', { name: 'DONE' });
    this.selectAllText = page.getByText('SELECT ALL');
    this.armHomeAllButton = page.getByRole('button', { name: 'Arm Home All' });
    this.armedHomeText = page.getByText('Armed Home');
  }

  async open(url) {
    await this.page.goto(url);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async dismissCookiePopup() {
    if (await this.cookieDismissButton.isVisible()) {
      await this.cookieDismissButton.click();
    }
  }

  async closePopup() {
    if (await this.doneButton.isVisible()) {
      await this.doneButton.click();
    }
  }

  async login() {
    await this.loginButton.click();
  }

  async selectAllPartitions() {
    await this.selectAllText.click();
  }

  async armHomeAll() {
    await this.armHomeAllButton.click();
  }

  async verifyArmedHomeStatus() {
    await expect(this.armedHomeText).toBeVisible({ timeout: 30000 });
  }
}

module.exports = { HomePage };