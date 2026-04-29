const { Readable } = require('stream')
const {
  clearWebhookEvents,
  findMonitorSession,
  findOrCreateMonitorSession,
  getMonitorSessionUserCandidates,
  getSessionBlobPath,
  getWebhookEventPrefix,
  listWebhookEvents,
  updateWebhookSessionSummary,
  writeMonitorSession,
  writeWebhookEvent
} = require('../actions/shared/apiMonitorStore')

function createMemoryBlobService(initialBlobs = {}) {
  const blobs = new Map(
    Object.entries(initialBlobs).map(([name, value]) => [
      name,
      typeof value === 'string' ? value : JSON.stringify(value, null, 2)
    ])
  )

  const getBlockBlobClient = jest.fn((name) => ({
    download: jest.fn(async () => {
      if (!blobs.has(name)) {
        const error = new Error('missing')
        error.code = 'BlobNotFound'
        error.statusCode = 404
        throw error
      }

      return {
        readableStreamBody: Readable.from([blobs.get(name)])
      }
    }),
    upload: jest.fn(async (content) => {
      blobs.set(name, content)
      return { etag: `"${name}"` }
    }),
    deleteIfExists: jest.fn(async () => {
      const existed = blobs.delete(name)
      return { succeeded: existed }
    })
  }))
  const listBlobsFlat = jest.fn(({ prefix }) => [...blobs.keys()]
    .filter((name) => name.startsWith(prefix))
    .sort()
    .map((name) => ({ name })))
  const getContainerClient = jest.fn(() => ({
    getBlockBlobClient,
    listBlobsFlat
  }))

  return {
    blobServiceClient: { getContainerClient },
    blobs,
    getBlockBlobClient,
    getContainerClient,
    listBlobsFlat
  }
}

function sessionData(sessionId, userId, requestCount = 0, webhookLogs = []) {
  return {
    session: {
      id: sessionId,
      userId,
      created: '2026-04-29T00:00:00.000Z',
      requestCount,
      webhookCount: webhookLogs.length,
      lastActivity: '2026-04-29T00:00:00.000Z'
    },
    requestLogs: new Array(requestCount).fill(null).map((_, index) => ({ requestId: `r-${index}` })),
    webhookLogs
  }
}

function webhookEvent(webhookId, timestamp) {
  return {
    webhookId,
    sessionId: 'session-1',
    timestamp,
    request: {
      method: 'POST',
      path: '/session-1',
      headers: {},
      query: {},
      body: { id: webhookId },
      bodySize: 12,
      clientIP: '127.0.0.1',
      userAgent: 'jest'
    },
    response: {
      status: 200,
      headers: {},
      body: { success: true }
    }
  }
}

