const {
  API_MONITOR_FEATURE,
  API_PROXY_FEATURE,
  SESSION_STORAGE_SCHEMA_VERSION,
  clearSessionEvents,
  createApiMonitorSessionData,
  createApiProxyUserSessionData,
  createProxySessionData,
  getApiMonitorSessionBlobPath,
  getApiMonitorSessionBlobPrefix,
  getApiMonitorWebhookEventPrefix,
  getApiProxySessionBlobPath,
  getApiProxyUserSessionBlobPath,
  getSessionIdFromApiMonitorSessionBlobPath,
  getSessionManagerBlobPath,
  listSessionEvents,
  normalizeApiMonitorSessionData,
  normalizeApiProxyUserSessionData,
  normalizeFeatureSessionDocument,
  normalizeProxySessionData
} = require('../actions/shared/sessionStore')

describe('shared session storage schema helpers', () => {
  test('keeps existing storage paths stable', () => {
    expect(getApiMonitorSessionBlobPath('user-1', 'session-1')).toBe('api-monitor/DO_NOT_DELETE_APPBUILDER_user-1_session-1.json')
    expect(getApiMonitorSessionBlobPrefix('user-1')).toBe('api-monitor/DO_NOT_DELETE_APPBUILDER_user-1_')
    expect(getSessionIdFromApiMonitorSessionBlobPath('user-1', 'api-monitor/DO_NOT_DELETE_APPBUILDER_user-1_session-1.json')).toBe('session-1')
    expect(getApiMonitorWebhookEventPrefix('session-1')).toBe('api-monitor/events/session-1/webhooks/')
    expect(getApiProxyUserSessionBlobPath('user-1')).toBe('users/user-1/sessions.json')
    expect(getApiProxySessionBlobPath('session-1')).toBe('sessions/session-1/config.json')
    expect(getSessionManagerBlobPath('user-1')).toBe('sessions/user-1-session.json')
  })

  test('creates versioned API Monitor session records without dropping legacy arrays', () => {
    const sessionData = createApiMonitorSessionData('session-1', 'user-1', '2026-04-29T00:00:00.000Z')

    expect(sessionData.storageSchemaVersion).toBe(SESSION_STORAGE_SCHEMA_VERSION)
    expect(sessionData.feature).toBe(API_MONITOR_FEATURE)
    expect(sessionData.session).toMatchObject({
      id: 'session-1',
      userId: 'user-1',
      requestCount: 0,
      webhookCount: 0
    })
    expect(sessionData.requestLogs).toEqual([])
    expect(sessionData.webhookLogs).toEqual([])
    expect(sessionData.proxyConfigs).toEqual([])
    expect(sessionData.features.apiMonitor).toMatchObject({
      sessionId: 'session-1',
      requestLogStorage: 'session.requestLogs',
      webhookEventStorage: 'api-monitor/events/session-1/webhooks/'
    })
  })

  test('normalizes old API Monitor session blobs in memory', () => {
    const normalized = normalizeApiMonitorSessionData({
      session: {
        id: 'session-1',
        userId: 'user-1',
        created: '2026-04-29T00:00:00.000Z'
      },
      requestLogs: [{ requestId: 'request-1' }],
      webhookLogs: [{ webhookId: 'webhook-1' }]
    })

    expect(normalized.storageSchemaVersion).toBe(SESSION_STORAGE_SCHEMA_VERSION)
    expect(normalized.session.requestCount).toBe(1)
    expect(normalized.session.webhookCount).toBe(1)
    expect(normalized.features.apiMonitor.proxyConfigStorage).toBe('session.proxyConfigs')
  })

  test('normalizes API Proxy user session documents around the feature registry shape', () => {
    const normalized = normalizeApiProxyUserSessionData({
      userId: 'user-1',
      created: '2026-04-29T00:00:00.000Z',
      features: {
        apiProxy: {
          proxyConfigs: [{ id: 'config-1' }]
        }
      }
    })

    expect(normalized.storageSchemaVersion).toBe(SESSION_STORAGE_SCHEMA_VERSION)
    expect(normalized.features[API_PROXY_FEATURE].sessions).toEqual([])
    expect(normalized.features[API_PROXY_FEATURE].proxyConfigs).toEqual([{ id: 'config-1' }])
    expect(normalized.features[API_PROXY_FEATURE].proxyLogs).toEqual([])
  })

  test('creates versioned API Proxy user and session-level records', () => {
    const userData = createApiProxyUserSessionData('user-1', '2026-04-29T00:00:00.000Z')
    const sessionData = createProxySessionData('session-1', 'user-1', {
      name: 'Proxy test',
      config: { id: 'config-1' },
      timestamp: '2026-04-29T00:00:00.000Z'
    })

    expect(userData.storageSchemaVersion).toBe(SESSION_STORAGE_SCHEMA_VERSION)
    expect(userData.features.apiProxy).toMatchObject({
      sessions: [],
      proxyConfigs: [],
      proxyLogs: []
    })
    expect(sessionData).toMatchObject({
      storageSchemaVersion: SESSION_STORAGE_SCHEMA_VERSION,
      sessionId: 'session-1',
      userId: 'user-1',
      name: 'Proxy test',
      config: { id: 'config-1' },
      proxyConfig: { id: 'config-1' },
      requestLogs: [],
      totalRequests: 0
    })
  })

  test('normalizes old session-manager feature documents', () => {
    const normalized = normalizeFeatureSessionDocument({
      userId: 'user-1',
      features: {
        tool: { value: true }
      }
    })

    expect(normalized.storageSchemaVersion).toBe(SESSION_STORAGE_SCHEMA_VERSION)
    expect(normalized.features.tool).toEqual({ value: true })
  })

  test('lists and clears array-backed session events consistently', () => {
    const sessionData = {
      requestLogs: [
        { id: 'oldest' },
        { id: 'middle' },
        { id: 'newest' }
      ]
    }

    expect(listSessionEvents(sessionData, 'requestLogs', {
      limit: 2,
      newestFirst: true
    })).toEqual({
      events: [{ id: 'newest' }, { id: 'middle' }],
      totalCount: 3
    })
    expect(clearSessionEvents(sessionData, 'requestLogs')).toBe(3)
    expect(sessionData.requestLogs).toEqual([])
  })

  test('normalizes old API Proxy session-level blobs', () => {
    const normalized = normalizeProxySessionData({
      sessionId: 'session-1',
      userId: 'user-1',
      config: { id: 'config-1' },
      requestLogs: [{ id: 'request-1', timestamp: '2026-04-29T01:00:00.000Z' }]
    })

    expect(normalized.storageSchemaVersion).toBe(SESSION_STORAGE_SCHEMA_VERSION)
    expect(normalized.proxyConfig).toEqual({ id: 'config-1' })
    expect(normalized.totalRequests).toBe(1)
    expect(normalized.lastRequestTime).toBe('2026-04-29T01:00:00.000Z')
  })
})
