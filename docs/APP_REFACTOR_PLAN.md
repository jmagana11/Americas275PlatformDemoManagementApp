# App Refactor Plan

This plan is designed for small, independent future agent sessions. Each milestone should be implemented on its own branch unless the user explicitly asks for a different workflow. Keep the app deployable after every milestone.

## Guiding Principles

- Preserve production behavior first.
- Keep action names, web URLs, routes, auth annotations, and Runtime version stable unless a milestone explicitly says otherwise.
- Do not remove legacy env vars in the same step that introduces canonical names. Add aliases first, observe, then remove in a later release.
- When local or deployed config shows duplicate-valued app-owned env variables, prefer one canonical env source in `ext.config.yaml` and keep old names only as temporary resolver aliases.
- Do not treat credentials as compromised. Treat them as sensitive configuration values that should not live in source or logs.
- Add or update tests with each behavior-changing milestone.
- Update `docs/REFACTOR_CHANGE_LOG.md` during every future session.

## Verification Baseline

Run these before and after each milestone that changes code:

```bash
npm test -- --runInBand
aio app build
```

For UI-affecting milestones, also run:

```bash
aio app run --open
```

Then smoke test only the workflows touched by the milestone.

## Cross-Cutting Milestones

### M0: Baseline Guardrails And Change Log Discipline

Goal: Make every future session reproducible.

Scope:
- Keep `AGENT.md`, this plan, and `docs/REFACTOR_CHANGE_LOG.md` current.
- Add a "Current Decision" or "Open Question" entry whenever a future agent discovers something important.
- Do not change app behavior.

Acceptance criteria:
- Future agent can identify current branch, current milestone, changed files, verification commands, and remaining risks from docs alone.

### M1: Canonical Runtime Config And Credential Resolver

Status: Completed locally on 2026-04-29.

Goal: Reduce duplicated env variables and remove credential-shape logic from individual actions.

Current observations:
- Default AEP actions use package inputs named `apiKey`, `clientSecret`, and `orgId`, sourced from `AEP_*`.
- Org-specific actions use `MA1HOL_*` and `POT5HOL_*`.
- Content template migration can use `POT5HOL_CONTENT_*` as overrides, falling back to `POT5HOL_*`.
- Campaign trigger uses `CAMPAIGN_TRIGGER_CLIENT_ID`, `CAMPAIGN_TRIGGER_CLIENT_SECRET`, and `CAMPAIGN_TRIGGER_IMS_ORG`, which may duplicate an existing Adobe org config.
- Azure Blob config is repeated in `api-monitor`, `api-proxy`, `data-api`, `data-api-logs`, `upload-file`, `check-file-exists`, `session-manager`, and `webhook-receiver`.

Completed implementation:
- Added `src/dx-excshell-1/actions/shared/config.js`.
- Implemented the planned resolver helpers plus `getCampaignTriggerConfig(params)`.
- Moved Runtime input key ownership into the config helper and wired redaction to that list.
- Migrated `prompt-generation` to `getAzureOpenAIConfig(params, 'text')`.
- Audited local duplicate env values by key name only, without printing values.
- Canonicalized app-owned duplicate env sources:
  - Campaign Trigger Adobe credentials now come from `MA1HOL_API_KEY`, `MA1HOL_CLIENT_SECRET`, and `MA1HOL_IMS_ORG`.
  - `CAMPAIGN_TRIGGER_CLIENT_ID`, `CAMPAIGN_TRIGGER_CLIENT_SECRET`, and `CAMPAIGN_TRIGGER_IMS_ORG` remain resolver aliases but are no longer required in `ext.config.yaml` or `.env.example`.
  - Shared Microsoft app role id now comes from `MS_APP_ROLE_ID`.
  - `MA1HOL_MS_APP_ROLE_ID` and `POT5HOL_MS_APP_ROLE_ID` remain resolver aliases but are no longer required in `ext.config.yaml` or `.env.example`.
- Added focused Jest coverage for resolver behavior, alias behavior, missing-config errors, redaction sync, `prompt-generation`, and `campaign-trigger`.

