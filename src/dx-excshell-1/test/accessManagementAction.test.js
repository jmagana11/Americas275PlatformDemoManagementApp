jest.mock('@azure/storage-blob', () => ({
  BlobServiceClient: jest.fn()
}))

const { Readable } = require('stream')
const { BlobServiceClient } = require('@azure/storage-blob')
const { main } = require('../actions/access-management')
const { ACCESS_POLICY_BLOB_PATH } = require('../actions/shared/accessPolicyStore')
const {
  ACCESS_MODE_ALLOWLIST,
  ADMINISTRATION_FEATURE_KEY,
  DEFAULT_ADMINISTRATOR_EMAIL
} = require('../actions/shared/accessPolicy')

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
    })
  }))
  const getContainerClient = jest.fn(() => ({
    getBlockBlobClient
  }))

  return {
    blobServiceClient: { getContainerClient },
    blobs
  }
}

function paramsFor(email, overrides = {}) {
  return {
    AZURE_BLOB_URL: 'https://storage.example.test/container',
    AZURE_SAS_TOKEN: '?token=fake',
    administrator: DEFAULT_ADMINISTRATOR_EMAIL,
    userEmail: email,
    ...overrides
  }
}

describe('access-management action', () => {
  beforeEach(() => {
    BlobServiceClient.mockReset()
  })

  test('returns compact permissions for non-admin users without full policies', async () => {
    const mocks = createMemoryBlobService()
    BlobServiceClient.mockImplementation(() => mocks.blobServiceClient)

    const result = await main(paramsFor('unknown@example.com', {
      action: 'getMyAccess'
    }))

    expect(result.statusCode).toBe(200)
    expect(result.body.success).toBe(true)
    expect(result.body.isAdmin).toBe(false)
    expect(result.body.permissions.apiMonitor).toBe(true)
    expect(result.body.policyDocument).toBeUndefined()
    expect(JSON.stringify(result.body)).not.toContain('allowedEmails')
  })

  test('allows the bootstrap administrator to load policies', async () => {
    const mocks = createMemoryBlobService()
    BlobServiceClient.mockImplementation(() => mocks.blobServiceClient)

    const result = await main(paramsFor(DEFAULT_ADMINISTRATOR_EMAIL, {
      action: 'getPolicies'
    }))

    expect(result.statusCode).toBe(200)
    expect(result.body.isAdmin).toBe(true)
    expect(result.body.policyDocument.featurePolicies[ADMINISTRATION_FEATURE_KEY]).toMatchObject({
      mode: ACCESS_MODE_ALLOWLIST,
      allowedEmails: [DEFAULT_ADMINISTRATOR_EMAIL]
    })
  })

  test('rejects invalid policy saves', async () => {
    const mocks = createMemoryBlobService()
    BlobServiceClient.mockImplementation(() => mocks.blobServiceClient)

    const result = await main(paramsFor(DEFAULT_ADMINISTRATOR_EMAIL, {
      action: 'savePolicies',
      policyDocument: {
        featurePolicies: {
          apiMonitor: {
            mode: 'team',
            allowedEmails: ['bad-email']
          }
        }
      }
    }))

    expect(result.statusCode).toBe(400)
    expect(result.body.success).toBe(false)
    expect(result.body.details).toEqual(expect.arrayContaining([
      'Invalid access mode for apiMonitor: team',
      'Invalid email for apiMonitor: bad-email'
    ]))
  })

  test('saves policies while preserving the bootstrap administrator', async () => {
    const mocks = createMemoryBlobService()
    BlobServiceClient.mockImplementation(() => mocks.blobServiceClient)

    const result = await main(paramsFor(DEFAULT_ADMINISTRATOR_EMAIL, {
      action: 'savePolicies',
      policyDocument: {
        featurePolicies: {
          [ADMINISTRATION_FEATURE_KEY]: {
            mode: ACCESS_MODE_ALLOWLIST,
            allowedEmails: []
          }
        }
      }
    }))

    expect(result.statusCode).toBe(200)
    expect(result.body.policyDocument.featurePolicies[ADMINISTRATION_FEATURE_KEY].allowedEmails)
      .toContain(DEFAULT_ADMINISTRATOR_EMAIL)
    expect(JSON.parse(mocks.blobs.get(ACCESS_POLICY_BLOB_PATH)).featurePolicies[ADMINISTRATION_FEATURE_KEY].allowedEmails)
      .toContain(DEFAULT_ADMINISTRATOR_EMAIL)
  })
})
