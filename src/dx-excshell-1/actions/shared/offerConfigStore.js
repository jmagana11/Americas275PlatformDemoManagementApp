/*
* <license header>
*/

const { v4: uuidv4 } = require('uuid')
const {
  deleteBlobIfExists,
  readJsonBlob,
  readJsonBlobsByPrefix,
  writeJsonBlob
} = require('./blobStore')
const {
  DEFAULT_PERSONALIZATION_SCHEMAS,
  normalizeStringList,
  parseJsonInput
} = require('./offerDecisioning')
const { normalizeTemplate } = require('./offerRenderer')

const SCHEMA_VERSION = 1
const CONFIG_METADATA = Object.freeze({
  purpose: 'offer-decisioning-config'
})
const PUBLIC_METADATA = Object.freeze({
  purpose: 'offer-decisioning-public-config'
})

function sanitizePathPart(value, fallback = 'unknown') {
  const sanitized = String(value || '').replace(/[^a-zA-Z0-9_-]/g, '_')
  return sanitized || fallback
}

function getUserIdentifier(headers = {}) {
  return sanitizePathPart(
    headers['x-ims-user-id'] ||
    headers['x-gw-ims-user-id'] ||
    headers['user-id'] ||
    headers['ims-user-id'] ||
    headers['x-user-id'] ||
    'default_user',
    'default_user'
  )
}

function getOrgIdentifier(headers = {}, params = {}) {
  return sanitizePathPart(
    headers['x-gw-ims-org-id'] ||
    params.orgId ||
    process.env.AEP_ORG_ID ||
    'default_org',
    'default_org'
  )
}

function getDraftConfigPath(orgId, userId, configId) {
  return `offer-decisioning/configs/${sanitizePathPart(orgId)}/${sanitizePathPart(userId)}/${sanitizePathPart(configId)}.json`
}

function getDraftConfigPrefix(orgId, userId) {
  return `offer-decisioning/configs/${sanitizePathPart(orgId)}/${sanitizePathPart(userId)}/`
}

function getPublishedConfigPath(publicId) {
  return `offer-decisioning/public/${sanitizePathPart(publicId)}.json`
}

function createPublicId() {
  return uuidv4().replace(/-/g, '').slice(0, 20)
}

function normalizeEdgeConfig(edge = {}) {
  return {
    datastreamId: String(edge.datastreamId || '').trim(),
    identityNamespace: String(edge.identityNamespace || 'ECID').trim(),
    mode: edge.mode === 'surfaces' ? 'surfaces' : 'decisionScopes',
    decisionScopes: normalizeStringList(edge.decisionScopes),
    surfaces: normalizeStringList(edge.surfaces),
    schemas: [...DEFAULT_PERSONALIZATION_SCHEMAS],
    contextTenantField: String(edge.contextTenantField || '').trim(),
    xdmDefaults: parseJsonInput(edge.xdmDefaults || edge.xdm || {}, {}),
    preserveState: Boolean(edge.preserveState)
  }
}

function normalizeOfferConfig(input = {}, owner = {}, existingConfig = {}, options = {}) {
  const timestamp = options.timestamp || new Date().toISOString()
  const id = sanitizePathPart(input.id || existingConfig.id || uuidv4())
  const existingPublish = existingConfig.publish || {}
  const publishInput = input.publish || {}
  const hasPublishEnabled = Object.prototype.hasOwnProperty.call(publishInput, 'enabled')
  const hasPublicId = Object.prototype.hasOwnProperty.call(publishInput, 'publicId')
  const hasPublishedAt = Object.prototype.hasOwnProperty.call(publishInput, 'publishedAt')

  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    name: String(input.name || existingConfig.name || 'Untitled offer config').trim(),
    createdAt: existingConfig.createdAt || timestamp,
    updatedAt: timestamp,
    ownerUserId: owner.userId || existingConfig.ownerUserId || 'default_user',
    ownerOrgId: owner.orgId || existingConfig.ownerOrgId || 'default_org',
    edge: normalizeEdgeConfig(input.edge || existingConfig.edge || {}),
    template: normalizeTemplate(input.template || existingConfig.template || {}),
    publish: {
      enabled: Boolean(hasPublishEnabled ? publishInput.enabled : existingPublish.enabled),
      publicId: hasPublicId ? publishInput.publicId : (existingPublish.publicId || null),
      publishedAt: hasPublishedAt ? publishInput.publishedAt : (existingPublish.publishedAt || null)
    }
  }
}

function createPublishedConfig(config, options = {}) {
  const timestamp = options.timestamp || new Date().toISOString()
  const publicId = config.publish.publicId || createPublicId()

  return {
    schemaVersion: SCHEMA_VERSION,
    id: config.id,
    publicId,
    name: config.name,
    ownerOrgId: config.ownerOrgId,
    edge: config.edge,
    template: config.template,
    publish: {
      enabled: true,
      publicId,
      publishedAt: timestamp
    }
  }
}

