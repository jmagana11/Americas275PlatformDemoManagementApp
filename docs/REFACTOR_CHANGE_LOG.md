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

## 2026-04-29 - Node 24 Runtime Upgrade

Branch: `codex/node24-runtime-upgrade`

Milestone: Roadmap - Auth Hardening And Runtime Upgrade, Runtime-only pass

Intent:
- Move the App Builder Runtime target from `nodejs:16` to `nodejs:24` in an isolated branch.
- Verify current Adobe I/O Runtime support from official Adobe documentation before changing Runtime declarations.
- Update the local toolchain guidance so CLI/build verification runs under Node 24.
- Keep this pass Runtime/tooling-focused: no deployment, no route/action/package name changes, no auth annotation changes, and no feature refactors.

Files changed:
- `.nvmrc`
- `AGENT.md`
- `README.md`
- `docs/APP_REFACTOR_PLAN.md`
- `docs/REFACTOR_CHANGE_LOG.md`
- `package.json`
- `package-lock.json`
- `src/dx-excshell-1/ext.config.yaml`

Behavior impact:
- Installed Node 24 locally through `nvm` and installed the Adobe AIO CLI under Node 24.
- Confirmed `@adobe/aio-cli` is still `11.0.2`, and the Node 24 install has current core plugins with no pending `aio update` items.
- Changed all 40 Runtime action declarations from `nodejs:16` to `nodejs:24`.
- Added `.nvmrc` with Node 24 and narrowed the root package engine to `>=24 <25`.
- Updated docs to treat Node 24 as the active Runtime/build target with `nodejs:22` only as a compatibility fallback.
- No deployment, action rename, route rename, package rename, Runtime annotation change, auth annotation change, or feature refactor was made.

Verification:
- Confirmed official Adobe I/O Runtime documentation lists Node.js 24 support.
- Passed under Node 24.15.0: `npm test -- --runInBand` - 19 suites, 135 tests.
- Passed under Node 24.15.0 with the Node 24-installed AIO CLI: `aio app build` - built 40 actions and web assets.
- Confirmed `aio update` under Node 24 reports 0 core plugin updates and 0 user plugin updates.
- Not run: local `aio app run --open` smoke and Stage smoke; deployment remains manual.

Open questions:
- Whether any Stage-only smoke issue requires a short-term fallback to `nodejs:22`.

Next recommended step:
- Run manual local smoke if desired, then deploy to Stage through the release owner's manual path and smoke the main workflows before production.

## 2026-04-29 - AEP Profile Injector Unmount Warning Fix

Branch: `codex/admin-ui-api-monitor-sessions`

Milestone: Targeted frontend bugfix during Administration/API Monitor session milestone

Intent:
- Fix the development warning in `AEPProfileInjectorSimplified`: "Can't perform a React state update on an unmounted component."
- Scope the fix to async mount-time session/sandbox loading and notification cleanup.
- Preserve AEP Profile Injector behavior and avoid route/action/config changes.

Files changed:
- `docs/REFACTOR_CHANGE_LOG.md`
- `src/dx-excshell-1/web-src/src/components/AEPProfileInjectorSimplified.js`

Behavior impact:
- Added mounted-state and AbortController cleanup for mount-time session/sandbox loading in `AEPProfileInjectorSimplified`.
- Guarded delayed feedback/error timeout callbacks so they do not set state after unmount.
- Guarded `loadSession`, `loadSandboxes`, and silent session-save completion state updates so closing or navigating away from the screen mid-request does not update an unmounted component.
- No action names, routes, Runtime annotations, access policies, credential inputs, or API contracts changed.

Verification:
- Passed: `npm test -- --runInBand` - 19 suites, 135 tests.
- Passed: `aio app build` - built 40 actions and web assets.
- Browser smoke left for user manual verification in local app.

Open questions:
- None.

Next recommended step:
- Manual user smoke: open AI AEP Profile Injector, navigate away or close the function while sandboxes/session loading is still in progress, and confirm the unmounted state update warning no longer appears.

