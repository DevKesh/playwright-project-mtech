const { test, expect } = require('@playwright/test');
const allure = require('allure-js-commons');
const { createLoginSession } = require('../../../framework/utils/login-session');
const { LoginPage } = require('../../../framework/pages/generated/smoke/LoginPage');

// Run using playwright.login-monitor.config.js to avoid smoke/Allure side effects.
// These worker-scoped options must be at file level. Do not record credential entry.
test.use({ trace: 'off', video: 'off' });

test.describe('@nl-authored @login-monitor Configured login and logout', () => {
  let session;

  const createConfiguredSession = () => {
    const username = process.env.LOGIN_MONITOR_USERNAME;
    const password = process.env.LOGIN_MONITOR_PASSWORD;
    if (!username || !password) {
      throw new Error('Set LOGIN_MONITOR_USERNAME and LOGIN_MONITOR_PASSWORD in the local environment before running this test.');
    }
    return createLoginSession({ username, password });
  };

  test.beforeAll(async () => {
    test.setTimeout(180000);
    // Monitor-only settings keep the corrected account separate from smoke credentials.
    // Playwright reruns this setup for each repeatEach execution with a fresh session.
    session = await createConfiguredSession();
  });

  test.afterAll(async () => {
    test.setTimeout(180000);
    if (session) await session.close();
  });

  test('@login-logout Successfully login and logout with configured credentials', async ({}, testInfo) => {
    test.setTimeout(180000);
    await allure.epic('Authentication');
    await allure.feature('Repeated login and logout');
    await allure.story('Configured credentials authenticate successfully on every cycle');
    await allure.severity('critical');
    await allure.tag('nl-authored');
    const iteration = testInfo.repeatEachIndex + 1;
    // A non-excluded parameter gives each repetition a distinct Allure history ID.
    await allure.parameter('iteration', String(iteration));
    await test.step(`Iteration ${iteration}: successful configured login, then Sign Out`, async () => {
      const { page } = session;
      const loginPage = new LoginPage(page);
      // Keep this monitor independent of smoke-suite panel/navigation changes.
      const devicesNav = page.getByRole('button', { name: 'Devices' }).first();

      try {
        // Keep known post-login popups handled for the whole test, not just at
        // one instant. Never register a generic OK/Confirm/Sync click handler.
        const syncNotice = page.getByRole('dialog').filter({
          hasText: 'Your security panel is out of sync',
        }).filter({ visible: true }).first();
        const done = page.getByRole('button', { name: 'DONE', exact: true })
          .filter({ visible: true }).first();
        const assertNoActionError = async () => {
          const rejected = page.getByText('Unable to perform the action', { exact: false })
            .filter({ visible: true });
          if (await rejected.count()) {
            throw new Error('Application reported an action failure; refusing to hide it by dismissing a popup.');
          }
        };
        await page.addLocatorHandler(syncNotice, async () => {
          await assertNoActionError();
          await page.keyboard.press('Escape');
          testInfo.annotations.push({
            type: 'environment-warning',
            description: `Iteration ${iteration}: dismissed panel out-of-sync notice with Escape; no sync requested.`,
          });
        });
        await page.addLocatorHandler(done, async button => {
          await assertNoActionError();
          // Another modal can cover DONE, and logout can detach it between the
          // visibility check and click. Handlers do not run recursively.
          if (await syncNotice.isVisible()) {
            await page.keyboard.press('Escape');
            await syncNotice.waitFor({ state: 'hidden', timeout: 5000 });
          }
          if (await button.isVisible()) {
            try {
              await button.click({ timeout: 5000 });
            } catch (error) {
              // A disappearing popup needs no click; a still-blocking one is a failure.
              if (await button.isVisible()) throw error;
            }
          }
        });
        // Also protect authenticated actions from late consent, without changing
        // the shared login helper's proven setup sequence.
        await loginPage.dismissCookieConsent();
        await test.step('Verify authenticated home page', async () => {
          await expect(devicesNav).toBeVisible({ timeout: 45000 });
          await expect.poll(() => new URL(page.url()).pathname.replace(/\/$/, ''), {
            message: 'Successful login must reach the authenticated home page',
            timeout: 45000,
          }).toBe('/home');
          await expect(loginPage.passwordInput).toBeHidden();
        });

        await test.step('Sign out through the application and verify the login form', async () => {
          await loginPage.dismissCookieConsent();
          // Preserve the proven panel-check settling sequence before scrolling.
          // waitFor observes without invoking handlers; the assertion dismisses it.
          await syncNotice.waitFor({ state: 'visible', timeout: 10000 })
            .catch(() => {});
          // These assertions invoke the handlers and verify dismissal. The handlers
          // remain registered if either popup appears later, even during Sign Out.
          await expect(done).toBeHidden();
          await expect(syncNotice).toBeHidden();
          // Scroll to the bottom on EVERY cycle; target the actual sidebar control
          // rather than an off-screen duplicate of the Sign Out text.
          const signOut = page.locator('#menu-SignOutMenu');
          await expect(async () => {
            // Dismissing a late modal can reset scrolling. Retry only positioning,
            // never the logout command, after the handlers have cleared overlays.
            await page.locator('body').press('Control+End');
            await signOut.scrollIntoViewIfNeeded();
            await expect(signOut).toBeVisible({ timeout: 2000 });
            await expect(signOut).toBeInViewport({ timeout: 2000 });
          }).toPass({ timeout: 15000 });
          await signOut.click();
          await expect(loginPage.usernameInput).toBeVisible({ timeout: 45000 });
          await expect(loginPage.passwordInput).toBeVisible();
          await expect(loginPage.passwordInput).toHaveValue('');
          await expect(loginPage.signInButton).toBeVisible();
          await expect(loginPage.signInButton).toBeDisabled();
          // QA2 serves the signed-out login form at '/' as well as '/login'.
          await expect.poll(() => new URL(page.url()).pathname, {
            message: 'Sign Out must return to the login page',
          }).toMatch(/^\/(?:login\/?)?$/);
          await expect(devicesNav).toBeHidden();
        });

        console.log(`[login-monitor] ${new Date().toISOString()} Login/logout iteration ${iteration} PASS (configured credentials)`);
      } catch (error) {
        // Helper-created pages are not covered by fixture screenshot settings.
        // Mask credential fields and never attach config values or passwords.
        try {
          await testInfo.attach(`login-logout-iteration-${iteration}-failure`, {
            body: await page.screenshot({ mask: [loginPage.usernameInput, loginPage.passwordInput] }),
            contentType: 'image/png',
          });
        } catch { /* Preserve the original assertion failure if the page closed. */ }
        throw error;
      } finally {
        await session.close();
        session = undefined;
      }
    });
  });
});

