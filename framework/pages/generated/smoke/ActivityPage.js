const { expect } = require('@playwright/test');

class ActivityPage {
  constructor(page) {
    this.page = page;
    this.activityEntries = page.locator('[class*=event], [class*=activity], .event-row, tr').first();
    this.activityTimestamp = page.getByText(/\d{1,2}:\d{2}:\d{2}\s*(AM|PM)/).first();
  }

  async verifyActivityLogEntries() {
    await expect(this.activityEntries).toBeVisible({ timeout: 10000 });
  }

  async verifyActivityLogEntriesVisible() {
    await this.verifyActivityLogEntries();
  }
}

module.exports = { ActivityPage };