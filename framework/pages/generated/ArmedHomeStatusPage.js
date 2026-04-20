// actual complete runnable code
const { expect } = require('@playwright/test');

class ArmedHomeStatusPage {
  constructor(page) {
    this.page = page;
    this.armedHomeStatus = page.locator('text=Armed Home');
  }

  async open(url) {
    await this.page.goto(url);
    await this.page.waitForLoadState('networkidle');
  }

  async waitForArmedHomeStatus() {
    await this.armedHomeStatus.waitFor({ state: 'visible' });
  }
}

module.exports = { ArmedHomeStatusPage };