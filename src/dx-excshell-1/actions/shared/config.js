const DEFAULT_CONTENT_SCOPE = 'additional_info.job_function,openid,session,user_management_sdk,cjm.suppression_service.client.delete,AdobeID,target_sdk,read_organizations,additional_info.roles,cjm.suppression_service.client.all,additional_info.projectedProductContext'
const POT5HOL_CONTENT_SCOPE = 'cjm.suppression_service.client.delete, cjm.suppression_service.client.all, openid, session, AdobeID, read_organizations, additional_info.projectedProductContext, read_pc.acp, read_pc, read_pc.dma_tartan, additional_info, target_sdk, additional_info.roles, additional_info.job_function, user_management_sdk'
const ADOBE_IMS_HOST = 'ims-na1.adobelogin.com'

const RUNTIME_INPUT_KEYS = Object.freeze([
  'LOG_LEVEL',
  'apiKey',
  'clientSecret',
  'techAccId',
  'techAccEm',
  'orgId',
  'AEP_API_KEY',
  'AEP_CLIENT_SECRET',
  'AEP_TECH_ACCOUNT_ID',
  'AEP_TECH_ACCOUNT_EMAIL',
  'AEP_ORG_ID',
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
  'MS_APP_ROLE_ID',
  'POT5HOL_CONTENT_API_KEY',
  'POT5HOL_CONTENT_CLIENT_SECRET',
  'CAMPAIGN_TRIGGER_CLIENT_ID',
  'CAMPAIGN_TRIGGER_CLIENT_SECRET',
  'CAMPAIGN_TRIGGER_SCOPE',
  'CAMPAIGN_TRIGGER_IMS_ORG',
  'CAMPAIGN_TRIGGER_SANDBOX'
])

class ConfigError extends Error {
  constructor(missingKeys, context) {
    const normalizedKeys = [...new Set(asArray(missingKeys).filter(Boolean))]
    const prefix = context ? `${context}: ` : ''
    super(`${prefix}Missing required Runtime config input(s): ${normalizedKeys.join(', ')}`)
    this.name = 'ConfigError'
    this.code = 'MISSING_RUNTIME_CONFIG'
    this.missingKeys = normalizedKeys
  }
}

function asArray(value) {
  if (Array.isArray(value)) {
    return value
  }
  return value === undefined || value === null ? [] : [value]
}

function hasConfigValue(value) {
  return value !== undefined && value !== null && value !== ''
}

function normalizeOptions(aliasesOrOptions) {
  if (Array.isArray(aliasesOrOptions) || typeof aliasesOrOptions === 'string') {
    return {
      aliases: asArray(aliasesOrOptions),
      env: process.env,
      includeProcessEnv: true
    }
  }

  const options = aliasesOrOptions || {}
  return {
    aliases: asArray(options.aliases),
    context: options.context,
    defaultValue: options.defaultValue,
    env: options.env || process.env,
    includeProcessEnv: options.includeProcessEnv !== false
  }
}

function candidateKeys(key, aliases) {
  return [...new Set([key, ...asArray(aliases)].filter(Boolean))]
}

function resolveInput(params, key, aliasesOrOptions) {
  const options = normalizeOptions(aliasesOrOptions)
  const keys = candidateKeys(key, options.aliases)
  const inputParams = params || {}

  for (const candidate of keys) {
    if (hasConfigValue(inputParams[candidate])) {
      return { value: inputParams[candidate], keys }
    }
  }

  if (options.includeProcessEnv) {
    const env = options.env || {}
    for (const candidate of keys) {
      if (hasConfigValue(env[candidate])) {
        return { value: env[candidate], keys }
      }
    }
  }

  if (hasConfigValue(options.defaultValue)) {
    return { value: options.defaultValue, keys }
  }

  return { value: undefined, keys }
}

function getOptionalInput(params, key, aliases) {
  return resolveInput(params, key, aliases).value
}

function getRequiredInput(params, key, options) {
  const resolved = resolveInput(params, key, options)
  if (!hasConfigValue(resolved.value)) {
    const normalizedOptions = normalizeOptions(options)
    throw new ConfigError(resolved.keys, normalizedOptions.context)
  }
  return resolved.value
}

function getHeaderValue(headers, key) {
  if (!headers) {
    return undefined
  }

  const normalizedKey = String(key).toLowerCase()
  const headerEntry = Object.entries(headers).find(([headerKey]) => String(headerKey).toLowerCase() === normalizedKey)
  return headerEntry ? headerEntry[1] : undefined
}