## 2026-04-29 - Administration UI And API Monitor Sessions

Branch: `codex/admin-ui-api-monitor-sessions`

Milestone: Active milestone - Administration UI and API Monitor session management

Intent:
- Add an admin-only `/Administration` route under Utilities for managing feature access policies.
- Use the non-secret bootstrap administrator email `jmagana@adobe.com` through the new `administrator` Runtime input.
- Store dynamic access policies in Azure Blob Storage while preserving the current static allowlist/public behavior as the default and fallback.
- Add API Monitor session listing and description editing for the existing API Monitor storage user identifier model.
- Move unfinished M7/M9-M13 work into roadmap/future-work documentation instead of treating those items as the immediate implementation sequence.

Files changed:
- `.env.example`
- `AGENT.md`
- `README.md`
- `docs/API_STORAGE_SCHEMA.md`
- `docs/APP_REFACTOR_PLAN.md`
- `docs/REFACTOR_CHANGE_LOG.md`
- `src/dx-excshell-1/ext.config.yaml`
- `src/dx-excshell-1/actions/access-management/index.js`
- `src/dx-excshell-1/actions/api-monitor/index.js`
- `src/dx-excshell-1/actions/shared/accessPolicy.js`
- `src/dx-excshell-1/actions/shared/accessPolicyStore.js`
- `src/dx-excshell-1/actions/shared/apiMonitorStore.js`
- `src/dx-excshell-1/actions/shared/config.js`
- `src/dx-excshell-1/actions/shared/sessionStore.js`
- `src/dx-excshell-1/web-src/src/appRegistry.js`
- `src/dx-excshell-1/web-src/src/components/Administration.js`
- `src/dx-excshell-1/web-src/src/components/ApiMonitor.js`
- `src/dx-excshell-1/web-src/src/components/App.js`
- `src/dx-excshell-1/web-src/src/components/SideBar.js`
- `src/dx-excshell-1/web-src/src/utils/accessControl.js`
- `src/dx-excshell-1/web-src/src/utils/accessManagement.js`
- `src/dx-excshell-1/test/accessManagementAction.test.js`
- `src/dx-excshell-1/test/accessPolicy.test.js`
- `src/dx-excshell-1/test/accessControl.test.js`
- `src/dx-excshell-1/test/apiMonitorStore.test.js`
- `src/dx-excshell-1/test/appBuilderConfig.test.js`
- `src/dx-excshell-1/test/appRegistry.test.js`
- `src/dx-excshell-1/test/sessionStore.test.js`

Behavior impact:
- Added new `access-management` Runtime action and `administrator` package input; declared action count is now 40.
- Added `/Administration` route under Utilities with backend-confirmed admin visibility. `jmagana@adobe.com` is the bootstrap administrator and is always retained in the Administration allowlist.
- Added Azure Blob access policy storage at `access-control/policies.json` with defaults that preserve current public/protected behavior.
- Frontend route/sidebar access now uses dynamic backend permission results when available and static defaults as fallback. Non-admin access responses do not include full allowlists.
- Added API Monitor `listSessions` and `updateSessionDescription` actions for existing API Monitor user identifiers.
- API Monitor UI now lists sessions by user identifier, allows descriptions, and connects to selected sessions through the existing connect flow.
- Older API Monitor sessions without `session.description` display an empty description.
- M7/M9-M13-style work is now documented as roadmap/future work instead of the immediate recommended sequence.
- No deployment, Runtime upgrade, existing action rename, existing route rename, existing auth annotation change, existing package name change, or existing web action URL change was made.

