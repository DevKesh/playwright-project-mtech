# Total Connect 2.0 - Smoke Test Plan

**Application**: Total Connect 2.0 (Honeywell/Resideo Home Security & IoT Platform)
**Environment**: QA2 (`https://qa2.totalconnect2.com/`)
**Framework**: Playwright + Allure Reporting + Multi-Agentic AI Self-Healing
**Test Tag**: `@smoke @tc`
**Playwright Project**: `tc-smoke`
**Last Updated**: 2026-03-23

---

## 1. Objective

Validate the core functionality of the Total Connect 2.0 application through end-to-end smoke tests covering:

- User authentication and account recovery flows
- Post-login navigation across all major application sections
- Security panel operations (tab switching)
- Page load verification for each functional area

These tests serve as a baseline regression suite and also demonstrate the multi-agentic AI self-healing framework capabilities (autonomous test generation, AI-driven healing, audit trail).

---

## 2. Scope

### In Scope

| Area | Coverage |
|------|----------|
| Authentication | Login with valid credentials |
| Account Recovery | Forgot Password and Forgot Username navigation |
| Security | Home page load, security panel tabs (Security/Partitions/Sensors) |
| Devices | Navigation to Devices (Automation) page |
| Cameras | Navigation to Cameras (Surveillance) page |
| Activity | Navigation to Activity (Event Log) page |
| Scenes | Navigation to Scenes (Smart Automation) page |

### Out of Scope

- Negative test cases (invalid login, expired sessions)
- Device control operations (arming/disarming, lock/unlock, thermostat adjustment)
- Camera live feed streaming and playback
- Scene creation, editing, and deletion
- User management (invite, roles, permissions)
- Multi-location switching
- Notification settings and alert configuration
- Mobile responsive testing
- Performance and load testing

---

## 3. Test Environment

| Parameter | Value |
|-----------|-------|
| Application URL | `https://qa2.totalconnect2.com/` |
| Browser | Google Chrome (Desktop) |
| Playwright Project | `tc-smoke` |
| Test Data Source | `framework/config/test-data.config.js` |
| Reporter | Allure + HTML |
| Parallel Execution | Yes (8 workers) |
| Retries | 0 (local), 2 (CI) |
| Screenshots | On every test |
| Video | Retained on failure |
| Trace | Retained on failure |

---

## 4. Entry Criteria

- QA2 environment is accessible and stable
- Test credentials are valid and account is active
- Node.js and Playwright dependencies are installed (`npm install`)
- `.env` file configured with `OPENAI_API_KEY` (only needed for AI healing demo)

---

## 5. Exit Criteria

- All 9 smoke test cases pass
- Allure report generated with epic/feature/story traceability
- No critical or high severity defects remain open
- Audit trail populated (when AI healing is enabled)

---

## 6. Test Scenarios

### 6.1 Authentication

#### TC01 - User Login
| Field | Value |
|-------|-------|
| **ID** | TC01 |
| **Title** | User should be able to log into Total Connect 2.0 |
| **Priority** | Critical |
| **Tags** | `@smoke`, `@tc`, `login`, `authentication`, `positive` |
| **Spec File** | `tests/generated/login-flow.spec.js` |
| **Precondition** | Valid credentials configured in test-data.config.js |

**Steps:**

| # | Action | Expected Result |
|---|--------|----------------|
| 1 | Navigate to base URL | Login page loads, URL contains `totalconnect` |
| 2 | Dismiss cookie consent banner (if visible) | Banner dismissed |
| 3 | Enter username and password, click Sign In | Credentials submitted |
| 4 | Verify redirect | URL changes to `/home` within 15 seconds |

---

### 6.2 Account Recovery

#### TC02 - Password Recovery Navigation
| Field | Value |
|-------|-------|
| **ID** | TC02 |
| **Title** | Navigate to forgot password page and verify form |
| **Priority** | High |
| **Tags** | `@smoke`, `@tc`, `password`, `recovery`, `navigation`, `positive` |
| **Spec File** | `tests/generated/password-recovery-flow.spec.js` |
| **Precondition** | Login page is accessible |

**Steps:**

| # | Action | Expected Result |
|---|--------|----------------|
| 1 | Navigate to login page | Login page loads |
| 2 | Dismiss cookie consent banner (if visible) | Banner dismissed |
| 3 | Click "Problems Signing In?" link | Redirects to `/problemsigningin` |
| 4 | Click "Forgot Password" link | Redirects to `/forgotpassword` |
| 5 | Verify forgot password form | Username input field and NEXT button are visible |

---

#### TC03 - Username Recovery Navigation
| Field | Value |
|-------|-------|
| **ID** | TC03 |
| **Title** | Navigate to forgot username page and verify form |
| **Priority** | High |
| **Tags** | `@smoke`, `@tc`, `username`, `recovery`, `navigation`, `positive` |
| **Spec File** | `tests/generated/username-recovery-flow.spec.js` |
| **Precondition** | Login page is accessible |

