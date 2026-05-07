const { expect } = require('@playwright/test');

class TotalConnectScenesPage {
  constructor(page) {
    this.page = page;
    this.scenesList = page.locator('.scenes-list, [class*="scene"]').first();
  }

  async open(url) {
    await this.page.goto(url);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async verifyScenesListVisible() {
    await expect(this.scenesList).toBeVisible({ timeout: 10000 });
  }
}

module.exports = { TotalConnectScenesPage };
