const { expect } = require('@playwright/test');

class HomePage {
  constructor(page) {
    this.page = page;
    this.loginButton = page.locator('#LoginButton');
    this.cookieDismissButton = page.locator('#truste-consent-button');
    this.doneButton = page.locator('#btnYesKeyNotification', { hasText: 'DONE' });
  }

  async open(url) {
    await this.page.goto(url);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async clickLoginButton() {
    await this.loginButton.click();
  }

  async dismissCookiePopup() {
    if (await this.cookieDismissButton.isVisible()) {
      await this.cookieDismissButton.click();
    }
  }

  async closePopupIfVisible() {
    if (await this.doneButton.isVisible()) {
      await this.doneButton.click();
    }
  }
}

module.exports = { HomePage };