**Steps:**

| # | Action | Expected Result |
|---|--------|----------------|
| 1 | Navigate to login page | Login page loads |
| 2 | Dismiss cookie consent banner (if visible) | Banner dismissed |
| 3 | Click "Problems Signing In?" link | Redirects to `/problemsigningin` |
| 4 | Click "Forgot Username" link | Redirects to `/forgotusername` |
| 5 | Verify forgot username form | Email/Phone input field and Submit button are visible |

---

### 6.3 Security

#### TC04 - Home Page Load with Security Panel
| Field | Value |
|-------|-------|
| **ID** | TC04 |
| **Title** | Verify home page loads with security panel and activity feed |
| **Priority** | Critical |
| **Tags** | `@smoke`, `@tc`, `security`, `home`, `positive` |
| **Spec File** | `tests/generated/security-panel-flow.spec.js` |
| **Precondition** | User is logged in and redirected to `/home` |

**Steps:**

| # | Action | Expected Result |
|---|--------|----------------|
| 1 | Verify Security navigation item | "Security" menu item is visible in sidebar |
| 2 | Verify activity feed | "Today's Activities" section is displayed |
| 3 | Verify sidebar navigation | Devices, Cameras, Activity, and Scenes menu items are all visible |

---

#### TC05 - Security Panel Tab Navigation
| Field | Value |
|-------|-------|
| **ID** | TC05 |
| **Title** | Navigate through Security, Partitions and Sensors tabs |
| **Priority** | High |
| **Tags** | `@smoke`, `@tc`, `security`, `partitions`, `sensors`, `positive` |
| **Spec File** | `tests/generated/security-panel-flow.spec.js` |
| **Precondition** | User is logged in and on the home/security page |

**Steps:**

| # | Action | Expected Result |
|---|--------|----------------|
| 1 | Click Partitions tab | Partitions panel content loads |
| 2 | Click Sensors tab | Sensors panel content loads |
| 3 | Click Security tab | Security panel content loads (return to default view) |

---

### 6.4 Devices (IoT)

#### TC06 - Devices Page Navigation
| Field | Value |
|-------|-------|
| **ID** | TC06 |
| **Title** | Navigate to Devices page and verify IoT device categories |
| **Priority** | High |
| **Tags** | `@smoke`, `@tc`, `devices`, `iot`, `navigation`, `positive` |
| **Spec File** | `tests/generated/devices-page-flow.spec.js` |
| **Precondition** | User is logged in |

**Steps:**

| # | Action | Expected Result |
|---|--------|----------------|
| 1 | Click "Devices" in sidebar navigation | URL changes to `/automation` |
| 2 | Verify page content loaded | Main content container (`#body-container-layout`) is visible |

**Note**: Device categories (Switches, Locks, Garage Doors, Thermostats) are present in the DOM but may be in collapsed state depending on the location's configured devices.

---

### 6.5 Cameras (Surveillance)

#### TC07 - Cameras Page Navigation
| Field | Value |
|-------|-------|
| **ID** | TC07 |
| **Title** | Navigate to Cameras page and verify camera feed section |
| **Priority** | High |
| **Tags** | `@smoke`, `@tc`, `cameras`, `surveillance`, `navigation`, `positive` |
| **Spec File** | `tests/generated/cameras-page-flow.spec.js` |
| **Precondition** | User is logged in |

**Steps:**

| # | Action | Expected Result |
|---|--------|----------------|
| 1 | Click "Cameras" in sidebar navigation | URL changes to `/cameras` |
| 2 | Verify page content loaded | Main content container (`#body-container-layout`) is visible |

---

### 6.6 Activity (Event Log)

#### TC08 - Activity Log Navigation
| Field | Value |
|-------|-------|
| **ID** | TC08 |
| **Title** | Navigate to Activity page and verify event log |
| **Priority** | High |
| **Tags** | `@smoke`, `@tc`, `activity`, `events`, `navigation`, `positive` |
| **Spec File** | `tests/generated/activity-log-flow.spec.js` |
| **Precondition** | User is logged in |

**Steps:**

| # | Action | Expected Result |
|---|--------|----------------|
| 1 | Click "Activity" in sidebar navigation | URL changes to `/events` |
| 2 | Verify page content loaded | Main content container (`#body-container-layout`) is visible |

---

### 6.7 Scenes (Automation)

#### TC09 - Scenes Page Navigation
| Field | Value |
|-------|-------|
| **ID** | TC09 |
| **Title** | Navigate to Scenes page and verify automation scenes |
| **Priority** | Medium |
| **Tags** | `@smoke`, `@tc`, `scenes`, `automation`, `navigation`, `positive` |
| **Spec File** | `tests/generated/scenes-page-flow.spec.js` |
| **Precondition** | User is logged in |

