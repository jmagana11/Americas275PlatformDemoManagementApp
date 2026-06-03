/*
* <license header>
*/

const { v4: uuidv4 } = require('uuid')

const EDGE_INTERACT_BASE_URL = 'https://edge.adobedc.net'
const PERSONALIZATION_DECISIONS_HANDLE = 'personalization:decisions'
const LOCATION_HINT_HANDLE = 'locationHint:result'
const STATE_STORE_HANDLE = 'state:store'
const IDENTITY_RESULT_HANDLE = 'identity:result'
const DEFAULT_PERSONALIZATION_SCHEMAS = Object.freeze([
  'https://ns.adobe.com/personalization/dom-action',
  'https://ns.adobe.com/personalization/html-content-item',
  'https://ns.adobe.com/personalization/json-content-item',
  'https://ns.adobe.com/personalization/redirect-item',
  'https://ns.adobe.com/personalization/ruleset-item',
  'https://ns.adobe.com/personalization/message/in-app',
  'https://ns.adobe.com/personalization/message/content-card',
  'https://ns.adobe.com/personalization/message/native-alert',
  'https://ns.adobe.com/personalization/measurement',
  'https://ns.adobe.com/personalization/eventHistoryOperation',
  'https://ns.adobe.com/personalization/default-content-item'
])

function ensureObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function ensureArray(value) {
  if (Array.isArray(value)) {
    return value
  }
  if (value === undefined || value === null || value === '') {
    return []
  }
  return [value]
}

function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry || '').trim())
      .filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(/[\n,]+/)
      .map((entry) => entry.trim())
      .filter(Boolean)
  }
  return []
}

function parseJsonInput(value, fallback = {}) {
  if (value === undefined || value === null || value === '') {
    return fallback
  }
  if (typeof value === 'object') {
    return value
  }
  if (typeof value !== 'string') {
    return fallback
  }
  try {
    return JSON.parse(value)
  } catch (error) {
    return fallback
  }
}

function parseContent(content) {
  if (content && typeof content === 'object') {
    return content
  }
  if (typeof content !== 'string') {
    return null
  }
  const trimmed = content.trim()
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) {
    return null
  }
  try {
    return JSON.parse(trimmed)
  } catch (error) {
    return null
  }
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value || {}))
}

function mergeIdentityMap(xdm, identityNamespace, identityValue) {
  const mergedXdm = deepClone(xdm)
  mergedXdm.identityMap = ensureObject(mergedXdm.identityMap)
  mergedXdm.identityMap[identityNamespace] = [{
    id: identityValue,
    primary: true
  }]
  return mergedXdm
}

function getInteractionMode(input = {}) {
  if (input.mode === 'surfaces' || input.mode === 'decisionScopes') {
    return input.mode
  }
  if (normalizeStringList(input.surfaces).length > 0) {
    return 'surfaces'
  }
  return 'decisionScopes'
}

function validateInteractInput(input = {}) {
  const errors = []
  const mode = getInteractionMode(input)
  const decisionScopes = normalizeStringList(input.decisionScopes)
  const surfaces = normalizeStringList(input.surfaces)

  if (!input.datastreamId) {
    errors.push('datastreamId is required')
  }
  if (!input.identityNamespace) {
    errors.push('identityNamespace is required')
  }
  if (!input.identityValue) {
    errors.push('identityValue is required')
  }
  if (mode === 'decisionScopes' && decisionScopes.length === 0) {
    errors.push('At least one decision scope is required')
  }
  if (mode === 'surfaces' && surfaces.length === 0) {
    errors.push('At least one surface is required')
  }
  if (decisionScopes.length > 30) {
    errors.push('A request can include at most 30 decision scopes')
  }

  return errors
}

function buildPersonalizationQuery(input = {}) {
  const mode = getInteractionMode(input)
  const personalization = {}

  if (mode === 'surfaces') {
    personalization.surfaces = normalizeStringList(input.surfaces)
  } else {
    personalization.decisionScopes = normalizeStringList(input.decisionScopes)
  }

  const schemas = normalizeStringList(input.schemas)
  personalization.schemas = schemas.length > 0
    ? schemas
    : [...DEFAULT_PERSONALIZATION_SCHEMAS]

  return {
    personalization
  }
}

function buildEdgeInteractRequest(input = {}, options = {}) {
  const errors = validateInteractInput(input)
  if (errors.length > 0) {
    const error = new Error(errors.join('; '))
    error.validationErrors = errors
    throw error
  }

  const requestId = input.requestId || (options.createRequestId || uuidv4)()
  const edgeBaseUrl = String(input.edgeBaseUrl || EDGE_INTERACT_BASE_URL).replace(/\/$/, '')
  const url = `${edgeBaseUrl}/ee/v1/interact?configId=${encodeURIComponent(input.datastreamId)}&requestId=${encodeURIComponent(requestId)}`
  const xdmDefaults = parseJsonInput(input.xdm, {})
  const xdm = mergeIdentityMap(xdmDefaults, input.identityNamespace, input.identityValue)
  const event = {
    xdm,
    query: buildPersonalizationQuery(input)
  }
  const body = {
    events: [event]
  }

  if (input.preserveState) {
    const entries = ensureArray(input.stateEntries).filter(Boolean)
    if (entries.length > 0) {
      body.meta = {
        state: {
          entries
        }
      }
    }
  }

  const headers = {
    'Content-Type': 'application/json'
  }
  if (input.assuranceSessionId) {
    headers['x-adobe-aep-validation-token'] = input.assuranceSessionId
  }

  return {
    requestId,
    url,
    method: 'POST',
    headers,
    body
  }
}

