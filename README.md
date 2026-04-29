# Americas 275 App Builder Utility App

This repository contains an Adobe App Builder application used by the Americas 275 team for Adobe Experience Platform, Adobe Journey Optimizer, AI-assisted data generation, API monitoring, file utilities, and internal demo operations.

The app is a React Spectrum single-page application running in Experience Cloud Shell, backed by Adobe I/O Runtime web actions. It is production-sensitive: action names, web action URLs, route paths, runtime annotations, and authentication settings should be changed only through a staged release plan.

## What The App Does

- Provides AEP utilities for overview, sandbox/segment workflows, schema/dataset inspection, streaming connector operations, profile generation, profile injection, and sample data checks.
- Provides AJO utilities for content template migration, campaign trigger testing, offer simulation, and custom action API reference workflows.
- Provides AI tooling for image analysis, prompt generation, image generation, and AI-assisted profile creation.
- Provides operational utilities including API Monitor, API Proxy, URL Shortener, file upload/download, token/crypto helpers, and JMeter-related testing tools.
- Stores API Monitor and API Proxy session data in Azure Blob Storage.
- Resolves service credentials server-side through App Builder inputs/environment variables, not from frontend source.

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

- `components/App.js` defines the route map.
- `components/SideBar.js` defines the main navigation groups.
- `utils/actionUrls.js` centralizes Runtime action URL generation.
- `utils/accessControl.js` gates protected screens by IMS/user context.

### Backend Actions

The Runtime actions live under:

```text
src/dx-excshell-1/actions
```

The production manifest currently declares 39 actions in:

```text
src/dx-excshell-1/ext.config.yaml
```

The first cleanup pass intentionally keeps:

- action names unchanged
- web action URLs unchanged
- UI route paths unchanged
- `require-adobe-auth` annotations unchanged
- Runtime set to `nodejs:16`

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
- Azure OpenAI and Vision: `AZURE_OPENAI_*`, `AZURE_VISION_*`
- Organization-specific configuration: `MA1HOL_*`, `POT5HOL_*`
- Campaign trigger configuration: `CAMPAIGN_TRIGGER_*`

Runtime package inputs are injected into action `params` by App Builder. Logging and monitor actions must redact or filter Runtime inputs before storing or rendering captured requests.

## Local Development

From the repository root:

```bash
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
6. Keep production deployment manual unless the release owner explicitly approves automatic production deploy behavior.

After the PR is merged:

```bash
git switch main
git pull --ff-only origin main
git branch -d codex/app-builder-spec-cleanup
```

## Follow-Up Refactors

Keep follow-up work in small PRs:

- centralize Adobe Platform auth/header helpers
- centralize Azure Blob client creation
- centralize JSON/error response formatting
- centralize OpenAI/Azure OpenAI request handling
- centralize frontend action invocation and route/sidebar metadata
- review hardening for public actions
- plan a separate Runtime upgrade from `nodejs:16` to `nodejs:20`

## Operational Notes

- Existing credential-like values that were visible in local testing should be considered exposed and rotated through the proper Adobe, Azure, Microsoft, and GitHub secret channels.
- API Monitor and API Proxy should never store raw Runtime inputs or sensitive headers.
- `campaign-trigger-app/`, generated exports, `.env`, `.aio`, build output, local scratch files, and credential JSON exports are intentionally ignored.
