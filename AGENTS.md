# Multi-Agentic AI Self-Healing Test Automation Framework

**Application:** Total Connect 2.0 (Resideo home security)  
**Stack:** Playwright JS + OpenAI GPT-4o + LangGraph + Allure Reporting  
**Purpose:** MTech thesis — AI-powered test automation with runtime self-healing and natural language test authoring

## Key Capabilities
- 8-test smoke suite with AI self-healing (broken locators auto-fixed at runtime via GPT)
- Natural language test authoring: write English → generate executable Playwright specs
- LangGraph state machines: Runtime Healing, Post-Mortem Analysis, NL Authoring, Lifecycle Orchestration
- Allure reporting with healing audit trails
- LambdaTest cloud execution support

## Test Generation from English
- Write instructions in Copilot Chat or `tests/suites/*.md` files
- Generated specs go to `tests/generated/nl-authored/`
- Page objects live in `framework/pages/generated/smoke/`
- See `.github/copilot-instructions.md` for the full page object API and rules
