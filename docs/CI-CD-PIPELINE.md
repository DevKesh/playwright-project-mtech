# CI/CD Pipeline — Setup & Configuration Guide

> **One config file, two modes.** Flip settings in `.env` for local development, or let GitHub Actions auto-configure for CI/CD.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         LOCAL (Your IDE)                             │
│                                                                     │
│   .env  ──►  runtime.config.js  ──►  Tests run HEADED              │
│              (single source)         Reports auto-OPEN              │
│                                      Slack DISABLED                 │
│                                      Credentials from .env          │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     CI/CD (GitHub Actions)                           │
│                                                                     │
│   Secrets ──►  runtime.config.js  ──►  Tests run HEADLESS           │
│   (no .env)   (auto-detects CI)       Reports NOT opened            │
│                                       Slack ENABLED                 │
│                                       Credentials from Secrets      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Quick Start (5 minutes)

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd playwright-project-mtech
npm ci
npx playwright install --with-deps chrome
```

### 2. Configure Local Environment

```bash
# Copy the example config
cp .env.example .env
```

Edit `.env` with your preferences:

```properties
# See the browser during test runs
HEADLESS=false

# Auto-open Allure report after each run
OPEN_REPORT=true

# Don't send Slack messages when running locally
SLACK_ENABLED=false

# Your API key (only needed if AI healing is ON)
OPENAI_API_KEY=sk-proj-...
```

### 3. Run Tests Locally

```bash
# Run the smoke suite
npx playwright test --project tc-smoke

# Or use the npm script
npm run test:smoke
```

That's it. The `.env` file controls everything locally.

---

## GitHub Actions Setup

### Required Secrets

Go to **your repo → Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret Name | Purpose | Example |
|-------------|---------|---------|
| `TC_USERNAME` | App login email | `tmsqa@1` |
| `TC_PASSWORD` | App login password | `Password@3` |
| `OPENAI_API_KEY` | GPT API key for AI self-healing | `sk-proj-...` |
| `SLACK_WEBHOOK_URL` | Incoming webhook for notifications | `https://hooks.slack.com/services/T.../B.../xxx` |

> **Why secrets?** These values are encrypted at rest, masked in logs, and never exposed in code. This is standard practice for all production pipelines.

### How to Create a Slack Webhook (Step-by-Step)

#### Prerequisites
- You need a Slack workspace where you have permission to install apps (ask your workspace admin if unsure)
- A channel where you want notifications to land (e.g., `#qa-automation`, `#test-results`)

#### Step 1: Create a Slack App

1. Open your browser and go to: **https://api.slack.com/apps**
2. Sign in with your Slack workspace credentials if prompted
3. Click the green **"Create New App"** button (top-right)
4. Select **"From scratch"** (not from manifest)
5. Fill in:
   - **App Name:** `QA Pipeline Bot` (or any name you prefer)
   - **Pick a workspace:** Select your company/team Slack workspace from the dropdown
6. Click **"Create App"**

You'll land on the **"Basic Information"** page of your new app.

#### Step 2: Enable Incoming Webhooks

1. In the left sidebar, click **"Incoming Webhooks"**
2. You'll see a toggle at the top that says "Activate Incoming Webhooks" — flip it to **ON**
3. Scroll down — you'll see a section called **"Webhook URLs for Your Workspace"**
4. Click **"Add New Webhook to Workspace"**
5. Slack will ask you to **pick a channel** — choose where you want test notifications posted (e.g., `#qa-automation`)
6. Click **"Allow"**

#### Step 3: Copy the Webhook URL

After allowing, you'll be redirected back to the Incoming Webhooks page. You'll now see a URL like:

```
https://hooks.slack.com/services/T024FQXXX/B06XXXXXXX/aB1cD2eF3gH4iJ5kL6mN7oP
```

Click **"Copy"** next to the URL.

#### Step 4: Test the Webhook (Optional but Recommended)

Open a terminal and run this to verify it works:

