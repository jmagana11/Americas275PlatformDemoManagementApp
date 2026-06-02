/*
* <license header>
*/

const crypto = require('crypto')
const { v4: uuidv4 } = require('uuid')
const {
  createBlobServiceClient,
  deleteBlobsByPrefix,
  getBlockBlobClient,
  isBlobNotFound,
  listBlobsByPrefix,
  readJsonBlob,
  streamToString,
  writeJsonBlob
} = require('./blobStore')

const STORAGE_SCHEMA_VERSION = 1
const MAX_UPLOAD_ROWS = 10000
const MAX_QUERY_LIMIT = 100
const DEFAULT_QUERY_LIMIT = 10
const ROOT_PREFIX = 'custom-actions'

function resolveUserKey(headers = {}, params = {}) {
  const email = (
    params.ownerEmail ||
    params.userEmail ||
    headers['x-ims-email'] ||
    headers['x-gw-ims-email'] ||
    ''
  ).toString().trim().toLowerCase()

  if (email) {
    return crypto.createHash('sha256').update(email).digest('hex').slice(0, 32)
  }

  const userId = (
    headers['x-ims-user-id'] ||
    headers['x-gw-ims-user-id'] ||
    params.userId ||
    ''
  ).toString().trim()

  if (userId) {
    return crypto.createHash('sha256').update(userId).digest('hex').slice(0, 32)
  }

  return 'anonymous'
}

function getDatasetBasePath(userKey, datasetId) {
  return `${ROOT_PREFIX}/${userKey}/${datasetId}`
}

function getManifestPath(userKey, datasetId) {
  return `${getDatasetBasePath(userKey, datasetId)}/manifest.json`
}

function getDataPath(userKey, datasetId) {
  return `${getDatasetBasePath(userKey, datasetId)}/data.csv`
}

function getLogPath(userKey, datasetId, requestId) {
  return `${getDatasetBasePath(userKey, datasetId)}/logs/${requestId}.json`
}

function jsonToCsv(rows) {
  if (!rows || rows.length === 0) {
    return ''
  }

  const headers = Object.keys(rows[0])
  const lines = [headers.join(',')]

  for (const row of rows) {
    lines.push(headers.map((header) => formatCsvValue(row[header])).join(','))
  }

  return lines.join('\n')
}

function formatCsvValue(value) {
  if (value === undefined || value === null) {
    return ''
  }

  const stringValue = String(value)
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }

  return stringValue
}

function parseCsvLine(line) {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  result.push(current.trim())
  return result
}

function csvToJson(csvContent) {
  const lines = csvContent.split('\n').map((line) => line.trim()).filter(Boolean)
  if (lines.length === 0) {
    return []
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.replace(/^"|"$/g, ''))
  const rows = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i])
    if (values.length < headers.length) {
      continue
    }

    const row = {}
    headers.forEach((header, index) => {
      row[header] = values[index] || ''
    })
    rows.push(row)
  }

  return rows
}

function normalizeRows(fileData) {
  if (!Array.isArray(fileData) || fileData.length === 0) {
    throw new Error('fileData must be a non-empty array of row objects')
  }

  const rows = fileData.map((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error('Each row must be an object')
    }
    return Object.entries(row).reduce((normalized, [key, value]) => {
      normalized[String(key).trim()] = value === undefined || value === null ? '' : String(value)
      return normalized
    }, {})
  })

  if (rows.length > MAX_UPLOAD_ROWS) {
    throw new Error(`CSV exceeds maximum of ${MAX_UPLOAD_ROWS} rows`)
  }

  return rows
}

function compareValues(cellValue, filterValue, op) {
  const left = String(cellValue === undefined || cellValue === null ? '' : cellValue).trim()
  const right = String(filterValue === undefined || filterValue === null ? '' : filterValue).trim()
  const leftLower = left.toLowerCase()
  const rightLower = right.toLowerCase()

  switch (op) {
    case 'eq':
      return leftLower === rightLower
    case 'ne':
      return leftLower !== rightLower
    case 'contains':
      return leftLower.includes(rightLower)
    case 'in': {
      const values = Array.isArray(filterValue)
        ? filterValue.map((item) => String(item).trim().toLowerCase())
        : rightLower.split(',').map((item) => item.trim()).filter(Boolean)
      return values.includes(leftLower)
    }
    case 'gt':
      return Number(left) > Number(right)
    case 'gte':
      return Number(left) >= Number(right)
    case 'lt':
      return Number(left) < Number(right)
    case 'lte':
      return Number(left) <= Number(right)
    default:
      throw new Error(`Unsupported filter operator: ${op}`)
  }
}

function applyWhere(rows, where) {
  if (!where || !where.column) {
    return rows
  }

  const column = String(where.column).trim()
  const op = where.op || 'eq'
  const value = where.value

  return rows.filter((row) => compareValues(row[column], value, op))
}

function applyFields(rows, fields) {
  if (!Array.isArray(fields) || fields.length === 0) {
    return rows
  }

  const selected = fields.map((field) => String(field).trim()).filter(Boolean)
  return rows.map((row) => selected.reduce((projected, field) => {
    projected[field] = row[field]
    return projected
  }, {}))
}