Original implementation plan:
1. Add `src/dx-excshell-1/actions/shared/config.js`.
2. Implement helpers:
   - `getRequiredInput(params, key, options)`
   - `getOptionalInput(params, key, aliases)`
   - `getDefaultAepConfig(params, headers)`
   - `getOrgConfig(params, orgKey, capability)`
   - `getAzureBlobConfig(params)`
   - `getAzureOpenAIConfig(params, purpose)`
3. Keep old env names as aliases. Do not remove existing inputs from `ext.config.yaml` in the first pass.
4. Add tests for alias behavior and missing-config errors.
5. Migrate one low-risk action first, then expand by cluster.

Acceptance criteria:
- No action loses support for existing env names.
- Missing config errors name the missing keys but never include values.
- Redaction runtime input list stays in sync.
- Tests cover canonical and legacy names.

Follow-up after M1:
- Migrate additional action clusters to the resolver when touching those workflows.
- Decide whether local `.env` should be manually cleaned now that duplicate app-owned env sources are no longer required.
- Decide whether `POT5HOL_CONTENT_*` remains separate long term if those values duplicate in Stage/Prod.

### M2: Shared Azure Blob Storage Module

Goal: Make blob operations consistent, testable, and concurrency-aware.

Current observations:
- Multiple actions create `BlobServiceClient` by concatenating `AZURE_BLOB_URL` and `AZURE_SAS_TOKEN`.
- Read/write helpers are duplicated.
- API Monitor stores mutable session state as one JSON blob.

Implementation plan:
1. Add `src/dx-excshell-1/actions/shared/blobStore.js`.
2. Centralize:
   - client creation
   - JSON read/write
   - blob-not-found handling
   - optional ETag conditional writes
   - safe metadata
3. Replace blob helper code in one action cluster first: API Monitor and webhook receiver.
4. Add unit tests using mocked Azure clients.

Acceptance criteria:
- `api-monitor` and `webhook-receiver` use the same helper.
- Existing session blob paths still work.
- Not-found behavior stays compatible.
- Future actions can import the helper without changing runtime inputs.

### M3: API Monitor Inbound Webhook Correctness

Goal: Make the inbound API tester display all requests sent to a webhook endpoint, including bursts, and make clear/read behavior deterministic.

Current observations:
- The webhook receiver appends inbound logs into a shared session JSON blob.
- Concurrent webhook requests can read the same old blob, append independently, and last writer wins.
- Retry merge only re-reads latest session data after a failed write, not before the first write.
- `getWebhookLogs` reads only the current user path, while `webhook-receiver` searches multiple possible user paths.
- `clearWebhookLogs` also reads only one path.
- The UI uses array indexes as row keys and selected-log references.
- The auto-refresh switch is hidden, so inbound monitoring relies on manual refresh or hidden state.

Implementation plan:
1. Reproduce locally:
   - Create API Monitor session.
   - Send 5 to 20 POST requests quickly to the generated webhook URL.
   - Refresh inbound history.
   - Clear inbound history, send another burst, and verify count.
2. Add tests for `webhook-receiver` session lookup and append behavior.
3. Introduce one shared `findMonitorSession(params, sessionId)` helper used by:
   - `getWebhookLogs`
   - `clearWebhookLogs`
   - `webhook-receiver`
   - later, `getLogs` and `clearLogs`
4. Fix append semantics. Preferred design:
   - Store each inbound webhook as its own blob under a prefix such as `api-monitor/events/{sessionId}/webhooks/{timestamp}_{webhookId}.json`.
   - Query by listing blobs for the session prefix.
   - Keep the session summary blob for counts and last activity only.
   - If changing storage shape is too large, use ETag conditional writes and retry with a forced re-read before every write.
5. Update `clearWebhookLogs` to clear the same storage location read by `getWebhookLogs`.
6. Update UI row keys to `webhookId` and selected lookup by id, not array index.
7. Make auto-refresh visible or provide an explicit "Live" toggle with clear status.

