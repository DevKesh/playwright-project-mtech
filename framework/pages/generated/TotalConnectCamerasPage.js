const { expect } = require('@playwright/test');

class TotalConnectCamerasPage {
  constructor(page) {
    this.page = page;

    // Camera page elements
    this.camerasHeading = page.getByText('Cameras').first();
    this.cameraFeed = page.locator('.camera-feed, [class*="camera"]').first();
    this.activityNotification = page.getByText('activities available').first();
  }
}

module.exports = { TotalConnectCamerasPage };
