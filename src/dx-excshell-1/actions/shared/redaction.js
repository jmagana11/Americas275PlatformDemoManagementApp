const REDACTED = '<redacted>'

const SYSTEM_PARAM_KEYS = new Set([
  '__ow_method',
  '__ow_path',
  '__ow_headers',
  '__ow_query',
  '__ow_body',
  '__ow_activation_id',
  '__ow_action_name',
  '__ow_deadline',
  '__ow_namespace',
  '__ow_transaction_id'
])

const RUNTIME_INPUT_KEYS = new Set([
  'LOG_LEVEL',
  'apiKey',
  'clientSecret',
  'techAccId',
  'techAccEm',
  'orgId',
  'JMETER_API_KEY',
  'AZURE_BLOB_URL',
  'AZURE_SAS_TOKEN',
  'AZURE_OPENAI_ENDPOINT',
  'AZURE_OPENAI_KEY',
  'AZURE_OPENAI_IMAGE_ENDPOINT',
  'AZURE_OPENAI_IMAGE_KEY',
  'AZURE_VISION_ENDPOINT',
  'AZURE_VISION_KEY',
  'MA1HOL_API_KEY',
  'MA1HOL_CLIENT_SECRET',
  'MA1HOL_IMS_ORG',
  'MA1HOL_TENANT',
  'MA1HOL_EMAIL_DOMAIN',
  'MA1HOL_MS_CLIENT_ID',
  'MA1HOL_MS_CLIENT_SECRET',
  'MA1HOL_MS_TENANT_ID',
  'MA1HOL_MS_APP_ROLE_ID',
  'MA1HOL_MS_APP_RESOURCE_ID',
  'POT5HOL_API_KEY',
  'POT5HOL_CLIENT_SECRET',
  'POT5HOL_IMS_ORG',
  'POT5HOL_TENANT',
  'POT5HOL_EMAIL_DOMAIN',
  'POT5HOL_MS_CLIENT_ID',
  'POT5HOL_MS_CLIENT_SECRET',
  'POT5HOL_MS_TENANT_ID',
  'POT5HOL_MS_APP_ROLE_ID',
  'POT5HOL_MS_APP_RESOURCE_ID',
  'POT5HOL_CONTENT_API_KEY',
  'POT5HOL_CONTENT_CLIENT_SECRET',
  'CAMPAIGN_TRIGGER_CLIENT_ID',
  'CAMPAIGN_TRIGGER_CLIENT_SECRET',
  'CAMPAIGN_TRIGGER_SCOPE',
  'CAMPAIGN_TRIGGER_IMS_ORG',
  'CAMPAIGN_TRIGGER_SANDBOX'
])

function isRuntimeInjectedParam(key) {
  return SYSTEM_PARAM_KEYS.has(key) || RUNTIME_INPUT_KEYS.has(key)
}

function isSensitiveKey(key) {
  const normalized = String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  return [
    'authorization',
    'apikey',
    'clientid',
    'clientsecret',
    'cookie',
    'credential',
    'imsorg',
    'orgid',
    'password',
    'privatekey',
    'sas',
    'scope',
    'secret',
    'sessiontoken',
    'techacc',
    'tenantid',
    'token'
  ].some(pattern => normalized.includes(pattern)) || normalized.endsWith('key')
}

function redactValue(value, key = '', seen = new WeakSet()) {
  if (RUNTIME_INPUT_KEYS.has(key) || isSensitiveKey(key)) {
    return REDACTED
  }

  if (key === '__ow_body' && typeof value === 'string') {
    try {
      return redactValue(JSON.parse(value), key, seen)
    } catch (e) {
      return REDACTED
    }
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return '[Circular]'
    }
    seen.add(value)
    return value.map(item => redactValue(item, '', seen))
  }

  if (value && typeof value === 'object') {
    if (seen.has(value)) {
      return '[Circular]'
    }
    seen.add(value)
    return Object.entries(value).reduce((safe, [childKey, childValue]) => {
      safe[childKey] = redactValue(childValue, childKey, seen)
      return safe
    }, {})
  }

  return value
}

function redactObject(value) {
  return redactValue(value)
}

function safeStringify(value, spacing = 2) {
  try {
    return JSON.stringify(redactObject(value), null, spacing)
  } catch (e) {
    return JSON.stringify(REDACTED)
  }
}

function buildRequestBodyFromFlattenedParams(params) {
  const bodyParams = {}

  for (const [key, value] of Object.entries(params || {})) {
    if (isRuntimeInjectedParam(key)) {
      continue
    }
    bodyParams[key] = redactValue(value, key)
  }

  return Object.keys(bodyParams).length > 0 ? bodyParams : null
}

module.exports = {
  REDACTED,
  buildRequestBodyFromFlattenedParams,
  isRuntimeInjectedParam,
  isSensitiveKey,
  redactObject,
  redactValue,
  safeStringify
}