function formatQueryResult(rows, format) {
  if (format === 'object') {
    return rows.length > 0 ? rows[0] : null
  }

  return rows
}

function buildAjoSnippet(datasetId, defaultQuery, datasetToken) {
  const body = {
    datasetId,
    ...defaultQuery
  }

  if (datasetToken) {
    body.datasetToken = datasetToken
  }

  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body
  }
}

function queryRows(rows, options = {}) {
  const limit = Math.min(
    Math.max(parseInt(options.limit, 10) || DEFAULT_QUERY_LIMIT, 1),
    MAX_QUERY_LIMIT
  )
  const offset = Math.max(parseInt(options.offset, 10) || 0, 0)
  const format = options.format || 'array'

  let filtered = applyWhere(rows, options.where)
  filtered = applyFields(filtered, options.fields)
  const totalMatches = filtered.length
  filtered = filtered.slice(offset, offset + limit)

  return {
    success: true,
    data: formatQueryResult(filtered, format),
    meta: {
      totalMatches,
      returned: format === 'object' ? (filtered.length > 0 ? 1 : 0) : filtered.length,
      limit,
      offset,
      format
    }
  }
}

async function readCsvRows(blobServiceClient, userKey, datasetId) {
  const blockBlobClient = getBlockBlobClient(blobServiceClient, getDataPath(userKey, datasetId))
  const downloadResponse = await blockBlobClient.download(0)
  const csvContent = await streamToString(downloadResponse.readableStreamBody)
  return csvToJson(csvContent)
}

async function readManifest(blobServiceClient, userKey, datasetId) {
  return readJsonBlob(blobServiceClient, getManifestPath(userKey, datasetId))
}

async function writeManifest(blobServiceClient, manifest) {
  await writeJsonBlob(blobServiceClient, getManifestPath(manifest.userKey, manifest.datasetId), manifest)
}

async function writeCsv(blobServiceClient, userKey, datasetId, rows) {
  const csvContent = jsonToCsv(rows)
  const blockBlobClient = getBlockBlobClient(blobServiceClient, getDataPath(userKey, datasetId))
  await blockBlobClient.upload(csvContent, Buffer.byteLength(csvContent), {
    blobHTTPHeaders: {
      blobContentType: 'text/csv'
    }
  })
}

async function createDataset(params, input = {}) {
  const headers = params.__ow_headers || {}

  let blobServiceClient
  try {
    blobServiceClient = createBlobServiceClient(params)
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Azure Blob Storage is not configured'
    }
  }

  const userKey = resolveUserKey(headers, params)
  const ownerEmail = (input.ownerEmail || params.ownerEmail || params.userEmail || '').toString().trim()
  const rows = normalizeRows(input.fileData)
  const columns = Object.keys(rows[0])
  const datasetId = uuidv4()
  const datasetToken = uuidv4()
  const primaryKey = input.primaryKey && columns.includes(input.primaryKey)
    ? input.primaryKey
    : (columns[0] || null)

  const defaultQuery = {
    where: primaryKey
      ? {
        column: primaryKey,
        op: 'eq',
        value: '${profile.identityMap.Email}'
      }
      : undefined,
    limit: 1,
    format: 'object'
  }

  if (!defaultQuery.where) {
    delete defaultQuery.where
  }

  const manifest = {
    storageSchemaVersion: STORAGE_SCHEMA_VERSION,
    datasetId,
    datasetToken,
    userKey,
    name: (input.name || params.name || `dataset-${datasetId.slice(0, 8)}`).toString().trim(),
    ownerEmail,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    columns,
    rowCount: rows.length,
    primaryKey,
    defaultQuery,
    ajoSnippet: buildAjoSnippet(datasetId, defaultQuery, datasetToken)
  }

  await writeCsv(blobServiceClient, userKey, datasetId, rows)
  await writeManifest(blobServiceClient, manifest)

  return {
    success: true,
    dataset: {
      datasetId,
      datasetToken,
      name: manifest.name,
      columns,
      rowCount: manifest.rowCount,
      primaryKey,
      defaultQuery,
      ajoSnippet: manifest.ajoSnippet,
      created: manifest.created
    }
  }
}

async function listDatasets(params) {
  const headers = params.__ow_headers || {}
  const userKey = resolveUserKey(headers, params)

  let blobServiceClient
  try {
    blobServiceClient = createBlobServiceClient(params)
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Azure Blob Storage is not configured'
    }
  }
  const prefix = `${ROOT_PREFIX}/${userKey}/`
  const blobs = await listBlobsByPrefix(blobServiceClient, prefix)
  const manifestPaths = blobs
    .map((blob) => blob.name)
    .filter((name) => name.endsWith('/manifest.json'))

  const datasets = []

  for (const manifestPath of manifestPaths) {
    const manifest = await readJsonBlob(blobServiceClient, manifestPath)
    if (!manifest) {
      continue
    }

    datasets.push({
      datasetId: manifest.datasetId,
      datasetToken: manifest.datasetToken,
      name: manifest.name,
      columns: manifest.columns,
      rowCount: manifest.rowCount,
      primaryKey: manifest.primaryKey,
      created: manifest.created,
      updated: manifest.updated
    })
  }

  datasets.sort((a, b) => new Date(b.updated || b.created) - new Date(a.updated || a.created))

  return {
    success: true,
    datasets
  }
}

