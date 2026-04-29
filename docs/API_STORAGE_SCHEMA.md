# API Monitor And API Proxy Storage Schema

This document describes the Azure Blob storage shapes used by API Monitor, API Proxy, and `session-manager`.

The M4 alignment keeps all existing blob paths stable and adds a shared metadata field to new and rewritten session documents:

```json
{
  "storageSchemaVersion": 1
}
```

Old documents without `storageSchemaVersion` are normalized in memory and rewritten with the version the next time the app updates them.

## Common Session Metadata

Feature-level session documents use this shared envelope:

```json
{
  "storageSchemaVersion": 1,
  "userId": "redacted-user",
  "created": "2026-04-29T00:00:00.000Z",
  "lastModified": "2026-04-29T00:00:00.000Z",
  "features": {}
}
```

## API Monitor Session Document

Path:

```text
api-monitor/DO_NOT_DELETE_APPBUILDER_<userId>_<sessionId>.json
```

Shape:

```json
{
  "storageSchemaVersion": 1,
  "feature": "apiMonitor",
  "session": {
    "id": "redacted-session-id",
    "userId": "redacted-user",
    "created": "2026-04-29T00:00:00.000Z",
    "requestCount": 1,
    "webhookCount": 2,
    "lastActivity": "2026-04-29T00:01:00.000Z"
  },
  "requestLogs": [
    {
      "requestId": "redacted-request-id",
      "sessionId": "redacted-session-id",
      "timestamp": "2026-04-29T00:01:00.000Z",
      "request": {
        "method": "GET",
        "url": "https://example.invalid/resource",
        "headers": {
          "authorization": "[REDACTED]"
        },
        "body": null
      },
      "response": {
        "status": 200,
        "headers": {},
        "body": {}
      },
      "responseTime": 42
    }
  ],
  "webhookLogs": [],
  "proxyConfigs": [],
  "features": {
    "apiMonitor": {
      "sessionId": "redacted-session-id",
      "userId": "redacted-user",
      "requestLogStorage": "session.requestLogs",
      "webhookEventStorage": "api-monitor/events/redacted-session-id/webhooks/",
      "proxyConfigStorage": "session.proxyConfigs"
    }
  }
}
```

Inbound webhook events are stored per event to avoid concurrent write loss.

Path:

```text
api-monitor/events/<sessionId>/webhooks/<timestamp>_<webhookId>.json
```

Shape:

```json
{
  "webhookId": "redacted-webhook-id",
  "sessionId": "redacted-session-id",
  "timestamp": "2026-04-29T00:01:00.000Z",
  "request": {
    "method": "POST",
    "path": "/redacted-session-id",
    "headers": {
      "authorization": "[REDACTED]"
    },
    "query": {},
    "body": {
      "sample": true
    },
    "bodySize": 15,
    "clientIP": "redacted-ip",
    "userAgent": "redacted-agent"
  },
  "response": {
    "status": 200,
    "headers": {},
    "body": {
      "success": true
    }
  }
}
```

## API Proxy User Session Document

Path:

```text
users/<userId>/sessions.json
```

Shape:

```json
{
  "storageSchemaVersion": 1,
  "userId": "redacted-user",
  "created": "2026-04-29T00:00:00.000Z",
  "lastModified": "2026-04-29T00:01:00.000Z",
  "features": {
    "apiProxy": {
      "sessions": [
        {
          "id": "redacted-session-id",
          "name": "Demo proxy",
          "createdAt": "2026-04-29T00:00:00.000Z",
          "lastUsed": "2026-04-29T00:01:00.000Z"
        }
      ],
      "proxyConfigs": [
        {
          "id": "redacted-config-id",
          "sessionId": "redacted-session-id",
          "name": "Demo proxy",
          "targetUrl": "https://example.invalid",
          "pathPattern": "/*",
          "method": "ALL",
          "headers": {
            "authorization": "[REDACTED]"
          },
          "transformations": {},
          "enabled": true
        }
      ],
      "proxyLogs": []
    }
  }
}
```

## API Proxy Session-Level Document

Path:

```text
sessions/<sessionId>/config.json
```

Shape:

```json
{
  "storageSchemaVersion": 1,
  "sessionId": "redacted-session-id",
  "userId": "redacted-user",
  "name": "Demo proxy",
  "created": "2026-04-29T00:00:00.000Z",
  "lastModified": "2026-04-29T00:01:00.000Z",
  "config": {
    "id": "redacted-config-id",
    "sessionId": "redacted-session-id",
    "name": "Demo proxy",
    "targetUrl": "https://example.invalid",
    "pathPattern": "/*",
    "method": "ALL",
    "headers": {
      "authorization": "[REDACTED]"
    },
    "transformations": {},
    "enabled": true
  },
  "proxyConfig": {
    "id": "redacted-config-id"
  },
  "requestLogs": [
    {
      "id": "redacted-log-id",
      "timestamp": "2026-04-29T00:01:00.000Z",
      "configId": "redacted-config-id",
      "configName": "Demo proxy",
      "originalRequest": {
        "method": "GET",
        "path": "/resource",
        "headers": {
          "authorization": "[REDACTED]"
        },
        "body": null
      },
      "targetRequest": {
        "url": "https://example.invalid/resource",
        "headers": {},
        "body": null
      },
      "response": {
        "status": 200,
        "headers": {},
        "body": "{}"
      },
      "responseTime": 42,
      "error": null
    }
  ],
  "totalRequests": 1,
  "lastRequestTime": "2026-04-29T00:01:00.000Z"
}
```

## Session Manager Document

Path:

```text
sessions/<userId>-session.json
```

Shape:

```json
{
  "storageSchemaVersion": 1,
  "userId": "redacted-user",
  "created": "2026-04-29T00:00:00.000Z",
  "lastModified": "2026-04-29T00:01:00.000Z",
  "features": {
    "featureName": {
      "lastModified": "2026-04-29T00:01:00.000Z"
    }
  }
}
```

## Migration Rules

- Existing blob paths are preserved.
- Existing top-level API Monitor arrays remain readable.
- Existing API Proxy user and session-level documents remain readable.
- Existing `session-manager` feature documents remain readable.
- New or rewritten documents include `storageSchemaVersion: 1`.
- Webhook events stay per-event. Outbound request logs and proxy request logs remain array-backed in M4 and can be moved to per-event blobs in a later milestone.