```powershell
# Replace the URL below with YOUR webhook URL
$body = '{"text": "✅ Webhook is working! Pipeline notifications will appear here."}' 
Invoke-RestMethod -Uri "https://hooks.slack.com/services/YOUR/WEBHOOK/URL" -Method Post -Body $body -ContentType "application/json"
```

You should see the message appear in your Slack channel immediately.

#### Step 5: Add as GitHub Secret

1. Go to your GitHub repository in a browser
2. Click **Settings** (tab at the top of the repo)
3. In the left sidebar: **Secrets and variables** → **Actions**
4. Click **"New repository secret"**
5. Fill in:
   - **Name:** `SLACK_WEBHOOK_URL`
   - **Secret:** Paste the webhook URL you copied in Step 3
6. Click **"Add secret"**

#### Step 6: Local Testing (Optional)

To test Slack notifications from your local machine without CI:

1. Add the webhook URL to your `.env` file:
   ```properties
   SLACK_ENABLED=true
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
   ```
2. Run the notifier after a test execution:
   ```powershell
   node framework/utils/slack-notify.js
   ```
3. Check your Slack channel for the notification
4. **Remember to set `SLACK_ENABLED=false` again** when done testing (to avoid noise during development)

#### Troubleshooting Slack Webhooks

| Issue | Cause | Fix |
|-------|-------|-----|
| `invalid_payload` error | Malformed JSON in the message | Check slack-notify.js isn't corrupted |
| `channel_not_found` | Channel was deleted/archived | Create a new webhook for an active channel |
| `403 Forbidden` | Webhook was revoked | Go to api.slack.com/apps, regenerate the webhook |
| No message appears | `SLACK_ENABLED=false` in .env | Set to `true` or remove the line |
| Works locally but not in CI | Secret not set in GitHub | Verify secret name is exactly `SLACK_WEBHOOK_URL` |

---

## Pipeline Workflows

### Workflow 1: `playwright.yml` — Full Pipeline (Manual Trigger)

**Trigger:** Manual dispatch or push to main  
**Stages:**

```
┌──────────────┐     ┌──────────────────┐     ┌───────────────────┐
│  Stage 1     │     │  Stage 2         │     │  Stage 3          │
│  Run Tests   │────►│  AI Self-Healing │────►│  Report + Notify  │
│  (30 min)    │     │  (on failure)    │     │  (Allure + Slack) │
└──────────────┘     └──────────────────┘     └───────────────────┘
```

**Manual trigger options:**
- `test_suite`: Choose which suite — `generated`, `smoke`, `total-connect`, `all`
- `enable_healing`: Enable/disable AI self-healing retry

### Workflow 2: `smoke-daily.yml` — Daily Smoke (Scheduled + Demo Mode)

**Trigger:** Weekdays at 2:00 AM UTC (automatic) or manual dispatch  
**Stages:**

```
┌──────────────┐     ┌──────────────────┐     ┌───────────────────┐
│  Smoke Tests │────►│  AI Healing      │────►│  Report + Slack   │
│              │     │  (only if failed) │     │  + GitHub Pages   │
└──────────────┘     └──────────────────┘     └───────────────────┘
```

**Manual trigger options for LIVE DEMO:**
- `runner`: `ubuntu-latest` (cloud) or `self-hosted` (your machine — shows browser)
- `headed`: `true` for visible browser during presentation

---

## Configuration Reference

### `.env` — Your Local Control Panel

