/*
* <license header>
*/

const ACCESS_POLICY_SCHEMA_VERSION = 1
const ACCESS_MODE_PUBLIC = 'public'
const ACCESS_MODE_ALLOWLIST = 'allowlist'
const ADMINISTRATION_FEATURE_KEY = 'administration'
const DEFAULT_ADMINISTRATOR_EMAIL = 'jmagana@adobe.com'

const ACCESS_GROUPS = Object.freeze({
  coreDemoUsers: Object.freeze([
    'aajani@adobe.com',
    'arfrank@adobe.com',
    'dsousa@adobe.com',
    'demoaccounts+usnamed@adobetest.com',
    'dumiller@adobe.com',
    'cherot@adobe.com',
    'gesmith@adobe.com',
    'jmagana@adobe.com',
    'lpadia@adobe.com',
    'msimpson@adobe.com',
    'gillies@adobe.com',
    'jauw@adobe.com',
    'pankajp@adobe.com',
    'picklesi@adobe.com',
    'phjohnso@adobe.com',
    'rnair@adobe.com',
    'risharma@adobe.com',
    'ryanr@adobe.com',
    'gruer@adobe.com',
    'jhandei@adobe.com',
    'apowers@adobe.com'
  ]),
  extendedUtilityUsers: Object.freeze([
    'delapena@adobe.com'
  ]),
  fileUtilityUsers: Object.freeze([
    'abbey@adobe.com'
  ]),
  apiDocumentationUsers: Object.freeze([
    'ivory@adobe.com'
  ])
})

function unique(values) {
  return [...new Set((values || []).filter(Boolean))]
}

function normalizeEmail(value) {
  return typeof value === 'string' && value.trim()
    ? value.trim().toLowerCase()
    : null
}

function splitEmailValues(values) {
  if (Array.isArray(values)) {
    return values.flatMap(splitEmailValues)
  }

  if (typeof values === 'string') {
    return values.split(/[\n,;]/)
  }

  return values === undefined || values === null ? [] : [values]
}

function normalizeEmailList(values) {
  return unique(splitEmailValues(values).map(normalizeEmail))
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''))
}

function getEmailsForGroups(groupNames) {
  return normalizeEmailList((groupNames || []).flatMap((groupName) => ACCESS_GROUPS[groupName] || []))
}

function getConfiguredAdministratorEmail(source = {}, env) {
  const environment = env || (typeof process !== 'undefined' ? process.env : {})
  return normalizeEmail(
    source.administrator ||
    source.ADMINISTRATOR ||
    environment.administrator ||
    environment.ADMINISTRATOR ||
    DEFAULT_ADMINISTRATOR_EMAIL
  )
}

function getHeaderValue(headers, name) {
  const normalizedName = String(name || '').toLowerCase()
  const entry = Object.entries(headers || {}).find(([headerName]) => String(headerName).toLowerCase() === normalizedName)
  return entry ? entry[1] : undefined
}

function getRequestUserEmail(params = {}) {
  const headers = params.__ow_headers || {}
  return normalizeEmail(
    params.userEmail ||
    params.email ||
    getHeaderValue(headers, 'x-user-email') ||
    getHeaderValue(headers, 'x-ims-user-email') ||
    getHeaderValue(headers, 'x-gw-ims-user-email') ||
    getHeaderValue(headers, 'x-adobe-user-email')
  )
}