Verification:
- Passed focused: `node node_modules/jest/bin/jest.js --passWithNoTests src/dx-excshell-1/test/accessPolicy.test.js src/dx-excshell-1/test/accessManagementAction.test.js src/dx-excshell-1/test/accessControl.test.js src/dx-excshell-1/test/appRegistry.test.js src/dx-excshell-1/test/apiMonitorStore.test.js src/dx-excshell-1/test/sessionStore.test.js src/dx-excshell-1/test/appBuilderConfig.test.js --runInBand` - 7 suites, 42 tests.
- Passed: `npm test -- --runInBand` - 19 suites, 135 tests.
- Passed after replacing unavailable `Save` icon with `SaveFloppy`: `aio app build` - built 40 actions and web assets.
- Attempted: `aio app run --open`; sandbox blocked local port/cache access with `listen EPERM: operation not permitted 0.0.0.0:9080`.
- Skipped by user choice: escalated local browser smoke; user will run it manually.

Open questions:
- None for this implementation pass; API Monitor user lookup will use the existing storage user identifier.

Next recommended step:
- Manual user smoke test: verify Administration appears for `jmagana@adobe.com`, policy edits persist, non-admins cannot open Administration, API Monitor lists sessions for the current user identifier, description edits persist, and Connect opens the selected session.

## 2026-04-29 - M5/M6 Route Registry And Access Control

Branch: `codex/m5-m6-route-access`

Milestone: M5 - Frontend Route, Nav, And Feature Registry / M6 - Access Control Consolidation

Intent:
- Introduce a shared frontend feature registry so `App.js` and `SideBar.js` use one source for route paths, sidebar labels, sidebar sections, icons, and access policies.
- Keep all existing route paths, visible sidebar labels, protected-route redirects, and public/protected behavior unchanged.
- Consolidate repeated access-control allowlists into named groups and feature policies while preserving the current effective allow/deny behavior.
- Stop dumping full access allowlists to the browser console by default; keep a debug option for policy details.
- Add tests for representative access decisions, registry route/sidebar wiring, and access-control logging behavior.

Files changed:
- `AGENT.md`
- `README.md`
- `docs/APP_REFACTOR_PLAN.md`
- `docs/REFACTOR_CHANGE_LOG.md`
- `src/dx-excshell-1/web-src/src/appRegistry.js`
- `src/dx-excshell-1/web-src/src/components/App.js`
- `src/dx-excshell-1/web-src/src/components/SideBar.js`
- `src/dx-excshell-1/web-src/src/index.js`
- `src/dx-excshell-1/web-src/src/utils/accessControl.js`
- `src/dx-excshell-1/test/accessControl.test.js`
- `src/dx-excshell-1/test/appRegistry.test.js`

Behavior impact:
- Behavior-preserving frontend refactor.
- Added a shared feature registry for route path, component, sidebar section, sidebar label, icon, and access policy metadata.
- `App.js` now renders all current route paths from the registry.
- Registry-backed `AppRoute` entries pass `path` and `exact` to the immediate `Switch` child so React Router can match non-home routes correctly.
- `SideBar.js` now renders the current visible sidebar labels and sections from the registry.
- Currently hidden routes remain supported but were not newly exposed in the sidebar.
- Access control now uses named groups and feature policy mappings while preserving known allow/deny decisions.
- Local raw bootstrap now provides a non-secret mock IMS profile for a core demo user so access-controlled navigation is visible during local smoke testing outside Experience Cloud Shell.
- Access control recognizes common IMS email field shapes and trims/case-normalizes the resolved email before checking policies.
- Added a local React Refresh registration guard in `accessControl.js` because the dev web bundle can emit `$RefreshReg$` calls for this non-component module while Experience Shell has not defined that helper.
- `logAccessControlInfo` no longer dumps full allowlists by default; full allowlists are only emitted when debug is enabled.
- No route paths, visible sidebar labels, action names, Runtime settings, auth annotations, or backend behavior changed.

Verification:
- Passed focused: `node node_modules/jest/bin/jest.js --passWithNoTests src/dx-excshell-1/test/accessControl.test.js src/dx-excshell-1/test/appRegistry.test.js --runInBand` - 2 suites, 10 tests.
- Passed: `npm test -- --runInBand` - 17 suites, 123 tests.
- Passed: `aio app build` - built 39 actions and web assets.
- Skipped with user approval: local browser smoke for sidebar route/navigation behavior; user will run it manually.

