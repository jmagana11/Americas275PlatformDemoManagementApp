/*
* <license header>
*/

const { Core } = require('@adobe/aio-sdk')
const fetch = require('node-fetch')
const {
  ConfigError,
  getOrgConfig,
  listOrgMetadata
} = require('../shared/config')
const { errorResponse, mergeJsonBodyParams } = require('../utils')

const EXPERIENCE_EVENT_CLASS = 'https://ns.adobe.com/xdm/context/experienceevent'
const SCHEMA_REGISTRY_BASE_URL = 'https://platform.adobe.io/data/foundation/schemaregistry'
const DEFAULT_SCHEMA_PAGE_LIMIT = 100
const MAX_SCHEMA_PAGE_LIMIT = 300

function successResponse(body) {
  return {
    statusCode: 200,
    body
  }
}

async function getAccessToken(orgConfig, logger) {
  const tokenResponse = await fetch(`https://${orgConfig.IMS}/ims/token/v3`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: orgConfig.API_KEY,
      client_secret: orgConfig.CLIENT_SECRET,
      scope: orgConfig.META_SCOPE
    })
  })

  if (!tokenResponse.ok) {
    logger.error(`Failed to get access token: ${tokenResponse.status}`)
    throw new Error(`Failed to get access token: ${tokenResponse.status}`)
  }

  const tokenData = await tokenResponse.json()
  return tokenData.access_token
}

async function getPlatformHeaders(params, logger, options = {}) {
  const orgConfig = getOrgConfig(params, options.org, 'sandboxes')
  const accessToken = await getAccessToken(orgConfig, logger)

  return {
    orgConfig,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'x-api-key': orgConfig.API_KEY,
      'x-gw-ims-org-id': orgConfig.IMS_ORG,
      'x-sandbox-name': options.sandboxName,
      'Content-Type': 'application/json',
      Accept: options.accept || 'application/json'
    }
  }
}

async function readJsonResponse(response, apiEndpoint) {
  const text = await response.text()
  let body

  try {
    body = text ? JSON.parse(text) : {}
  } catch (error) {
    body = { body: text }
  }

  if (!response.ok) {
    const error = new Error(`request to ${apiEndpoint} failed with status code ${response.status}`)
    error.statusCode = response.status
    error.details = body
    throw error
  }

  return body
}

function getSchemaClass(schema = {}) {
  return schema['meta:class'] || schema.class || schema['xdm:class'] || ''
}

function isExperienceEventSchema(schema = {}) {
  return String(getSchemaClass(schema)).toLowerCase().includes('experienceevent')
}

function summarizeSchema(schema = {}) {
  return {
    id: schema['$id'] || schema.id,
    title: schema.title || schema['xdm:title'] || schema['meta:altId'] || schema['$id'],
    description: schema.description || '',
    type: schema.type || 'object',
    version: schema.version,
    created: schema['meta:created'],
    updated: schema['meta:updated'],
    class: getSchemaClass(schema),
    isExperienceEvent: isExperienceEventSchema(schema)
  }
}

function normalizePageLimit(limit) {
  const parsed = Number(limit)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_SCHEMA_PAGE_LIMIT
  }
  return Math.min(Math.floor(parsed), MAX_SCHEMA_PAGE_LIMIT)
}

function getNextStart(body = {}) {
  if (body._page?.next) {
    return body._page.next
  }

  const nextHref = body._links?.next?.href
  if (!nextHref) {
    return null
  }

  try {
    return new URL(nextHref).searchParams.get('start')
  } catch (error) {
    return null
  }
}

function buildSchemaListUrl(params = {}) {
  const limit = normalizePageLimit(params.limit)
  const orderby = params.orderby || 'title'
  const eventSchemasOnly = params.eventSchemasOnly !== false
  const url = new URL(`${SCHEMA_REGISTRY_BASE_URL}/tenant/schemas`)

  url.searchParams.set('orderby', orderby)
  url.searchParams.set('limit', String(limit))

  if (params.start) {
    url.searchParams.set('start', params.start)
  }

  if (eventSchemasOnly) {
    url.searchParams.append('property', `meta:class==${EXPERIENCE_EVENT_CLASS}`)
  }

  return {
    url: url.toString(),
    limit,
    orderby,
    eventSchemasOnly
  }
}

async function listSandboxes(params, logger) {
  const org = String(params.org || '').toUpperCase()
  const { orgConfig, headers } = await getPlatformHeaders(params, logger, {
    org,
    sandboxName: undefined,
    accept: 'application/json'
  })
  delete headers['x-sandbox-name']

  const apiEndpoint = 'https://platform.adobe.io/data/foundation/sandbox-management/sandboxes'
  const response = await fetch(apiEndpoint, {
    method: 'GET',
    headers
  })
  const body = await readJsonResponse(response, apiEndpoint)
  const sandboxes = Array.isArray(body.sandboxes) ? body.sandboxes : (body.items || body.results || [])

  return successResponse({
    success: true,
    org,
    tenant: orgConfig.TENANT,
    sandboxes
  })
}

