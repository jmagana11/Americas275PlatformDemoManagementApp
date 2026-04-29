// Access Control Utility
// Dynamic access policies are loaded from the access-management action; static defaults keep local and fallback behavior stable.

var $RefreshReg$ = typeof globalThis !== 'undefined' && globalThis.$RefreshReg$
  ? globalThis.$RefreshReg$
  : function () {}

const {
  ACCESS_GROUPS,
  ACCESS_MODE_ALLOWLIST,
  ACCESS_MODE_PUBLIC,
  ADMINISTRATION_FEATURE_KEY,
  DEFAULT_ADMINISTRATOR_EMAIL,
  FEATURE_ACCESS_DEFINITIONS,
  createDefaultPolicyDocument,
  evaluateFeatureAccess,
  normalizeEmail,
  normalizeEmailList,
  normalizePolicyDocument
} = require('../../../actions/shared/accessPolicy')

const ACCESS_POLICY_GROUPS = Object.freeze({
  userManagement: Object.freeze(['coreDemoUsers']),
  aepOverview: Object.freeze(['coreDemoUsers', 'extendedUtilityUsers']),
  jmeterTesting: Object.freeze(['coreDemoUsers', 'extendedUtilityUsers']),
  fileManager: Object.freeze(['coreDemoUsers', 'extendedUtilityUsers', 'fileUtilityUsers']),
  apiTester: Object.freeze(['coreDemoUsers', 'extendedUtilityUsers', 'fileUtilityUsers']),
  apiDocumentation: Object.freeze(['coreDemoUsers', 'extendedUtilityUsers', 'fileUtilityUsers', 'apiDocumentationUsers']),
  contentMigrator: Object.freeze(['coreDemoUsers', 'extendedUtilityUsers']),
  aiProfileInjector: Object.freeze(['coreDemoUsers', 'extendedUtilityUsers']),
  apiProxy: Object.freeze(['coreDemoUsers', 'extendedUtilityUsers', 'fileUtilityUsers']),
  admin: Object.freeze(['coreDemoUsers'])
})

const ACCESS_POLICY_LABELS = Object.freeze(FEATURE_ACCESS_DEFINITIONS.reduce((labels, definition) => {
  labels[definition.key] = definition.label
  return labels
}, {
  apiTester: 'API Tester',
  aiProfileInjector: 'AI AEP Profile Injector',
  apiProxy: 'API Proxy',
  contentMigrator: 'Content Migrator',
  admin: 'admin features'
}))

function getDefaultPolicyDocument() {
  return createDefaultPolicyDocument({
    source: {
      administrator: DEFAULT_ADMINISTRATOR_EMAIL
    }
  })
}

function getDefaultAllowedEmailsByFeature() {
  const policyDocument = getDefaultPolicyDocument()
  return Object.keys(policyDocument.featurePolicies).reduce((allowedByFeature, featureKey) => {
    allowedByFeature[featureKey] = policyDocument.featurePolicies[featureKey].allowedEmails
    return allowedByFeature
  }, {})
}

const ACCESS_POLICIES = Object.freeze(getDefaultAllowedEmailsByFeature())

function getFirstStringValue(values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return null
}

function getUserEmail(ims) {
  return getFirstStringValue([
    ims?.profile?.email,
    ims?.profile?.emailAddress,
    ims?.profile?.mail,
    ims?.profile?.userEmail,
    ims?.email,
    ims?.userEmail,
    ims?.userProfile?.email
  ])
}

function normalizeImsEmail(ims) {
  return normalizeEmail(getUserEmail(ims))
}

function createStaticAccessState(options = {}) {
  return {
    source: options.source || 'static',
    permissions: null,
    isAdmin: false,
    backendAdminVerified: false,
    policiesLoaded: false,
    loadError: options.loadError || null,
    userEmail: options.userEmail || null
  }
}

function buildAccessStateFromResponse(response) {
  if (!response || response.success !== true || !response.permissions) {
    return createStaticAccessState({
      source: 'fallback',
      loadError: response && response.error ? response.error : 'Access policies unavailable'
    })
  }

  return {
    source: 'dynamic',
    permissions: response.permissions,
    isAdmin: response.isAdmin === true,
    backendAdminVerified: response.isAdmin === true,
    policiesLoaded: response.policiesLoaded === true,
    loadError: null,
    userEmail: response.userEmail || null
  }
}

function hasDynamicPermission(featureKey, accessState) {
  return Boolean(
    accessState &&
    accessState.permissions &&
    Object.prototype.hasOwnProperty.call(accessState.permissions, featureKey)
  )
}