**Steps:**

| # | Action | Expected Result |
|---|--------|----------------|
| 1 | Click "Scenes" in sidebar navigation | URL changes to `/smartscenes` |
| 2 | Verify page content loaded | Main content container (`#body-container-layout`) is visible |

---

## 7. Test Execution Summary

### Execution Commands

| Command | Description | Uses AI/API? |
|---------|-------------|--------------|
| `npm run demo:smoke` | Run all smoke tests (headless) | No |
| `npm run demo:smoke:headed` | Run all smoke tests (browser visible) | No |
| `npm run demo:heal` | Run with AI self-healing enabled | Yes (per failure) |
| `npm run demo:report` | Generate and open Allure report | No |

### Allure Report Traceability

| Test | Epic | Feature | Story | Severity |
|------|------|---------|-------|----------|
| TC01 | Total Connect | Authentication | User Login | Critical |
| TC02 | Total Connect | Password Recovery | Forgot Password Navigation | High |
| TC03 | Total Connect | Account Recovery | Username Recovery Navigation | High |
| TC04 | Total Connect | Security | Home Page Load | Critical |
| TC05 | Total Connect | Security | Security Panel Tab Navigation | High |
| TC06 | Total Connect | Devices | Devices Page Navigation | High |
| TC07 | Total Connect | Cameras | Cameras Page Navigation | High |
| TC08 | Total Connect | Activity | Activity Log Navigation | High |
| TC09 | Total Connect | Scenes | Scenes Page Navigation | Medium |

---

## 8. Page Object Inventory

| Page Object | File | Key Locators |
|-------------|------|-------------|
| TotalConnect2LoginPage | `framework/pages/generated/TotalConnect2LoginPage.js` | `#UsernameInput`, `#PasswordInput`, `#LoginButton`, `#problemSigingInLink` |
| TotalConnectForgotPasswordPage | `framework/pages/generated/TotalConnectForgotPasswordPage.js` | `#UsernameInput`, NEXT button |
| TotalConnectForgotUsernamePage | `framework/pages/generated/TotalConnectForgotUsernamePage.js` | `#EmailPhoneInput`, Submit button |
| TotalConnectHomePage | `framework/pages/generated/TotalConnectHomePage.js` | `span.menuName` (sidebar nav), `md-tab-item` (Security/Partitions/Sensors tabs) |
| TotalConnectDevicesPage | `framework/pages/generated/TotalConnectDevicesPage.js` | Switches, Locks, Garage Doors, Thermostats sections |
| TotalConnectCamerasPage | `framework/pages/generated/TotalConnectCamerasPage.js` | Camera feed, activity notification |
| TotalConnectActivityPage | `framework/pages/generated/TotalConnectActivityPage.js` | Event list, date filter inputs |
| TotalConnectScenesPage | `framework/pages/generated/TotalConnectScenesPage.js` | Scenes table, Add button |

---

## 9. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| QA2 environment downtime | All tests fail | Check environment status before execution |
| Credential expiry / account lock | Login tests fail | Rotate credentials in `test-data.config.js` |
| Cookie consent banner changes | Consent dismiss fails | Wrapped in try/catch — non-blocking |
| Angular SPA slow transitions | Timeout on navigation | Generous timeouts (10-15s) on URL assertions |
| DOM structure changes (locator drift) | Element not found | AI self-healing auto-suggests new locators |
| Parallel session conflicts | Flaky logins | Each test gets its own browser context |

---

## 10. Future Test Expansion (Planned)

The following scenarios are identified for future regression expansion beyond the current smoke suite:

### Authentication (Negative)
- TC10 - Login with invalid username
- TC11 - Login with invalid password
- TC12 - Login with empty credentials
- TC13 - Account lockout after N failed attempts

### Security Panel (Functional)
- TC14 - Verify sensor status list under Sensors tab
- TC15 - Verify partition details under Partitions tab
- TC16 - Verify alert/trouble indicators on security panel

### Devices (Functional)
- TC17 - Expand and verify Switches device list
- TC18 - Expand and verify Locks device list
- TC19 - Expand and verify Thermostat details

### Cameras (Functional)
- TC20 - Verify camera thumbnail feed loads
- TC21 - Verify activity notification badge on cameras

### Activity (Functional)
- TC22 - Filter events by date range
- TC23 - Verify event entries contain timestamp and description

### Scenes (Functional)
- TC24 - Verify existing scenes listed in table with Name and Trigger columns
- TC25 - Verify Add Scene button functionality

### User Management
- TC26 - Navigate to My Profile page
- TC27 - Navigate to Current Location Users
- TC28 - Navigate to All Location Users

### Multi-Location
- TC29 - Switch between locations using location toggle
- TC30 - Verify location-specific data loads after switch