const FEATURE_ACCESS_DEFINITIONS = Object.freeze([
  { key: 'home', label: 'Home', defaultMode: ACCESS_MODE_PUBLIC },
  {
    key: 'aepOverview',
    label: 'AEP Overview',
    defaultMode: ACCESS_MODE_ALLOWLIST,
    defaultAllowedEmails: getEmailsForGroups(['coreDemoUsers', 'extendedUtilityUsers'])
  },
  {
    key: 'aepProfileInjector',
    label: 'AI AEP Profile Injector',
    defaultMode: ACCESS_MODE_ALLOWLIST,
    defaultAllowedEmails: getEmailsForGroups(['coreDemoUsers', 'extendedUtilityUsers'])
  },
  { key: 'jsonEditor', label: 'JSON Editor', defaultMode: ACCESS_MODE_PUBLIC },
  { key: 'aiPromptGeneratorEnhanced', label: 'AI Prompt Generator', defaultMode: ACCESS_MODE_PUBLIC },
  { key: 'apiMonitor', label: 'API Monitor', defaultMode: ACCESS_MODE_PUBLIC },
  {
    key: 'proxyManager',
    label: 'API Proxy',
    defaultMode: ACCESS_MODE_ALLOWLIST,
    defaultAllowedEmails: getEmailsForGroups(['coreDemoUsers', 'extendedUtilityUsers', 'fileUtilityUsers'])
  },
  { key: 'campaignTrigger', label: 'Campaign Trigger', defaultMode: ACCESS_MODE_PUBLIC },
  { key: 'dataManagement', label: 'Data Management', defaultMode: ACCESS_MODE_PUBLIC },
  { key: 'cryptoUtils', label: 'Crypto & Token Utils', defaultMode: ACCESS_MODE_PUBLIC },
  {
    key: 'userManagement',
    label: 'User Management',
    defaultMode: ACCESS_MODE_ALLOWLIST,
    defaultAllowedEmails: getEmailsForGroups(['coreDemoUsers'])
  },
  { key: 'aiUserGuide', label: 'AI User Guide', defaultMode: ACCESS_MODE_PUBLIC },
  { key: 'urlShortener', label: 'URL Shortener', defaultMode: ACCESS_MODE_PUBLIC },
  { key: 'aiPromptGenerator', label: 'AI Prompt Generator Legacy', defaultMode: ACCESS_MODE_PUBLIC },
  { key: 'aiApiDocumentation', label: 'AI API Documentation', defaultMode: ACCESS_MODE_PUBLIC },
  {
    key: 'fileManager',
    label: 'File Manager',
    defaultMode: ACCESS_MODE_ALLOWLIST,
    defaultAllowedEmails: getEmailsForGroups(['coreDemoUsers', 'extendedUtilityUsers', 'fileUtilityUsers'])
  },
  {
    key: 'apiDocumentation',
    label: 'Custom Action APIs',
    defaultMode: ACCESS_MODE_ALLOWLIST,
    defaultAllowedEmails: getEmailsForGroups(['coreDemoUsers', 'extendedUtilityUsers', 'fileUtilityUsers', 'apiDocumentationUsers'])
  },
  { key: 'jmeterTestwoFolders', label: 'JMeter Test No Folders', defaultMode: ACCESS_MODE_PUBLIC },
  { key: 'jmeterTestWfolders', label: 'JMeter Test With Folders', defaultMode: ACCESS_MODE_PUBLIC },
  { key: 'createSandbox', label: 'Create Sandbox', defaultMode: ACCESS_MODE_PUBLIC },
  { key: 'deleteSandbox', label: 'Delete Sandbox', defaultMode: ACCESS_MODE_PUBLIC },
  { key: 'actionsForm', label: 'Actions Form', defaultMode: ACCESS_MODE_PUBLIC },
  {
    key: 'contentTemplateMigrator',
    label: 'Content Migrator',
    defaultMode: ACCESS_MODE_ALLOWLIST,
    defaultAllowedEmails: getEmailsForGroups(['coreDemoUsers', 'extendedUtilityUsers'])
  },
  { key: 'offerSimulator', label: 'Offer Simulator', defaultMode: ACCESS_MODE_PUBLIC },
  { key: 'segmentRefresh', label: 'Segment Refresh', defaultMode: ACCESS_MODE_PUBLIC },
  {
    key: 'jmeterTesting',
    label: 'Jmeter Testing',
    defaultMode: ACCESS_MODE_ALLOWLIST,
    defaultAllowedEmails: getEmailsForGroups(['coreDemoUsers', 'extendedUtilityUsers'])
  },
  { key: 'sandboxManagement', label: 'Sandbox Management', defaultMode: ACCESS_MODE_PUBLIC },
  { key: 'about', label: 'About', defaultMode: ACCESS_MODE_PUBLIC },
  {
    key: ADMINISTRATION_FEATURE_KEY,
    label: 'Administration',
    defaultMode: ACCESS_MODE_ALLOWLIST,
    defaultAllowedEmails: [DEFAULT_ADMINISTRATOR_EMAIL]
  }
])

const FEATURE_ACCESS_BY_KEY = Object.freeze(FEATURE_ACCESS_DEFINITIONS.reduce((byKey, definition) => {
  byKey[definition.key] = definition
  return byKey
}, {}))

function normalizeMode(mode, fallbackMode = ACCESS_MODE_PUBLIC) {
  return mode === ACCESS_MODE_ALLOWLIST || mode === ACCESS_MODE_PUBLIC ? mode : fallbackMode
}

function normalizeFeaturePolicy(featureKey, policy = {}, options = {}) {
  const definition = FEATURE_ACCESS_BY_KEY[featureKey]
  if (!definition) {
    return null
  }

  const administratorEmail = getConfiguredAdministratorEmail(options.source || {}, options.env)
  const defaultAllowedEmails = normalizeEmailList(definition.defaultAllowedEmails || [])
  const defaultMode = definition.defaultMode || ACCESS_MODE_PUBLIC
  const mode = featureKey === ADMINISTRATION_FEATURE_KEY
    ? ACCESS_MODE_ALLOWLIST
    : normalizeMode(policy.mode, defaultMode)
  const policyEmails = policy.allowedEmails === undefined
    ? defaultAllowedEmails
    : normalizeEmailList(policy.allowedEmails)
  const allowedEmails = featureKey === ADMINISTRATION_FEATURE_KEY
    ? unique([...policyEmails, administratorEmail])
    : policyEmails

  return {
    mode,
    allowedEmails
  }
}

