# Refactor Change Log

This log exists so future agent sessions can pick up the refactor without guessing what happened. Update it before and after every milestone implementation.

## How To Use This File

For every future work session:

1. Add an "Intent" entry before changing code.
2. Add a "Result" entry after verification.
3. Link the milestone from `docs/APP_REFACTOR_PLAN.md`.
4. Be specific about behavior changes, skipped work, and open questions.
5. Do not include credential values.

## Entry Template

```text
## YYYY-MM-DD - <short title>

Branch:
Milestone:
Intent:
Files changed:
Behavior impact:
Verification:
Open questions:
Next recommended step:
```

## 2026-04-29 - M1 Config Resolver And Env Dedup Implemented

Branch: `main`

Milestone: M1 - Canonical Runtime Config And Credential Resolver

Intent:
- Add a shared backend Runtime config resolver for package inputs and environment fallbacks.
- Cover default AEP, org-specific Adobe config, Azure Blob config, Azure OpenAI/Vision config, and legacy alias behavior without removing existing env names.
- Migrate one low-risk action first: `prompt-generation`, preserving its request/response behavior while using the shared resolver.
- Add focused tests for canonical values, legacy aliases, and value-free missing-config errors.
- Audit duplicate-valued local env keys without printing credential values, then centralize app-owned duplicate env sources.

Result:
- Added `actions/shared/config.js` with `getRequiredInput`, `getOptionalInput`, `getDefaultAepConfig`, `getOrgConfig`, `getAzureBlobConfig`, and `getAzureOpenAIConfig`.
- Kept existing Runtime input/env names intact and represented legacy aliases in the resolver.
- Moved the redaction Runtime input key list to the shared config module so config-aware keys and Runtime input filtering stay aligned.
- Migrated `prompt-generation` to use `getAzureOpenAIConfig(params, 'text')` while preserving its missing-config and success response shapes.
- Added `getCampaignTriggerConfig` so Campaign Trigger uses canonical `MA1HOL_API_KEY`, `MA1HOL_CLIENT_SECRET`, and `MA1HOL_IMS_ORG` instead of requiring duplicate `CAMPAIGN_TRIGGER_CLIENT_ID`, `CAMPAIGN_TRIGGER_CLIENT_SECRET`, and `CAMPAIGN_TRIGGER_IMS_ORG` env sources.
- Replaced duplicate per-org Microsoft app role env sources with one `MS_APP_ROLE_ID` source while keeping legacy per-org names as resolver aliases.
- Updated `.env.example` and `ext.config.yaml` so duplicate-valued app-owned env variables are no longer required.
- Added Jest coverage for canonical and alias resolution, content-template fallback behavior, campaign trigger credential canonicalization, Azure config groups, missing-config errors, redaction sync, and the migrated prompt-generation and campaign-trigger actions.

Files changed:
- `.env.example`
- `README.md`
- `src/dx-excshell-1/ext.config.yaml`
- `src/dx-excshell-1/actions/campaign-trigger/index.js`
- `src/dx-excshell-1/actions/shared/config.js`
- `src/dx-excshell-1/actions/shared/redaction.js`
- `src/dx-excshell-1/actions/prompt-generation/index.js`
- `src/dx-excshell-1/test/appBuilderConfig.test.js`
- `src/dx-excshell-1/test/campaignTrigger.test.js`
- `src/dx-excshell-1/test/config.test.js`
- `src/dx-excshell-1/test/promptGeneration.test.js`
- `docs/REFACTOR_CHANGE_LOG.md`

Behavior impact:
- Behavior-preserving backend refactor for the migrated `prompt-generation` action.
- Campaign Trigger now resolves Adobe client/org credentials from canonical MA1HOL env sources, with legacy trigger-specific env names still supported as local/process aliases during migration.
- App Builder no longer requires duplicate env sources for Campaign Trigger client id/client secret/IMS org or per-org Microsoft app role ids.
- The real local `.env` file was audited for duplicate key names but not edited, to avoid deleting or rewriting local secret-bearing data without explicit action-time confirmation.
- No action names, package names, web URLs, UI routes, Runtime annotations, auth settings, or Runtime versions were changed.
- No frontend-visible workflow was changed, so no browser smoke test was required for M1.

Verification:
- Passed: `npm test -- --runInBand` - 11 suites, 75 tests.
- Passed: `aio app build` - built 39 actions and web assets.

Open questions:
- Whether the local `.env` file should be cleaned up manually now that the app no longer requires the duplicate app-owned env sources.
- Whether generated AIO context env keys and unreferenced local aliases such as `SERVICE_API_KEY` and `jmeterKey` should remain in local developer env files.
- Whether `POT5HOL_CONTENT_*` should remain separate long term or become temporary aliases of `POT5HOL_*` if their values duplicate in Stage/Prod.
- Which cluster should consume the resolver next: org-specific Adobe/Microsoft actions in M8, AEP read-only actions in M7, or Azure Blob users after M2 introduces blob helpers.

Next recommended step:
- Continue with M2: Shared Azure Blob Storage Module, then use the config resolver from M1 when centralizing blob client creation.

## 2026-04-29 - Content Template Migrator Unmount Warning Fix

Branch: `main`

Milestone: M0 - Baseline Guardrails And Change Log Discipline / targeted frontend bugfix

