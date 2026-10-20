# PLAYWRIGHT - Complete Guide for Senior Testers

**Subject:** QA & TESTING  
**Source:** The 10 supplied handwritten pages.

> Transcription note: This document preserves the supplied pages' content and order, including their claims, examples, tips, diagrams, and checklist. It does not add technical explanations or correct the source's technical claims. Handwritten code is retained as source fragments, including incomplete or inconsistent syntax; it is not expanded into complete programs. `[unclear in source]` marks handwriting that cannot be read confidently.

## Contents

1. [Page 1 - Architecture Deep Dive](#page-1---architecture-deep-dive)
2. [Page 2 - Installation & Config](#page-2---installation--config)
3. [Page 3 - Locators Mastery](#page-3---locators-mastery)
4. [Page 4 - Auto-Waiting & Assertions](#page-4---auto-waiting--assertions)
5. [Page 5 - Advanced POM & Fixtures](#page-5---advanced-pom--fixtures)
6. [Page 6 - API Testing with Playwright](#page-6---api-testing-with-playwright)
7. [Page 7 - Handling Complex Elements](#page-7---handling-complex-elements)
8. [Page 8 - Network, Mocking & Auth](#page-8---network-mocking--auth)
9. [Page 9 - Runner, Reporting & Debugging](#page-9---runner-reporting--debugging)
10. [Page 10 - CI/CD, Best Practices & Advanced](#page-10---cicd-best-practices--advanced)

---

## Page 1 - Architecture Deep Dive

### What is Playwright? (Microsoft)

- Open-source, cross-language automation framework developed by Microsoft, released 2020.
- Built for reliable end-to-end testing of web applications.
- Targets modern web apps: supports Chromium, Firefox, and WebKit browsers via a single API.
- Works with Node.js, Python, Java, and .NET - Windows, macOS, Linux.

### Browser Engines Supported

| Browser engine | Notes |
| --- | --- |
| Chromium | Chrome / Edge based, Blink engine. Fast, default browser for Playwright. |
| Firefox | Gecko engine, maintained by Mozilla. Full cross-platform support. |
| WebKit | Safari/WebKit engine, maintained by Apple. macOS / iOS support. |

### How Playwright Works - Architecture Overview

```text
Test Code
(Python / Node.js / Java / .NET)
    |
    v
Playwright Library / Client
(Your test script uses Playwright API)
    |
    +--> Playwright Server
    |    (Node.js server process, spawns & controls browsers)
    |
    v
WebSocket Connection
(Bi-directional RPC over WebSocket, JSON protocol)
    |
    v
Browser Process
+------------+---------+--------+
| Chromium   | Firefox | WebKit |
+------------+---------+--------+
    |
    v
Browser Context
(Isolated context: cookies, cache, storage are separate per context)
    |
    v
Page 1 (isolated) --> Page 2 (isolated) --> Page 3 (isolated)
```

Diagram annotations:

- **Playwright Server:** Node.js server process, spawns and controls browsers; connected to the client/test-code side and WebSocket connection.
- **Page 1:** Multiple pages run same context, isolated like separate tabs.
- **Page 2:** In context, isolated state, like separate.
- **Page 3:** `[unclear in source]`.

Additional architecture notes:

- No WebDriver needed. Playwright communicates directly via Chrome DevTools Protocol / WebKit protocol.
- Commands are executed via WebSocket; actions auto-wait for element to be ready.

### Advantages Over Selenium

- **Auto-wait:** Playwright automatically waits for elements to be visible/actionable - eliminates flaky sleeps.
- **True Isolation:** BrowserContext allows parallel isolated sessions, no cookie/state leakage.
- **Single API for all 3 browsers:** Consistent tests across Chromium, Firefox, WebKit.
- **Faster Execution:** Parallel tests, built-in Playwright Test runner, built-in retries.
- **Rich Capabilities:** Network interception and mocking, request/response stubbing, tracing, video recording, screenshots.
- **Modern Web Support:** Handles shadow DOM, iframes, web components, file downloads, multi-page/page events out of the box.

### Key Notes for Senior Testers

- Use the following to reuse an authenticated session:

  ```javascript
  browser.newContext({ storageState: "auth.json" })
  ```

- Enable tracing for debugging:

  ```javascript
  await context.tracing.start({ screenshots: true, snapshots: true });
  await context.tracing.stop({ path: "trace.zip" });
  ```

- Use robust locators. The following is preferred over CSS/XPath:

  ```javascript
  page.getByRole("button", { name: "Submit" })
  ```

- Runs headless by default. Set the following for debugging locally:

  ```javascript
  { headless: false }
  ```

- Supports parallelism out of the box; each test gets a fresh context.

**Pro Tip:** Use `expect` for auto-retry assertions!

**Key Takeaway:** Playwright offers more reliability, speed, and modern web support compared to Selenium. Ideal for senior testers handling large test suites.

**Page 1 of 10 - 01**

---

## Page 2 - Installation & Config

### Setup Commands

1. Initialize the Playwright project:

   ```bash
   npm init playwright@latest
   ```

   - Initializes Playwright project.
   - Prompts for TS/JS, test folder, GitHub Actions.

2. Install browsers:

   ```bash
   npx playwright install
   ```

   - Downloads browser binaries: Chromium, Firefox, WebKit.
   - Approximately 200-300 MB.

**Tip:** Add `--with-deps` to also install OS dependencies on Linux.

### playwright.config.ts - Line by Line Breakdown

| Source configuration line / setting | Explanation on the page |
| --- | --- |
| `export default defineConfig({` | Folder where tests live. Default is `"tests/"`. |
| `fullyParallel: true` | Run all tests in parallel across workers for speed. |
| `forbidOnly: !!process.env.CI` | Fails if `test.only()` is left in CI - prevents accidental skip. |
| `retries: process.env.CI ? 2 : 0` | Retry flaky tests 2x on CI only. |
| `workers: process.env.CI ? 1 : undefined` | Limit to 1 worker on CI for stability. |
| `reporter: [['html'], ['list']]` | HTML report + list to console. Can add json/junit. |
| `use` / `baseURL: 'http://localhost:3000'` | Base URL for `page.goto("/path")`. |
| `trace: 'on-first-retry'` | Records trace on first retry - great for debugging. |
| `screenshot: 'only-on-failure'` | Screenshots saved if test fails. |
| `video: 'retain-on-failure'` | Video saved if test fails. |

`projects: [` - define browser projects below.

```text
{ name: 'chromium', use: { ...devices["Desktop Chrome"] } },
{ name: 'firefox', use: { ...devices["Desktop Firefox"] } },
{ name: 'webkit', use: { ...devices["Desktop Safari"] } },
});
```

- **chromium / Desktop Chrome:** Chrome browser.
- **firefox / Desktop Firefox:** Firefox.
- **webkit / Desktop Safari:** Safari / WebKit.

### Recommended Folder Structure

```text
project-root/
  playwright.config.ts       <- config file
  tests/
    your test files
    example.spec.ts
  tests-examples/
    sample tests from init
  screenshots/videos/traces output
  playwright-report/
    HTML report output
```

### Senior Tester Tips

- Always commit `playwright.config.ts` to git.
- Use `.env` for `baseURL` in different environments: dev/stage/prod.
- Run:

  ```bash
  npx playwright test --ui
  ```

  Opens interactive UI mode.

- Run:

  ```bash
  npx playwright show-report
  ```

  Opens HTML report.

- For CI: add Playwright to the CI pipeline; use cache for browsers.

**Note:** `trace`, `screenshot`, and `video` help debug flaky tests!

**Page 2 of 10 - 02**

---

## Page 3 - Locators Mastery

**Playwright Locators - Detailed Notes & Examples - 03 Oct 2024**

### Priority Order for Locators - Best Practice First to Fallback

1. **getByRole - MOST RECOMMENDED**
   - Uses ARIA role + accessible name.
   - Most stable, accessible, semantic.
   - Always prefer this first.

2. **getByLabel / getByPlaceholder / getByText / getByAltText / getByTitle / getByTestId**
   - Text-based and attribute-based locators.
   - Good for labeling, visible text, placeholders, alt, title, or test-id.

3. **CSS Selector - `.class`, `#id`, `[data-*]`**
   - Fast but brittle.
   - Use if no accessible option.
   - Can break if UI changes.

4. **XPath - `//button[...]`**
   - Last resort.
   - Complex, brittle, avoid when possible.

### Locator Methods - Examples & Usage

#### getByRole(...)

```javascript
const submitBtn = page.getByRole("button", { name: 'Submit' });
```

- Finds a `<button>` with accessible name "Submit".
- Use for buttons, links, headings, `[unclear in source]`, etc.

#### getByText(...)

```text
await page.getByText("Login").click:;
```

- Finds element containing the text "Login".
- Case-sensitive by default.

#### getByLabel(...)

```javascript
await page.getByLabel("Email").fill("user@example.com");
```

- Finds input labeled "Email" via `<label>` association.
- Great for form inputs.

#### getByPlaceholder(...)

```text
await page.getByPlaceholder("Enter password").fill("...);
```

- Targets input by its placeholder text.

#### getByAltText(...)

```text
const logo = await page.getByAltText("Company Logo")
```

- Finds image by its alt attribute.

#### getByTitle(...)

```text
await page.getByTitle("User Settings").click:;
```

- Finds element by its title attribute.

#### getByTestId(...)

```text
geoit page.getByTestId("user-profile").isVisible:;
```

- Uses `data-testid` attribute; stable for testing.

### DOM Structure Example

```text
div class="login-form"
  [button role=button
   name="Submit"]
          |
          v
getByRole("button", { name: "Submit" })
```

### Advanced & Chaining Locators

#### locator.filter({ hasText: '...' })

```text
page.getByRole("listitem").filter({
  hasText: 'Active'
}).click:;
```

- Filters within results to one containing text "Active".

#### nth(n)

- 0-based index.

```text
page.getByRole("row").nth(2).click:;
```

- Selects the 3rd row, index 2.

#### first()

- Picks the first match.

```text
page.getByRole("link").first().click:;
```

#### last()

- Picks the last match.

```text
page.getByRole("link").last().click:;
```

#### Chaining locators

```text
page.getByRole("dialog").getByRole(
  "button", { name: "Close" }
).click:;
```

- Scope inside dialog, then find button named "Close".

### Best Practices

- Always prefer `getByRole` for accessibility and maintainability.
- Use `getByLabel` for form fields - mirrors how user sees the label.
- Use `getByTestId` only for elements without accessible name/label.
- Chain locators to narrow scope instead of writing long CSS selectors.
- Avoid CSS/XPath unless necessary - fragile to markup changes.

**TIP:** Use Playwright's VSCode extension or run `npx playwright codegen` to generate locators interactively!

**Page 3 of 10 - 03**

---

## Page 4 - Auto-Waiting & Assertions

### How auto-wait works

- Playwright automatically waits for element to be **actionable** before performing action.
- Actionability checks are built in:

  | Check | Description on the page |
  | --- | --- |
  | Visible | Element is visible: not `display:none`, `opacity:0`. |
  | Stable | Element is stable, not moving/changing position. |
  | Enabled | Element is enabled: not disabled, not `[unclear in source]`. |

### Auto-wait is applied to actions

| Action | Behavior |
| --- | --- |
| `click()` | Waits until clickable, then clicks. |
| `fill()` | Waits until input is editable, then types text. |
| `check()` / `uncheck()` | Waits until checkbox is enabled and visible. |
| `hover()`, `tap()`, `selectOption()` | All wait until actionable. |

### Assertions in Playwright

Use `expect(locator).to...` for assertions - auto-wait + retry until true or timeout.

```text
expect(locator).toBeVisible()          // element is visible
expect(locator).toBeEnabled()          // element is enabled / not disabled
expect(locator).toHaveText("text")     // exact text match
expect(locator).toHaveCount(n)         // number of elements matches n
expect(locator).toHaveURL(/regex/ or "url")  // page URL check
```

`toHaveCount(n)` is useful for lists/items.

### Soft Assertions

```javascript
expect.soft(locator).toBeVisible()
```

- Continues test even if assertion fails; runs remaining tests.
- Custom timeout:

  ```text
  await expect(locator).toBeVisible({ timeout: 5000 });
  ```

- Default is 5000 ms; can set in config too.

### Difference: Selenium Waits vs Playwright Auto-wait

| Selenium WebDriver | Playwright Auto-wait |
| --- | --- |
| No auto-wait. Must use explicit wait: `WebDriverWait` + `ExpectedConditions`. | Auto-waits before every action/assertion. |
| You write wait until element clickable/visible manually. | No manual wait needed for click/fill/visible. |
| Risk of flaky tests if wait missing. | Retries assertion until timeout, auto-stable. |
| Timeouts configured per wait. | More reliable, less flaky by design. |

**Playwright Auto-wait note:** Default is 5000 ms; can set in config too.

```text
[Action: click()]
        |
        v
[Check: Visible? -> Stable? -> Enabled?]
        |
        v
[Perform Action]
```

If check fails -> auto-retry until timeout -> then throw error.

**Key Takeaway:** Playwright = built-in auto-wait -> fewer sleeps, fewer flakes.

**Page 4 of 10 - 04**

---

## Page 5 - Advanced POM & Fixtures

### Why POM?

- POM = Page Object Model - separates test code from page interactions.
- Improves maintainability, reusability, readability across many tests.
- Single source of truth for locators/selectors - update only once when UI changes.
- Makes tests cleaner, easier to scale, easier for team collaboration.

### Advanced POM structure - class + constructor + method chaining

- Constructor stores the Playwright Page instance for reuse.
- Page methods execute actions and return `this` to allow chaining calls.

**Example (LoginPage.ts):**

```text
class LoginPage {
  constructor(page) {
    this.page = page;
    this.username = page.locator("username);
    this.password = page.locator(#password);
    this.loginBtn = page.locator("button >> text="Login");

  async login(username, password) {
    await this.username.fill(username);
    await this.password.fill(password);
    await this.loginBtn.click:;
    return new DashboardPage(this.page); // return for chaining
  }
```

**Usage:**

```text
await loginPage.login("user"/pass").openDashboard)
```

### Fixtures creation for POM - Dependency Injection

- Fixtures inject ready-to-use objects into tests: dependency injection.
- Removes need to re-instantiate pages in every test.
- Keeps tests clean, focused only on test logic.

**test.extend() with custom fixtures**

```text
import { test as base, expect } from @playwright/test;'
dashboardPage: async ({ page }, use) => {
  const dashboardPage = new DashboardPage(page);
  await use(dashboardPage);
});
export { expect };
```

### Reusable login fixture

- Create a fixture that logs the user in once and reuses authenticated state.
- Great for tests that require logged-in user across the suite.

```text
loggedInPage: async ({ loginPage }, use) => {
  await loginPage.login(process.env.TEST_USER, process.env.TEST_PASS);
  // now authenticated
},
});
}.
```

### Best Practices for Large Frameworks

- 1 Page class = 1 real page/screen - keep structure 1:1.
- Keep locators private; expose only actions via methods.
- Return next page from actions to enable fluent chaining.
- Store selectors using role/data-testid for stability.
- Separate POMs and fixtures into folders: `/pages`, `/fixtures`.
- Use environment variables for credentials - never hardcode.
- Write small, focused fixtures; compose them as needed.

**Page 5 of 10 - 05**

---

## Page 6 - API Testing with Playwright

### Why API testing in Playwright?

- Faster than UI: test backend directly, no browser render -> quick feedback.
- Isolate issues: is it API or UI bug?
- Reuse in CI/CD: lightweight, reliable, consistent.
- Support auth setup for UI tests -> login via API then UI actions.

### APIRequestContext

- Provided by Playwright to make HTTP requests without launching browser.
- Created via:

  ```javascript
  playwright.request.newContext()
  ```

Source example:

```text
const request = await playwright.request.newContext.({
  baseURL: "https://ap..example.com",
  extraHTTPHeaders: { "Authorization", :Bearer ${token}: }
});
```

### HTTP Methods - Examples

#### 1) GET - Fetch user data

```text
const getResp = await request.get("/users/123);"
console.log: Await getResp.status)): // 200
const user = await getResp.json)):
```

- Validates response body.

#### 2) POST - Create new user

```text
const postResp = await request.post("/users", {
  data: { name: "Alice", role: "tester" }

console.log: postResp.status)): // 201
```

- Payload as JSON.

#### 3) PUT - Update user

```text
const putResp = await request.put("/users/123); {
  data: { role: "senior-tester" }
})[unclear in source] update record
```

#### 4) DELETE - Remove user

```text
const delResp = await request.delete("/users/123);
expect(delResp.status)).toBe(204):
```

### Validating Status, Headers, Body & JSON

**Status:**

```text
expect(getResp.status))..toBe(200);
```

**Headers:**

```text
const ct = getResp.headers('content-type'):;
```

**Body:**

```text
expect.body).toHaveproperty ",id", 123):
```

**Schema validation (zod) example:**

```text
import { z ; from "zod";
const UserScama = z.objut {id: z [unclear in source](
name: z stiging(:);
UserScama.parle body): // throws if invalid
```

### Combining API + UI - Login via API then UI Test

```text
[API] POST /login -> 200 + JWT token
                  |
                  v
[Browser] newContext -> setExtraHTTPHeaders(
  (content-type) ((Authorization: Bearer token))
                  |
                  v
[UI] page.goto("dashboard") -> assert logged in
```

- Tip: login via API for speed, then continue.
- UI test without UI login flow.
- Saves time in tests!

### Tips for Senior Testers

- Reuse request context in fixtures for all tests.
- Store tokens in env / `auth state.json` for reuse across tests.
- Always assert `content-type` header for JSON APIs.
- Use `request.dispose()` in teardown to cleanup.
- Combine with `expect.soft()` for non-blocking assertions.

**Pro tip:** Use `test.step()` to group API + UI steps for better logs.

**Page 6 - Notes - API Testing with Playwright - 2024**  
**Page 6 of 10 - 06**

---

## Page 7 - Handling Complex Elements

**Page 7 of 10 - Playwright Advanced Topics**  
**Date shown:** 12 Oct

### 1. Frames - frameLocator & nested frames

```text
const frame = page.frameLocator("iframe[name="tads"]").frameLocator("iframe.content");
await frame.getByText("Submit").click();
```

**Senior Tip:**

- Use `frameLocator` for nested iframes - it auto-retries and pierces through nested frames.
- Avoid `page.frame()` unless you need static ref.
- `frameLocator` is resilient to DOM reloads.

### 2. Shadow DOM piercing

```javascript
await page.locator("custom-el >>> .shadow-button").click();
// >>> pierces closed shadow root
```

**Senior Tip:**

- The `>>>` combinator pierces Shadow DOM.
- Works only in Playwright.
- For deeply nested shadows, chain: `"parent >>> child >>> button"`.
- Test in DevTools first!

### 3. File Uploads - setInputFiles()

```text
await page.setInputFiles("input(type="file"]", "./data/report.pdf");
// for multiple: ["file1.png", "file2.png"]
```

**Senior Tip:**

- Ensure file path is relative to test run.
- Use `path.join /__dirname, "file"]` for cross-OS.
- Can also set buffer if dynamic.

### 4. Downloads - waitForEvent("download")

```javascript
const download = await page.waitForEvent("download");
await download.saveAs("./downloads/data.csv");
console.log(download.suggestedFilename());
```

**Senior Tip:** Always `waitForEvent` BEFORE the action that triggers download.

Example:

```text
await page.click(#export");
```

### 5. Alerts / Dialogs handling

```text
page.on("dialog", async dialog => {
  console.log(dialog.type(), dialog.message();
  await dialog.accept("ok text"); // or dialog.dismiss()
});
```

**Senior Tip:** Register dialog listener BEFORE action. Else it will auto-accept and you miss it.

### 6. Multiple Windows / Pages - context.waitForEvent("page")

```text
const newPage = await context.waitForEvent("page");
await newPage.waitForLoadState();
await newPage.getByRole("button", { name: "Confirm" ]).click();
```

**Senior Tip:**

- Open often via `target=_blank`.
- Use context for popup.
- New page is isolated; close it when done to avoid leaks.

**Senior Tip:** Hover before clicking hidden menus. Add `waitFor()` if menu animates.

### 7. Drag & Drop

```text
await page.locator(#item").dragTo(page.locator(#dropzone");
// or manual: hover, drag, drop with mouse
```

**Senior Tip:** If `dragTo` is flaky, use low-level mouse:

```text
hover -> mousedown -> moveTo -> mouseup
```

Additional source code:

```text
await page.[unclear in source].type("search query");
await page.[unclear in source].press("Enter"); , { delay: 50 ]);
```

**Senior Tip:** Use delay for realistic typing. Use `keyboard.down/up` for hold combos like Shift.

### 10. Mouse

```javascript
await page.mouse.click(120, 250);
await page.mouse.wheel(0, 300); // scroll down
```

**Senior Tip:** Use mouse for canvas/specific coords. Combine with `boundingBox()` for target coords.

**Key:** Always keep selectors resilient. Prefer role/text/label. Avoid brittle CSS.

**Page 7 of 10 - 07**

---

## Page 8 - Network, Mocking & Auth

**Topic:** Playwright - Network Interception, Mocking APIs, Auth Strategies & Events.

### 1. page.route() - Intercepting Requests

- Intercept network requests to mock, abort, or modify before they reach the server.

```text
await page.route("**/api/*", async (route) => {
  const req = route.request();
  // Mock API response for specific endpoint
  if (req.url().includes "/users"); {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ users: [[ id: 1,
                              name: "Mock User" }] })
    });
    return; // respond with mock, stop further
  }
  await route.continue(); // continue to real network
});
```

Flow diagram:

```text
Incoming Request
       |
       v
Matches pattern?
       |
       +-- Yes --> route.fulfill(mock data)
       |
       +-- No ---> route.continue()
```

**Flow:** Request -> Check -> Mock or Continue.

**Remember:** You must always call `fulfill()`, `continue()`, or `abort()`. Otherwise the request will hang!

### 2. Mocking API Responses

- Return fake JSON to test UI without backend dependency.

```text
await page.route("**/api/login", async (route) => {
  await route.fulfill({
    body: JSON.stringify({ token: "fake-jwt-123", user: "testUser" })
  });
```

**Pro Tip:** Use `JSON.stringify()` to generate dynamic mock responses for different cases.

### 3. Aborting Requests

- Stop unnecessary requests to speed up tests: ads, analytics, tracking.

```text
await page.route("**/analytics/*", route => route.abort();
```

- Common for blocking third-party services like analytics, ads, fonts.

Source header fragment:

```text
"Authorization": "Bearer TEST_TOKEN_123"
}; await route.continue({ headers });
});
```

- Lets you inject Authorization header without real login.

### 5. Authentication Strategies

- `storageState` -> Save login state and reuse across tests.

  ```text
  await context.storageState({ use: { storageState: "auth.json" }
  ```

- OAuth / SSO -> Global Setup for one-time login.
- Create `globalSetup.ts` to log in once and save storageState.

  ```text
  });
  ```

### 6. Network Events - Request/Response Listening

- Listen to network events to log/debug requests and responses.

```text
page.on("request", req => {
console.log("-> Request:", req.method(), req.url();
console.log("<- Response:", res.status(), res.url();
```

- Great for debugging failed API calls or monitoring traffic.

### Senior Pro Tips

- Always call `route.continue()` for unmatched routes or tests will timeout.
- Use precise glob patterns: `**/api/**` for APIs, `**/*.png` to skip images.
- Combine `storageState` with `route()` to mock only specific calls while logged in.
- Speed up CI pipelines approximately 80% by reusing `storageState` instead of logging in each test.
- For OAuth/SAML, run `globalSetup` once; keep `auth.json` in `.gitignore`.

**Summary:** `page.route()` = control & mock network | `storageState` = reuse auth | events = observe requests/responses.

**Page 08 - Playwright E2E Notes - Page 8/10 - 08**

---

## Page 9 - Runner, Reporting & Debugging

### Test runner features

- **fullyParallel:** Run tests in parallel across workers.
- **workers:** Controls number of parallel workers, `workers = 4`.
  - Set in `playwright.config.ts`:

    ```text
    workers: 4
    ```

- **retries:** Retry failed tests on CI.

  ```text
  retries: 2
  ```

  Retry on failure, 0 for local.

- **sharding:** Split tests across shards.

  ```text
  Shard 1/3 -> Shard 2/3 -> Shard 3/3
  ```

  ```bash
  npx playwright test --shard=1/3
  ```

- **grep:** Filter tests by name/regex.

  ```bash
  npx playwright test -g "login"
  ```

- **test.describe:** Group related tests together.

  ```text
  test.describe("Auth Flow", () => { ... })
  ```

- **beforeAll:** Runs once before all tests in group.
- **afterAll:** Runs once after all tests in group.
- Use for setup, cleanup: close DB, tear down.

### Reporting

#### HTML

- Built-in HTML report.

```bash
npx playwright show-report
```

#### JUnit

- For CI integrations: GitHub Actions / Jenkins.

```javascript
reporter: [['junit', { outputFile: "results.xml" }]]
```

#### Allure

- Allure reporting integration.
- Install: `@playwright/test` + `allure-playwright`.
- Generate:

  ```bash
  allure generate allure-results --clean
  ```

- View:

  ```bash
  allure serve allure-results
  ```

### Tracing

- `screenshot: "only-on-failure"` -> auto screenshot when test fails.
  - Screenshots on failure.
  - `.png`.
- Trace viewer -> record trace for debugging.

  ```text
  trace: "on" / "retain-on-failure"
  ```

- View trace:

  ```bash
  npx playwright show-trace trace.zip
  ```

- `video: "retain-on-failure"` -> records video of failing test.
  - Saved as `.webm` in `test-results/`.

### UI Mode

```bash
npx playwright test --ui
```

- Opens Playwright UI mode.
- Interactive UI to run tests, filter, watch mode.
- Inspect test steps, view logs, re-run individual test.

**Debug mode:**

```bash
npx playwright test --debug
```

- Opens Playwright Inspector for step-through debugging.
- `PWDEBUG=1` -> enable debug logging.

```bash
PWDEBUG=1 npx playwright test
```

### Tips

- Use `--headed` to see browser while debugging.
- Combine `PWDEBUG=1 --debug --ui` for full debug.
- Use retries + trace together for flaky tests.
- Keep traces for CI failures.

**Page 9 of 10 - 09**

**End of Page 9 -> Page 10: CI & Best Practices**

---

## Page 10 - CI/CD, Best Practices & Advanced

### CI/CD Integration - GitHub Actions

- Automate tests on every PR + merge to main.
- Workflow file: `.github/workflows/ci.yml`.

```text
name: CI - Playwright Tests
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps: actions/checkout@v4
    uses: actions/setup-node@v4
    with: version: 20
    run: npm ci [unclear in source] playwright install --with-deps
```

### Docker - Dockerfile for Playwright

- Containerize tests for consistent, reproducible environment.

```dockerfile
FROM mcr.microsoft.com/playwright:v1.42-jammy
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["npx", "playwright", "test"]
```

### Best Practices for Senior Testers

- No hard waits -> rely on auto-waiting; use `expect(locator).toBeVisible()`, `waitForResponse()`, etc.
- Use fixtures -> centralize setup in `fixtures/test.ts` for auth, DB seed, page context.
- Isolated tests -> each test is independent; use `test.describe()` and `test.use({ storageState: ... })`.
- Clean state via teardown fixtures; avoid relying on other tests.

### Visual Testing - toHaveScreenshot()

- Capture visual snapshots for key UI states to detect regressions.
- Example:

  ```javascript
  await expect(page).toHaveScreenshot("dashboard.png", { maxDiffPixelRatio: 0.02 });
  ```

- Keep screenshots consistent -> run in Docker to avoid OS/font rendering differences.

### Performance Testing

- Measure performance using custom metrics: page load time, Time to First Byte, CLS, LCP.
- Integrate Lighthouse via `@playwright/test` or web-vitals library; assert budgets.
- Tag performance tests with `@perf` and run separately in CI.

### FINAL CHECKLIST - Production Framework

- [x] All tests pass in CI on PR/push.
- [x] Visual baselines updated & committed to repo.
- [x] Flaky tests quarantined and flagged for fix.
- [x] Secrets stored in GitHub Actions secrets; no hardcoded secrets.
- [x] Tests run inside Docker for environment parity.
- [x] Accessibility: zero critical axe violations.
- [x] Performance budgets defined & monitored.
- [x] Artifacts uploaded: HTML report, trace.zip, test results.

### Summary

Build a reliable, fast, and maintainable test framework. Focus on stability through fixtures, isolation, and real assertions. Keep CI fast & green. Keep tests readable like documentation. Continuously monitor for flake, improve coverage, and review reports.

**Key mindset:** deterministic - observable - repeatable.

**End of Notes - Keep tests deterministic, observable, and maintainable.**

**Page 10 / 10**
