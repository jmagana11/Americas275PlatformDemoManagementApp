# Custom Action API v2

Generic dataset-backed APIs for Adobe Journey Optimizer Custom Actions. Legacy `mode` + `filename` requests on `data-api` are unchanged.

## Blob layout

```text
custom-actions/{userKey}/{datasetId}/manifest.json
custom-actions/{userKey}/{datasetId}/data.csv
custom-actions/{userKey}/{datasetId}/logs/{requestId}.json
```

`userKey` is a SHA-256 prefix derived from IMS email or user id.

## Runtime operations

### `upload-file`

| operation | Purpose |
|-----------|---------|
| `create` | Upload rows (`fileData`), optional `name`, `primaryKey`, `ownerEmail` |
| `list` | List datasets for the current user |
| `delete` | Delete dataset (`datasetId`) |

Legacy uploads still use `fileData` + `fileType` without `operation`.

### `data-api`

v2 body:

```json
{
  "datasetId": "uuid",
  "datasetToken": "uuid",
  "where": { "column": "customer_id", "op": "eq", "value": "CUST-001" },
  "limit": 1,
  "format": "object"
}
```

Filter operators: `eq`, `ne`, `contains`, `in`, `gt`, `gte`, `lt`, `lte`.

Response formats: `object` (first row), `array` (all matches within limit).

### `data-api-logs`

Pass `datasetId` to read per-dataset logs. Omit for legacy global `logs/data-api-logs.json`.

## AJO endpoint

Configure the Custom Action as **HTTP POST** to the deployed `data-api` web action (from App Builder `config.json`):

```text
POST https://{namespace}.adobeioruntime.net/api/v1/web/dx-excshell-1/data-api
```

Headers: `Content-Type: application/json`. The in-app **Custom Action APIs** screen (`/ApiDocumentation`) shows the URL for your environment and supports copy for URL and request body.

Force a deploy after backend changes when Exchange publish would otherwise block:

```bash
aio app deploy --force-deploy
```

## UI

Route `/ApiDocumentation` (sidebar: **Custom Action APIs**) uses `CustomActionApis.js`: upload CSV, manage datasets, test filters, copy AJO payload, and view activity logs. Legacy `ApiDocumentation.js` is unused but kept for reference.

## AJO Custom Action

1. Create a dataset in the app (Custom Action APIs screen).
2. Copy the generated POST URL and JSON body (includes `datasetToken`).
3. Map filter values to `${profile...}` or `${event...}` expressions as needed.
4. Test from the app, then configure the Custom Action in AJO with the same body shape.

Owners may call `data-api` without `datasetToken` when IMS identity matches the dataset owner. Public journey calls should always send `datasetToken`.
