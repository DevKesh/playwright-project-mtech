# Exploration Context — Total Connect 2.0

> This file is read by the AI exploration agent during `npm run demo:explore:login`.
> Edit this file in plain English to control what the agent explores and how it generates tests.
> No code changes needed — just update the sections below.

---

## Application Overview

- **Name:** Total Connect 2.0 Home Security System
- **Environment:** QA2 (https://qa2.totalconnect2.com/)
- **Type:** Single Page Application (AngularJS-based)
- **Purpose:** Home security monitoring and automation dashboard

---

## Authentication

- **Login URL:** https://qa2.totalconnect2.com/login
- **Credential fields:** Username (#UsernameInput), Password (#PasswordInput), Sign In (#LoginButton)
- **After login:** Redirects to /home (dashboard)
- **Cookie consent:** May appear as #truste-consent-button — dismiss it by clicking
- **Security Notifications popup:** Appears after first login — toggle the switch and click DONE button

---

## Main Pages & Navigation

After login, the sidebar has these navigation links:

1. **Dashboard/Home** (/home)
   - Shows security panel status
   - Shows "Today's Activities" feed
   - Location name visible at top

2. **Security Panel** (from sidebar: "Security")
   - Has 3 tabs: Security, Partitions, Sensors
   - Tabs are `md-tab-item` elements
   - Shows armed/disarmed status

3. **Devices** (from sidebar: "Devices")
   - URL: /automation
   - Lists IoT devices (thermostats, locks, switches)
   - Devices are in expandable cards
   - Each device type has different controls

4. **Cameras** (from sidebar: "Camras" — note: typo in actual app)
   - Shows camera feed panels
   - May have live/recorded toggle

5. **Activity Log** (from sidebar: "Activity Logs")
   - Historical event list
   - May be paginated
   - Shows timestamps and event descriptions

6. **Scenes** (from sidebar: "Scenes")
   - Automation workflows
   - List of scene cards with names and status

---

## Actual DOM Structure (from live app inspection)

### Sidebar Navigation
The sidebar uses `<button>` elements (NOT `<a>` links). Use these IDs:
- **Security/Home:** `#menu-HomeMenu` or `#submenu-HomeMenu` (text: "Security")
- **Devices:** `#menu-AutomationMenu` or `#submenu-AutomationMenu` (text: "Devices")
- **Cameras:** `#menu-CamerasMenu` or `#submenu-CamerasMenu` (text: "Cameras")
- **Activity:** `#menu-EventsListMenu` or `#submenu-EventsListMenu` (text: "Activity")
- **Scenes:** `#menu-SmartScenesGripMenu` or `#submenu-SmartScenesGripMenu` (text: "Scenes")

Best locator for sidebar navigation: `page.locator('#submenu-AutomationMenu')` or `page.getByRole('button', { name: 'Devices' }).last()`

### Security Panel / Arming
- **Partition status text:** "2 of 2 Partitions Disarmed" (shown in a `<p>` tag)
- **SELECT ALL** — Clickable text. Use `page.getByText('SELECT ALL')`. After clicking, text changes to "DESELECT ALL"
- After clicking SELECT ALL, two black buttons appear: **ARM AWAY** and **ARM HOME** (uppercase)

**CRITICAL LOCATOR RULE for arming buttons:**
These buttons have `aria-label` attributes that OVERRIDE their accessible name:
- `<button aria-label="Arms all sensors">ARM AWAY</button>`
- `<button aria-label="Arms perimeter sensors">ARM HOME</button>`
- `<button aria-label="Disarms all sensors">DISARM</button>`

Because of aria-label, `getByRole('button', { name: 'ARM HOME' })` will FAIL.
**MUST USE `page.getByText('ARM HOME')` or `page.locator('button', { hasText: 'ARM HOME' })`**

- **Disarm flow:** After arming, click SELECT ALL again → DISARM button appears
- **Partition names:** "P1 - Partition 1", "P2 - Partition-02"
- **Status text after arming:** "Armed Home", "Armed Away", "Disarmed" — appears in partition div

### Today's Activities (Home Page)
- Section heading: "Today's Activities"
- Activity entries contain timestamps like "11:04:39  PM  IST"
- Entry text format: "Vx3 top left - Motion was detected." or "DOORBELL - A Person was detected."
- "View all activities" button at the bottom

### Weather Widget
- Location shown: "Huslia, Texas"
- Temperature with °F/°C toggle buttons: `#Fahrenheitbutton`, `#Celsiusbutton`

---

## Special Behaviors to Handle

1. **Cookie consent banner** — Click #truste-consent-button if visible (wrap in try/catch)
2. **Security Notifications popup** — After login, a dialog may appear:
   - Contains `md-switch` toggle
   - Has a "DONE" button in `.md-dialog-container`
   - Must be dismissed before navigating
3. **Slow page loads** — The app is an SPA. After login, wait for URL to contain `/home` and for `#body-container-layout` to be visible
4. **Dynamic device list** — May have 0-10+ devices, don't assert exact counts
5. **Tab navigation** — Security panel tabs don't change the URL, just show/hide content

---

## Critical Test Workflows (Priority Order)

### 1. Login Flow (Critical)
- Navigate to login URL
- Dismiss cookie consent if visible
- Fill username and password from config
- Click sign in
- Verify redirect to /home
- Dismiss security notifications popup if visible

### 2. Security Panel Navigation (High)
- After login, click "Security" in sidebar
- Verify security tab is visible
- Click "Partitions" tab
- Click "Sensors" tab
- Verify tab switching works

### 3. Devices Page (High)
- After login, click "Devices" in sidebar
- Verify URL contains /automation
- Verify at least one device category is visible

### 4. Cameras Page (Medium)
- After login, click "Camras" in sidebar (note the typo!)
- Verify camera section loads

### 5. Activity Log (Medium)
- After login, click "Activity Logs" in sidebar
- Verify activity entries are displayed

### 6. Scenes Page (Medium)
- After login, click "Scenes" in sidebar
- Verify scenes list loads

### 7. Forgot Password (Low)
- From login page, click "Problems Signing In" link
- Verify navigation to forgot password form

### 8. Forgot Username (Low)
- From login page, click "Problems Signing In" link
- Navigate to forgot username option
- Verify form is displayed

---

## Locator Strategy Preferences

1. **Prefer IDs** when available: `#UsernameInput`, `#LoginButton`, `#truste-consent-button`
2. **Use text/role** for navigation: `page.locator('span.menuName', { hasText: 'Security' })`
3. **Use data attributes** if present: `[data-testid="..."]`
4. **Avoid fragile selectors**: No nth-child, no absolute paths, no dynamically generated classes
5. **For tabs**: Use `md-tab-item` with text filter

---

## Test Generation Rules

- Every test must start with login (use testDataConfig credentials)
- Every test must handle cookie consent (try/catch)
- After login, dismiss security notifications popup (try/catch, non-blocking)
- Use `test.step()` for each logical action group
- Use `expect(page).toHaveURL()` with timeout for navigation assertions
- Use `expect(locator).toBeVisible({ timeout: 10000 })` for element visibility
- Tag all test describes with `@smoke @tc @tc-plan`
- Number test cases: TC01, TC02, etc.
- Never use `waitForLoadState('networkidle')` — it times out on this app

---

## What NOT to Explore

- Admin settings pages (if any)
- Help/documentation links
- External links (links going outside totalconnect2.com)
- Mobile-responsive menu patterns (focus on desktop 1920x1080)
