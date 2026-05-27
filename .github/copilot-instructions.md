# Copilot Instructions — Playwright Test Generation

This project is a **Playwright test automation framework** for **Total Connect 2.0** (Resideo home security app at `https://qa2.totalconnect2.com/`).

When generating Playwright tests, you MUST follow these rules exactly.

---

## Available Page Objects

### LoginPage
**Import:** `require('../../../framework/pages/generated/smoke/LoginPage')`
- `constructor(page)`
- `login(username, password)` — fills username & password, clicks Sign In
- `dismissCookieConsent()` — dismisses cookie banner if visible

### TotalConnectHomePage
**Import:** `require('../../../framework/pages/generated/smoke/TotalConnectHomePage')`
- `constructor(page)`
- **Locators:** devicesNav, camerasNav, activityNav, armHomeButton, armAwayButton, disarmButton, partitionStatusText, selectAllCheckbox
- `dismissCookiePopup()` — dismiss cookie bar
- `closeDonePopup()` — dismiss "DONE" dialog
- `dismissErrorDialog()` — dismiss error/status dialogs with OK button
- `selectAllPartitions()` — click SELECT ALL checkbox (**REQUIRED before any arm/disarm action**)
- `armHome()` — arm the system in Home mode (clicks ARM HOME, handles confirmation)
- `armAway()` — arm the system in Away mode
- `disarm()` — disarm the system (clicks DISARM, handles confirmation)
- `waitForArmedHome()` — wait for "Armed Home" status to appear
- `waitForArmedAway()` — wait for "Armed Away" status to appear
- `waitForDisarmed()` — wait for "Disarmed" status to appear
- `verifyPartitionStatus(status)` — assert partition shows given status text (e.g., 'Armed Home', 'Disarmed')
- `ensureDisarmed()` — if system is armed, disarm it first (**MUST call as precondition before arming**)
- `navigateToDevices()` — click Devices nav, waits for /automation URL internally (~5-10s)
- `navigateToCameras()` — click Cameras nav, waits for /cameras URL internally (~10-20s, async load)
- `navigateToActivity()` — click Activity nav, waits for /events URL internally (~5-10s)

### DevicesPage
**Import:** `require('../../../framework/pages/generated/smoke/DevicesPage')`
- `constructor(page)`
- `verifyDeviceCategoriesVisible()` — asserts device categories are visible on the page

### CamerasPage
**Import:** `require('../../../framework/pages/generated/smoke/CamerasPage')`
- `constructor(page)`
- `verifyCamerasPageLoaded()` — asserts camera content is visible
- `verifyAllCamerasVisible()` — returns count of camera elements
- `verifyCameraNames()` — returns count of camera name labels

### ActivityPage
**Import:** `require('../../../framework/pages/generated/smoke/ActivityPage')`
- `constructor(page)`
- `verifyActivityLogEntries()` — asserts activity log entries are displayed

---

## Login Helper

**Import:** `require('../../../framework/utils/login-session')`

- `createLoginSession()` — launches browser, logs in, returns `{ browser, context, page, close }`
  - The returned `page` is already on `/home`, fully authenticated and ready
  - Login takes 15-30s internally (handled by the helper)
  - Use in `test.beforeAll` with `test.setTimeout(180000)`
  - Close browser in `test.afterAll`

---

## Behavioral Rules (MANDATORY)

### Timeouts
| Scenario | Timeout | Where |
|----------|---------|-------|
| Login/session setup | `test.setTimeout(180000)` | Inside `test.beforeAll` |
| Any test involving Cameras page | `test.setTimeout(90000)` | First line inside the `test()` function |

### Arm/Disarm Preconditions (MUST follow this exact sequence)
1. Call `homePage.ensureDisarmed()` — system may be armed from prior run
2. Call `homePage.selectAllPartitions()` — required to select which partitions to arm
3. Call `homePage.armHome()` or `homePage.armAway()`
4. Verify with `homePage.verifyPartitionStatus('Armed Home')`
5. Call `homePage.selectAllPartitions()` **AGAIN** — selection resets after arming
6. Call `homePage.disarm()`
7. Verify with `homePage.verifyPartitionStatus('Disarmed')`

### Anti-Patterns (NEVER do these)
- ❌ NEVER use `page.goto()` for app pages — use page object navigation methods
- ❌ NEVER use `page.waitForURL()` — navigation methods handle this internally
- ❌ NEVER use `expect(page).toHaveURL()` — navigation methods verify URLs internally
- ❌ NEVER invent page objects or methods not listed above
- ❌ NEVER write manual login code — always use `createLoginSession()`
- ❌ NEVER import from paths other than those listed above

---

## Test Structure Pattern (MUST follow exactly)

```javascript
const { test, expect } = require('@playwright/test');
const allure = require('allure-js-commons');
const { createLoginSession } = require('../../../framework/utils/login-session');
const { TotalConnectHomePage } = require('../../../framework/pages/generated/smoke/TotalConnectHomePage');
// ... other page object imports as needed

test.describe('@nl-authored <Suite Name>', () => {
  let page, browser, homePage;

  test.beforeAll(async () => {
    test.setTimeout(180000);
    const session = await createLoginSession();
    browser = session.browser;
    page = session.page;
    homePage = new TotalConnectHomePage(page);
    // ... instantiate other page objects as needed
  });

  test.afterAll(async () => {
    if (browser) await browser.close();
  });

  test('<Test Title>', async () => {
    // test.setTimeout(90000); ← ADD THIS if test involves Cameras page
    await allure.epic('...');
    await allure.feature('...');
    await allure.story('...');
    await allure.severity('critical');
    await allure.tag('nl-authored');

    await test.step('<Step description>', async () => {
      // page object method calls here
    });

    await test.step('<Next step>', async () => {
      // ...
    });
  });
});
```

---

## Output Location

Save generated test files to: `tests/generated/nl-authored/<descriptive-name>.spec.js`

## Running Tests

```bash
npx playwright test tests/generated/nl-authored/<file>.spec.js --headed
```