Acceptance criteria:
- A burst of at least 20 inbound requests appears as 20 logs.
- Clearing inbound logs removes only inbound logs for that session.
- After clear, a new burst displays all new requests, not only one.
- Existing old session blobs still read or fail gracefully.
- Sensitive headers/body fields remain redacted.
- Tests cover concurrent append or event-blob listing behavior.

### M4: API Monitor And API Proxy Storage Alignment

Goal: Make API Monitor, API Proxy, and session-manager share a storage model instead of parallel models.

Current observations:
- API Monitor stores `requestLogs`, `webhookLogs`, and `proxyConfigs` in one session blob.
- API Proxy has a richer `features.apiProxy` model and migration logic.
- `session-manager` exists but is not clearly the single source of truth.

Implementation plan:
1. Document current storage schemas with sample redacted fixtures.
2. Choose target schema:
   - session metadata
   - feature configs
   - request events
   - webhook events
   - proxy events
3. Add schema versioning and migration helpers.
4. Move API Monitor first, API Proxy second.

Acceptance criteria:
- Old sessions still load.
- New sessions use a documented schema version.
- Proxy and monitor event readers do not duplicate blob logic.

### M5: Frontend Route, Nav, And Feature Registry

Goal: Reduce duplication between `App.js`, `SideBar.js`, access control, and help/docs.

Current observations:
- Routes are declared in `App.js`.
- Sidebar nav is declared separately in `SideBar.js`.
- Access control is wired per route manually.
- Some components/routes exist but are not visible in sidebar.

Implementation plan:
1. Add `web-src/src/appRegistry.js`.
2. Define each feature with:
   - route path
   - nav label
   - section
   - component import
   - icon
   - access policy
   - smoke test notes
3. Generate routes and sidebar from the registry.
4. Keep existing route paths unchanged.

Acceptance criteria:
- No visible route path changes.
- Sidebar labels stay the same unless the user approves changes.
- Protected routes still redirect consistently.
- Tests or snapshots verify all registry routes render.

### M6: Access Control Consolidation

Goal: Remove repeated hard-coded email lists and make feature access auditable.

Current observations:
- `accessControl.js` repeats mostly identical email arrays for each feature.
- `logAccessControlInfo` prints all allowed email lists to the browser console.

Implementation plan:
1. Define named groups once, such as `coreDemoUsers`, `extendedUtilityUsers`, `admins`.
2. Map features to groups.
3. Stop logging entire allowlists by default.
4. Preserve current effective access exactly in the first pass.

Acceptance criteria:
- Current allowed/denied behavior is unchanged for known users.
- `logAccessControlInfo` does not dump full allowlists unless debug mode is enabled.
- Tests cover representative emails.

### M7: AEP Backend Helper Cluster

Goal: Centralize AEP IMS org/api-key/header construction and repeated response handling.

Current candidate actions:
- `getSchemas`
- `getSchemaDetails`
- `downloadSchemaDetails`
- `getDatasets`
- `createDataset`
- `getSegments`
- `refreshSegment`
- `getSegmentJobStatus`
- `getProfileCount`
- `getSampleData`
- `debugProfileIngestion`
- `createStreamingConnector`
- `createStreamingDataflow`
- `deleteStreamingConnector`
- `getStreamingConnectors`
- `injectProfiles`
- `offer-simulator`

Implementation plan:
1. Add `actions/shared/aep.js`.
2. Include helpers:
   - `getAepRequestContext(params)`
   - `buildAepHeaders(context, imsToken)`
   - `normalizeAepError(error)`
3. Migrate two read-only actions first.
4. Expand to mutating actions only after tests pass.

Acceptance criteria:
- Header values match previous behavior.
- IMS token and org fallback order is documented.
- Error shape stays compatible with frontend components.

### M8: Organization-Specific Adobe/Microsoft Config Cluster

Goal: Make User Management, Content Migrator, Segment Refresh org selection, and org sandboxes use one config model.