function buildPropositionEventRequest(input = {}, options = {}) {
  if (!input.datastreamId) {
    throw new Error('datastreamId is required')
  }
  if (!input.identityNamespace) {
    throw new Error('identityNamespace is required')
  }
  if (!input.identityValue) {
    throw new Error('identityValue is required')
  }

  const requestId = input.requestId || (options.createRequestId || uuidv4)()
  const edgeBaseUrl = String(input.edgeBaseUrl || EDGE_INTERACT_BASE_URL).replace(/\/$/, '')
  const url = `${edgeBaseUrl}/ee/v1/interact?configId=${encodeURIComponent(input.datastreamId)}&requestId=${encodeURIComponent(requestId)}`
  const eventType = input.eventType === 'interact'
    ? 'decisioning.propositionInteract'
    : 'decisioning.propositionDisplay'
  const proposition = ensureObject(input.proposition)
  const xdm = mergeIdentityMap({
    eventType,
    _experience: {
      decisioning: {
        propositions: [{
          id: proposition.id || proposition.propositionId,
          scope: proposition.scope,
          scopeDetails: proposition.scopeDetails,
          items: ensureArray(input.items || proposition.items).map((item) => ({
            id: item.id,
            schema: item.schema,
            characteristics: item.characteristics
          })).filter((item) => item.id)
        }]
      }
    }
  }, input.identityNamespace, input.identityValue)
  const body = {
    events: [{ xdm }]
  }

  if (input.preserveState) {
    const entries = ensureArray(input.stateEntries).filter(Boolean)
    if (entries.length > 0) {
      body.meta = {
        state: {
          entries
        }
      }
    }
  }

  return {
    requestId,
    url,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body
  }
}

function getHandlePayloads(edgeResponse = {}, handleType) {
  return ensureArray(edgeResponse.handle)
    .filter((handle) => handle && handle.type === handleType)
    .flatMap((handle) => ensureArray(handle.payload))
}

function extractStateEntries(edgeResponse = {}) {
  return getHandlePayloads(edgeResponse, STATE_STORE_HANDLE)
    .flatMap((payload) => {
      if (Array.isArray(payload && payload.entries)) {
        return payload.entries
      }
      return [payload]
    })
    .filter(Boolean)
}

function extractTokens(item = {}, proposition = {}) {
  const tokenCandidates = [
    item.token,
    item.eventToken,
    item.data && item.data.token,
    item.data && item.data.eventToken,
    item.data && item.data.characteristics && item.data.characteristics.eventToken,
    proposition.scopeDetails && proposition.scopeDetails.characteristics && proposition.scopeDetails.characteristics.eventToken
  ]

  return tokenCandidates.filter(Boolean)
}

function normalizeItem(item = {}, proposition = {}) {
  const data = ensureObject(item.data)
  const parsedContent = parseContent(data.content)
  const characteristics = data.characteristics || item.characteristics || null

  return {
    id: item.id || data.id || null,
    isFallback: String(item.id || data.id || '').startsWith('xcore:fallback-offer:'),
    schema: item.schema || data.schema || null,
    format: data.format || null,
    language: data.language || [],
    content: data.content === undefined ? null : data.content,
    parsedContent,
    deliveryURL: data.deliveryURL || data.deliveryUrl || null,
    linkURL: data.linkURL || data.linkUrl || null,
    characteristics,
    tokens: extractTokens(item, proposition)
  }
}

function normalizeEdgeResponse(edgeResponse = {}) {
  const decisionPayloads = getHandlePayloads(edgeResponse, PERSONALIZATION_DECISIONS_HANDLE)
  const propositions = decisionPayloads.map((proposition) => ({
    id: proposition.id || proposition.propositionId || null,
    scope: proposition.scope || null,
    scopeDetails: proposition.scopeDetails || null,
    activity: proposition.activity || null,
    placement: proposition.placement || null,
    items: ensureArray(proposition.items).map((item) => normalizeItem(item, proposition))
  }))
  const items = propositions.flatMap((proposition) => proposition.items)

  return {
    requestId: edgeResponse.requestId || null,
    propositions,
    locationHints: getHandlePayloads(edgeResponse, LOCATION_HINT_HANDLE),
    stateEntries: extractStateEntries(edgeResponse),
    identity: getHandlePayloads(edgeResponse, IDENTITY_RESULT_HANDLE),
    handles: ensureArray(edgeResponse.handle),
    summary: {
      propositionCount: propositions.length,
      itemCount: items.length,
      fallbackCount: items.filter((item) => item.isFallback).length,
      personalizedCount: items.filter((item) => !item.isFallback).length
    }
  }
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`
}

function buildCurl(request) {
  const headerArgs = Object.entries(request.headers || {})
    .map(([key, value]) => `  -H ${shellQuote(`${key}: ${value}`)}`)
  return [
    `curl -X ${request.method || 'POST'} ${shellQuote(request.url)}`,
    ...headerArgs,
    `  --data ${shellQuote(JSON.stringify(request.body || {}, null, 2))}`
  ].join(' \\\n')
}

module.exports = {
  DEFAULT_PERSONALIZATION_SCHEMAS,
  EDGE_INTERACT_BASE_URL,
  buildCurl,
  buildEdgeInteractRequest,
  buildPropositionEventRequest,
  mergeIdentityMap,
  normalizeEdgeResponse,
  normalizeStringList,
  parseContent,
  parseJsonInput,
  validateInteractInput
}
