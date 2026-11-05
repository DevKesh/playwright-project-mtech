# Copilot Instructions — Playwright Test Generation

This project is a **Playwright test automation framework** for **Total Connect 2.0** (Resideo home security app at `https://qa2.totalconnect2.com/`).

When generating Playwright tests, you MUST follow these rules exactly.

## Shared Maintenance Contract

- Use the single root Playwright config and native projects: `tc2`, `monitoring`,
  `alarmnet-login-security`, `alarmnet-mobile-security`,
  `alarmnet-forgot-login-security`, and `framework`. Add routine tests in the
  existing project folder with native tags; do not edit config or YAML for each test.
- Use plain JavaScript, native fixtures and `test.step`. Preserve existing dirty
  content, the eight smoke assertions, and safety checks. Do not weaken assertions,
  add retries, or add automatic healing reruns to make failures disappear.
- Default validation is offline `npm test`; synthetic browser contracts use
  `npm run test:framework:browser`. Respect narrower user validation limits.
  Live runs (including public probes), panel actions, paid AI, cloud execution,
  Slack posts, and deployment each require explicit approval before execution.
- Live fixtures require `RUN_LIVE_TESTS=true`; live npm scripts set it. Test
  collection and root config imports must not load credentials or providers.
  These instructions guide behavior; they are not a security sandbox.
- Store secrets only in ignored `.env.qa` or CI secrets. Keep `.env.example`
  blank. Never include credential values in config, specs, prompts, logs or reports.
- `getAccount(name)` resolves `ACCOUNT_<UPPER_NAME>_USERNAME` and
  `ACCOUNT_<UPPER_NAME>_PASSWORD`. Names match `^[a-z][a-z0-9_]*$`: a lowercase
  initial letter, then lowercase letters, digits or underscores. A partial or empty canonical pair fails.
  Transitional `LOGIN_MONITOR_*` for `approved_monitor` and `TC_*` for `configured`
  apply only when the entire corresponding canonical pair is absent; never mix pairs.
- CI executes once with retries zero and no healing rerun. Shared execution
  validates nonempty results before publication and only supplies a Slack report
  link after validated deployment. Failed and incomplete runs are not passes.
- AI remains explicit/local and optional. OpenAI and Azure routing are retained;
  live provider parity is unverified and RAG retrieval remains OpenAI-specific.

---

## Available Page Objects

### LoginPage
**Canonical module:** `framework/pages/tc2/LoginPage.js` (consume through fixtures)
- `constructor(page)`
- `login(username, password)` — fills username & password, clicks Sign In
- `dismissCookieConsent()` — dismisses cookie banner if visible

### TotalConnectHomePage
**Canonical module:** `framework/pages/tc2/TotalConnectHomePage.js` (consume through fixtures)
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
**Canonical module:** `framework/pages/tc2/DevicesPage.js` (consume through fixtures)
- `constructor(page)`
- `verifyDeviceCategoriesVisible()` — asserts device categories are visible on the page

### CamerasPage
**Canonical module:** `framework/pages/tc2/CamerasPage.js` (consume through fixtures)
- `constructor(page)`
- `verifyCamerasPageLoaded()` — asserts camera content is visible
- `verifyAllCamerasVisible()` — returns count of camera elements
- `verifyCameraNames()` — returns count of camera name labels

### ActivityPage
**Canonical module:** `framework/pages/tc2/ActivityPage.js` (consume through fixtures)
- `constructor(page)`
- `verifyActivityLogEntries()` — asserts activity log entries are displayed

---

## Fixtures

Authenticated business tests import `{ test, expect }` from
`require('../../../framework/fixtures/smoke.fixture')`.
Request only the named fixtures needed by each test:
`authenticatedPage`, `loginPage`, `homePage`, `devicesPage`, `camerasPage`, `activityPage`.
The import above is relative to `tests/tc2/nl-authored/`; from `tests/tc2/`, use
`../../framework/fixtures/smoke.fixture`. `smoke.fixture` owns named POMs and
intentionally layers on `tc.fixture`, which owns session lifecycle and cleanup.
Do not add an alias fixture or duplicate session ownership. The authenticated
fixture manually launches a fresh browser/context per test, honors passed config
settings, and starts on `/home`. Do not construct POMs or log in inside business specs.

