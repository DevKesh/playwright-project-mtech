---
description: "Configure a named QA account through blank environment entries and optional CI secret bindings, without handling credentials."
agent: framework-maintainer
argument-hint: "Account name and non-panel use case; specify whether CI bindings are needed. Do not provide credentials."
---

Follow [the account contract](../copilot-instructions.md) and inspect the existing
account resolver and blank template. Use one QA environment, not a new config or
env file per account. Validate the requested name against the resolver.

Add only blank `ACCOUNT_<UPPER_NAME>_USERNAME` / `ACCOUNT_<UPPER_NAME>_PASSWORD`
template entries where needed. Tell the operator to provision values privately
in ignored `.env.qa` or GitHub Secrets; never open/populate that secret file or
ask for values in chat. Show selection with `test.use({ account: 'secondary' })`
using the requested name. Keep `@panel` restricted to `approved_monitor`.

Do not change fallback rules: legacy pairs apply only to their documented
equivalent accounts when the entire canonical pair is absent. No mixed pairs,
empty-value fallback or credentials in config/specs/prompts. CI changes, when
requested, bind only the selected account; public jobs receive no account secrets.

Use offline resolver checks only. No live login, panel, paid AI, cloud, Slack or
deployment without explicit approval. Report variable NAMES and modified paths,
not values, plus remaining operator provisioning steps.