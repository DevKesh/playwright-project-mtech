# Multi-Agentic AI Self-Healing Test Automation Framework

**Application:** Total Connect 2.0 (Resideo home security)  
**Stack:** Playwright JS + OpenAI GPT-4o + LangGraph + Allure Reporting  
**Purpose:** MTech thesis — AI-powered test automation with runtime self-healing and natural language test authoring

## Key Capabilities
- 8-test smoke suite with original assertions and panel cleanup; optional local AI locator recovery
- Natural language test authoring: write English → generate executable Playwright specs
- LangGraph state machines: Runtime Healing, Post-Mortem Analysis, NL Authoring, Lifecycle Orchestration
- Allure reporting with healing audit trails
- LambdaTest cloud execution support

## Test Generation from English
- Write instructions in Copilot Chat or `tests/suites/*.md` files
- New generated TC2 specs go to `tests/tc2/nl-authored/`
- Canonical page objects live in `framework/pages/tc2/`; old generated/smoke modules only re-export
- See `.github/copilot-instructions.md` for the full page object API and rules

## Maintenance Entry Point (5 November 2026)
- One root config owns `tc2`, `monitoring`, `alarmnet-login-security`, `alarmnet-mobile-security`, `alarmnet-forgot-login-security`, and offline `framework` projects.
- `npm test` is offline Node validation; `npm run test:framework:browser` runs synthetic browser contracts. Live fixtures require `RUN_LIVE_TESTS=true`; live scripts set it.
- `smoke.fixture` owns named POMs over `tc.fixture` session lifecycle. Do not add fixture aliases or duplicate login ownership. Public tests use guarded unauthenticated fixtures.
- Accounts are selected by name (`approved_monitor` by default); `@panel` requires that account and single-worker execution. Secrets belong only in ignored `.env.qa` or CI secrets, never config/specs/prompts.
- Preserve dirty content and original assertions. Live/public, panel, paid AI, cloud, Slack and deployment require explicit approval. CI uses zero retries and no healing rerun.
- Shared agent: [.github/agents/framework-maintainer.agent.md](.github/agents/framework-maintainer.agent.md). Prompts: `/add-test`, `/add-suite`, `/add-account`, `/configure-ci`, `/diagnose-failure`. These guide behavior, not sandbox it; runtime AI agents are separate.

## Current Documentation
- [docs/FRAMEWORK_NAVIGATION_GUIDE.md](docs/FRAMEWORK_NAVIGATION_GUIDE.md) is short onboarding, ownership and old-to-new mapping.
- [README.md](README.md) contains current commands and execution prerequisites.
- [docs/PROJECT_GUIDE.md](docs/PROJECT_GUIDE.md) explains the framework and interview tradeoffs in plain language.
- [docs/TEST_FRAMEWORK_ARCHITECTURE.md](docs/TEST_FRAMEWORK_ARCHITECTURE.md) reconciles the May dissertation with current code, shared CI, unverified live Azure parity, and incomplete OpenAI-specific RAG retrieval.
- Smoke explicitly requires the approved monitor account and can operate physical panels. Offline framework tests are separate from live smoke validation.
- Do not describe AI suggestions as verified fixes, rendered camera sections as playback, or historical timings as current benchmarks.