describe('API Monitor blob storage helper', () => {
  test('uses shared user candidate lookup rules including configured org and fallbacks', () => {
    expect(getMonitorSessionUserCandidates({
      orgId: 'ABC@AdobeOrg'
    }, 'current_user')).toEqual([
      'current_user',
      'ABC_AdobeOrg',
      'user_anonymous',
      'default_user'
    ])
  })

  test('finds the best matching session across candidate user paths', async () => {
    const currentPath = getSessionBlobPath('current_user', 'session-1')
    const defaultPath = getSessionBlobPath('default_user', 'session-1')
    const mocks = createMemoryBlobService({
      [currentPath]: sessionData('session-1', 'current_user', 0),
      [defaultPath]: sessionData('session-1', 'default_user', 2)
    })

    const found = await findMonitorSession(mocks.blobServiceClient, 'session-1', {
      userId: 'current_user'
    })

    expect(found).toMatchObject({
      userId: 'default_user',
      blobPath: defaultPath,
      score: 20
    })
  })

  test('creates a session when a webhook arrives before a session blob exists', async () => {
    const mocks = createMemoryBlobService()

    const created = await findOrCreateMonitorSession(mocks.blobServiceClient, 'session-1', {
      userId: 'current_user',
      timestamp: '2026-04-29T01:00:00.000Z'
    })

    expect(created.created).toBe(true)
    expect(created.sessionData.session).toMatchObject({
      id: 'session-1',
      userId: 'current_user',
      webhookCount: 0
    })
    expect(mocks.blobs.has(getSessionBlobPath('current_user', 'session-1'))).toBe(true)
  })

  test('stores webhook events as separate blobs and lists them with legacy fallback events', async () => {
    const legacyEvent = webhookEvent('legacy', '2026-04-29T00:30:00.000Z')
    const sessionPath = getSessionBlobPath('current_user', 'session-1')
    const mocks = createMemoryBlobService({
      [sessionPath]: sessionData('session-1', 'current_user', 1, [legacyEvent])
    })
    const monitorSession = await findMonitorSession(mocks.blobServiceClient, 'session-1', {
      userId: 'current_user'
    })

    await writeWebhookEvent(mocks.blobServiceClient, webhookEvent('newer', '2026-04-29T02:00:00.000Z'))
    await writeWebhookEvent(mocks.blobServiceClient, webhookEvent('older', '2026-04-29T01:00:00.000Z'))

    const result = await listWebhookEvents(mocks.blobServiceClient, 'session-1', {
      sessionData: monitorSession.sessionData,
      limit: 10
    })

    expect(result.totalCount).toBe(3)
    expect(result.events.map((event) => event.webhookId)).toEqual(['newer', 'older', 'legacy'])
    expect([...mocks.blobs.keys()].filter((name) => name.startsWith(getWebhookEventPrefix('session-1')))).toHaveLength(2)
  })

  test('updates session summary from event blobs without appending to legacy webhookLogs', async () => {
    const legacyEvent = webhookEvent('legacy', '2026-04-29T00:30:00.000Z')
    const sessionPath = getSessionBlobPath('current_user', 'session-1')
    const mocks = createMemoryBlobService({
      [sessionPath]: sessionData('session-1', 'current_user', 1, [legacyEvent])
    })
    const monitorSession = await findMonitorSession(mocks.blobServiceClient, 'session-1', {
      userId: 'current_user'
    })

    await writeWebhookEvent(mocks.blobServiceClient, webhookEvent('newer', '2026-04-29T02:00:00.000Z'))
    const updated = await updateWebhookSessionSummary(mocks.blobServiceClient, monitorSession, {
      timestamp: '2026-04-29T02:00:00.000Z'
    })

    expect(updated.session.webhookCount).toBe(2)
    expect(updated.session.lastActivity).toBe('2026-04-29T02:00:00.000Z')
    expect(updated.webhookLogs.map((event) => event.webhookId)).toEqual(['legacy'])
  })

  test('clears event blobs and embedded legacy webhook logs for the located session only', async () => {
    const sessionPath = getSessionBlobPath('current_user', 'session-1')
    const otherSessionPath = getSessionBlobPath('current_user', 'session-2')
    const mocks = createMemoryBlobService({
      [sessionPath]: sessionData('session-1', 'current_user', 1, [
        webhookEvent('legacy', '2026-04-29T00:30:00.000Z')
      ]),
      [otherSessionPath]: sessionData('session-2', 'current_user', 0)
    })
    const monitorSession = await findMonitorSession(mocks.blobServiceClient, 'session-1', {
      userId: 'current_user'
    })

    await writeWebhookEvent(mocks.blobServiceClient, webhookEvent('newer', '2026-04-29T02:00:00.000Z'))
    await writeMonitorSession(mocks.blobServiceClient, otherSessionPath, sessionData('session-2', 'current_user', 0, [
      { ...webhookEvent('other', '2026-04-29T03:00:00.000Z'), sessionId: 'session-2' }
    ]))

    const result = await clearWebhookEvents(mocks.blobServiceClient, monitorSession, {
      timestamp: '2026-04-29T04:00:00.000Z'
    })
    const clearedSession = JSON.parse(mocks.blobs.get(sessionPath))

    expect(result.deletedCount).toBe(1)
    expect([...mocks.blobs.keys()].filter((name) => name.startsWith(getWebhookEventPrefix('session-1')))).toHaveLength(0)
    expect(clearedSession.webhookLogs).toEqual([])
    expect(clearedSession.session.webhookCount).toBe(0)
    expect(mocks.blobs.has(otherSessionPath)).toBe(true)
  })
})
