const { expect } = require('@playwright/test');

class TotalConnectActivityPage {
  constructor(page) {
    this.page = page;

    // Activity page elements
    this.activityHeading = page.getByText('Activity').first();
    this.eventList = page.locator('.event-list, [class*="event"]').first();
    this.dateFromInput = page.locator('input[type="date"], input[placeholder*="From"]').first();
    this.dateToInput = page.locator('input[type="date"], input[placeholder*="To"]').last();
  }
}

module.exports = { TotalConnectActivityPage };
