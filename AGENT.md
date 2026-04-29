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
- Runtime action count: 39 declared actions.
- Runtime target is intentionally still `nodejs:16`.
- Node runtime upgrade planning should target the newest Adobe I/O Runtime LTS kind supported at implementation time. As of 2026-04-29, Node 20 is at EOL on 2026-04-30, so do not plan a new migration to Node 20.
- Deployment workflows are manual-only. Merging to `main` should not deploy this app by itself.
- PR #1 merged the production-safe cleanup and redaction baseline into `main`.
- M1 is complete locally: shared Runtime config resolver, app-owned duplicate env dedupe, prompt-generation migration, and Campaign Trigger canonical credential resolution.

## Non-Negotiables

- Do not change action names, package names, web action URLs, UI route paths, Runtime annotations, or `require-adobe-auth` values unless the user asks for that exact release step.
- Do not upgrade Runtime from `nodejs:16` in the same PR as feature refactors. Plan that separately, and target `nodejs:24` if Adobe supports it in this app/workspace; use `nodejs:22` only as a compatibility fallback.
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
src/dx-excshell-1/web-src/src/utils/accessControl.js
src/dx-excshell-1/web-src/src/utils/actionUrls.js
src/dx-excshell-1/test/
docs/APP_REFACTOR_PLAN.md
docs/REFACTOR_CHANGE_LOG.md
```

## Current High-Value Refactor Areas

1. Follow-on config resolver adoption:
   - M1 added `actions/shared/config.js` and centralized app-owned duplicate env sources found during the local audit.
   - Campaign Trigger now uses canonical `MA1HOL_API_KEY`, `MA1HOL_CLIENT_SECRET`, and `MA1HOL_IMS_ORG`; trigger-specific credential env names remain resolver aliases only.
   - Microsoft Graph app role id now uses one `MS_APP_ROLE_ID`; per-org role id names remain resolver aliases only.
   - Remaining work is migrating more action clusters to the resolver and deciding whether local-only/generated env aliases should be cleaned outside source.

2. API Monitor inbound webhook reliability:
   - Inbound requests are stored by mutating one session JSON blob in Azure Blob Storage.
   - Concurrent webhook calls can overwrite each other because the receiver appends to stale session data and only re-reads on retry.
   - `getWebhookLogs`, `clearWebhookLogs`, and `webhook-receiver` do not share exactly the same session/user blob lookup rules.
   - The UI indexes rows by array index rather than stable request ids.

3. Repeated backend helpers:
   - Azure Blob client creation appears in several actions.
   - AEP IMS org/api-key/header construction appears in many actions.
   - Adobe IMS token fetching appears in multiple org-aware actions.
   - JSON response/error formatting is inconsistent.

4. Frontend structure:
   - Routes live in `App.js`; nav lives separately in `SideBar.js`.
   - Access control email lists are duplicated by feature in `utils/accessControl.js`.
   - Several large components need extraction only after behavior tests exist.

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

Start with Milestone M2 in `docs/APP_REFACTOR_PLAN.md`: add the shared Azure Blob storage module, then use it in the API Monitor/API Proxy storage work. M3 remains the highest-priority user-visible bug after the blob helper foundation is in place.