Current candidate files:
- `UserManagement.js`
- `ContentTemplateMigrator.js`
- `SegmentRefresh.js`
- `adobe-auth`
- `microsoft-auth`
- `get-org-sandboxes`
- `content-templates`
- `getsandboxes`
- `ims-product-config`

Implementation plan:
1. Build on M1 config helper.
2. Define canonical org keys: `MA1HOL`, `POT5HOL`, and future orgs.
3. Keep frontend labels and selected values unchanged.
4. Add backend org capability checks:
   - Adobe IMS token
   - AEP sandbox list
   - AJO content templates
   - Microsoft Graph
5. Remove duplicated frontend environment maps after backend resolution is stable.

Acceptance criteria:
- Existing MA1HOL/POT5HOL UI flows work.
- Adding a third org requires config only, not changes in multiple components/actions.
- Content-template override env vars remain supported as aliases.

### M9: AI Tooling Helper Cluster

Goal: Centralize Azure OpenAI, Azure Vision, prompt, and response handling.

Current candidate actions/components:
- `prompt-generation`
- `image-generation`
- `image-analysis`
- `generateProfiles`
- `AIPromptGeneratorEnhanced.js`
- `AIPromptGenerator.js`
- `AEPProfileInjectorSimplified.js`

Implementation plan:
1. Add `actions/shared/azureOpenAi.js`.
2. Add request validation and consistent error responses.
3. Decide whether text/image endpoints are separate canonical config keys or a single provider config with purposes.
4. Keep current UI payloads unchanged in first pass.

Acceptance criteria:
- Text prompt, image generation, image analysis, and profile generation still work.
- Missing config errors are clear and value-free.
- Tests cover one success and one missing-config path per action.

### M10: Data/File Utility Cleanup

Goal: Make file and JSON-data utilities consistent, paginated, and safe with larger blobs.

Current candidate components/actions:
- `FileManager.js`
- `DataManagement.js`
- `JsonEditor.js`
- `data-api`
- `data-api-logs`
- `upload-file`
- `check-file-exists`

Implementation plan:
1. Move these actions to shared Azure Blob helper from M2.
2. Define response contracts for list/read/write/delete.
3. Add pagination or continuation-token support for large folders.
4. Confirm upload/download limits and user-facing errors.

Acceptance criteria:
- Existing upload/download behavior works.
- Large lists do not lock the UI.
- Blob errors are shown without exposing SAS token details.

### M11: JMeter And Sandbox Legacy Rationalization

Goal: Decide what is active, what is legacy, and what should be moved under `tools/legacy`.

Current candidate files:
- `JmeterTesting.js`
- `JmeterTestwoFolders.js`
- `JmeterTestWfolders.js`
- `jmeterNFemailTracking`
- `SandboxManagement.js`
- `CreateSandbox.js`
- `DeleteSandbox.js`
- `ActionsForm.js`

Implementation plan:
1. Map each visible route and sidebar item.
2. Confirm with user which flows are production-used.
3. Consolidate duplicate JMeter screens only after tests or manual smoke steps exist.
4. Move unused components only after route/sidebar/action checks pass.

Acceptance criteria:
- No used route disappears unexpectedly.
- JMeter API key stays server-side.
- Legacy decisions are recorded in the change log.

### M12: Test Harness And Smoke Automation

Goal: Make future refactors safer.

Implementation plan:
1. Expand config safety tests.
2. Add unit tests for shared helpers as they are created.
3. Add action contract tests for high-risk actions.
4. Consider a lightweight Playwright smoke suite for:
   - sidebar render
   - API Monitor session create
   - inbound webhook log read
   - User Management auth error/missing-config path
   - Content Migrator initial load

Acceptance criteria:
- CI catches missing action files, missing direct deps, exposed blocked patterns, and broken helper contracts.
- Smoke test docs stay aligned with README.

### M13: Auth Hardening And Runtime Upgrade

Goal: Harden public actions and move Runtime off `nodejs:16` only after the refactors are stable.

