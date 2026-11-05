---
description: "Add a native Playwright test to an existing project using its guarded fixture, account name and tags."
agent: framework-maintainer
argument-hint: "Scenario, expected result, existing project, account name if needed, and public or panel risk."
---

Add the requested test under [the shared contract](../copilot-instructions.md).
Use [onboarding](../../docs/FRAMEWORK_NAVIGATION_GUIDE.md) and the nearest existing
spec to choose its project folder, fixture and native tags. Ask only for missing
behavior or safety decisions, never passwords.

Reuse named POM fixtures for business tests and guarded unauthenticated fixtures
for public tests. Use `test.step` and real assertions. New TC2 NL output belongs
under `tests/tc2/nl-authored/`; do not overwrite an existing authored spec.
Default new business coverage to `@regression`; do not expand the eight-test smoke
inventory without approval. No routine config or YAML changes.

Preserve account/panel restrictions and disarm cleanup. Perform only authorized
offline validation. Do not run live/public, panel, paid AI, cloud, Slack or deploy
actions without explicit approval. Return the path, tags, account name, selected
collection command and checks actually completed.