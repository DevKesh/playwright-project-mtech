const { expect } = require('@playwright/test');

class TotalConnectScenesPage {
  constructor(page) {
    this.page = page;

    // Scenes page elements
    this.scenesHeading = page.getByText('Scenes').first();
    this.scenesTable = page.locator('table, [class*="scene"]').first();
    this.addSceneButton = page.getByText('Add').first();
  }
}

module.exports = { TotalConnectScenesPage };