Intent:
- Investigate the development warning: "Can't perform a React state update on an unmounted component" in `ContentTemplateMigrator`.
- Keep the fix scoped to cleanup around notifications and async fetch completion.

Result:
- Added mounted-state and notification-timeout refs in `ContentTemplateMigrator`.
- Cleared pending notification timeout on unmount.
- Guarded notification and async fetch completion state updates so closing the screen mid-request does not update an unmounted component.

Files changed:
- `src/dx-excshell-1/web-src/src/components/ContentTemplateMigrator.js`
- `docs/REFACTOR_CHANGE_LOG.md`

Behavior impact:
- No route, action, config, credential, Runtime, or API contract changes.
- User-visible behavior is intended to remain the same, except the development-only unmounted state update warning should stop for this screen.

Verification:
- Passed: `npm test -- --runInBand` - 11 suites, 75 tests.
- Passed: `aio app build` - built 39 actions and web assets.
- Browser smoke test not completed because Adobe/Okta login required manual user takeover; local `aio app run` was stopped afterward.

Open questions:
- Whether similar notification timeout patterns exist in other frontend screens and should be cleaned up in a separate sweep.

Next recommended step:
- Resume the previously recommended M2 storage helper milestone.

## 2026-04-29 - Planning Documents Created

Branch: `main`

Milestone: M0 - Baseline Guardrails And Change Log Discipline

Intent:
- Create local project documentation for future refactor-focused agent sessions.
- Capture the app architecture, refactor milestones, individual app plans, and working protocol.
- Keep these docs in the project workspace without committing them yet.

Files changed:
- `AGENT.md`
- `docs/APP_REFACTOR_PLAN.md`
- `docs/REFACTOR_CHANGE_LOG.md`

Behavior impact:
- Documentation only.
- No application behavior changed.
- No action names, routes, Runtime annotations, env mappings, or workflows changed.

Verification:
- Not run; documentation-only change.

Open questions:
- Which API Monitor storage design should be used for M3: event-per-blob storage or ETag-protected session blob writes?
- Are `POT5HOL_CONTENT_*` values intended to remain separate long term, or are they temporary aliases of `POT5HOL_*`?
- Should campaign trigger credentials become an alias to an org config plus campaign-specific scope/sandbox?
- Which JMeter screen is the current production workflow?
- Which hidden routes should stay supported versus move to legacy?

Next recommended step:
- Start M3: API Monitor inbound webhook correctness.
- Reproduce the "only one inbound request shown after clear/burst" issue, add tests, then fix storage and UI keying.

## 2026-04-29 - Runtime Upgrade Target Clarified

Branch: `main`

Milestone: M13 - Auth Hardening And Runtime Upgrade

Intent:
- Correct the future runtime upgrade plan so it does not target Node 20, which reaches EOL on 2026-04-30.
- Record that Adobe I/O Runtime should be checked at implementation time and that `nodejs:24` is the preferred target when supported.

Files changed:
- `AGENT.md`
- `docs/APP_REFACTOR_PLAN.md`
- `README.md`
- `docs/REFACTOR_CHANGE_LOG.md`

Behavior impact:
- Documentation only.
- No Runtime value changed in `src/dx-excshell-1/ext.config.yaml`.
- Current production behavior remains unchanged.

Verification:
- Not run; documentation-only change.

Open questions:
- Does every App Builder action and dependency pass under `nodejs:24`, or is `nodejs:22` needed as a short-term compatibility fallback?
- Should Jest/Parcel be modernized before or inside the runtime upgrade branch?

Next recommended step:
- Keep M3 as the next implementation milestone.
- Run M13 later as an isolated branch after the storage/config refactors are stable.

## 2026-04-29 - Reusable Agent Prompts Added

Branch: `main`

Milestone: M0 - Baseline Guardrails And Change Log Discipline

Intent:
- Add reusable prompts that can bootstrap a future agent conversation and instruct a future agent to implement a specific milestone.
- Make it easy to hand off work without losing the documentation workflow.

Files changed:
- `docs/AGENT_INITIAL_PROMPT.md`
- `docs/MILESTONE_IMPLEMENTATION_PROMPT.md`
- `docs/REFACTOR_CHANGE_LOG.md`

Behavior impact:
- Documentation only.
- No application behavior changed.

Verification:
- Not run; documentation-only change.

Open questions:
- None.

Next recommended step:
- Use `docs/AGENT_INITIAL_PROMPT.md` to start future agent sessions.
- Use `docs/MILESTONE_IMPLEMENTATION_PROMPT.md` with the chosen milestone id when ready to implement M3 or another milestone.

## Historical Context Before This Log

PR #1 merged the production-safe App Builder cleanup into `main`:

- App Builder config was normalized while preserving action names, routes, Runtime values, and auth annotations.
- Credentials were moved out of source into App Builder inputs/env channels.
- API Monitor, API Proxy, webhook receiver, and shared utilities gained redaction protections.
- README was updated with architecture, security/configuration notes, local development commands, smoke test checklist, and manual release guidance.
- PR validation now runs local build/test without requiring Adobe deployment auth.
- Stage and Prod deployment workflows are manual-only.

The user clarified after that cleanup that credential values should be treated as not compromised. Future docs and PRs should describe secret-channel hygiene without claiming compromise.
