/**
 * ============================================================
 *  HOW TO WRITE A NEW TEST  (copy this file and rename it)
 * ============================================================
 *
 *  There are only 3 things you need to know:
 *
 *  1. Page Objects  – live in framework/pages/generated/
 *     Each one is a plain class that stores locators and has click/fill methods.
 *     Example:  TotalConnectHomePage has  this.devicesNav = page.locator(...)
 *
 *  2. Flow helper   – lives in framework/flows/totalconnect/TotalConnectFlow.js
 *     It wires page objects together so you can do one-liners like
 *     totalConnectFlow.loginWithConfiguredUser()  instead of repeating
 *     the open → consent → fill → submit steps in every test.
 *     You do NOT have to use flows. They are shortcuts, not requirements.
 *
 *  3. test-data.config.js – has the base URL, username, password.
 *     The flow reads it automatically. If you go direct, import it yourself.
 *
 *  Below are TWO versions of the same test so you can see both styles.
 *  Pick whichever you're comfortable with.
 */

// ─── Imports (same for every test) ──────────────────────────
const { test, expect } = require('@playwright/test');

// ─────────────────────────────────────────────────────────────
//  STYLE A — Direct Playwright (no flow, no page objects)
//  Easiest to understand. Good starting point.
// ─────────────────────────────────────────────────────────────
test('A - login and verify dashboard loads', async ({ page }) => {
  // 1. Go to the login page
  await page.goto('https://qa2.totalconnect2.com/');

  // 2. Accept cookie consent if it shows up
  const consentBtn = page.locator('#truste-consent-button');
  if (await consentBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await consentBtn.click();
  }

  // 3. Fill in credentials and sign in
  await page.locator('#UsernameInput').fill('tmsqa@1');
  await page.locator('#PasswordInput').fill('Password@3');
  await page.locator('#LoginButton').click();

  // 4. Assert we landed on the home dashboard
  await expect(page).toHaveURL(/.*\/home/, { timeout: 15000 });
  await expect(page.locator('#body-container-layout')).toBeVisible();
});

// ─────────────────────────────────────────────────────────────
//  STYLE B — Using the Flow helper (less repetition)
//  Same result, but login is a one-liner you can reuse.
// ─────────────────────────────────────────────────────────────
const { createTotalConnectFlow } = require('../../framework/flows/totalconnect/TotalConnectFlow');

test('B - login and navigate to Cameras page', async ({ page }) => {
  // Create the flow helper (gives you loginPage, homePage, etc.)
  const tc = createTotalConnectFlow({ page, expect });

  // 1. Login (one line instead of the 5 steps above)
  await tc.loginWithConfiguredUser();

  // 2. Click "Cameras" in the sidebar using the page object directly
  await tc.homePage.camerasNav.click();

  // 3. Assert the Cameras page loaded
  await expect(page).toHaveURL(/.*\/surveillance/, { timeout: 10000 });
  await expect(page.locator('#body-container-layout')).toBeVisible();
});

// ─────────────────────────────────────────────────────────────
//  STYLE C — Using page objects without the flow
//  You get organized locators but control every step yourself.
// ─────────────────────────────────────────────────────────────
const { TotalConnect2LoginPage } = require('../../framework/pages/generated/TotalConnect2LoginPage');
const { TotalConnectHomePage } = require('../../framework/pages/generated/TotalConnectHomePage');

test('C - login and check sidebar links exist', async ({ page }) => {
  const loginPage = new TotalConnect2LoginPage(page);
  const homePage = new TotalConnectHomePage(page);

  // 1. Open login page and fill form
  await loginPage.open('https://qa2.totalconnect2.com/');
  await loginPage.fillLoginForm('tmsqa@1', 'Password@3');
  await loginPage.clickSignIn();

  // 2. Wait for dashboard
  await expect(page).toHaveURL(/.*\/home/, { timeout: 15000 });

  // 3. Verify sidebar nav items are visible
  await expect(homePage.securityNav).toBeVisible();
  await expect(homePage.devicesNav).toBeVisible();
  await expect(homePage.camerasNav).toBeVisible();
  await expect(homePage.activityNav).toBeVisible();
  await expect(homePage.scenesNav).toBeVisible();
});