function hasFeatureAccess(featureKey, ims, accessState) {
  const normalizedFeatureKey = featureKey === 'admin'
    ? ADMINISTRATION_FEATURE_KEY
    : featureKey

  if (normalizedFeatureKey === ADMINISTRATION_FEATURE_KEY) {
    return Boolean(accessState && accessState.backendAdminVerified && accessState.isAdmin)
  }

  if (hasDynamicPermission(normalizedFeatureKey, accessState)) {
    return accessState.permissions[normalizedFeatureKey] === true
  }

  const userEmail = normalizeImsEmail(ims)
  const featureLabel = ACCESS_POLICY_LABELS[normalizedFeatureKey] || normalizedFeatureKey
  const policyDocument = getDefaultPolicyDocument()
  const policy = normalizePolicyDocument(policyDocument).featurePolicies[normalizedFeatureKey]

  if (policy && policy.mode === ACCESS_MODE_PUBLIC) {
    return true
  }

  if (!userEmail) {
    console.warn(`No email found in IMS profile, denying access to ${featureLabel}`)
    return false
  }

  return evaluateFeatureAccess(policyDocument, normalizedFeatureKey, userEmail, {
    source: {
      administrator: DEFAULT_ADMINISTRATOR_EMAIL
    }
  })
}

function createAccessChecker(featureKey) {
  return (ims, accessState) => hasFeatureAccess(featureKey, ims, accessState)
}

const hasUserManagementAccess = createAccessChecker('userManagement')
const hasAEPOverviewAccess = createAccessChecker('aepOverview')
const hasJmeterTestingAccess = createAccessChecker('jmeterTesting')
const hasFileManagerAccess = createAccessChecker('fileManager')
const hasApiTesterAccess = createAccessChecker('apiMonitor')
const hasApiDocumentationAccess = createAccessChecker('apiDocumentation')
const hasContentMigratorAccess = createAccessChecker('contentTemplateMigrator')
const hasAIProfileInjectorAccess = createAccessChecker('aepProfileInjector')
const hasApiProxyAccess = createAccessChecker('proxyManager')
const hasAdminAccess = createAccessChecker(ADMINISTRATION_FEATURE_KEY)

function getUserAccessPermissions(ims, accessState) {
  const permissions = FEATURE_ACCESS_DEFINITIONS.reduce((summary, definition) => {
    summary[definition.key] = hasFeatureAccess(definition.key, ims, accessState)
    return summary
  }, {})

  permissions.apiTester = permissions.apiMonitor
  permissions.contentMigrator = permissions.contentTemplateMigrator
  permissions.aiProfileInjector = permissions.aepProfileInjector
  permissions.apiProxy = permissions.proxyManager
  permissions.admin = permissions[ADMINISTRATION_FEATURE_KEY]

  return permissions
}

function getAllowedEmailsByFeature(policyDocument) {
  const normalizedDocument = normalizePolicyDocument(policyDocument || getDefaultPolicyDocument(), {
    source: {
      administrator: DEFAULT_ADMINISTRATOR_EMAIL
    }
  })

  return Object.keys(normalizedDocument.featurePolicies).reduce((allowedByFeature, featureKey) => {
    const policy = normalizedDocument.featurePolicies[featureKey]
    allowedByFeature[featureKey] = policy.mode === ACCESS_MODE_ALLOWLIST
      ? normalizeEmailList(policy.allowedEmails)
      : []
    return allowedByFeature
  }, {})
}

function isDebugEnabled(ims, options = {}) {
  if (options.debug === true || ims?.accessControlDebug === true) {
    return true
  }

  if (typeof window === 'undefined' || !window.localStorage) {
    return false
  }

  try {
    return window.localStorage.getItem('accessControlDebug') === 'true'
  } catch (error) {
    return false
  }
}

function logAccessControlInfo(ims, options = {}) {
  const info = {
    userEmail: getUserEmail(ims),
    permissions: getUserAccessPermissions(ims, options.accessState)
  }

  if (isDebugEnabled(ims, options)) {
    info.allowedEmailsByFeature = getAllowedEmailsByFeature(options.policyDocument)
  }

  console.log('Access Control Info:', info)
}

module.exports = {
  ACCESS_GROUPS,
  ACCESS_MODE_ALLOWLIST,
  ACCESS_MODE_PUBLIC,
  ACCESS_POLICIES,
  ACCESS_POLICY_GROUPS,
  ADMINISTRATION_FEATURE_KEY,
  FEATURE_ACCESS_DEFINITIONS,
  buildAccessStateFromResponse,
  createStaticAccessState,
  getAllowedEmailsByFeature,
  getFirstStringValue,
  getUserAccessPermissions,
  getUserEmail,
  hasAEPOverviewAccess,
  hasAIProfileInjectorAccess,
  hasAdminAccess,
  hasApiDocumentationAccess,
  hasApiProxyAccess,
  hasApiTesterAccess,
  hasContentMigratorAccess,
  hasFeatureAccess,
  hasFileManagerAccess,
  hasJmeterTestingAccess,
  hasUserManagementAccess,
  logAccessControlInfo
}