Current runtime guidance:
- Node 20 reaches EOL on 2026-04-30, so it should not be the target runtime for a new migration.
- Adobe I/O Runtime currently documents Node.js 24 and Node.js 22 support.
- Preferred target: `nodejs:24`.
- Compatibility fallback: `nodejs:22` if `nodejs:24` is blocked by App Builder tooling, dependencies, or Stage smoke results.
- CI should use the same major Node line as the intended App Builder runtime once the runtime upgrade branch starts.

Implementation plan:
1. Verify Adobe I/O Runtime support at implementation time using Adobe docs and `aio app build`.
2. Audit dependencies for Node 24 compatibility, especially CommonJS actions using `node-fetch`, Azure SDK packages, Jest 27, and Parcel.
3. Review all public actions and decide which should require Adobe auth.
4. Add auth checks for public utility actions that mutate or proxy data.
5. Upgrade CI Node version to the selected target major.
6. Upgrade every action runtime in `src/dx-excshell-1/ext.config.yaml` in one isolated branch.
7. Run local tests/build and Stage smoke before production.

Acceptance criteria:
- Stage smoke passes.
- No public URL behavior changes without user approval.
- Runtime upgrade is reversible and isolated.
- Runtime target is a supported Adobe I/O Runtime kind and a supported Node LTS line.

## Individual App Plans

### App Shell, Navigation, And Home

Files:
- `App.js`
- `SideBar.js`
- `SidebarContext.js`
- `Home.js`
- `accessControl.js`

Plan:
- Use the app registry from M5.
- Remove broad console logging of runtime/IMS objects.
- Keep route paths unchanged.
- Centralize access policy names and sidebar sections.
- Add a basic route render test after the registry exists.

### AEP Overview

Files:
- `AEPOverview.js`
- `getsandboxes`
- AEP schema/dataset actions

Plan:
- Move sandbox/org config fetching to shared org config helpers.
- Normalize loading and error states.
- Add action tests for missing API key/org/token.
- Keep visible dashboard layout unchanged until data helpers are stable.

### Segment Refresh

Files:
- `SegmentRefresh.js`
- `getSegments`
- `refreshSegment`
- `getSegmentJobStatus`

Plan:
- Centralize org selection and AEP headers.
- Keep current MA1HOL/POT5HOL labels.
- Add tests for job-status polling and missing sandbox/org handling.
- Avoid changing refresh workflow until smoke-tested in Stage.

### User Management

Files:
- `UserManagement.js`
- `adobe-auth`
- `microsoft-auth`
- `ims-product-config`

Plan:
- Use backend org config resolver so frontend carries labels and `environmentKey` only.
- Cache service tokens server-side only if the cache is scoped and expires safely.
- Normalize Microsoft Graph errors for the UI.
- Move repeated local UI sections into smaller components after behavior is covered.

### Content Template Migrator

Files:
- `ContentTemplateMigrator.js`
- `content-templates`
- `get-org-sandboxes`

Plan:
- Use the same org config model as User Management.
- Keep `POT5HOL_CONTENT_*` aliases until user confirms they are no longer needed.
- Add dry-run summary for migrations before changing remote content.
- Add tests around token fetch, source list, target list, and migrate payload building.

### Campaign Trigger

Files:
- `CampaignTrigger.js`
- `campaign-trigger`

Plan:
- Completed in M1: Campaign Trigger Adobe credentials resolve from canonical MA1HOL config, with legacy `CAMPAIGN_TRIGGER_*` credential names retained as resolver aliases only.
- Keep campaign-specific `scope` and `sandbox` separate.
- Validate localStorage saved configs contain only non-secret request settings.
- Add action tests for missing config and successful trigger request with mocked fetch.

### Offer Simulator

Files:
- `OfferSimulator.js`
- `offer-simulator`

Plan:
- Move AEP/AJO header construction to shared AEP helper.
- Add fixtures for placement/decision request payloads.
- Improve frontend error display without changing workflow.

### AI Prompt Generator And Profile Injector

Files:
- `AIPromptGeneratorEnhanced.js`
- `AIPromptGenerator.js`
- `AEPProfileInjectorSimplified.js`
- `prompt-generation`
- `generateProfiles`
- `injectProfiles`