function createDefaultPolicyDocument(options = {}) {
  const timestamp = options.timestamp || new Date().toISOString()
  const featurePolicies = {}

  for (const definition of FEATURE_ACCESS_DEFINITIONS) {
    featurePolicies[definition.key] = normalizeFeaturePolicy(definition.key, {}, options)
  }

  return {
    storageSchemaVersion: ACCESS_POLICY_SCHEMA_VERSION,
    featurePolicies,
    createdAt: timestamp,
    updatedAt: timestamp,
    updatedBy: options.updatedBy || 'system'
  }
}

function normalizePolicyDocument(document = {}, options = {}) {
  const timestamp = options.timestamp || new Date().toISOString()
  const defaults = createDefaultPolicyDocument({
    ...options,
    timestamp
  })
  const sourcePolicies = document && typeof document === 'object' ? document.featurePolicies || {} : {}
  const featurePolicies = {}

  for (const definition of FEATURE_ACCESS_DEFINITIONS) {
    featurePolicies[definition.key] = normalizeFeaturePolicy(definition.key, sourcePolicies[definition.key] || {}, options)
  }

  return {
    ...defaults,
    ...(document && typeof document === 'object' ? document : {}),
    storageSchemaVersion: document.storageSchemaVersion || ACCESS_POLICY_SCHEMA_VERSION,
    featurePolicies,
    createdAt: document.createdAt || defaults.createdAt,
    updatedAt: document.updatedAt || timestamp,
    updatedBy: document.updatedBy || defaults.updatedBy
  }
}

function validatePolicyDocumentUpdate(document = {}, options = {}) {
  const errors = []
  const policies = document && typeof document === 'object' ? document.featurePolicies || {} : {}
  const knownKeys = new Set(FEATURE_ACCESS_DEFINITIONS.map((definition) => definition.key))
  const administratorEmail = getConfiguredAdministratorEmail(options.source || {}, options.env)

  for (const key of Object.keys(policies)) {
    if (!knownKeys.has(key)) {
      errors.push(`Unknown feature key: ${key}`)
      continue
    }

    const policy = policies[key] || {}
    if (policy.mode !== undefined && policy.mode !== ACCESS_MODE_PUBLIC && policy.mode !== ACCESS_MODE_ALLOWLIST) {
      errors.push(`Invalid access mode for ${key}: ${policy.mode}`)
    }

    if (key === ADMINISTRATION_FEATURE_KEY && policy.mode === ACCESS_MODE_PUBLIC) {
      errors.push('Administration cannot be public')
    }

    for (const email of normalizeEmailList(policy.allowedEmails || [])) {
      if (!isValidEmail(email)) {
        errors.push(`Invalid email for ${key}: ${email}`)
      }
    }
  }

  if (!administratorEmail || !isValidEmail(administratorEmail)) {
    errors.push('administrator must be a valid email address')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

function evaluateFeatureAccess(document, featureKey, userEmail, options = {}) {
  const normalizedEmail = normalizeEmail(userEmail)
  const policyDocument = normalizePolicyDocument(document, options)
  const policy = policyDocument.featurePolicies[featureKey]

  if (!policy) {
    return false
  }

  if (policy.mode === ACCESS_MODE_PUBLIC) {
    return true
  }

  if (!normalizedEmail) {
    return false
  }

  return normalizeEmailList(policy.allowedEmails).includes(normalizedEmail)
}

function createPermissionMap(document, userEmail, options = {}) {
  const permissions = {}
  const policyDocument = normalizePolicyDocument(document, options)

  for (const definition of FEATURE_ACCESS_DEFINITIONS) {
    permissions[definition.key] = evaluateFeatureAccess(policyDocument, definition.key, userEmail, options)
  }

  return permissions
}

function isAdministrator(document, userEmail, options = {}) {
  const administratorEmail = getConfiguredAdministratorEmail(options.source || {}, options.env)
  const normalizedEmail = normalizeEmail(userEmail)

  return Boolean(normalizedEmail && (
    normalizedEmail === administratorEmail ||
    evaluateFeatureAccess(document, ADMINISTRATION_FEATURE_KEY, normalizedEmail, options)
  ))
}

module.exports = {
  ACCESS_GROUPS,
  ACCESS_MODE_ALLOWLIST,
  ACCESS_MODE_PUBLIC,
  ACCESS_POLICY_SCHEMA_VERSION,
  ADMINISTRATION_FEATURE_KEY,
  DEFAULT_ADMINISTRATOR_EMAIL,
  FEATURE_ACCESS_BY_KEY,
  FEATURE_ACCESS_DEFINITIONS,
  createDefaultPolicyDocument,
  createPermissionMap,
  evaluateFeatureAccess,
  getConfiguredAdministratorEmail,
  getEmailsForGroups,
  getRequestUserEmail,
  isAdministrator,
  isValidEmail,
  normalizeEmail,
  normalizeEmailList,
  normalizePolicyDocument,
  validatePolicyDocumentUpdate
}
