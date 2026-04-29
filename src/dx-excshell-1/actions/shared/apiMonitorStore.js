/*
* <license header>
*/

const {
  deleteBlobsByPrefix,
  readJsonBlob,
  readJsonBlobsByPrefix,
  writeJsonBlob
} = require('./blobStore')
const { redactObject } = require('./redaction')
const {
  clearSessionEvents,
  createApiMonitorSessionData,
  getApiMonitorSessionBlobPath,
  getApiMonitorWebhookEventBlobPath,
  getApiMonitorWebhookEventPrefix,
  listSessionEvents,
  normalizeApiMonitorSessionData
} = require('./sessionStore')

const SESSION_BLOB_METADATA = Object.freeze({
  purpose: 'api-monitor-session-data'
})
const WEBHOOK_EVENT_METADATA = Object.freeze({
  purpose: 'api-monitor-webhook-event'
})

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function sanitizeUserId(userId) {
  return String(userId || '').replace(/[^a-zA-Z0-9]/g, '_')
}

function getSessionBlobPath(userId, sessionId) {
  return getApiMonitorSessionBlobPath(userId, sessionId)
}

function getWebhookEventPrefix(sessionId) {
  return getApiMonitorWebhookEventPrefix(sessionId)
}

function getWebhookEventBlobPath(sessionId, webhookEntry) {
  return getApiMonitorWebhookEventBlobPath(sessionId, webhookEntry)
}

function getConfiguredOrgUserIds(params = {}) {
  const configuredOrgId = params.orgId || process.env.AEP_ORG_ID || ''
  return unique([
    configuredOrgId.replace('@', '_'),
    sanitizeUserId(configuredOrgId)
  ])
}

function getMonitorSessionUserCandidates(params = {}, userId) {
  return unique([
    userId,
    ...getConfiguredOrgUserIds(params),
    'user_anonymous',
    'default_user'
  ])
}

function scoreSessionData(sessionData) {
  if (!sessionData) {
    return -1
  }

  const session = sessionData.session || {}
  const requestCount = session.requestCount || (sessionData.requestLogs || []).length || 0
  const webhookCount = session.webhookCount || (sessionData.webhookLogs || []).length || 0

  return requestCount * 10 + webhookCount
}

async function findMonitorSession(blobServiceClient, sessionId, options = {}) {
  const candidates = getMonitorSessionUserCandidates(options.params, options.userId)
  let bestSession = null

  for (const candidateUserId of candidates) {
    const blobPath = getSessionBlobPath(candidateUserId, sessionId)
    const rawSessionData = await readJsonBlob(blobServiceClient, blobPath)

    if (!rawSessionData) {
      continue
    }

    const sessionData = normalizeApiMonitorSessionData(rawSessionData, {
      sessionId,
      userId: candidateUserId
    })
    const score = scoreSessionData(sessionData)
    if (!bestSession || score > bestSession.score) {
      bestSession = {
        sessionData,
        userId: candidateUserId,
        blobPath,
        score
      }
    }
  }

  return bestSession
}

function createMonitorSessionData(sessionId, userId, timestamp = new Date().toISOString()) {
  return createApiMonitorSessionData(sessionId, userId, timestamp)
}

async function writeMonitorSession(blobServiceClient, blobPath, sessionData, options = {}) {
  const normalizedSessionData = normalizeApiMonitorSessionData(sessionData, {
    sessionId: sessionData && sessionData.session && sessionData.session.id,
    userId: sessionData && sessionData.session && sessionData.session.userId,
    timestamp: options.timestamp
  })
  normalizedSessionData.lastModified = options.timestamp ||
    normalizedSessionData.session.lastActivity ||
    new Date().toISOString()

  return writeJsonBlob(blobServiceClient, blobPath, normalizedSessionData, {
    ...options,
    metadata: {
      ...SESSION_BLOB_METADATA,
      ...(options.metadata || {})
    }
  })
}

async function findOrCreateMonitorSession(blobServiceClient, sessionId, options = {}) {
  const foundSession = await findMonitorSession(blobServiceClient, sessionId, options)
  if (foundSession) {
    return {
      ...foundSession,
      created: false
    }
  }

  const timestamp = options.timestamp || new Date().toISOString()
  const userId = options.userId || 'default_user'
  const blobPath = getSessionBlobPath(userId, sessionId)
  const sessionData = createMonitorSessionData(sessionId, userId, timestamp)

  await writeMonitorSession(blobServiceClient, blobPath, sessionData)

  return {
    sessionData,
    userId,
    blobPath,
    score: 0,
    created: true
  }
}

