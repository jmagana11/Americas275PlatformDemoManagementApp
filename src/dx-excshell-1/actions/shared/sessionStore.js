/*
* <license header>
*/

const SESSION_STORAGE_SCHEMA_VERSION = 1
const API_MONITOR_FEATURE = 'apiMonitor'
const API_PROXY_FEATURE = 'apiProxy'
const LEGACY_SESSION_CONTAINER_NAME = 'demos'

function ensureObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function ensureArray(value) {
  return Array.isArray(value) ? value : []
}

function getTimestamp(timestamp) {
  return timestamp || new Date().toISOString()
}

function getApiMonitorSessionBlobPath(userId, sessionId) {
  return `api-monitor/DO_NOT_DELETE_APPBUILDER_${userId}_${sessionId}.json`
}

function getApiMonitorWebhookEventPrefix(sessionId) {
  return `api-monitor/events/${sessionId}/webhooks/`
}

function getApiMonitorWebhookEventBlobPath(sessionId, webhookEntry) {
  const safeTimestamp = String(webhookEntry.timestamp || new Date().toISOString()).replace(/[:.]/g, '-')
  return `${getApiMonitorWebhookEventPrefix(sessionId)}${safeTimestamp}_${webhookEntry.webhookId}.json`
}

function getApiProxyUserSessionBlobPath(userId) {
  return `users/${userId}/sessions.json`
}

function getApiProxySessionBlobPath(sessionId) {
  return `sessions/${sessionId}/config.json`
}

function getSessionManagerBlobPath(userId) {
  return `sessions/${userId}-session.json`
}

function normalizeStorageMetadata(document = {}, options = {}) {
  const timestamp = getTimestamp(options.timestamp)
  const normalized = {
    ...ensureObject(document)
  }

  normalized.storageSchemaVersion = normalized.storageSchemaVersion || SESSION_STORAGE_SCHEMA_VERSION

  if (options.userId && !normalized.userId) {
    normalized.userId = options.userId
  }

  normalized.created = normalized.created || timestamp
  normalized.lastModified = normalized.lastModified || normalized.created || timestamp

  return normalized
}

function normalizeFeatureSessionDocument(document = {}, options = {}) {
  const normalized = normalizeStorageMetadata(document, options)
  normalized.features = ensureObject(normalized.features)
  return normalized
}

function normalizeApiProxyFeature(featureData = {}) {
  const normalized = {
    ...ensureObject(featureData)
  }

  normalized.sessions = ensureArray(normalized.sessions)
  normalized.proxyConfigs = ensureArray(normalized.proxyConfigs)
  normalized.proxyLogs = ensureArray(normalized.proxyLogs)

  return normalized
}

function normalizeApiProxyUserSessionData(document = {}, options = {}) {
  const normalized = normalizeFeatureSessionDocument(document, options)
  normalized.features[API_PROXY_FEATURE] = normalizeApiProxyFeature(normalized.features[API_PROXY_FEATURE])
  return normalized
}

function createApiProxyUserSessionData(userId, timestamp = new Date().toISOString()) {
  return normalizeApiProxyUserSessionData({
    userId,
    created: timestamp,
    lastModified: timestamp,
    features: {
      [API_PROXY_FEATURE]: {
        sessions: [],
        proxyConfigs: [],
        proxyLogs: []
      }
    }
  }, { userId, timestamp })
}

function normalizeProxySessionData(document = {}, options = {}) {
  const timestamp = getTimestamp(options.timestamp)
  const normalized = normalizeStorageMetadata(document, options)

  normalized.sessionId = normalized.sessionId || options.sessionId
  normalized.name = normalized.name || options.name

  if (normalized.config === undefined) {
    normalized.config = options.config === undefined ? null : options.config
  }

  normalized.proxyConfig = normalized.proxyConfig || normalized.config || null
  normalized.requestLogs = ensureArray(normalized.requestLogs)
  normalized.totalRequests = typeof normalized.totalRequests === 'number'
    ? normalized.totalRequests
    : normalized.requestLogs.length
  normalized.lastModified = normalized.lastModified || timestamp

  if (!normalized.lastRequestTime && normalized.requestLogs.length > 0) {
    normalized.lastRequestTime = normalized.requestLogs[0].timestamp
  }

  return normalized
}