async function deleteDataset(params) {
  const headers = params.__ow_headers || {}
  const userKey = resolveUserKey(headers, params)
  const datasetId = (params.datasetId || '').toString().trim()

  if (!datasetId) {
    throw new Error('datasetId is required')
  }

  const blobServiceClient = createBlobServiceClient(params)
  const manifest = await readManifest(blobServiceClient, userKey, datasetId)

  if (!manifest) {
    return {
      success: false,
      error: 'Dataset not found'
    }
  }

  await deleteBlobsByPrefix(blobServiceClient, `${getDatasetBasePath(userKey, datasetId)}/`)

  return {
    success: true,
    datasetId
  }
}

async function loadDatasetForQuery(params) {
  const headers = params.__ow_headers || {}
  const datasetId = (params.datasetId || '').toString().trim()

  if (!datasetId) {
    throw new Error('datasetId is required')
  }

  const blobServiceClient = createBlobServiceClient(params)
  const blobs = await listBlobsByPrefix(blobServiceClient, `${ROOT_PREFIX}/`)
  const manifestPaths = blobs
    .map((blob) => blob.name)
    .filter((name) => name.endsWith(`/${datasetId}/manifest.json`))

  if (manifestPaths.length === 0) {
    throw new Error('Dataset not found')
  }

  const manifestPath = manifestPaths[0]
  const userKey = manifestPath.split('/')[1]
  const manifest = await readJsonBlob(blobServiceClient, manifestPath)

  if (!manifest) {
    throw new Error('Dataset not found')
  }

  const providedToken = (params.datasetToken || headers['x-dataset-token'] || '').toString().trim()
  if (manifest.datasetToken && manifest.datasetToken !== providedToken) {
    const requesterKey = resolveUserKey(headers, params)
    if (requesterKey !== userKey) {
      throw new Error('Invalid dataset token')
    }
  }

  const rows = await readCsvRows(blobServiceClient, userKey, datasetId)
  return { manifest, rows, userKey }
}

async function queryDataset(params) {
  const { manifest, rows } = await loadDatasetForQuery(params)
  const result = queryRows(rows, {
    where: params.where || manifest.defaultQuery?.where,
    limit: params.limit ?? manifest.defaultQuery?.limit,
    offset: params.offset,
    format: params.format || manifest.defaultQuery?.format,
    fields: params.fields
  })

  return {
    ...result,
    datasetId: manifest.datasetId,
    datasetName: manifest.name
  }
}

async function appendDatasetLog(params, logEntry) {
  try {
    const { userKey, manifest } = await loadDatasetForQuery(params)
    const blobServiceClient = createBlobServiceClient(params)
    await writeJsonBlob(
      blobServiceClient,
      getLogPath(userKey, manifest.datasetId, logEntry.id || uuidv4()),
      logEntry
    )
  } catch (error) {
    console.error('Error writing custom action dataset log:', error.message)
  }
}

async function listDatasetLogs(params) {
  const headers = params.__ow_headers || {}
  const userKey = resolveUserKey(headers, params)
  const datasetId = (params.datasetId || '').toString().trim()

  if (!datasetId) {
    throw new Error('datasetId is required for dataset log listing')
  }

  const blobServiceClient = createBlobServiceClient(params)
  const prefix = `${getDatasetBasePath(userKey, datasetId)}/logs/`
  const blobs = await listBlobsByPrefix(blobServiceClient, prefix)
  const logs = []

  for (const blob of blobs) {
    const entry = await readJsonBlob(blobServiceClient, blob.name)
    if (entry) {
      logs.push(entry)
    }
  }

  logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

  const limit = Math.min(Math.max(parseInt(params.limit, 10) || 50, 1), 200)
  return {
    success: true,
    logs: logs.slice(0, limit),
    total: logs.length
  }
}

async function handleUploadOperation(params) {
  const operation = (params.operation || '').toString().trim().toLowerCase()

  switch (operation) {
    case 'create':
      return createDataset(params, {
        fileData: params.fileData,
        name: params.name,
        primaryKey: params.primaryKey,
        ownerEmail: params.ownerEmail || params.userEmail
      })
    case 'list':
      return listDatasets(params)
    case 'delete':
      return deleteDataset(params)
    default:
      throw new Error(`Unsupported custom action operation: ${operation}`)
  }
}

module.exports = {
  MAX_QUERY_LIMIT,
  ROOT_PREFIX,
  appendDatasetLog,
  buildAjoSnippet,
  compareValues,
  createDataset,
  csvToJson,
  deleteDataset,
  formatQueryResult,
  getDataPath,
  getDatasetBasePath,
  getManifestPath,
  handleUploadOperation,
  jsonToCsv,
  listDatasetLogs,
  listDatasets,
  loadDatasetForQuery,
  normalizeRows,
  queryDataset,
  queryRows,
  resolveUserKey
}