Plan:
- Centralize Azure OpenAI request helper.
- Keep prompt payload shape stable.
- Add explicit missing-config tests.
- Split huge frontend components into state hooks and presentational panels only after tests exist.

### Image Generation And Image Analysis

Files:
- `image-generation`
- `image-analysis`

Plan:
- Use shared Azure AI config helper.
- Keep text-image endpoint separation unless user approves a config rename.
- Add tests for payload validation and redacted errors.

### API Monitor

Files:
- `ApiMonitor.js`
- `api-monitor`
- `webhook-receiver`

Plan:
- Implement M3 first.
- Use stable event ids as UI row keys.
- Make live refresh visible and reliable.
- Add a manual smoke script or documented curl loop for burst testing.

Example smoke command shape:

```bash
for i in 1 2 3 4 5; do curl -s -X POST "$WEBHOOK_URL" -H 'Content-Type: application/json' -d "{\"n\":$i}" >/dev/null & done; wait
```

Expected result: inbound history shows five distinct rows.

### API Proxy

Files:
- `ProxyManager.js`
- `api-proxy`
- `session-manager`

Plan:
- Align storage with M4.
- Keep proxy config schema backwards-compatible.
- Add tests for matching proxy config, header preparation, request transform, response transform, and log redaction.
- Review public action auth later in M13.

### File Manager, Data Management, JSON Editor

Files:
- `FileManager.js`
- `DataManagement.js`
- `JsonEditor.js`
- `data-api`
- `data-api-logs`
- `upload-file`
- `check-file-exists`

Plan:
- Use shared blob helper.
- Add pagination and clearer error states.
- Keep the existing UI workflows while extracting common file-list and JSON editor panels.

### URL Shortener

Files:
- `URLShortener.js`
- `url-shortener`

Plan:
- Confirm storage backend and collision behavior.
- Add tests for create, lookup, duplicate alias, and invalid URL.
- Consider TTL/owner metadata if the app needs cleanup later.

### Crypto And Token Utilities

Files:
- `CryptoUtils.js`

Plan:
- Confirm which tools are intended for local browser-only operation.
- Avoid sending user-entered tokens to actions unless explicitly required.
- Add visible warnings only where useful and not noisy.

### JMeter

Files:
- `JmeterTesting.js`
- `JmeterTestwoFolders.js`
- `JmeterTestWfolders.js`
- `jmeterNFemailTracking`

Plan:
- Identify which of the three screens is current.
- Consolidate duplicated form/request logic after user confirms active workflow.
- Keep `JMETER_API_KEY` server-side.

### API Documentation And AI Documentation

Files:
- `ApiDocumentation.js`
- `AIApiDocumentation.js`
- `AIUserGuide.js`

Plan:
- Extract static docs data into local JSON/JS data modules.
- Keep route paths unchanged.
- Add simple render checks if the route registry is introduced.

### Sandbox Management

Files:
- `SandboxManagement.js`
- `CreateSandbox.js`
- `DeleteSandbox.js`
- `ActionsForm.js`

Plan:
- Determine whether these routes are actively used or legacy.
- If active, align with shared AEP helper.
- If legacy, document and move only after confirming no sidebar/config references depend on them.

## Recommended Sequence

Completed:
- M1: Canonical runtime config helper, credential resolver aliases, and app-owned duplicate env source dedupe.

Next recommended sequence:
1. M2: Shared Azure Blob helper.
2. M3: API Monitor inbound correctness.
3. M8: Org-specific config cluster.
4. M7: AEP backend helper cluster.
5. M5 and M6: Frontend registry and access control cleanup.
6. M9, M10, M11: Tool-specific cleanup.
7. M12: Smoke automation expansion.
8. M13: Auth hardening and Runtime upgrade.

## Change Log Rule

Every future agent session must update `docs/REFACTOR_CHANGE_LOG.md` with:

- date
- branch
- milestone
- files changed
- behavior changed or preserved
- verification commands and results
- open questions
- next recommended step
