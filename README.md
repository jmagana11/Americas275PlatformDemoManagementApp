# Americas 275 App Builder Utility App

This repository contains an Adobe App Builder application used by the Americas 275 team for Adobe Experience Platform, Adobe Journey Optimizer, AI-assisted data generation, API monitoring, file utilities, and internal demo operations.

The app is a React Spectrum single-page application running in Experience Cloud Shell, backed by Adobe I/O Runtime web actions. It is production-sensitive: action names, web action URLs, route paths, runtime annotations, and authentication settings should be changed only through a staged release plan.

## What The App Does

- Provides AEP utilities for overview, sandbox/segment workflows, schema/dataset inspection, streaming connector operations, profile generation, profile injection, and sample data checks.
- Provides AJO utilities for content template migration, campaign trigger testing, offer simulation, and custom action API reference workflows.
- Provides AI tooling for image analysis, prompt generation, image generation, and AI-assisted profile creation.
- Provides operational utilities including API Monitor, API Proxy, URL Shortener, file upload/download, token/crypto helpers, and JMeter-related testing tools.
- Stores API Monitor and API Proxy session data in Azure Blob Storage.
- Documents API Monitor, API Proxy, and session-manager blob schemas in `docs/API_STORAGE_SCHEMA.md`.
- Stores API Monitor inbound webhook events as individual Azure Blob JSON files under the session event prefix, while keeping the session JSON blob as a compatibility and summary record.
- Resolves service credentials server-side through App Builder inputs/environment variables, not from frontend source.
- Provides non-secret organization metadata from backend config so User Management, Content Template Migrator, and Segment Refresh share one org picker model.
- Uses a shared frontend feature registry for route and sidebar metadata, plus dynamic access-control policies backed by Azure Blob Storage.
- Provides an Administration screen for managing feature access and API Monitor session descriptions for reconnecting to known session IDs.

## Architecture

```text
app.config.yaml
  -> src/dx-excshell-1/ext.config.yaml
      -> web-src/ React Spectrum SPA
      -> actions/ Adobe I/O Runtime web actions
```

### Frontend

The frontend lives under:

```text
src/dx-excshell-1/web-src
```

Important pieces:

- `appRegistry.js` defines route paths, components, sidebar sections, sidebar labels, icons, and access policy references.
- `components/App.js` renders routes from the feature registry.
- `components/SideBar.js` renders navigation groups from the feature registry.
- `index.js` uses a non-secret mock IMS profile for local raw mode so access-controlled navigation is visible when the app is opened outside Experience Cloud Shell.
- `utils/actionUrls.js` centralizes Runtime action URL generation.
- `utils/accessControl.js` gates screens by IMS/user context using backend policy results with static defaults as a fallback.
- `components/Administration.js` manages feature policy mode and allowlisted emails for every registry feature.
- `utils/orgConfig.js` centralizes frontend org picker metadata and falls back to the current MA1HOL/POT5HOL labels if backend metadata cannot load.

### Backend Actions

The Runtime actions live under:

```text
src/dx-excshell-1/actions
```

The production manifest currently declares 40 actions in:

```text
src/dx-excshell-1/ext.config.yaml
```

The first cleanup pass intentionally keeps:

- action names unchanged
- web action URLs unchanged
- UI route paths unchanged
- `require-adobe-auth` annotations unchanged
- Runtime set to `nodejs:24`

## Security And Configuration

Do not commit credentials. Use `.env` locally and repository/GitHub secrets in CI.

Use this file as the non-secret key list:

```text
.env.example
```

Important credential/config groups:

- Adobe Runtime and App Builder values: `AIO_runtime_*`
- Default AEP action credentials: `AEP_*`
- Azure Blob Storage: `AZURE_BLOB_URL`, `AZURE_SAS_TOKEN`
- Access administration: `administrator`, defaulting locally to `jmagana@adobe.com`
- Azure OpenAI and Vision: `AZURE_OPENAI_*`, `AZURE_VISION_*`
- Organization-specific configuration: `MA1HOL_*`, `POT5HOL_*`
- Campaign trigger configuration: `MA1HOL_*` Adobe credentials plus `CAMPAIGN_TRIGGER_SCOPE` and `CAMPAIGN_TRIGGER_SANDBOX`
- Shared Microsoft Graph app role: `MS_APP_ROLE_ID`

Runtime package inputs are injected into action `params` by App Builder. Logging and monitor actions must redact or filter Runtime inputs before storing or rendering captured requests.

Dynamic feature access policies are stored at:

