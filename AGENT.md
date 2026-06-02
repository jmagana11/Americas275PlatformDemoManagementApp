# Agent Handoff: Americas 275 App Builder Utility App

This file gives future agent sessions enough context to work safely without re-learning the whole app. Treat the repository as production-sensitive even when working locally.

## Current Baseline

- Repository root: `/Users/jmagana/Desktop/projects/Utitlities/Americas275ProjectApp/App`
- Main app extension: `src/dx-excshell-1`
- Frontend: React Spectrum SPA under `src/dx-excshell-1/web-src`
- Backend: Adobe I/O Runtime actions under `src/dx-excshell-1/actions`
- App Builder config:
  - Root app config: `app.config.yaml`
  - Extension config: `src/dx-excshell-1/ext.config.yaml`
- Runtime action count: 40 declared actions.
- Runtime target is `nodejs:24`.
- Local Runtime/build verification should run under Node 24.
- Deployment workflows are manual-only. Merging to `main` should not deploy this app by itself.
- PR #1 merged the production-safe cleanup and redaction baseline into `main`.
- M1 is complete locally: shared Runtime config resolver, app-owned duplicate env dedupe, prompt-generation migration, and Campaign Trigger canonical credential resolution.
- M2 is complete locally: shared Azure Blob helper, JSON read/write helpers, not-found handling, metadata normalization, prefix list/delete support, and API Monitor/webhook receiver helper migration.
- M3 is complete locally: API Monitor inbound webhooks now use per-event blobs with shared session lookup, deterministic read/clear behavior, stable UI row keys, and visible live refresh.
- M4 is complete locally: API Monitor, API Proxy, and session-manager storage paths are documented, new/re-written session records use `storageSchemaVersion: 1`, and all three areas use shared schema/path normalization helpers while preserving existing blob paths.
- M8 is complete locally: User Management, Content Template Migrator, Segment Refresh sandbox org pickers, org-aware auth actions, content templates, and sandbox lookups use the shared org config model and non-secret org metadata endpoint.
- M5/M6 are complete locally: routes/sidebar navigation use a shared frontend feature registry, access control uses named groups plus feature policies without logging full allowlists by default, identity resolution handles common IMS email fields, and local raw bootstrap uses a non-secret mock IMS profile so protected navigation appears during local smoke testing outside Experience Cloud Shell.
- Active runtime milestone is in progress locally: Runtime declarations are being moved to `nodejs:24` in an isolated branch after the Administration/API Monitor session milestone was merged to `main`.

## Non-Negotiables

- Do not change action names, package names, web action URLs, UI route paths, Runtime annotations, or `require-adobe-auth` values unless the user asks for that exact release step.
- Keep Runtime upgrades isolated from feature refactors. The current target is `nodejs:24`; use `nodejs:22` only as a compatibility fallback if Stage smoke or App Builder tooling requires it.
- Do not print, copy, or summarize credential values. Credential values should be treated as production values and managed through App Builder inputs, local `.env`, Adobe/Azure/Microsoft consoles, or GitHub secrets.
- The user clarified that credentials should not be treated as compromised. Do not write PR notes or docs that claim compromise. Focus on source-control and secret-channel hygiene.
- Keep behavior-preserving refactors small. One cluster per branch or conversation is preferred.
- Before any code change, read the local files involved and update `docs/REFACTOR_CHANGE_LOG.md`.
- After any code change, run at minimum:

```bash
npm test -- --runInBand
aio app build
```

## App Builder Quirks To Remember

- App Builder package inputs are injected into every action's `params`.
- Because of that, monitor/logger actions must filter Runtime inputs before storing or rendering request payloads.
- Current redaction utilities live in `src/dx-excshell-1/actions/shared/redaction.js`.
- Shared config utilities live in `src/dx-excshell-1/actions/shared/config.js`.
- Shared access policy utilities live in `src/dx-excshell-1/actions/shared/accessPolicy.js`.
- Shared storage schema utilities live in `src/dx-excshell-1/actions/shared/sessionStore.js`.
- App-owned duplicate env values should resolve through canonical inputs first, with legacy names kept only as temporary aliases in the resolver.
- Frontend action URLs come from generated App Builder config imported as `allActions` from `src/dx-excshell-1/web-src/src/config.json`.
- Local dev normally runs at `http://localhost:9080`.
- Runtime action URLs are produced by App Builder/AIO tooling; do not hand-edit generated deployed URLs.

## Repo Map

```text
app.config.yaml
src/dx-excshell-1/ext.config.yaml
src/dx-excshell-1/actions/
src/dx-excshell-1/actions/shared/redaction.js
src/dx-excshell-1/web-src/src/components/
src/dx-excshell-1/web-src/src/components/App.js
src/dx-excshell-1/web-src/src/components/SideBar.js
src/dx-excshell-1/web-src/src/components/Administration.js
src/dx-excshell-1/web-src/src/appRegistry.js
src/dx-excshell-1/web-src/src/utils/accessControl.js
src/dx-excshell-1/web-src/src/utils/actionUrls.js
src/dx-excshell-1/test/
docs/APP_REFACTOR_PLAN.md
docs/API_STORAGE_SCHEMA.md
docs/REFACTOR_CHANGE_LOG.md
```