The account option defaults to `approved_monitor`. Non-panel tests may select a
privately configured account with `test.use({ account: 'secondary' })`.
Every `@panel` test requires `approved_monitor`; do not relax this policy.
Old `framework/pages/generated/smoke/` modules are transitional thin re-exports,
not a second implementation or the destination for new POM work.

Public login/recovery tests must remain unauthenticated. Use `login-security.fixture`
for synthetic security scripts (native `page`, optional `loginPage`, pacing), or
the guarded `page` from `tc.fixture` for public monitoring. Adjust relative imports
to the spec folder. Never use raw `@playwright/test` in a new live test to bypass
the live guard. Public entry navigation and URL assertions are allowed when they
are the behavior under test. Never request authenticated fixtures, real credentials
or healing for public/security flows.

---

## Behavioral Rules (MANDATORY)

### Timeouts
| Scenario | Timeout | Where |
|----------|---------|-------|
| Login/session setup and teardown | `180000` | Owned by authenticated-session fixture, separate from test timeout |
| Any test involving Cameras page | `test.setTimeout(90000)` | First line inside the `test()` function |
| Arm/disarm test | `test.setTimeout(300000)` | First line inside the `test()` function |

### Arm/Disarm Preconditions (MUST follow this exact sequence)
1. Call `homePage.ensureDisarmed()` — system may be armed from prior run
2. Call `homePage.selectAllPartitions()` — required to select which partitions to arm
3. Call `homePage.armHome()` or `homePage.armAway()`
4. Verify with `homePage.verifyPartitionStatus('Armed Home')`
5. Call `homePage.selectAllPartitions()` **AGAIN** — selection resets after arming
6. Call `homePage.disarm()`
7. Verify with `homePage.verifyPartitionStatus('Disarmed')`

Put steps 3-4 inside `try` and steps 5-6 inside `finally` so a failed arm/status
check still attempts disarm. Use the matching 'Armed Away' status for armAway.
Keep smoke single-worker with full parallelism disabled. Fresh browser contexts
do not isolate the physical panel. Use default describe mode, not serial skip-on-failure.
Apply the native `@panel` tag to physical-action tests. Never heal/replay physical
commands generically; hard cancellation may prevent cleanup and requires an operator check.

### Anti-Patterns (NEVER do these)
- ❌ NEVER use `page.goto()` for app pages — use page object navigation methods
- ❌ NEVER use `page.waitForURL()` — navigation methods handle this internally
- ❌ NEVER use `expect(page).toHaveURL()` — navigation methods verify URLs internally
- ❌ NEVER invent page objects or methods not listed above
- ❌ NEVER write manual login/browser setup in authenticated business specs; use the smoke fixtures
- ❌ NEVER use shared mutable pages, beforeAll/afterAll sessions, or serial test dependencies
- ❌ NEVER bypass fixture ownership or invent a duplicate POM implementation

---

## Test Structure Pattern (MUST follow exactly)

```javascript
const { test, expect } = require('../../../framework/fixtures/smoke.fixture');
const allure = require('allure-js-commons');

test.describe('<Suite Name>', { tag: ['@nl-authored', '@regression'] }, () => {
  test('Verify device categories', { tag: '@devices' }, async ({ homePage, devicesPage }) => {
    await allure.epic('...');
    await allure.feature('...');
    await allure.story('...');
    await allure.severity('critical');
    await allure.tag('nl-authored');

    await test.step('Navigate to Devices', async () => {
      await homePage.navigateToDevices();
    });

    await test.step('Verify device categories', async () => {
      await devicesPage.verifyDeviceCategoriesVisible();
    });
  });
});
```

---

## Output Location

Save generated TC2 tests to `tests/tc2/nl-authored/<descriptive-name>.spec.js`.
Keep ordinary business tests under `tests/tc2/`, monitoring under `tests/monitoring/`,
and synthetic public security tests under `tests/security/`. Preserve existing tags.
Never silently overwrite a human-maintained spec. Ask before expanding the approved
eight-test smoke inventory; use `@regression` for new business coverage by default.

## Running Tests

Collection only (no live approval needed):

```powershell
npx playwright test --project tc2 --list
```

Only after explicit live approval, run a selected generated regression test:

```powershell
npm run test:regression -- tests/tc2/nl-authored/<file>.spec.js --headed
```