// Password recovery deliberately uses an unauthenticated fixture, not a login session.
test.describe('@nl-authored @login-monitor Forgot Password flow', () => {
  test('@forgot-password Open recovery form and return to login without requesting a reset', async ({ page }, testInfo) => {
    test.setTimeout(90000);
    await allure.epic('Authentication');
    await allure.feature('Forgot Password');
    await allure.story('Recovery form is accessible from the login page');
    await allure.severity('critical');
    await allure.tag('nl-authored');
    const iteration = testInfo.repeatEachIndex + 1;
    await allure.parameter('iteration', String(iteration));
    const diagnostics = [];
    page.on('pageerror', error => diagnostics.push({ type: 'pageerror', message: error.message }));
    page.on('console', message => {
      if (message.type() === 'error') {
        diagnostics.push({ type: 'console', message: message.text() });
      }
    });

    const loginPage = new LoginPage(page);
    const problemsLink = page.getByRole('link', { name: 'Problems signing in?', exact: true });
    // Register before navigation so late CDN consent dialogs cannot block any
    // recovery step, including Return To Sign In, in this fresh browser context.
    await loginPage.dismissCookieConsent();

    const verifyLogin = async () => {
      await expect(loginPage.usernameInput).toBeVisible();
      await expect(loginPage.usernameInput).toBeEditable();
      await expect(loginPage.usernameInput).toHaveValue('');
      await expect(loginPage.passwordInput).toBeVisible();
      await expect(loginPage.passwordInput).toBeEditable();
      await expect(loginPage.passwordInput).toHaveValue('');
      await expect(loginPage.signInButton).toBeVisible();
      await expect(loginPage.signInButton).toBeDisabled();
      await expect(problemsLink).toBeVisible();
      expect(new URL(page.url()).pathname.replace(/\/$/, '')).toBe('/login');
    };

    try {
      await test.step(`Forgot Password iteration ${iteration}`, async () => {
        await test.step('Open a fresh, unauthenticated login page', async () => {
          // Reload the public entry each cycle; subsequent navigation uses UI links.
          const response = await page.goto('/login', { waitUntil: 'domcontentloaded' });
          expect(response, 'Login document response').not.toBeNull();
          expect(response.ok(), 'Login document must return a successful HTTP status').toBeTruthy();
          await expect(loginPage.usernameInput).toBeVisible();
          await loginPage.dismissCookieConsent();
          await verifyLogin();
        });

        await test.step('Open sign-in assistance and follow Forgot Password', async () => {
          await problemsLink.click();
          await expect(page.getByRole('heading', { name: 'Problems signing in?', exact: true })).toBeVisible();
          await page.getByRole('link', { name: 'Forgot your password', exact: true }).click();
        });

        await test.step('Verify the password recovery form without requesting a reset', async () => {
          await expect(page.getByRole('heading', { name: 'Forgot your password', exact: true })).toBeVisible();
          await expect(page.getByText('Please enter the username associated with your account', { exact: true })).toBeVisible();
          const username = page.getByRole('textbox', { name: /Username/ });
          await expect(username).toBeVisible();
          await expect(username).toBeEditable();
          await expect(username).toHaveValue('');
          const next = page.getByRole('button', { name: 'NEXT', exact: true });
          await expect(next).toBeVisible();
          await expect(next).toBeDisabled();
          expect(new URL(page.url()).pathname.replace(/\/$/, '')).toBe('/forgotpassword');
        });

        await test.step('Return to sign in and verify the login form again', async () => {
          await page.getByRole('link', { name: 'Return To Sign In', exact: true }).click();
          await verifyLogin();
        });

        console.log(`[login-monitor] ${new Date().toISOString()} Forgot Password iteration ${iteration} PASS (no reset requested)`);
      });
    } finally {
      await testInfo.attach('browser-diagnostics', {
        body: Buffer.from(JSON.stringify(diagnostics, null, 2)),
        contentType: 'application/json',
      });
      console.log(`[login-monitor] ${new Date().toISOString()} recoveryIteration=${iteration} diagnostics=${diagnostics.length}`);
    }
  });
});