function throwIfMissing(requiredValues, context) {
  const missingKeys = requiredValues
    .filter((item) => !hasConfigValue(item.value))
    .flatMap((item) => item.keys)

  if (missingKeys.length > 0) {
    throw new ConfigError(missingKeys, context)
  }
}

function getDefaultAepConfig(params = {}, headers = params.__ow_headers || {}) {
  const apiKey = resolveInput(params, 'apiKey', {
    aliases: ['AEP_API_KEY'],
    context: 'Default AEP config'
  })
  const clientSecret = resolveInput(params, 'clientSecret', ['AEP_CLIENT_SECRET'])
  const techAccId = resolveInput(params, 'techAccId', ['AEP_TECH_ACCOUNT_ID'])
  const techAccEm = resolveInput(params, 'techAccEm', ['AEP_TECH_ACCOUNT_EMAIL'])
  const orgFromHeader = getHeaderValue(headers, 'x-gw-ims-org-id')
  const orgFromInput = resolveInput(params, 'orgId', {
    aliases: ['AEP_ORG_ID'],
    context: 'Default AEP config'
  })
  const orgId = orgFromHeader || orgFromInput.value

  throwIfMissing([
    apiKey,
    { value: orgId, keys: orgFromInput.keys }
  ], 'Default AEP config')

  return {
    apiKey: apiKey.value,
    clientSecret: clientSecret.value,
    techAccId: techAccId.value,
    techAccEm: techAccEm.value,
    orgId,
    imsOrgId: orgId
  }
}

function normalizeOrgKey(orgKey) {
  return String(orgKey || '').trim().toUpperCase()
}

function normalizeCapability(capability) {
  const value = String(capability || 'adobe').trim().toLowerCase()
  if (['content', 'content-template', 'content-templates', 'contenttemplates', 'ajo-content'].includes(value)) {
    return 'contentTemplates'
  }
  if (['microsoft', 'ms', 'graph', 'microsoft-graph'].includes(value)) {
    return 'microsoft'
  }
  if (['aep', 'platform'].includes(value)) {
    return 'aep'
  }
  return 'adobe'
}

function getOrgField(params, orgKey, fieldName, aliases = []) {
  const resolved = resolveInput(params, `${orgKey}_${fieldName}`, aliases)
  return {
    value: resolved.value,
    keys: resolved.keys
  }
}

function getOrgConfig(params = {}, orgKey, capability) {
  const normalizedOrgKey = normalizeOrgKey(orgKey)
  if (!normalizedOrgKey) {
    throw new ConfigError(['orgKey'], 'Organization config')
  }

  const normalizedCapability = normalizeCapability(capability)
  const isPotContentConfig = normalizedOrgKey === 'POT5HOL' && normalizedCapability === 'contentTemplates'
  const apiKey = isPotContentConfig
    ? getOrgField(params, normalizedOrgKey, 'CONTENT_API_KEY', [`${normalizedOrgKey}_API_KEY`])
    : getOrgField(params, normalizedOrgKey, 'API_KEY')
  const clientSecret = isPotContentConfig
    ? getOrgField(params, normalizedOrgKey, 'CONTENT_CLIENT_SECRET', [`${normalizedOrgKey}_CLIENT_SECRET`])
    : getOrgField(params, normalizedOrgKey, 'CLIENT_SECRET')
  const imsOrg = getOrgField(params, normalizedOrgKey, 'IMS_ORG')
  const tenant = getOrgField(params, normalizedOrgKey, 'TENANT')
  const emailDomain = getOrgField(params, normalizedOrgKey, 'EMAIL_DOMAIN')
  const msClientId = getOrgField(params, normalizedOrgKey, 'MS_CLIENT_ID')
  const msClientSecret = getOrgField(params, normalizedOrgKey, 'MS_CLIENT_SECRET')
  const msTenantId = getOrgField(params, normalizedOrgKey, 'MS_TENANT_ID')
  const msAppRoleId = resolveInput(params, 'MS_APP_ROLE_ID', [`${normalizedOrgKey}_MS_APP_ROLE_ID`])
  const msAppResourceId = getOrgField(params, normalizedOrgKey, 'MS_APP_RESOURCE_ID')

  const requiredByCapability = {
    adobe: [apiKey, clientSecret],
    aep: [apiKey, imsOrg],
    contentTemplates: [apiKey, clientSecret, imsOrg, tenant],
    microsoft: [msClientId, msClientSecret, msTenantId, msAppRoleId, msAppResourceId]
  }

  throwIfMissing(requiredByCapability[normalizedCapability], `${normalizedOrgKey} ${normalizedCapability} config`)

  const metaScope = isPotContentConfig ? POT5HOL_CONTENT_SCOPE : DEFAULT_CONTENT_SCOPE

  return {
    orgKey: normalizedOrgKey,
    capability: normalizedCapability,
    apiKey: apiKey.value,
    clientSecret: clientSecret.value,
    imsOrg: imsOrg.value,
    tenant: tenant.value,
    emailDomain: emailDomain.value,
    msClientId: msClientId.value,
    msClientSecret: msClientSecret.value,
    msTenantId: msTenantId.value,
    msAppRoleId: msAppRoleId.value,
    msAppResourceId: msAppResourceId.value,
    metaScope,
    imsHost: ADOBE_IMS_HOST,
    API_KEY: apiKey.value,
    CLIENT_SECRET: clientSecret.value,
    IMS_ORG: imsOrg.value,
    TENANT: tenant.value,
    EMAIL_DOMAIN: emailDomain.value,
    MS_CLIENT_ID: msClientId.value,
    MS_CLIENT_SECRET: msClientSecret.value,
    MS_TENANT_ID: msTenantId.value,
    MS_APP_ROLE_ID: msAppRoleId.value,
    MS_APP_RESOURCE_ID: msAppResourceId.value,
    META_SCOPE: metaScope,
    IMS: ADOBE_IMS_HOST
  }
}