async function writeWebhookEvent(blobServiceClient, webhookEntry, options = {}) {
  const blobPath = getWebhookEventBlobPath(webhookEntry.sessionId, webhookEntry)

  await writeJsonBlob(blobServiceClient, blobPath, webhookEntry, {
    ...options,
    metadata: {
      ...WEBHOOK_EVENT_METADATA,
      sessionId: webhookEntry.sessionId,
      webhookId: webhookEntry.webhookId,
      ...(options.metadata || {})
    }
  })

  return blobPath
}

function dedupeWebhookEvents(events) {
  const byId = new Map()

  for (const event of events) {
    if (!event) {
      continue
    }

    const key = event.webhookId || `${event.timestamp}:${event.request && event.request.path}`
    byId.set(key, event)
  }

  return [...byId.values()]
}

function sortWebhookEventsNewestFirst(events) {
  return [...events].sort((left, right) => {
    const leftTime = new Date(left.timestamp || 0).getTime()
    const rightTime = new Date(right.timestamp || 0).getTime()
    return rightTime - leftTime
  })
}

async function listWebhookEvents(blobServiceClient, sessionId, options = {}) {
  const prefix = getWebhookEventPrefix(sessionId)
  const eventBlobs = await readJsonBlobsByPrefix(blobServiceClient, prefix, options)
  const storedEvents = eventBlobs.map((entry) => entry.data)
  const legacyEvents = options.includeLegacy === false
    ? []
    : ((options.sessionData && options.sessionData.webhookLogs) || [])
  const events = sortWebhookEventsNewestFirst(dedupeWebhookEvents([
    ...legacyEvents,
    ...storedEvents
  ]))
  const limit = Number(options.limit || 100)

  return {
    events: redactObject(events.slice(0, limit)),
    totalCount: events.length
  }
}

async function clearWebhookEvents(blobServiceClient, monitorSession, options = {}) {
  const timestamp = options.timestamp || new Date().toISOString()
  const sessionData = monitorSession.sessionData
  const deleteResult = await deleteBlobsByPrefix(blobServiceClient, getWebhookEventPrefix(sessionData.session.id), options)

  sessionData.webhookLogs = []
  sessionData.session.webhookCount = 0
  sessionData.session.lastActivity = timestamp

  await writeMonitorSession(blobServiceClient, monitorSession.blobPath, sessionData)

  return deleteResult
}

function listMonitorRequestEvents(sessionData, options = {}) {
  const { events, totalCount } = listSessionEvents(sessionData, 'requestLogs', {
    ...options,
    newestFirst: true
  })

  return {
    events: redactObject(events),
    totalCount
  }
}

async function clearMonitorRequestEvents(blobServiceClient, monitorSession, options = {}) {
  const timestamp = options.timestamp || new Date().toISOString()
  const sessionData = monitorSession.sessionData
  const clearedCount = clearSessionEvents(sessionData, 'requestLogs')

  sessionData.session.requestCount = 0
  sessionData.session.lastActivity = timestamp

  await writeMonitorSession(blobServiceClient, monitorSession.blobPath, sessionData)

  return {
    clearedCount
  }
}

async function updateWebhookSessionSummary(blobServiceClient, monitorSession, options = {}) {
  const timestamp = options.timestamp || new Date().toISOString()
  const latestSessionData = normalizeApiMonitorSessionData(
    await readJsonBlob(blobServiceClient, monitorSession.blobPath) || monitorSession.sessionData,
    {
      sessionId: monitorSession.sessionData.session.id,
      userId: monitorSession.sessionData.session.userId,
      timestamp
    }
  )
  const { totalCount } = await listWebhookEvents(blobServiceClient, latestSessionData.session.id, {
    sessionData: latestSessionData
  })

  latestSessionData.session.webhookCount = totalCount
  latestSessionData.session.lastActivity = timestamp

  await writeMonitorSession(blobServiceClient, monitorSession.blobPath, latestSessionData)

  return latestSessionData
}

module.exports = {
  clearMonitorRequestEvents,
  clearWebhookEvents,
  createMonitorSessionData,
  findMonitorSession,
  findOrCreateMonitorSession,
  getMonitorSessionUserCandidates,
  getSessionBlobPath,
  getWebhookEventBlobPath,
  getWebhookEventPrefix,
  listMonitorRequestEvents,
  listWebhookEvents,
  sanitizeUserId,
  updateWebhookSessionSummary,
  writeMonitorSession,
  writeWebhookEvent
}