async function listSchemas(params, logger) {
  const org = String(params.org || '').toUpperCase()
  const sandboxName = params.sandboxName || params.sandbox
  if (!sandboxName) {
    return errorResponse(400, 'sandboxName is required', logger)
  }

  const { orgConfig, headers } = await getPlatformHeaders(params, logger, {
    org,
    sandboxName,
    accept: 'application/vnd.adobe.xed-id+json'
  })
  const {
    url: apiEndpoint,
    limit,
    orderby,
    eventSchemasOnly
  } = buildSchemaListUrl({
    limit: params.limit,
    start: params.start,
    orderby: params.orderby,
    eventSchemasOnly: params.eventSchemasOnly
  })
  const response = await fetch(apiEndpoint, {
    method: 'GET',
    headers
  })
  const body = await readJsonResponse(response, apiEndpoint)
  const schemas = (body.results || []).map(summarizeSchema)
  const eventSchemas = eventSchemasOnly
    ? schemas
    : schemas.filter((schema) => schema.isExperienceEvent)
  const nextStart = getNextStart(body)

  return successResponse({
    success: true,
    org,
    sandboxName,
    tenant: orgConfig.TENANT,
    schemas,
    eventSchemas,
    count: schemas.length,
    eventCount: eventSchemas.length,
    page: {
      orderby,
      limit,
      start: params.start || null,
      nextStart,
      hasMore: Boolean(nextStart),
      count: body._page?.count || schemas.length,
      eventSchemasOnly
    }
  })
}

async function getSchemaDefinition(schemaId, headers) {
  const encodedSchemaId = encodeURIComponent(schemaId)
  const apiEndpoint = `${SCHEMA_REGISTRY_BASE_URL}/tenant/schemas/${encodedSchemaId}`
  const response = await fetch(apiEndpoint, {
    method: 'GET',
    headers
  })
  return readJsonResponse(response, apiEndpoint)
}

async function getFieldGroupDefinition(ref, headers) {
  const encodedFieldGroupId = encodeURIComponent(ref)
  const apiEndpoint = `${SCHEMA_REGISTRY_BASE_URL}/tenant/fieldgroups/${encodedFieldGroupId}`
  const response = await fetch(apiEndpoint, {
    method: 'GET',
    headers
  })
  return readJsonResponse(response, apiEndpoint)
}

async function resolveFieldGroups(schema, headers, logger) {
  const fieldGroups = Array.isArray(schema.allOf) ? schema.allOf : []
  const resolved = []

  for (const fieldGroup of fieldGroups) {
    if (!fieldGroup || !fieldGroup.$ref) {
      continue
    }

    try {
      const definition = await getFieldGroupDefinition(fieldGroup.$ref, headers)
      resolved.push({
        ref: fieldGroup.$ref,
        title: definition.title,
        description: definition.description,
        properties: definition.properties || {},
        definitions: definition.definitions || {},
        rawDefinition: definition
      })
    } catch (error) {
      logger.error(`Failed to resolve field group ${fieldGroup.$ref}: ${error.message}`)
      resolved.push({
        ref: fieldGroup.$ref,
        title: 'Failed to resolve',
        description: error.message,
        properties: {},
        definitions: {},
        error: error.message
      })
    }
  }

  return resolved
}

function ensureObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function deepMergeProperties(target, source) {
  const merged = { ...ensureObject(target) }

  for (const [key, value] of Object.entries(ensureObject(source))) {
    if (
      merged[key] &&
      value &&
      typeof merged[key] === 'object' &&
      typeof value === 'object' &&
      merged[key].properties &&
      value.properties
    ) {
      merged[key] = {
        ...merged[key],
        ...value,
        properties: deepMergeProperties(merged[key].properties, value.properties)
      }
    } else {
      merged[key] = value
    }
  }

  return merged
}

function mergeSchemaProperties(schema, resolvedFieldGroups) {
  let merged = { ...(schema.properties || {}) }

  for (const fieldGroup of resolvedFieldGroups) {
    merged = deepMergeProperties(merged, fieldGroup.properties)

    for (const definition of Object.values(fieldGroup.definitions || {})) {
      if (definition && definition.properties) {
        merged = deepMergeProperties(merged, definition.properties)
      }
    }
  }

  return merged
}

function extractIdentityFields(schema = {}) {
  return (schema['meta:identityDescriptors'] || []).map((descriptor) => ({
    path: descriptor['xdm:sourceProperty'],
    namespace: descriptor['xdm:namespace'],
    isPrimary: Boolean(descriptor['xdm:isPrimary'])
  }))
}

function normalizeFieldType(field = {}) {
  if (Array.isArray(field.type)) {
    return field.type.find((entry) => entry !== 'null') || field.type[0]
  }
  return field.type || 'string'
}

function getDefaultValueForType(field = {}) {
  const type = normalizeFieldType(field)
  if (field.enum && field.enum.length > 0) return field.enum[0]
  if (type === 'number' || type === 'integer') return 0
  if (type === 'boolean') return false
  if (type === 'array') return []
  if (type === 'object') return {}
  return ''
}

