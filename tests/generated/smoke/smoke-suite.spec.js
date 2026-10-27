const { test, expect } = require('../../../framework/fixtures/smoke.fixture');

test.describe('@smoke @tc @tc-plan TC Smoke Suite', () => {
  // Tests continue executing even if one fails — gives full report with all 8 results
  test.describe.configure({ mode: 'default' });

  test('TC-001: Verify home page is loaded after login', async ({ authenticatedPage: page, homePage, loginPage }) => {
    await test.step('Verify authenticated home content', async () => {
      await expect.poll(() => new URL(page.url()).pathname).toBe('/home');
      await expect(homePage.devicesNav).toBeVisible();
      await expect(homePage.camerasNav).toBeVisible();
      // Authentication readiness is not the same as panel availability (TC-002).
      await expect(homePage.securityNav).toBeVisible();
      await expect(loginPage.passwordInput).toBeHidden();
    });
  });

  test('TC-002: Arm Home and Disarm partitions', async ({ homePage }) => {
    test.setTimeout(300000); // Precondition, arm, and disarm each await panel confirmation.
    await test.step('Navigate back to home page', async () => {
      await homePage.navigateToHome();
    });

    await test.step('Ensure all partitions are disarmed before test', async () => {
      await homePage.ensureDisarmed();
    });

    await test.step('Select all partitions', async () => {
      await homePage.selectAllPartitions();
    });

    // Always attempt cleanup after sending an arm command, even when its status
    // assertion fails. Cleanup errors remain failures; no commands are retried.
    try {
      await test.step('Arm Home', async () => {
        await homePage.armHome();
      });

      await test.step('Verify partition shows Armed Home', async () => {
        await homePage.verifyPartitionStatus('Armed Home');
      });
    } finally {
      await test.step('Select all partitions again', async () => {
        await homePage.selectAllPartitions();
      });

      await test.step('Disarm', async () => {
        await homePage.disarm();
      });
    }

    await test.step('Verify partition shows Disarmed', async () => {
      await homePage.verifyPartitionStatus('Disarmed');
    });
  });

  test('TC-003: Navigate to Devices page', async ({ homePage, devicesPage }) => {
    await test.step('Navigate back to home page', async () => {
      await homePage.navigateToHome();
    });

    await test.step('Navigate to Devices page', async () => {
      await homePage.navigateToDevices();
    });

    await test.step('Verify device categories are visible', async () => {
      await devicesPage.verifyDeviceCategoriesVisible();
    });
  });

  test('TC-004: Navigate to Cameras page', async ({ homePage, camerasPage }) => {
    test.setTimeout(90000); // Cameras load async — first visit takes longer
    await test.step('Navigate back to home page', async () => {
      await homePage.navigateToHome();
    });

    await test.step('Navigate to Cameras page', async () => {
      await homePage.navigateToCameras();
    });

    await test.step('Verify camera content is visible on the page', async () => {
      await camerasPage.verifyCamerasPageLoaded();
    });
  });

  test('TC-005: Navigate to Activity page and verify log', async ({ homePage, activityPage }) => {
    await test.step('Navigate back to home page', async () => {
      await homePage.navigateToHome();
    });

    await test.step('Navigate to Activity page', async () => {
      await homePage.navigateToActivity();
    });

    await test.step('Verify activity log entries are displayed', async () => {
      await activityPage.verifyActivityLogEntries();
    });
  });

  test('TC-006: Verify all cameras are visible on Cameras page', async ({ homePage, camerasPage }) => {
    test.setTimeout(90000);
    await test.step('Navigate back to home page', async () => {
      await homePage.navigateToHome();
    });

    await test.step('Navigate to Cameras page', async () => {
      await homePage.navigateToCameras();
    });

    await test.step('Verify all cameras are visible and present', async () => {
      const count = await camerasPage.verifyAllCamerasVisible();
      console.log(`[TC-006] Found ${count} camera elements on the page`);
    });
  });

  test('TC-007: Verify camera names are displayed on Cameras page', async ({ homePage, camerasPage }) => {
    test.setTimeout(90000);
    await test.step('Navigate to Cameras page', async () => {
      await homePage.navigateToCameras();
    });

    await test.step('Verify each camera has a visible name', async () => {
      const count = await camerasPage.verifyCameraNames();
      console.log(`[TC-007] Found ${count} camera name labels on the page`);
    });
  });

  test('TC-008: Verify camera feed sections load on Cameras page', async ({ homePage, camerasPage }) => {
    test.setTimeout(90000);
    await test.step('Navigate to Cameras page', async () => {
      await homePage.navigateToCameras();
    });

    await test.step('Verify camera feeds are loaded and visible', async () => {
      const count = await camerasPage.verifyCameraFeedsLoaded();
      console.log(`[TC-008] Found ${count} camera feed elements on the page`);
    });
  });
});
