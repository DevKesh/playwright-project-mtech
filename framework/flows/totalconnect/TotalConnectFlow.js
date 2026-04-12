const { testDataConfig } = require('../../config/test-data.config');
const { TotalConnect2LoginPage } = require('../../pages/generated/TotalConnect2LoginPage');
const { TotalConnectHomePage } = require('../../pages/generated/TotalConnectHomePage');
const { TotalConnectDevicesPage } = require('../../pages/generated/TotalConnectDevicesPage');
const { TotalConnectActivityPage } = require('../../pages/generated/TotalConnectActivityPage');
const { TotalConnectScenesPage } = require('../../pages/generated/TotalConnectScenesPage');

function createTotalConnectFlow({ page, expect }) {
  const loginPage = new TotalConnect2LoginPage(page);
  const homePage = new TotalConnectHomePage(page);
  const devicesPage = new TotalConnectDevicesPage(page);
  const activityPage = new TotalConnectActivityPage(page);
  const scenesPage = new TotalConnectScenesPage(page);

  const openLoginPage = async () => {
    await loginPage.open(testDataConfig.targetApp.baseUrl);
    await expect(loginPage.usernameInput).toBeVisible({ timeout: 15000 });
  };

  const acceptConsentIfVisible = async () => {
    try {
      await loginPage.acceptConsent();
    } catch {
      // Consent banner is optional in this environment.
    }
  };

  const fillConfiguredCredentials = async () => {
    await loginPage.fillLoginForm(
      testDataConfig.targetApp.credentials.email,
      testDataConfig.targetApp.credentials.password
    );
  };

  const submitLogin = async () => {
    await loginPage.clickSignIn();
    await expect(page).toHaveURL(/.*\/home/, { timeout: 15000 });
    await expect(page.locator('#body-container-layout')).toBeVisible({ timeout: 15000 });
  };

  const loginWithConfiguredUser = async () => {
    await openLoginPage();
    await acceptConsentIfVisible();
    await fillConfiguredCredentials();
    await submitLogin();
  };

  const navigateToSecurity = async () => {
    await homePage.navigateToSecurity();
    await expect(page.locator('md-tab-item').filter({ hasText: 'Security' })).toBeVisible({ timeout: 10000 });
  };

  const navigateToDevices = async () => {
    await homePage.navigateToDevices();
    await expect(page).toHaveURL(/.*\/automation/, { timeout: 10000 });
    await expect(page.locator('#body-container-layout')).toBeVisible({ timeout: 10000 });
  };

  const navigateToCameras = async () => {
    await homePage.navigateToCameras();
    await expect(page).toHaveURL(/.*\/cameras/, { timeout: 10000 });
    await expect(page.locator('#body-container-layout')).toBeVisible({ timeout: 10000 });
  };

  const navigateToActivity = async () => {
    await homePage.navigateToActivity();
    await expect(page).toHaveURL(/.*\/events/, { timeout: 10000 });
    await expect(page.locator('#body-container-layout')).toBeVisible({ timeout: 10000 });
  };

  const navigateToScenes = async () => {
    await homePage.navigateToScenes();
    await expect(page).toHaveURL(/.*\/smartscenes/, { timeout: 10000 });
    await expect(page.locator('#body-container-layout')).toBeVisible({ timeout: 10000 });
  };

  const navigateToMyProfile = async () => {
    await homePage.navigateToMyProfile();
    await expect(page.locator('#body-container-layout')).toBeVisible({ timeout: 10000 });
  };

  const navigateToLocations = async () => {
    await homePage.navigateToLocations();
    await expect(page.locator('#body-container-layout')).toBeVisible({ timeout: 10000 });
  };

  return {
    loginPage,
    homePage,
    devicesPage,
    activityPage,
    scenesPage,
    openLoginPage,
    acceptConsentIfVisible,
    fillConfiguredCredentials,
    submitLogin,
    loginWithConfiguredUser,
    navigateToSecurity,
    navigateToDevices,
    navigateToCameras,
    navigateToActivity,
    navigateToScenes,
    navigateToMyProfile,
    navigateToLocations,
  };
}

module.exports = { createTotalConnectFlow };