function detectTenantRoot(properties = {}, orgConfig = {}) {
  const configuredTenant = orgConfig.TENANT ? `_${orgConfig.TENANT}` : ''
  if (configuredTenant && properties[configuredTenant]) {
    return configuredTenant
  }

  return Object.keys(properties).find((key) => key.startsWith('_') && key !== '_id') || ''
}

function flattenFields(properties = {}, options = {}) {
  const fields = []
  const identitiesByPath = new Map((options.identityFields || []).map((field) => [field.path, field]))

  function visit(props, prefix = '', requiredPaths = new Set()) {
    for (const [key, field] of Object.entries(ensureObject(props))) {
      const path = prefix ? `${prefix}.${key}` : key
      const fieldType = normalizeFieldType(field)
      const childRequired = new Set(Array.isArray(field.required) ? field.required : [])
      const isRequired = requiredPaths.has(key)
      const identity = identitiesByPath.get(path)

      if (fieldType === 'object' && field.properties) {
        visit(field.properties, path, childRequired)
        continue
      }

      if (fieldType === 'array' && field.items && field.items.properties) {
        visit(field.items.properties, `${path}[]`, new Set(Array.isArray(field.items.required) ? field.items.required : []))
        continue
      }

      fields.push({
        path,
        label: field.title || key,
        description: field.description || field.title || '',
        type: fieldType,
        format: field.format,
        enum: field.enum,
        required: isRequired,
        identity,
        isIdentity: Boolean(identity),
        sampleValue: getDefaultValueForType(field)
      })
    }
  }

  visit(properties, '', new Set(options.rootRequired || []))

  return fields
}

function stripTenantPath(path, tenantRoot) {
  if (!tenantRoot) return path
  if (path === tenantRoot) return ''
  if (path.startsWith(`${tenantRoot}.`)) return path.slice(tenantRoot.length + 1)
  return path
}

async function getSchemaFields(params, logger) {
  const org = String(params.org || '').toUpperCase()
  const sandboxName = params.sandboxName || params.sandbox
  const schemaId = params.schemaId || params.id
  if (!sandboxName) {
    return errorResponse(400, 'sandboxName is required', logger)
  }
  if (!schemaId) {
    return errorResponse(400, 'schemaId is required', logger)
  }

  const { orgConfig, headers } = await getPlatformHeaders(params, logger, {
    org,
    sandboxName,
    accept: 'application/vnd.adobe.xed+json'
  })
  const schema = await getSchemaDefinition(schemaId, headers)
  const resolvedFieldGroups = await resolveFieldGroups(schema, headers, logger)
  const properties = mergeSchemaProperties(schema, resolvedFieldGroups)
  const identities = extractIdentityFields(schema)
  const tenantRoot = detectTenantRoot(properties, orgConfig)
  const fields = flattenFields(properties, {
    identityFields: identities,
    rootRequired: schema.required || []
  }).map((field) => ({
    ...field,
    relativePath: stripTenantPath(field.path, tenantRoot)
  }))
  const requiredFields = fields.filter((field) => field.required)

  return successResponse({
    success: true,
    org,
    sandboxName,
    tenant: orgConfig.TENANT,
    tenantRoot,
    schema: {
      id: schema.$id || schemaId,
      title: schema.title,
      description: schema.description,
      class: getSchemaClass(schema),
      isExperienceEvent: isExperienceEventSchema(schema)
    },
    identities,
    fields,
    requiredFields,
    fieldCount: fields.length,
    requiredCount: requiredFields.length,
    fieldGroups: resolvedFieldGroups.map((fieldGroup) => ({
      ref: fieldGroup.ref,
      title: fieldGroup.title,
      description: fieldGroup.description,
      error: fieldGroup.error
    }))
  })
}

async function main(params) {
  const requestParams = mergeJsonBodyParams(params)
  const logger = Core.Logger('offer-schema-assistant', { level: requestParams.LOG_LEVEL || 'info' })

  try {
    const operation = requestParams.operation || requestParams.action

    if (operation === 'listOrgs' || operation === 'list-orgs') {
      return successResponse({
        success: true,
        organizations: listOrgMetadata(requestParams)
      })
    }

    if (operation === 'listSandboxes') {
      return await listSandboxes(requestParams, logger)
    }

    if (operation === 'listSchemas') {
      return await listSchemas(requestParams, logger)
    }

    if (operation === 'getSchemaFields') {
      return await getSchemaFields(requestParams, logger)
    }

    return errorResponse(400, 'Unsupported operation', logger)
  } catch (error) {
    logger.error(error)
    if (error instanceof ConfigError) {
      return errorResponse(500, error.message, logger)
    }
    if (error.statusCode) {
      return {
        statusCode: error.statusCode,
        body: {
          success: false,
          error: error.message,
          details: error.details
        }
      }
    }
    return errorResponse(500, error.message || 'Schema assistant failed', logger)
  }
}

exports.main = main
exports.flattenFields = flattenFields
exports.stripTenantPath = stripTenantPath
exports.detectTenantRoot = detectTenantRoot
exports.buildSchemaListUrl = buildSchemaListUrl
exports.getNextStart = getNextStart
exports.normalizePageLimit = normalizePageLimit