```text
access-control/policies.json
```

The bootstrap administrator from `administrator` is always retained in the Administration allowlist.

Shared backend config resolution lives in:

```text
src/dx-excshell-1/actions/shared/config.js
```

The resolver prefers canonical env inputs and keeps older duplicate names as temporary aliases. App-owned duplicate credential env sources removed from `ext.config.yaml` include Campaign Trigger client/org credential inputs and per-org Microsoft app role ids.

Organization-specific action config is resolved server-side through the same helper. `get-org-sandboxes` can return non-secret org metadata for frontend pickers, while Adobe/Microsoft credentials remain Runtime inputs only. `POT5HOL_CONTENT_*` content-template override inputs remain supported and fall back to base `POT5HOL_*` inputs.

Shared Azure Blob helpers live in:

```text
src/dx-excshell-1/actions/shared/blobStore.js
src/dx-excshell-1/actions/shared/apiMonitorStore.js
src/dx-excshell-1/actions/shared/sessionStore.js
```

New and rewritten API Monitor, API Proxy, and session-manager session records include `storageSchemaVersion: 1`; existing records without the field remain readable and are normalized on write.

API Monitor inbound webhooks are stored per event at:

```text
api-monitor/events/<sessionId>/webhooks/
```

The older session-embedded `webhookLogs` array remains readable and clearable for compatibility with existing session blobs.

API Monitor session descriptions are stored on `session.description` in the existing session blob. Older sessions without a description display an empty value.

## Local Development

From the repository root:

```bash
nvm use
npm install
npm test -- --runInBand
aio app build
aio app run --open
```

The local app usually opens at:

```text
http://localhost:9080
```

If a previous local server is running, stop it with `Ctrl-C` before restarting.

## Testing

Run the unit/config safety suite:

```bash
npm test -- --runInBand
```

Run the direct Jest command used during cleanup:

```bash
node node_modules/jest/bin/jest.js --passWithNoTests ./test --runInBand
```

Build the App Builder app:

```bash
aio app build
```

## Local Smoke Test Checklist

Before merging or staging, test the main workflows locally:

- Home/sidebar render and protected route behavior
- AEP Overview
- Segment Refresh
- User Management Adobe auth flow
- Content Template Migrator sandbox/template flows
- AI prompt/image paths
- API Monitor webhook capture and redaction
- API Monitor session list, description edit, and Connect behavior for the current user identifier
- API Monitor inbound webhook burst capture: send at least 20 quick POST requests to the generated webhook URL, verify 20 inbound rows, clear inbound logs, then verify a second burst appears completely.
- API Proxy request logging and redaction
- File upload/download
- Campaign Trigger
- Offer Simulator
- URL Shortener

## Stage And Production Release

Use a pull request from the cleanup branch into `main`. Do not force-push over production history.

Recommended flow:

```bash
git switch codex/app-builder-spec-cleanup
npm test -- --runInBand
aio app build
git status --short
git add .
git commit -m "Clean up App Builder project structure"
git push -u origin codex/app-builder-spec-cleanup
```

Then:

1. Open a pull request into `main`.
2. Confirm CI passes.
3. Deploy to Stage.
4. Run the smoke test checklist against Stage.
5. Merge to `main` only after Stage is clean.
6. Deploy only through the manual GitHub Actions workflows or the release owner's chosen manual App Builder deploy path.

After the PR is merged:

```bash
git switch main
git pull --ff-only origin main
git branch -d codex/app-builder-spec-cleanup
```

## Follow-Up Refactors

Keep follow-up work in small PRs:

- centralize Adobe Platform auth/header helpers
- continue migrating non-API-Monitor Azure Blob actions to the shared Blob helper
- centralize JSON/error response formatting
- continue migrating action clusters to the shared Runtime config resolver
- centralize OpenAI/Azure OpenAI request handling beyond `prompt-generation`
- centralize frontend action invocation and route/sidebar metadata
- review hardening for public actions
- continue Stage smoke validation for the `nodejs:24` Runtime target, with `nodejs:22` only as a compatibility fallback

## Operational Notes

- Credential values should be managed through the proper Adobe, Azure, Microsoft, App Builder, and GitHub secret channels rather than tracked source.
- API Monitor and API Proxy should never store raw Runtime inputs or sensitive headers.
- The deployment workflows are manual by design; merging to `main` should not deploy this app by itself.
- `campaign-trigger-app/`, generated exports, `.env`, `.aio`, build output, local scratch files, and credential JSON exports are intentionally ignored.
