const REDACTED = '<redacted>'
const { RUNTIME_INPUT_KEYS: CONFIG_RUNTIME_INPUT_KEYS } = require('./config')

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

const RUNTIME_INPUT_KEYS = new Set(CONFIG_RUNTIME_INPUT_KEYS)

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
