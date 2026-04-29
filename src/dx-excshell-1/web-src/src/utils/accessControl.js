// Access Control Utility
// This utility manages which users can access specific features based on their email addresses.

var $RefreshReg$ = typeof globalThis !== 'undefined' && globalThis.$RefreshReg$
  ? globalThis.$RefreshReg$
  : function () {}

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

const ACCESS_POLICY_LABELS = Object.freeze({
  userManagement: 'User Management',
  aepOverview: 'AEP Overview',
  jmeterTesting: 'Jmeter Testing',
  fileManager: 'File Manager',
  apiTester: 'API Tester',
  apiDocumentation: 'API Documentation',
  contentMigrator: 'Content Migrator',
  aiProfileInjector: 'AI AEP Profile Injector',
  apiProxy: 'API Proxy',
  admin: 'admin features'
})

function getUniqueEmails(groupNames) {
  const emails = []
  for (const groupName of groupNames || []) {
    for (const email of ACCESS_GROUPS[groupName] || []) {
      if (!emails.includes(email)) {
        emails.push(email)
      }
    }
  }
  return emails
}

function freezePolicyEmails(featureKey) {
  return Object.freeze(getUniqueEmails(ACCESS_POLICY_GROUPS[featureKey]))
}

const ACCESS_POLICIES = Object.freeze({
  userManagement: freezePolicyEmails('userManagement'),
  aepOverview: freezePolicyEmails('aepOverview'),
  jmeterTesting: freezePolicyEmails('jmeterTesting'),
  fileManager: freezePolicyEmails('fileManager'),
  apiTester: freezePolicyEmails('apiTester'),
  apiDocumentation: freezePolicyEmails('apiDocumentation'),
  contentMigrator: freezePolicyEmails('contentMigrator'),
  aiProfileInjector: freezePolicyEmails('aiProfileInjector'),
  apiProxy: freezePolicyEmails('apiProxy'),
  admin: freezePolicyEmails('admin')
})

function getFirstStringValue(values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return null
}

function normalizeEmail(ims) {
  const userEmail = getUserEmail(ims)
  return userEmail ? userEmail.toLowerCase() : null
}

function hasAccess(featureKey, ims) {
  const userEmail = normalizeEmail(ims)
  const featureLabel = ACCESS_POLICY_LABELS[featureKey] || featureKey

  if (!userEmail) {
    console.warn(`No email found in IMS profile, denying access to ${featureLabel}`)
    return false
  }

  return (ACCESS_POLICIES[featureKey] || []).includes(userEmail)
}

function createAccessChecker(featureKey) {
  return (ims) => hasAccess(featureKey, ims)
}

const hasUserManagementAccess = createAccessChecker('userManagement')
const hasAEPOverviewAccess = createAccessChecker('aepOverview')
const hasJmeterTestingAccess = createAccessChecker('jmeterTesting')
const hasFileManagerAccess = createAccessChecker('fileManager')
const hasApiTesterAccess = createAccessChecker('apiTester')
const hasApiDocumentationAccess = createAccessChecker('apiDocumentation')
const hasContentMigratorAccess = createAccessChecker('contentMigrator')
const hasAIProfileInjectorAccess = createAccessChecker('aiProfileInjector')
const hasApiProxyAccess = createAccessChecker('apiProxy')
const hasAdminAccess = createAccessChecker('admin')

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

function getUserAccessPermissions(ims) {
  return {
    userManagement: hasUserManagementAccess(ims),
    aepOverview: hasAEPOverviewAccess(ims),
    jmeterTesting: hasJmeterTestingAccess(ims),
    fileManager: hasFileManagerAccess(ims),
    apiTester: hasApiTesterAccess(ims),
    apiDocumentation: hasApiDocumentationAccess(ims),
    contentMigrator: hasContentMigratorAccess(ims),
    aiProfileInjector: hasAIProfileInjectorAccess(ims),
    apiProxy: hasApiProxyAccess(ims),
    admin: hasAdminAccess(ims)
  }
}

function getAllowedEmailsByFeature() {
  return Object.keys(ACCESS_POLICIES).reduce((allowedByFeature, featureKey) => {
    allowedByFeature[featureKey] = ACCESS_POLICIES[featureKey]
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
    permissions: getUserAccessPermissions(ims)
  }

  if (isDebugEnabled(ims, options)) {
    info.allowedEmailsByFeature = getAllowedEmailsByFeature()
  }

  console.log('Access Control Info:', info)
}

module.exports = {
  ACCESS_GROUPS,
  ACCESS_POLICIES,
  ACCESS_POLICY_GROUPS,
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
  hasFileManagerAccess,
  hasJmeterTestingAccess,
  hasUserManagementAccess,
  logAccessControlInfo
}
