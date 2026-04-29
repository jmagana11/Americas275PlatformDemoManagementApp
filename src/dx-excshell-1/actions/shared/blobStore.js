/*
* <license header>
*/

const { BlobServiceClient } = require('@azure/storage-blob')
const { getAzureBlobConfig } = require('./config')

const DEFAULT_CONTAINER_NAME = ''
const JSON_CONTENT_TYPE = 'application/json'
const MAX_METADATA_VALUE_LENGTH = 1024

function createBlobServiceClient(params = {}, options = {}) {
  const BlobServiceClientCtor = options.BlobServiceClient || BlobServiceClient
  const { blobUrl, sasToken } = getAzureBlobConfig(params)

  return new BlobServiceClientCtor(`${blobUrl}${sasToken}`)
}

function getContainerClient(blobServiceClient, options = {}) {
  if (!blobServiceClient || typeof blobServiceClient.getContainerClient !== 'function') {
    throw new Error('Azure BlobServiceClient is required')
  }

  return blobServiceClient.getContainerClient(options.containerName || DEFAULT_CONTAINER_NAME)
}

function getBlockBlobClient(blobServiceClient, blobPath, options = {}) {
  if (!blobPath) {
    throw new Error('blobPath is required')
  }

  const containerClient = getContainerClient(blobServiceClient, options)
  return containerClient.getBlockBlobClient(blobPath)
}

function isBlobNotFound(error) {
  return Boolean(error && (
    error.statusCode === 404 ||
    error.status === 404 ||
    error.code === 'BlobNotFound' ||
    (error.details && error.details.errorCode === 'BlobNotFound')
  ))
}

function normalizeMetadataKey(key) {
  const normalized = String(key || '').replace(/[^A-Za-z0-9_]/g, '_')
  if (!normalized) {
    return null
  }

  return /^[A-Za-z_]/.test(normalized) ? normalized : `m_${normalized}`
}

function normalizeMetadataValue(value) {
  if (value === undefined || value === null || value === '') {
    return undefined
  }

  if (typeof value === 'object') {
    return undefined
  }

  return String(value).slice(0, MAX_METADATA_VALUE_LENGTH)
}

function normalizeMetadata(metadata = {}) {
  return Object.entries(metadata).reduce((safeMetadata, [key, value]) => {
    const metadataKey = normalizeMetadataKey(key)
    const metadataValue = normalizeMetadataValue(value)

    if (metadataKey && metadataValue !== undefined) {
      safeMetadata[metadataKey] = metadataValue
    }

    return safeMetadata
  }, {})
}

function buildUploadOptions(options = {}) {
  const baseHeaders = options.blobHTTPHeaders || {}
  const blobHTTPHeaders = {
    ...baseHeaders,
    blobContentType: options.contentType || baseHeaders.blobContentType || JSON_CONTENT_TYPE
  }
  const metadata = normalizeMetadata({
    updatedAt: new Date().toISOString(),
    ...(options.metadata || {})
  })
  const uploadOptions = {
    blobHTTPHeaders
  }

  if (Object.keys(metadata).length > 0) {
    uploadOptions.metadata = metadata
  }

  if (options.conditions) {
    uploadOptions.conditions = options.conditions
  } else if (options.etag) {
    uploadOptions.conditions = { ifMatch: options.etag }
  }

  return uploadOptions
}

async function streamToString(readableStream) {
  if (!readableStream) {
    return ''
  }

  if (typeof readableStream === 'string') {
    return readableStream
  }

  if (Buffer.isBuffer(readableStream)) {
    return readableStream.toString()
  }

  return new Promise((resolve, reject) => {
    const chunks = []

    readableStream.on('data', (data) => {
      chunks.push(data.toString())
    })
    readableStream.on('end', () => {
      resolve(chunks.join(''))
    })
    readableStream.on('error', reject)
  })
}

async function readJsonBlob(blobServiceClient, blobPath, options = {}) {
  try {
    const blockBlobClient = getBlockBlobClient(blobServiceClient, blobPath, options)
    const downloadOptions = options.downloadOptions || {}
    const downloadResponse = await blockBlobClient.download(0, undefined, downloadOptions)
    const content = await streamToString(downloadResponse.readableStreamBody)
    const data = content ? JSON.parse(content) : null

    if (options.includeProperties) {
      return {
        data,
        etag: downloadResponse.etag,
        lastModified: downloadResponse.lastModified
      }
    }

    return data
  } catch (error) {
    if (isBlobNotFound(error)) {
      return options.includeProperties
        ? { data: null, etag: null, lastModified: null }
        : null
    }

    throw error
  }
}

async function writeJsonBlob(blobServiceClient, blobPath, data, options = {}) {
  const blockBlobClient = getBlockBlobClient(blobServiceClient, blobPath, options)
  const jsonContent = JSON.stringify(data, null, 2)
  const uploadOptions = buildUploadOptions(options)

  return blockBlobClient.upload(jsonContent, Buffer.byteLength(jsonContent), uploadOptions)
}

function createJsonBlobStore(params = {}, options = {}) {
  const blobServiceClient = options.blobServiceClient || createBlobServiceClient(params, options)

  return {
    blobServiceClient,
    readJson: (blobPath, readOptions = {}) => readJsonBlob(blobServiceClient, blobPath, {
      ...options,
      ...readOptions
    }),
    writeJson: (blobPath, data, writeOptions = {}) => writeJsonBlob(blobServiceClient, blobPath, data, {
      ...options,
      ...writeOptions
    })
  }
}

module.exports = {
  createBlobServiceClient,
  createJsonBlobStore,
  getBlockBlobClient,
  getContainerClient,
  isBlobNotFound,
  normalizeMetadata,
  readJsonBlob,
  streamToString,
  writeJsonBlob
}