| Variable | Default (Local) | CI Behavior | What it Does |
|----------|----------------|-------------|--------------|
| `HEADLESS` | `false` | `true` (auto) | Show/hide browser window |
| `BROWSER_CHANNEL` | `chrome` | `chrome` | Which browser to use |
| `SLOW_MO` | `0` | `0` | Delay between actions (ms) |
| `OPEN_REPORT` | `true` | `false` (auto) | Auto-open Allure after run |
| `SLACK_ENABLED` | `false` | `true` (auto) | Send Slack notifications |
| `SLACK_WEBHOOK_URL` | — | From secrets | Webhook URL |
| `TC_USERNAME` | fallback used | From secrets | Login credential |
| `TC_PASSWORD` | fallback used | From secrets | Login credential |
| `AI_HEALING_ENABLED` | `false`/`true` | From secrets | AI retry on failure |
| `OPENAI_API_KEY` | your key | From secrets | GPT API access |
| `NAV_TIMEOUT` | `15000` | `30000` (auto) | Navigation timeout |
| `ACTION_TIMEOUT` | `10000` | `15000` (auto) | Click/type timeout |
| `TEST_TIMEOUT` | `60000` | `120000` (auto) | Single test timeout |

### Priority Order (highest wins):

1. **Environment variables** already set (CI secrets)
2. **`.env` file** values (local overrides)
3. **Auto-detection** based on `CI=true` flag

---

## How It Works Under the Hood

```
framework/config/runtime.config.js
```

This single file:
1. Loads `.env` (if it exists — won't in CI since it's `.gitignored`)
2. Detects `CI=true` (automatically set by GitHub Actions)
3. Exports clean flags consumed by all test files and utilities

**Consumers:**
- `smoke-suite.spec.js` → reads `runtime.browser.headless`
- `allure-auto-reporter.js` → reads `runtime.reporting.openAfterRun`
- `slack-notify.js` → reads `runtime.reporting.slackEnabled`
- `test-data.config.js` → reads `runtime.credentials.*`

---

## Demo Playbook

### Showing Local vs CI Difference

1. Open `.env` in your IDE — point out `HEADLESS=false`, `OPEN_REPORT=true`
2. Run a test locally → browser visible, report auto-opens
3. Show the GitHub Actions workflow → same tests, but headless + Slack notification
4. Explain: "One config file toggles between developer mode and pipeline mode"

### Live Browser Demo (Self-Hosted Runner)

If you need the audience to SEE the browser during a CI/CD demo:

1. Set up a [self-hosted runner](https://docs.github.com/en/actions/hosting-your-own-runners)
2. Trigger `smoke-daily.yml` manually with:
   - Runner: `self-hosted`
   - Headed: `true`
3. The browser opens on your machine, tests execute visually

---

## Slack Notification Format

On every pipeline completion, the team receives:

```
┌─────────────────────────────────────────────┐
│  ✅ Smoke Tests PASSED                      │
│                                             │
│  Results: Total: 8 | Passed: 8 | Failed: 0 │
│  Duration: 2m 34s                           │
│  AI Healing: Disabled                       │
│                                             │
│  [View Run]  [Allure Report]                │
└─────────────────────────────────────────────┘
```

Color-coded: green for pass, red for failures.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Tests fail with "browser not found" | Run `npx playwright install --with-deps chrome` |
| Slack notification not sent | Check `SLACK_WEBHOOK_URL` secret is set; verify `SLACK_ENABLED` isn't `false` in env |
| Reports open in CI (blocking) | Verify `.env` file is NOT committed (check `.gitignore`) |
| Credentials not working in CI | Confirm `TC_USERNAME` and `TC_PASSWORD` secrets are set in repo settings |
| AI healing not triggering | Set `AI_HEALING_ENABLED=true` and provide `OPENAI_API_KEY` secret |
| Self-hosted runner can't show browser | Ensure runner machine has Chrome installed and a display (not headless server) |

---

## File Map

```
.env                          ← Your local settings (gitignored)
.env.example                  ← Template for new developers
framework/
  config/
    runtime.config.js         ← Single source of truth (reads .env + detects CI)
    test-data.config.js       ← Uses runtime config for credentials
  reporters/
    allure-auto-reporter.js   ← Uses runtime config for --open flag
  utils/
    slack-notify.js           ← Uses runtime config for slack toggle
.github/
  workflows/
    playwright.yml            ← Full pipeline (test → heal → report → notify)
    smoke-daily.yml           ← Daily smoke (scheduled + demo mode)
```