Open questions:
- Which currently hidden routes should become visible sidebar items in a future UI cleanup.

Next recommended step:
- Smoke test the sidebar sections, protected redirects, and representative public routes in local browser.
- Proceed to M7: AEP backend helper cluster.

## 2026-04-29 - M8 Organization Config Cluster

Branch: `codex/m8-org-config`

Milestone: M8 - Organization-Specific Adobe/Microsoft Config Cluster

Intent:
- Build on the M1 Runtime config resolver so User Management, Content Template Migrator, Segment Refresh sandbox loading, and org-aware auth/content actions use one backend org model.
- Keep existing MA1HOL/POT5HOL frontend selected values and visible labels unchanged.
- Preserve content-template credential override behavior for `POT5HOL_CONTENT_*` while falling back to base `POT5HOL_*` inputs.
- Avoid action name, route, Runtime kind, annotation, package-name, or web action URL changes.
- Add focused tests for org metadata listing, capability-specific config checks, sandbox lookup, auth actions, content-template config resolution, and frontend org metadata wiring.

Files changed:
- `AGENT.md`
- `README.md`
- `docs/APP_REFACTOR_PLAN.md`
- `docs/REFACTOR_CHANGE_LOG.md`
- `src/dx-excshell-1/actions/shared/config.js`
- `src/dx-excshell-1/actions/adobe-auth/index.js`
- `src/dx-excshell-1/actions/microsoft-auth/index.js`
- `src/dx-excshell-1/actions/get-org-sandboxes/index.js`
- `src/dx-excshell-1/actions/content-templates/index.js`
- `src/dx-excshell-1/actions/getsandboxes/index.js`
- `src/dx-excshell-1/actions/ims-product-config/index.js`
- `src/dx-excshell-1/actions/utils.js`
- `src/dx-excshell-1/web-src/src/utils/orgConfig.js`
- `src/dx-excshell-1/web-src/src/components/UserManagement.js`
- `src/dx-excshell-1/web-src/src/components/ContentTemplateMigrator.js`
- `src/dx-excshell-1/web-src/src/components/SegmentRefresh.js`
- `src/dx-excshell-1/test/config.test.js`
- `src/dx-excshell-1/test/orgConfigActions.test.js`
- `src/dx-excshell-1/test/appBuilderConfig.test.js`
- `src/dx-excshell-1/test/utils.test.js`

Behavior impact:
- Behavior-preserving M8 refactor for existing MA1HOL/POT5HOL workflows.
- Added shared backend org key discovery, non-secret org metadata, capability-specific config checks, IMS-org lookup, sandbox capability support, and Microsoft token-only capability support.
- Migrated org-aware auth, sandbox, content-template, and IMS product config actions to `actions/shared/config.js`.
- `get-org-sandboxes` now supports `action: "list-orgs"` for non-secret frontend org metadata.
- User Management, Content Template Migrator, and Segment Refresh now share `web-src/src/utils/orgConfig.js` for org picker metadata with MA1HOL/POT5HOL fallbacks.
- `POT5HOL_CONTENT_*` content-template override inputs remain supported and fall back to base `POT5HOL_*` inputs.
- Follow-up fix after manual smoke: `get-org-sandboxes` and `content-templates` now merge JSON request body fields with Runtime-injected params, so Content Template Migrator sandbox/template POST requests work whether App Builder flattens body fields or exposes `body`/`__ow_body`.
- Follow-up fix after manual smoke: org discovery now ignores unrelated single-field global keys such as default AEP, JMeter, or service API keys instead of exposing them as pseudo-org picker entries.
- Content Template Migrator sandbox loading now surfaces action error messages instead of showing only "No sandboxes found".
- No action names, package names, web action URLs, route paths, Runtime annotations, `require-adobe-auth` values, Runtime kind, or credential channels changed.

