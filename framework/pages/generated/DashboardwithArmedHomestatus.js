const { expect } = require('@playwright/test');

class DashboardwithArmedHomestatus {
  constructor(page) {
    this.page = page;
    this.armedHomeStatus = page.getByText('Armed Home');
  }

  async open(url) {
    await this.page.goto(url);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async waitForArmedHomeStatus() {
    await expect(this.armedHomeStatus).toBeVisible();
  }
}

module.exports = { DashboardwithArmedHomestatus };