function createProxySessionData(sessionId, userId, options = {}) {
  const timestamp = getTimestamp(options.timestamp)

  return normalizeProxySessionData({
    sessionId,
    userId,
    name: options.name,
    created: timestamp,
    lastModified: timestamp,
    config: options.config === undefined ? null : options.config,
    requestLogs: []
  }, {
    sessionId,
    userId,
    timestamp
  })
}

function normalizeApiMonitorSessionData(document = {}, options = {}) {
  const timestamp = getTimestamp(options.timestamp)
  const source = ensureObject(document)
  const sourceSession = ensureObject(source.session)
  const requestLogs = ensureArray(source.requestLogs)
  const webhookLogs = ensureArray(source.webhookLogs)
  const proxyConfigs = ensureArray(source.proxyConfigs)
  const sessionId = sourceSession.id || options.sessionId
  const userId = sourceSession.userId || options.userId || source.userId || 'default_user'
  const features = ensureObject(source.features)
  const monitorFeature = ensureObject(features[API_MONITOR_FEATURE])

  const normalized = {
    ...source,
    storageSchemaVersion: source.storageSchemaVersion || SESSION_STORAGE_SCHEMA_VERSION,
    feature: source.feature || API_MONITOR_FEATURE,
    session: {
      ...sourceSession,
      id: sessionId,
      userId,
      created: sourceSession.created || source.created || timestamp,
      requestCount: typeof sourceSession.requestCount === 'number' ? sourceSession.requestCount : requestLogs.length,
      webhookCount: typeof sourceSession.webhookCount === 'number' ? sourceSession.webhookCount : webhookLogs.length,
      lastActivity: sourceSession.lastActivity || source.lastModified || timestamp
    },
    requestLogs,
    webhookLogs,
    proxyConfigs
  }

  normalized.created = normalized.created || normalized.session.created
  normalized.lastModified = normalized.lastModified || normalized.session.lastActivity
  normalized.features = {
    ...features,
    [API_MONITOR_FEATURE]: {
      ...monitorFeature,
      sessionId: normalized.session.id,
      userId: normalized.session.userId,
      requestLogStorage: 'session.requestLogs',
      webhookEventStorage: getApiMonitorWebhookEventPrefix(normalized.session.id),
      proxyConfigStorage: 'session.proxyConfigs'
    }
  }

  return normalized
}

function createApiMonitorSessionData(sessionId, userId, timestamp = new Date().toISOString()) {
  return normalizeApiMonitorSessionData({
    session: {
      id: sessionId,
      userId,
      created: timestamp,
      requestCount: 0,
      webhookCount: 0,
      lastActivity: timestamp
    },
    requestLogs: [],
    webhookLogs: [],
    proxyConfigs: []
  }, {
    sessionId,
    userId,
    timestamp
  })
}

function listSessionEvents(sessionData, eventKey, options = {}) {
  const limit = Number(options.limit || 100)
  const events = ensureArray(sessionData && sessionData[eventKey])
  const selectedEvents = options.newestFirst
    ? events.slice(-limit).reverse()
    : events.slice(0, limit)

  return {
    events: selectedEvents,
    totalCount: events.length
  }
}

function clearSessionEvents(sessionData, eventKey) {
  const events = ensureArray(sessionData && sessionData[eventKey])
  const clearedCount = events.length
  sessionData[eventKey] = []
  return clearedCount
}

module.exports = {
  API_MONITOR_FEATURE,
  API_PROXY_FEATURE,
  LEGACY_SESSION_CONTAINER_NAME,
  SESSION_STORAGE_SCHEMA_VERSION,
  clearSessionEvents,
  createApiMonitorSessionData,
  createApiProxyUserSessionData,
  createProxySessionData,
  ensureArray,
  getApiMonitorSessionBlobPath,
  getApiMonitorWebhookEventBlobPath,
  getApiMonitorWebhookEventPrefix,
  getApiProxySessionBlobPath,
  getApiProxyUserSessionBlobPath,
  getSessionManagerBlobPath,
  listSessionEvents,
  normalizeApiMonitorSessionData,
  normalizeApiProxyUserSessionData,
  normalizeFeatureSessionDocument,
  normalizeProxySessionData
}