Verification:
- Passed focused: `node node_modules/jest/bin/jest.js --passWithNoTests src/dx-excshell-1/test/config.test.js src/dx-excshell-1/test/orgConfigActions.test.js src/dx-excshell-1/test/appBuilderConfig.test.js --runInBand` - 3 suites, 29 tests.
- Passed focused after sandbox follow-up: `node node_modules/jest/bin/jest.js --passWithNoTests src/dx-excshell-1/test/config.test.js src/dx-excshell-1/test/orgConfigActions.test.js src/dx-excshell-1/test/utils.test.js --runInBand` - 3 suites, 49 tests.
- Passed after sandbox follow-up: `npm test -- --runInBand` - 15 suites, 113 tests.
- Passed after sandbox follow-up: `aio app build` - built 39 actions and web assets.
- Skipped with user approval: local `aio app run --open` UI smoke; user will run the M8 smoke test manually.

Open questions:
- Whether future org display labels should become non-secret Runtime inputs instead of code defaults.
- Whether User Management postmirror endpoints should move behind App Builder actions in a separate milestone.

Next recommended step:
- Manual user smoke test for M8: verify User Management, Content Template Migrator, and Segment Refresh still show MA1HOL/POT5HOL org options, load sandboxes, and complete the touched auth/template/sandbox flows.
- Proceed to M7: AEP backend helper cluster.

## 2026-04-29 - M4 API Monitor And API Proxy Storage Alignment

Branch: `codex/m4-storage-alignment`

Milestone: M4 - API Monitor And API Proxy Storage Alignment

Intent:
- Document the current API Monitor, API Proxy, and session-manager Azure Blob storage schemas with redacted sample shapes.
- Add shared schema/version helpers so new session records have an explicit storage version while old sessions still load.
- Align API Monitor, API Proxy, and session-manager around shared storage path and session-normalization logic without changing action names, routes, auth annotations, Runtime version, or web action URLs.
- Add focused compatibility tests for old session shapes and new schema-versioned session records.

Result:
- Added `docs/API_STORAGE_SCHEMA.md` with redacted sample shapes for API Monitor session blobs, API Monitor webhook event blobs, API Proxy user/session blobs, and session-manager feature blobs.
- Added `actions/shared/sessionStore.js` with storage schema version constants, stable path helpers, API Monitor/API Proxy/session-manager normalizers, and shared array-event list/clear helpers.
- API Monitor new session blobs now include `storageSchemaVersion: 1` and a small `features.apiMonitor` storage map while preserving existing `session`, `requestLogs`, `webhookLogs`, and `proxyConfigs` fields.
- API Monitor session lookup now normalizes old session blobs in memory, and outbound request-log list/clear behavior uses the shared monitor store helpers.
- API Proxy now uses the shared Azure Blob helper plus shared path/schema normalization for both user-level `users/<userId>/sessions.json` and session-level `sessions/<sessionId>/config.json` records.
- `session-manager` now uses the shared Azure Blob helper and shared feature-session normalization while preserving the existing `sessions/<userId>-session.json` path.
- Added focused Jest coverage for storage paths, schema versioning, old-shape normalization, and shared array-backed event helpers.

Files changed:
- `AGENT.md`
- `README.md`
- `docs/API_STORAGE_SCHEMA.md`
- `docs/APP_REFACTOR_PLAN.md`
- `docs/REFACTOR_CHANGE_LOG.md`
- `src/dx-excshell-1/actions/shared/sessionStore.js`
- `src/dx-excshell-1/actions/shared/apiMonitorStore.js`
- `src/dx-excshell-1/actions/api-monitor/index.js`
- `src/dx-excshell-1/actions/api-proxy/index.js`
- `src/dx-excshell-1/actions/session-manager/index.js`
- `src/dx-excshell-1/test/sessionStore.test.js`

