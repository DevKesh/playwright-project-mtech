const { expect } = require('@playwright/test');

class DevicesPage {
  constructor(page) {
    this.page = page;
    this.devicesLink = page.getByRole('link', { name: 'Devices' });
    this.devicesList = page.getByRole('list', { name: 'Devices List' });
  }

  async open(url) {
    await this.page.goto(url);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async navigateToDevices() {
    await this.devicesLink.click();
    await this.page.waitForURL(/.*\/automation/, { timeout: 10000 });
  }

  async verifyUrlContainsAutomation() {
    await expect(this.page).toHaveURL(/.*\/automation/);
  }

  async verifyDevicesListVisible() {
    await expect(this.devicesList).toBeVisible();
  }
}

module.exports = { DevicesPage };