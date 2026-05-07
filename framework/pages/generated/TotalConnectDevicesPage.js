const { expect } = require('@playwright/test');

class TotalConnectDevicesPage {
  constructor(page) {
    this.page = page;
    this.devicesList = page.locator('.devices-list, [class*="device"]').first();
  }

  async open(url) {
    await this.page.goto(url);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async verifyDevicesListVisible() {
    await expect(this.devicesList).toBeVisible({ timeout: 10000 });
  }
}

module.exports = { TotalConnectDevicesPage };
