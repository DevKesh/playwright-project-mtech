const { expect } = require('@playwright/test');
const { waitForPageReady } = require('../../../utils/waitForPageReady');

class DevicesPage {
  constructor(page) {
    this.page = page;
  }

  async verifyDeviceCategoriesVisible() {
    // Wait for the page to load content — look for any heading, card, or list item on the devices/automation page
    await this.page.waitForURL('**/automation', { timeout: 10000 });
    // Wait for ALL loaders to disappear (e.g., "Loading devices" spinner)
    await waitForPageReady(this.page);
    // Verify there's at least some meaningful content on the page (not just a blank page)
    // A sidebar "Devices" button or arbitrary heading must never satisfy this check.
    const categories = this.page.getByText(/^(Lights?|Locks?|Thermostats?|Garage(?: Doors?)?|Sensors?|Switches?)$/i)
      .filter({ visible: true });
    await expect(categories.first(), 'At least one actual device category must be visible')
      .toBeVisible({ timeout: 30000 });
  }

  async verifyDevicesListVisible() {
    await this.verifyDeviceCategoriesVisible();
  }
}

module.exports = { DevicesPage };