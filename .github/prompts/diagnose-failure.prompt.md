---
description: "Diagnose a Playwright, fixture or reporting failure using current-run evidence without automatic live reruns."
agent: framework-maintainer
argument-hint: "Failure message, test or run ID, artifact paths and permitted offline checks. Redact secrets."
---

Follow [the shared contract](../copilot-instructions.md). Inspect the failing test,
nearest owner and supplied current-run evidence. Separate application assertion,
locator, session setup, timeout/cancellation and reporting/deployment failures.
Do not infer a passing run from a successful Slack post or partial passing counts.

State observed facts, one falsifiable local hypothesis and the cheapest offline
check. Make only a grounded, scoped fix when authorized; otherwise report findings.
Do not weaken assertions, introduce retries, enable healing reruns, substitute old
reports or expose credentials. AI suggestions are not verified repairs.

Do not rerun live/public or panel tests, call paid AI/cloud, send Slack or deploy
without explicit approval. If panel cleanup may have been interrupted, report the
need for an operator state check rather than issuing commands. Return evidence
paths, findings, changes, completed checks and what remains unverified.