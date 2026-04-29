jest.mock('@azure/storage-blob', () => ({
  BlobServiceClient: jest.fn()
}))

const { Readable } = require('stream')
const { BlobServiceClient } = require('@azure/storage-blob')
const {
  createBlobServiceClient,
  createJsonBlobStore,
  isBlobNotFound,
  normalizeMetadata,
  readJsonBlob,
  writeJsonBlob
} = require('../actions/shared/blobStore')

function readableJson(value) {
  return Readable.from([JSON.stringify(value)])
}

function createMockBlobClient() {
  const upload = jest.fn()
  const download = jest.fn()
  const getBlockBlobClient = jest.fn(() => ({ upload, download }))
  const getContainerClient = jest.fn(() => ({ getBlockBlobClient }))
  const blobServiceClient = { getContainerClient }

  return {
    blobServiceClient,
    download,
    getBlockBlobClient,
    getContainerClient,
    upload
  }
}

describe('shared Azure blob store helper', () => {
  beforeEach(() => {
    BlobServiceClient.mockReset()
  })

  test('creates a BlobServiceClient from Runtime Azure Blob config', () => {
    const client = { getContainerClient: jest.fn() }
    BlobServiceClient.mockImplementation(() => client)

    const result = createBlobServiceClient({
      AZURE_BLOB_URL: 'https://storage.example.test/container',
      AZURE_SAS_TOKEN: '?token=fake'
    })

    expect(result).toBe(client)
    expect(BlobServiceClient).toHaveBeenCalledWith('https://storage.example.test/container?token=fake')
  })

  test('reads JSON blobs and can return ETag metadata for conditional writes', async () => {
    const mocks = createMockBlobClient()
    const lastModified = new Date('2026-04-29T00:00:00Z')
    mocks.download.mockResolvedValue({
      readableStreamBody: readableJson({ ok: true }),
      etag: '"etag-1"',
      lastModified
    })

    const result = await readJsonBlob(mocks.blobServiceClient, 'api-monitor/session.json', {
      includeProperties: true
    })

    expect(mocks.getContainerClient).toHaveBeenCalledWith('')
    expect(mocks.getBlockBlobClient).toHaveBeenCalledWith('api-monitor/session.json')
    expect(mocks.download).toHaveBeenCalledWith(0, undefined, {})
    expect(result).toEqual({
      data: { ok: true },
      etag: '"etag-1"',
      lastModified
    })
  })

  test('returns null for missing blobs without swallowing other errors', async () => {
    const missingMocks = createMockBlobClient()
    const missingError = new Error('missing')
    missingError.code = 'BlobNotFound'
    missingMocks.download.mockRejectedValue(missingError)

    await expect(readJsonBlob(missingMocks.blobServiceClient, 'missing.json')).resolves.toBeNull()
    expect(isBlobNotFound(missingError)).toBe(true)

    const failedMocks = createMockBlobClient()
    failedMocks.download.mockRejectedValue(new Error('network failed'))

    await expect(readJsonBlob(failedMocks.blobServiceClient, 'error.json')).rejects.toThrow('network failed')
  })

  test('writes JSON blobs with content headers, safe metadata, and optional ETag conditions', async () => {
    const mocks = createMockBlobClient()
    mocks.upload.mockResolvedValue({ etag: '"etag-2"' })

    await writeJsonBlob(mocks.blobServiceClient, 'api-monitor/session.json', { ok: true }, {
      etag: '"etag-1"',
      metadata: {
        purpose: 'api-monitor-session-data',
        'bad-key': 'kept-safe',
        objectValue: { ignored: true }
      }
    })

    const [content, length, options] = mocks.upload.mock.calls[0]

    expect(content).toBe(JSON.stringify({ ok: true }, null, 2))
    expect(length).toBe(Buffer.byteLength(content))
    expect(options.blobHTTPHeaders).toEqual({
      blobContentType: 'application/json'
    })
    expect(options.metadata).toMatchObject({
      purpose: 'api-monitor-session-data',
      bad_key: 'kept-safe',
      updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
    })
    expect(options.metadata.objectValue).toBeUndefined()
    expect(options.conditions).toEqual({ ifMatch: '"etag-1"' })
  })

  test('creates a reusable JSON blob store with shared options', async () => {
    const mocks = createMockBlobClient()
    mocks.download.mockResolvedValue({
      readableStreamBody: readableJson({ stored: true })
    })
    mocks.upload.mockResolvedValue({})

    const store = createJsonBlobStore({}, {
      blobServiceClient: mocks.blobServiceClient,
      metadata: {
        purpose: 'shared-test'
      }
    })

    await expect(store.readJson('shared/path.json')).resolves.toEqual({ stored: true })
    await store.writeJson('shared/path.json', { stored: true })

    expect(store.blobServiceClient).toBe(mocks.blobServiceClient)
    expect(mocks.upload.mock.calls[0][2].metadata.purpose).toBe('shared-test')
  })

  test('normalizes metadata keys and skips unsupported values', () => {
    expect(normalizeMetadata({
      '1-starts-with-number': 'value',
      'has-dash': 'value',
      empty: '',
      object: { nested: true }
    })).toEqual({
      m_1_starts_with_number: 'value',
      has_dash: 'value'
    })
  })
})
