const { expect } = require('@playwright/test');

class TotalConnectHomePage {
  constructor(page) {
    this.page = page;
    this.securityNav = page.getByRole('button', { name: 'Security' }).first();
    this.devicesNav = page.getByRole('button', { name: 'Devices' }).first();
    this.camerasNav = page.getByRole('button', { name: 'Cameras' }).first();
    this.activityNav = page.getByRole('button', { name: 'Activity' }).first();
    this.scenesNav = page.getByRole('button', { name: 'Scenes' }).first();
    this.profileNav = page.getByRole('button', { name: 'My Profile' }).first();
    this.locationsNav = page.getByRole('button', { name: 'Locations' }).first();
  }

  async navigateToSecurity() {
    await this.securityNav.click();
  }

  async navigateToDevices() {
    await this.devicesNav.click();
  }

  async navigateToCameras() {
    await this.camerasNav.click();
  }

  async navigateToActivity() {
    await this.activityNav.click();
  }

  async navigateToScenes() {
    await this.scenesNav.click();
  }

  async navigateToMyProfile() {
    await this.profileNav.click();
  }

  async navigateToLocations() {
    await this.locationsNav.click();
  }
}

module.exports = { TotalConnectHomePage };
