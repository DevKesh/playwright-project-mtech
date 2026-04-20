const { expect } = require('@playwright/test');

class ActivityPage {
  constructor(page) {
    this.page = page;
    this.activityLogEntries = page.locator('.activity-log-entry');
  }

  async open() {
    await this.page.goto('https://qa2.totalconnect2.com/events');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async verifyActivityLogEntriesVisible() {
    await expect(this.activityLogEntries).toBeVisible();
  }
}

module.exports = { ActivityPage };