## Current High-Value Refactor Areas

1. Follow-on config resolver adoption:
   - M1 added `actions/shared/config.js` and centralized app-owned duplicate env sources found during the local audit.
   - Campaign Trigger now uses canonical `MA1HOL_API_KEY`, `MA1HOL_CLIENT_SECRET`, and `MA1HOL_IMS_ORG`; trigger-specific credential env names remain resolver aliases only.
   - Microsoft Graph app role id now uses one `MS_APP_ROLE_ID`; per-org role id names remain resolver aliases only.
   - M8 added org metadata discovery and capability checks used by User Management, Content Template Migrator, Segment Refresh sandbox loading, `adobe-auth`, `microsoft-auth`, `get-org-sandboxes`, `content-templates`, `getsandboxes`, and `ims-product-config`.
   - Remaining work is migrating non-org clusters to the resolver and deciding whether local-only/generated env aliases should be cleaned outside source.

2. API Monitor inbound webhook reliability:
   - M3 moved inbound webhook events to per-event blobs under `api-monitor/events/<sessionId>/webhooks/`.
   - `getWebhookLogs`, `clearWebhookLogs`, and `webhook-receiver` now share session lookup and webhook event storage helpers.
   - Legacy session-embedded `webhookLogs` still read and clear gracefully.
   - M4 documented the current API Monitor/API Proxy/session-manager schemas and added shared schema version normalization.
   - Remaining storage work is a future event-log follow-up: decide whether outbound API Monitor and API Proxy request logs should move from array-backed records to per-event blobs.

3. Repeated backend helpers:
   - Azure Blob client creation is centralized for migrated API Monitor actions, but still appears in non-migrated actions.
   - AEP IMS org/api-key/header construction appears in many actions.
   - Adobe IMS token fetching appears in multiple org-aware actions.
   - JSON response/error formatting is inconsistent.

4. Frontend structure:
   - Routes and sidebar nav now share `web-src/src/appRegistry.js`.
   - Access control groups and feature policies now live in `utils/accessControl.js`.
   - Several large components still need extraction only after behavior tests exist.

## Important App Areas

- App shell/navigation: `App.js`, `SideBar.js`, `SidebarContext.js`, `accessControl.js`
- AEP overview and data actions: `AEPOverview.js`, `DataManagement.js`, AEP schema/dataset actions
- Segment refresh: `SegmentRefresh.js`, `getSegments`, `refreshSegment`, `getSegmentJobStatus`
- User management: `UserManagement.js`, `adobe-auth`, `microsoft-auth`, `ims-product-config`
- Content template migration: `ContentTemplateMigrator.js`, `content-templates`, `get-org-sandboxes`
- Campaign trigger: `CampaignTrigger.js`, `campaign-trigger`
- Offer simulator: `OfferSimulator.js`, `offer-simulator`
- AI tooling: `AIPromptGeneratorEnhanced.js`, `AEPProfileInjectorSimplified.js`, `prompt-generation`, `image-generation`, `image-analysis`, `generateProfiles`, `injectProfiles`
- API Monitor: `ApiMonitor.js`, `api-monitor`, `webhook-receiver`
- API Proxy: `ProxyManager.js`, `api-proxy`, `session-manager`
- File/data utilities: `FileManager.js`, `DataManagement.js`, `upload-file`, `check-file-exists`, `data-api`, `data-api-logs`
- Custom Action APIs (AJO): `CustomActionApis.js` on `/ApiDocumentation`, `actions/shared/customActionStore.js`; see `docs/CUSTOM_ACTION_API_V2.md`. Legacy `data-api` `mode` + `filename` contract unchanged.
- URL shortener: `URLShortener.js`, `url-shortener`
- JMeter: `JmeterTesting.js`, `JmeterTestwoFolders.js`, `JmeterTestWfolders.js`, `jmeterNFemailTracking`

## Working Protocol For Future Agents

1. Start with:

```bash
git status --short --branch
git log -1 --oneline
```

2. Read this file plus:

```text
docs/APP_REFACTOR_PLAN.md
docs/REFACTOR_CHANGE_LOG.md
README.md
```

3. Pick exactly one milestone or one app-specific plan item.

4. Create a branch if code changes will be committed:

```bash
git switch -c codex/<short-task-name>
```

5. Add an entry to `docs/REFACTOR_CHANGE_LOG.md` before and after the work.

6. Prefer shared helpers only when they remove real duplication and preserve behavior.

7. Add tests before risky refactors when possible. Existing safety tests are in `src/dx-excshell-1/test`.

8. Verify with:

```bash
npm test -- --runInBand
aio app build
```

9. For frontend-visible changes, smoke test locally in the browser.

10. Do not deploy. Deployment remains manual.

## Suggested First Follow-Up

Smoke test the Node 24 Runtime branch in Stage after local build verification, then continue with roadmap items such as the AEP backend helper cluster.