function getCampaignTriggerConfig(params = {}) {
  const clientId = resolveInput(params, 'MA1HOL_API_KEY', ['CAMPAIGN_TRIGGER_CLIENT_ID', 'apiKey', 'AEP_API_KEY'])
  const clientSecret = resolveInput(params, 'MA1HOL_CLIENT_SECRET', ['CAMPAIGN_TRIGGER_CLIENT_SECRET', 'clientSecret', 'AEP_CLIENT_SECRET'])
  const scope = resolveInput(params, 'CAMPAIGN_TRIGGER_SCOPE')
  const imsOrg = resolveInput(params, 'MA1HOL_IMS_ORG', ['CAMPAIGN_TRIGGER_IMS_ORG', 'orgId', 'AEP_ORG_ID'])
  const sandbox = resolveInput(params, 'CAMPAIGN_TRIGGER_SANDBOX')

  throwIfMissing([
    clientId,
    clientSecret,
    scope,
    imsOrg,
    sandbox
  ], 'Campaign trigger config')

  return {
    clientId: clientId.value,
    clientSecret: clientSecret.value,
    scope: scope.value,
    imsOrg: imsOrg.value,
    sandbox: sandbox.value
  }
}

function getAzureBlobConfig(params = {}) {
  const blobUrl = resolveInput(params, 'AZURE_BLOB_URL')
  const sasToken = resolveInput(params, 'AZURE_SAS_TOKEN')

  throwIfMissing([
    blobUrl,
    sasToken
  ], 'Azure Blob config')

  return {
    blobUrl: blobUrl.value,
    sasToken: sasToken.value
  }
}

function getAzureOpenAIConfig(params = {}, purpose = 'text') {
  const normalizedPurpose = String(purpose || 'text').trim().toLowerCase()
  const purposeConfig = {
    text: {
      context: 'Azure OpenAI config',
      endpointKey: 'AZURE_OPENAI_ENDPOINT',
      keyKey: 'AZURE_OPENAI_KEY'
    },
    image: {
      context: 'Azure OpenAI image config',
      endpointKey: 'AZURE_OPENAI_IMAGE_ENDPOINT',
      keyKey: 'AZURE_OPENAI_IMAGE_KEY'
    },
    vision: {
      context: 'Azure Vision config',
      endpointKey: 'AZURE_VISION_ENDPOINT',
      keyKey: 'AZURE_VISION_KEY'
    }
  }[normalizedPurpose]

  if (!purposeConfig) {
    throw new ConfigError([`unsupported purpose: ${purpose}`], 'Azure OpenAI config')
  }

  const endpoint = resolveInput(params, purposeConfig.endpointKey)
  const apiKey = resolveInput(params, purposeConfig.keyKey)

  throwIfMissing([
    endpoint,
    apiKey
  ], purposeConfig.context)

  return {
    purpose: normalizedPurpose,
    endpoint: endpoint.value,
    apiKey: apiKey.value,
    key: apiKey.value
  }
}

module.exports = {
  ConfigError,
  RUNTIME_INPUT_KEYS,
  getAzureBlobConfig,
  getAzureOpenAIConfig,
  getCampaignTriggerConfig,
  getDefaultAepConfig,
  getOptionalInput,
  getOrgConfig,
  getRequiredInput
}
