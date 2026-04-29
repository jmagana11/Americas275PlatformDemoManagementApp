const {
  ACCESS_POLICIES,
  buildAccessStateFromResponse,
  FEATURE_ACCESS_DEFINITIONS,
  getUserAccessPermissions,
  hasAEPOverviewAccess,
  hasAdminAccess,
  hasApiDocumentationAccess,
  hasApiProxyAccess,
  hasContentMigratorAccess,
  hasFileManagerAccess,
  hasJmeterTestingAccess,
  hasUserManagementAccess,
  logAccessControlInfo
} = require('../web-src/src/utils/accessControl')

function imsFor(email, extras = {}) {
  return {
    ...extras,
    profile: {
      email
    }
  }
}

describe('frontend access control', () => {
  let logSpy
  let warnSpy

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
    warnSpy.mockRestore()
  })

  test('preserves core demo user access across protected features', () => {
    const ims = imsFor('jmagana@adobe.com')

    expect(hasUserManagementAccess(ims)).toBe(true)
    expect(hasAEPOverviewAccess(ims)).toBe(true)
    expect(hasJmeterTestingAccess(ims)).toBe(true)
    expect(hasFileManagerAccess(ims)).toBe(true)
    expect(hasApiDocumentationAccess(ims)).toBe(true)
    expect(hasContentMigratorAccess(ims)).toBe(true)
    expect(hasApiProxyAccess(ims)).toBe(true)
    expect(hasAdminAccess(ims)).toBe(false)
  })

  test('requires dynamic backend confirmation for administration access', () => {
    const ims = imsFor('jmagana@adobe.com')
    const accessState = buildAccessStateFromResponse({
      success: true,
      isAdmin: true,
      policiesLoaded: true,
      permissions: {
        administration: true
      }
    })

    expect(hasAdminAccess(ims)).toBe(false)
    expect(hasAdminAccess(ims, accessState)).toBe(true)
  })

  test('preserves extended user differences by feature', () => {
    const delapena = imsFor('delapena@adobe.com')
    const abbey = imsFor('abbey@adobe.com')
    const ivory = imsFor('ivory@adobe.com')

    expect(hasAEPOverviewAccess(delapena)).toBe(true)
    expect(hasContentMigratorAccess(delapena)).toBe(true)
    expect(hasUserManagementAccess(delapena)).toBe(false)
    expect(hasAdminAccess(delapena)).toBe(false)

    expect(hasFileManagerAccess(abbey)).toBe(true)
    expect(hasApiProxyAccess(abbey)).toBe(true)
    expect(hasAEPOverviewAccess(abbey)).toBe(false)

    expect(hasApiDocumentationAccess(ivory)).toBe(true)
    expect(hasFileManagerAccess(ivory)).toBe(false)
  })

  test('denies unknown or missing users', () => {
    expect(hasUserManagementAccess(imsFor('unknown@example.com'))).toBe(false)
    expect(hasAEPOverviewAccess({ profile: {} })).toBe(false)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No email found'))
  })

  test('recognizes common IMS email profile shapes', () => {
    expect(hasAEPOverviewAccess({ profile: { emailAddress: ' JMAGANA@adobe.com ' } })).toBe(true)
    expect(hasContentMigratorAccess({ profile: { mail: 'delapena@adobe.com' } })).toBe(true)
    expect(hasApiDocumentationAccess({ userProfile: { email: 'ivory@adobe.com' } })).toBe(true)
  })

  test('returns stable permission summary keys', () => {
    const keys = Object.keys(getUserAccessPermissions(imsFor('jmagana@adobe.com')))

    for (const definition of FEATURE_ACCESS_DEFINITIONS) {
      expect(keys).toContain(definition.key)
    }
    expect(keys).toEqual(expect.arrayContaining([
      'apiTester',
      'contentMigrator',
      'aiProfileInjector',
      'apiProxy',
      'admin'
    ]))
  })

  test('does not dump allowlists unless debug mode is enabled', () => {
    logAccessControlInfo(imsFor('jmagana@adobe.com'))
    expect(logSpy).toHaveBeenLastCalledWith('Access Control Info:', expect.not.objectContaining({
      allowedEmailsByFeature: expect.any(Object)
    }))

    logAccessControlInfo(imsFor('jmagana@adobe.com'), { debug: true })
    expect(logSpy).toHaveBeenLastCalledWith('Access Control Info:', expect.objectContaining({
      allowedEmailsByFeature: ACCESS_POLICIES
    }))
  })
})
