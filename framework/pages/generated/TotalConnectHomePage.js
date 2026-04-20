const { expect } = require('@playwright/test');

class TotalConnectHomePage {
  constructor(page) {
    this.page = page;

    // Sidebar navigation menu items (use span.menuName to avoid strict mode violations with submenus)
    this.securityNav = page.locator('span.menuName', { hasText: /^Security$/ });
    this.devicesNav = page.locator('span.menuName', { hasText: 'Devices' });
    this.camerasNav = page.locator('span.menuName', { hasText: 'Camera' });
    this.activityNav = page.locator('span.menuName', { hasText: 'Activities' });
    this.scenesNav = page.locator('span.menuName', { hasText: 'Scenes' });
    this.usersNav = page.locator('span.menuName', { hasText: 'Users' });
    this.myProfileNav = page.locator('span.menuName', { hasText: 'My Profile' });
    this.locationsNav = page.locator('span.menuName', { hasText: 'Locations' });
    this.notificationsNav = page.locator('span.menuName', { hasText: 'Notifications' });
    this.signOutNav = page.locator('span.menuName', { hasText: 'Sign Out' });

    // Security panel tabs (visible on Home/Security page)
    this.securityTab = page.locator('md-tab-item').filter({ hasText: 'Security' });
    this.partitionsTab = page.locator('md-tab-item').filter({ hasText: 'Partitions' });
    this.sensorsTab = page.locator('md-tab-item').filter({ hasText: 'Sensors' });

    // Home page content
    this.todaysActivities = page.getByText("Today's Activities");
    this.viewAllActivities = page.getByText('VIEW ALL ACTIVITIES');
    this.locationLabel = page.locator('.location-name, [class*="location"]').first();
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

  async navigateToUsers() {
    await this.usersNav.click();
  }

  async navigateToMyProfile() {
    await this.myProfileNav.click();
  }

  async navigateToLocations() {
    await this.locationsNav.click();
  }

  async clickSignOut() {
    await this.signOutNav.click();
  }

  async switchToPartitionsTab() {
    await this.partitionsTab.click();
  }

  async switchToSensorsTab() {
    await this.sensorsTab.click();
  }

  async clickViewAllActivities() {
    await this.viewAllActivities.click();
  }
}

module.exports = { TotalConnectHomePage };
