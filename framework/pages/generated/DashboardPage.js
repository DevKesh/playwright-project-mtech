const { expect } = require('@playwright/test');

class DashboardPage {
  constructor(page) {
    this.page = page;
    this.loginButton = page.locator('#LoginButton');
    this.cookieDismissButton = page.locator('#truste-consent-button');
    this.doneButton = page.locator('#btnYesKeyNotification', { hasText: 'DONE' });
    this.selectAllButton = page.getByText('SELECT ALL');
    this.armHomeButton = page.getByRole('button', { name: 'Arm Home' });
  }

  async open(url) {
    await this.page.goto(url);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async loginAndNavigateToDashboard() {
    await this.loginButton.click();
    await this.page.waitForURL('**/dashboard', { waitUntil: 'domcontentloaded' });
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

  async selectAllPartitions() {
    await this.selectAllButton.click();
  }

  async armHome() {
    await this.armHomeButton.click();
  }
}

module.exports = { DashboardPage };