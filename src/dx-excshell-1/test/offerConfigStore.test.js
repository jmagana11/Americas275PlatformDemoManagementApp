const { Readable } = require('stream')
const {
  deleteOfferConfig,
  getDraftConfigPath,
  getPublishedConfigPath,
  getPublishedOfferConfig,
  listOfferConfigs,
  publishOfferConfig,
  saveOfferConfig,
  unpublishOfferConfig
} = require('../actions/shared/offerConfigStore')
const {
  DEFAULT_PERSONALIZATION_SCHEMAS
} = require('../actions/shared/offerDecisioning')

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
    blobs
  }
}

const owner = {
  orgId: 'org-1',
  userId: 'user-1'
}

const baseConfig = {
  id: 'config-1',
  name: 'Homepage offer',
  edge: {
    datastreamId: 'datastream-1',
    identityNamespace: 'ECID',
    mode: 'decisionScopes',
    decisionScopes: ['scope-1'],
    surfaces: [],
    schemas: ['schema-1'],
    contextTenantField: '_adobedemoamericas275',
    xdmDefaults: {
      _adobedemoamericas275: {
        web: {
          webPageDetails: {
            name: 'home'
          }
        }
      }
    },
    preserveState: true
  },
  template: {
    type: 'card',
    fieldMappings: {
      title: 'parsedContent.title'
    }
  }
}

describe('Offer config Azure Blob store', () => {
  test('saves, lists, and reads draft configs under owner paths', async () => {
    const mocks = createMemoryBlobService()
    const result = await saveOfferConfig(mocks.blobServiceClient, baseConfig, owner, {
      timestamp: '2026-06-03T12:00:00.000Z'
    })
    const path = getDraftConfigPath(owner.orgId, owner.userId, 'config-1')

    expect(result.blobPath).toBe(path)
    expect(mocks.blobs.has(path)).toBe(true)
    expect(result.config.edge.schemas).toEqual(DEFAULT_PERSONALIZATION_SCHEMAS)
    expect(result.config.edge.contextTenantField).toBe('_adobedemoamericas275')

    const configs = await listOfferConfigs(mocks.blobServiceClient, owner)
    expect(configs).toEqual([expect.objectContaining({
      id: 'config-1',
      name: 'Homepage offer',
      mode: 'decisionScopes',
      datastreamId: 'datastream-1',
      templateType: 'card'
    })])
  })

  test('publishes and unpublishes without keeping owner-only state in the public config', async () => {
    const mocks = createMemoryBlobService()
    await saveOfferConfig(mocks.blobServiceClient, baseConfig, owner, {
      timestamp: '2026-06-03T12:00:00.000Z'
    })

    const published = await publishOfferConfig(mocks.blobServiceClient, 'config-1', owner, {
      timestamp: '2026-06-03T12:05:00.000Z'
    })
    const publicId = published.publishedConfig.publicId
    const publicPath = getPublishedConfigPath(publicId)

    expect(mocks.blobs.has(publicPath)).toBe(true)
    expect(published.config.publish).toMatchObject({
      enabled: true,
      publicId,
      publishedAt: '2026-06-03T12:05:00.000Z'
    })

    const publicConfig = await getPublishedOfferConfig(mocks.blobServiceClient, publicId)
    expect(publicConfig.ownerUserId).toBeUndefined()
    expect(publicConfig.edge.datastreamId).toBe('datastream-1')
    expect(publicConfig.template.type).toBe('card')

    const unpublished = await unpublishOfferConfig(mocks.blobServiceClient, 'config-1', owner, {
      timestamp: '2026-06-03T12:10:00.000Z'
    })

    expect(mocks.blobs.has(publicPath)).toBe(false)
    expect(unpublished.publish).toEqual({
      enabled: false,
      publicId: null,
      publishedAt: null
    })
  })

  test('deletes draft configs and any published public copy', async () => {
    const mocks = createMemoryBlobService()
    await saveOfferConfig(mocks.blobServiceClient, baseConfig, owner)
    const published = await publishOfferConfig(mocks.blobServiceClient, 'config-1', owner)
    const publicPath = getPublishedConfigPath(published.publishedConfig.publicId)
    const draftPath = getDraftConfigPath(owner.orgId, owner.userId, 'config-1')

    await deleteOfferConfig(mocks.blobServiceClient, 'config-1', owner)

    expect(mocks.blobs.has(draftPath)).toBe(false)
    expect(mocks.blobs.has(publicPath)).toBe(false)
  })
})