Behavior impact:
- Compatibility-preserving backend storage alignment.
- Existing blob paths are preserved.
- Existing old sessions without `storageSchemaVersion` continue to load and are normalized on write.
- New or rewritten API Monitor, API Proxy, and session-manager records include `storageSchemaVersion: 1`.
- No deployment, action URL, route, Runtime, auth annotation, or credential changes were made.

Verification:
- Passed before implementation: `npm test -- --runInBand` - 13 suites, 89 tests.
- Passed focused: `node node_modules/jest/bin/jest.js --passWithNoTests src/dx-excshell-1/test/sessionStore.test.js src/dx-excshell-1/test/apiMonitorStore.test.js --runInBand` - 2 suites, 14 tests.
- Passed: `npm test -- --runInBand` - 14 suites, 97 tests.
- Passed: `aio app build` - built 39 actions and web assets.
- Passed: user manual smoke test for the M4 storage flows.

Open questions:
- Whether outbound API Monitor request logs and API Proxy request logs should move to per-event blobs in a later milestone after schema alignment is documented.

Next recommended step:
- Proceed to M8: organization-specific Adobe/Microsoft config cluster.

## 2026-04-29 - M3 API Monitor Inbound Webhook Correctness

Branch: `codex/m3-api-monitor-webhooks`

Milestone: M3 - API Monitor Inbound Webhook Correctness

Intent:
- Make inbound API Monitor webhook logging deterministic under burst traffic.
- Use the M2 shared blob helper to move inbound webhook events away from last-writer-wins mutation of a single session JSON blob.
- Align `webhook-receiver`, `getWebhookLogs`, and `clearWebhookLogs` around the same session lookup and webhook storage rules.
- Update the API Monitor UI to use stable webhook ids for inbound row keys/selection and make live refresh visible or explicit.
- Add focused tests for webhook event storage/listing/clearing and compatible fallback behavior.

Result:
- Added `actions/shared/apiMonitorStore.js` for shared API Monitor session lookup, session blob paths, webhook event blob paths, event listing, event clearing, session summary updates, and backward-compatible legacy embedded webhook logs.
- Extended `actions/shared/blobStore.js` with prefix listing, prefix JSON reads, and prefix deletes.
- Migrated inbound webhook capture so `webhook-receiver` writes each inbound request to its own blob under `api-monitor/events/<sessionId>/webhooks/`.
- Updated `api-monitor` `getWebhookLogs` to read event blobs plus legacy embedded webhook logs, sorted newest-first, and `clearWebhookLogs` to delete event blobs while clearing legacy embedded logs.
- Kept the session JSON blob as the compatibility and summary record for existing session paths.
- Updated `ApiMonitor.js` so outbound and inbound tables use stable request/webhook ids for row keys and selected-row lookup.
- Made the API Monitor live refresh switch visible.
- Added focused storage tests for shared session lookup, event-per-blob listing, summary update, clear behavior, and blob prefix list/read/delete helpers.

Files changed:
- `AGENT.md`
- `docs/APP_REFACTOR_PLAN.md`
- `README.md`
- `src/dx-excshell-1/actions/shared/apiMonitorStore.js`
- `src/dx-excshell-1/actions/shared/blobStore.js`
- `src/dx-excshell-1/actions/api-monitor/index.js`
- `src/dx-excshell-1/actions/webhook-receiver/index.js`
- `src/dx-excshell-1/web-src/src/components/ApiMonitor.js`
- `src/dx-excshell-1/test/apiMonitorStore.test.js`
- `src/dx-excshell-1/test/blobStore.test.js`
- `docs/REFACTOR_CHANGE_LOG.md`

Behavior impact:
- Existing session creation, proxy logging, session blob paths, UI route paths, action names, auth annotations, and Runtime version are preserved.
- Inbound webhook history now reads from per-event blobs, which avoids concurrent webhook calls overwriting each other in the shared session JSON blob.
- Old session-embedded `webhookLogs` still read and are cleared gracefully.
- Clearing inbound logs deletes only webhook event blobs for that session and clears the legacy embedded inbound array; outbound request logs and proxy configs are not cleared.