function summarizeConfig(config = {}) {
  return {
    id: config.id,
    name: config.name,
    updatedAt: config.updatedAt,
    createdAt: config.createdAt,
    mode: config.edge && config.edge.mode,
    datastreamId: config.edge && config.edge.datastreamId,
    templateType: config.template && config.template.type,
    publish: config.publish || { enabled: false, publicId: null, publishedAt: null }
  }
}

async function saveOfferConfig(blobServiceClient, input = {}, owner = {}, options = {}) {
  const configId = input.id || uuidv4()
  const blobPath = getDraftConfigPath(owner.orgId, owner.userId, configId)
  const existingConfig = await readJsonBlob(blobServiceClient, blobPath) || {}
  const config = normalizeOfferConfig({
    ...input,
    id: configId
  }, owner, existingConfig, options)

  await writeJsonBlob(blobServiceClient, blobPath, config, {
    metadata: CONFIG_METADATA
  })

  return {
    config,
    blobPath
  }
}

async function getOfferConfig(blobServiceClient, configId, owner = {}) {
  const blobPath = getDraftConfigPath(owner.orgId, owner.userId, configId)
  const config = await readJsonBlob(blobServiceClient, blobPath)
  return {
    config,
    blobPath
  }
}

async function listOfferConfigs(blobServiceClient, owner = {}) {
  const prefix = getDraftConfigPrefix(owner.orgId, owner.userId)
  const entries = await readJsonBlobsByPrefix(blobServiceClient, prefix)
  return entries
    .map((entry) => summarizeConfig(entry.data))
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
}

async function deleteOfferConfig(blobServiceClient, configId, owner = {}) {
  const { config, blobPath } = await getOfferConfig(blobServiceClient, configId, owner)
  if (config && config.publish && config.publish.publicId) {
    await deleteBlobIfExists(blobServiceClient, getPublishedConfigPath(config.publish.publicId))
  }
  const deleteResult = await deleteBlobIfExists(blobServiceClient, blobPath)
  return {
    deleted: deleteResult === undefined || deleteResult.succeeded !== false,
    configId
  }
}

async function publishOfferConfig(blobServiceClient, configId, owner = {}, options = {}) {
  const { config } = await getOfferConfig(blobServiceClient, configId, owner)
  if (!config) {
    return null
  }

  const timestamp = options.timestamp || new Date().toISOString()
  const publishedConfig = createPublishedConfig(config, { timestamp })
  const updatedDraft = normalizeOfferConfig({
    ...config,
    publish: publishedConfig.publish
  }, owner, config, {
    timestamp
  })

  await writeJsonBlob(blobServiceClient, getPublishedConfigPath(publishedConfig.publicId), publishedConfig, {
    metadata: PUBLIC_METADATA
  })
  await writeJsonBlob(blobServiceClient, getDraftConfigPath(owner.orgId, owner.userId, configId), updatedDraft, {
    metadata: CONFIG_METADATA
  })

  return {
    config: updatedDraft,
    publishedConfig
  }
}

async function unpublishOfferConfig(blobServiceClient, configId, owner = {}, options = {}) {
  const { config } = await getOfferConfig(blobServiceClient, configId, owner)
  if (!config) {
    return null
  }

  const publicId = config.publish && config.publish.publicId
  if (publicId) {
    await deleteBlobIfExists(blobServiceClient, getPublishedConfigPath(publicId))
  }

  const updatedDraft = normalizeOfferConfig({
    ...config,
    publish: {
      enabled: false,
      publicId: null,
      publishedAt: null
    }
  }, owner, config, {
    timestamp: options.timestamp || new Date().toISOString()
  })

  await writeJsonBlob(blobServiceClient, getDraftConfigPath(owner.orgId, owner.userId, configId), updatedDraft, {
    metadata: CONFIG_METADATA
  })

  return updatedDraft
}

async function getPublishedOfferConfig(blobServiceClient, publicId) {
  return readJsonBlob(blobServiceClient, getPublishedConfigPath(publicId))
}

module.exports = {
  SCHEMA_VERSION,
  createPublishedConfig,
  createPublicId,
  deleteOfferConfig,
  getDraftConfigPath,
  getDraftConfigPrefix,
  getOrgIdentifier,
  getPublishedConfigPath,
  getPublishedOfferConfig,
  getUserIdentifier,
  getOfferConfig,
  listOfferConfigs,
  normalizeEdgeConfig,
  normalizeOfferConfig,
  publishOfferConfig,
  saveOfferConfig,
  summarizeConfig,
  unpublishOfferConfig
}
