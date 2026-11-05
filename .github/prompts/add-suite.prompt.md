---
description: "Add a tagged Playwright suite within an existing project without creating another runner or configuration."
agent: framework-maintainer
argument-hint: "Suite purpose, scenarios, target application, public/authenticated boundary and risk tags."
---

Follow [the shared contract](../copilot-instructions.md) and
[onboarding](../../docs/FRAMEWORK_NAVIGATION_GUIDE.md). Group the supplied scenarios
using native `test.describe`, tags and independent tests in the owning folder.
Reuse existing POMs and guarded fixtures; preserve each scenario's assertion.

A new tagged suite in an existing project needs neither config nor YAML edits.
If this is genuinely a new application, schedule or execution policy, explain
that boundary and obtain approval before expanding to config/workflow changes.
Do not create a DSL, runner, fixture alias or duplicate project discovery.

Validate offline and list the intended native selection. Live/public probes,
panel actions, paid AI, cloud, Slack and deployment require explicit approval;
suite creation does not grant it. Report paths, project, tags, account names,
verification and any unresolved scenario requirements.