const { expect } = require('@playwright/test');

class TotalConnectDevicesPage {
  constructor(page) {
    this.page = page;

    // Device category sections
    this.switchesSection = page.getByText('Switches').first();
    this.locksSection = page.getByText('Locks').first();
    this.garageDoorsSection = page.getByText('Garage Doors').first();
    this.thermostatsSection = page.getByText('Thermostats').first();
  }

  async isSwitchesSectionVisible() {
    return this.switchesSection.isVisible();
  }

  async isLocksSectionVisible() {
    return this.locksSection.isVisible();
  }

  async isGarageDoorsSectionVisible() {
    return this.garageDoorsSection.isVisible();
  }

  async isThermostatsSectionVisible() {
    return this.thermostatsSection.isVisible();
  }
}

module.exports = { TotalConnectDevicesPage };
