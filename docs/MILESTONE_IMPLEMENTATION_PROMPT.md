# Milestone Implementation Prompt

Use this prompt when you want a future agent to implement one milestone from `docs/APP_REFACTOR_PLAN.md`.

Replace `<MILESTONE_ID>` and `<MILESTONE_NAME>` before sending.

```text
Please implement <MILESTONE_ID>: <MILESTONE_NAME> from docs/APP_REFACTOR_PLAN.md.

Repository:

/Users/jmagana/Desktop/projects/Utitlities/Americas275ProjectApp/App

Before changing code:

1. Read AGENT.md.
2. Read docs/APP_REFACTOR_PLAN.md.
3. Read docs/REFACTOR_CHANGE_LOG.md.
4. Read README.md.
5. Run:

git status --short --branch
git log -1 --oneline

6. Find the full milestone section for <MILESTONE_ID>.
7. Identify the exact files and workflows affected.
8. Add an "Intent" entry to docs/REFACTOR_CHANGE_LOG.md.

Implementation rules:

- Keep the change scoped to <MILESTONE_ID>.
- Preserve production behavior unless the milestone explicitly changes behavior.
- Do not deploy.
- Do not print, copy, or summarize credential values.
- Do not treat credentials as compromised.
- Do not change action names, package names, web action URLs, UI route paths, Runtime annotations, or require-adobe-auth values unless this milestone explicitly requires it and I approve it.
- Keep legacy env variable aliases unless the milestone explicitly removes them and I approve it.
- Add or update tests for any behavior-changing code.
- Prefer shared helpers only when they remove real duplication and preserve existing behavior.
- Update docs/REFACTOR_CHANGE_LOG.md with result, verification, open questions, and next recommended step.

Required verification before final response:

npm test -- --runInBand
aio app build

If the milestone affects UI behavior, also start or use the local App Builder dev server and smoke test the affected screen in the browser.

Final response must include:

- milestone implemented
- files changed
- behavior changed or preserved
- verification results
- remaining risks or open questions
- recommended next milestone

Do not commit, push, merge, or deploy unless I explicitly ask for that in the same conversation.
```

## Quick Milestone Examples

### M3 API Monitor

```text
Please implement M3: API Monitor Inbound Webhook Correctness from docs/APP_REFACTOR_PLAN.md.

Focus on making inbound webhook history show all requests sent to the generated endpoint, including quick bursts and requests sent after clearing logs. Preserve existing routes and action names. Add tests for the storage/read/clear behavior and update docs/REFACTOR_CHANGE_LOG.md.
```

### M1 Config Resolver

```text
Please implement M1: Canonical Runtime Config And Credential Resolver from docs/APP_REFACTOR_PLAN.md.

Start by adding the shared backend config resolver and tests. Keep all existing env names working as aliases. Do not remove ext.config.yaml inputs in this pass.
```

### M13 Runtime Upgrade

```text
Please implement M13: Auth Hardening And Runtime Upgrade from docs/APP_REFACTOR_PLAN.md.

First verify current Adobe I/O Runtime support from official Adobe docs. Target nodejs:24 if supported, with nodejs:22 only as a compatibility fallback. Keep this isolated from other refactors and do not deploy.
```
