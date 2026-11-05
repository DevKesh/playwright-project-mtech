---
description: "Adjust an approved schedule or suite policy through the shared test-execution workflow and thin wrappers."
agent: framework-maintainer
argument-hint: "Existing suite/project, requested trigger or schedule, account name and allowed execution policy."
---

Read [the shared contract](../copilot-instructions.md), the existing wrapper and
shared test-execution workflow. Routine new tests need no YAML change. Confirm
the requested schedule/policy change; edit only its owning wrapper/shared input
when needed. Do not add another test executor or per-spec workflow.

Preserve allowlisted suite selection, explicit live opt-in, suite-scoped secret
bindings, zero retries, no healing rerun, and shared panel/account concurrency.
Do not cancel running panel work to start a newer run. Monitoring repetition is
explicit coverage, not retry-on-failure. Preserve public-suite credential isolation.

Keep raw failure evidence, nonempty parseable-result validation, generated-summary
validation, and truthful failed/incomplete state. Supply a Slack report link only
after validated deployment; no empty or historical fallback report publication.

Validate statically/offline. Do not dispatch workflows, run live/public or panel
tests, invoke paid AI/cloud, send Slack or deploy without explicit approval for
each action. Report changed paths, policy, secret NAMES and validation limitations.