Verification:
- Passed: focused `node node_modules/jest/bin/jest.js --passWithNoTests src/dx-excshell-1/test/blobStore.test.js src/dx-excshell-1/test/apiMonitorStore.test.js --runInBand` - 2 suites, 14 tests.
- Passed: `npm test -- --runInBand` - 13 suites, 89 tests.
- Passed: `aio app build` - built 39 actions and web assets.
- Attempted: `aio app run --open` in sandbox, blocked by local listen/cache permission (`EPERM` on port 9080 and AIO cache log).
- Skipped with user approval: escalated local browser smoke; user will run the smoke test manually.

Open questions:
- Whether event-per-blob storage should later be generalized for outbound request/proxy events as part of M4.
- Whether the visible live refresh switch should later be relocated into each tab toolbar after broader API Monitor UI cleanup.

Next recommended step:
- User manual smoke test: create an API Monitor session, send a burst of at least 20 POST requests to the generated webhook URL, refresh or enable live refresh, verify 20 inbound rows, clear inbound logs, then send another burst and verify all new rows appear.
- After M3 is merged into `main`, proceed to M4 storage alignment.

## 2026-04-29 - M2 Shared Azure Blob Storage Module

Branch: `codex/m2-blob-store`

Milestone: M2 - Shared Azure Blob Storage Module

Intent:
- Add a shared Azure Blob storage helper for Runtime actions.
- Centralize BlobServiceClient creation, JSON read/write, blob-not-found handling, JSON content headers, optional ETag conditional writes, and safe metadata handling.
- Migrate the API Monitor and webhook receiver action cluster to use the helper while preserving current session blob paths and response behavior.
- Add focused unit tests with mocked Azure Blob clients.

Result:
- Added `actions/shared/blobStore.js` with shared BlobServiceClient creation via the M1 Azure Blob config resolver.
- Centralized JSON blob reads/writes, blob-not-found handling, JSON content headers, safe metadata normalization, reusable JSON blob store creation, and optional ETag conditional upload support.
- Migrated `api-monitor` and `webhook-receiver` away from local duplicated Azure Blob helpers and onto the shared helper.
- Preserved the existing API Monitor session blob path shape: `api-monitor/DO_NOT_DELETE_APPBUILDER_<userId>_<sessionId>.json`.
- Added `test/blobStore.test.js` with mocked Azure Blob clients covering client creation, JSON reads, not-found behavior, JSON writes, metadata normalization, reusable store options, and ETag upload conditions.

Files changed:
- `src/dx-excshell-1/actions/shared/blobStore.js`
- `src/dx-excshell-1/actions/api-monitor/index.js`
- `src/dx-excshell-1/actions/webhook-receiver/index.js`
- `src/dx-excshell-1/test/blobStore.test.js`
- `docs/REFACTOR_CHANGE_LOG.md`

Behavior impact:
- Intended behavior-preserving storage helper extraction for the API Monitor/webhook receiver cluster.
- Existing session blob paths, session JSON shape, request/webhook/proxy config fields, and Runtime input names remain unchanged.
- Missing Azure Blob config now flows through the shared config resolver with value-free error messages.
- No action names, package names, web action URLs, UI routes, Runtime annotations, auth settings, or Runtime versions were changed.

Verification:
- Passed: focused `node node_modules/jest/bin/jest.js --passWithNoTests src/dx-excshell-1/test/blobStore.test.js --runInBand` - 1 suite, 6 tests.
- Passed: `npm test -- --runInBand` - 12 suites, 81 tests.
- Passed: `aio app build` - built 39 actions and web assets.

Open questions:
- Whether M3 should use event-per-blob storage or ETag-protected session blob writes for API Monitor inbound webhook correctness.

Next recommended step:
- Proceed to M3: API Monitor inbound webhook correctness, building on the shared blob helper and deciding between event-per-blob storage and ETag-protected session blob writes.

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
