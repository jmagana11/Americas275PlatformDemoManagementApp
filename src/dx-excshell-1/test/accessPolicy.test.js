const {
  ACCESS_MODE_ALLOWLIST,
  ACCESS_MODE_PUBLIC,
  ADMINISTRATION_FEATURE_KEY,
  DEFAULT_ADMINISTRATOR_EMAIL,
  createDefaultPolicyDocument,
  createPermissionMap,
  evaluateFeatureAccess,
  isAdministrator,
  normalizePolicyDocument,
  validatePolicyDocumentUpdate
} = require('../actions/shared/accessPolicy')

describe('access policy defaults and validation', () => {
  test('preserves current public and allowlist defaults', () => {
    const policyDocument = createDefaultPolicyDocument()

    expect(policyDocument.featurePolicies.apiMonitor.mode).toBe(ACCESS_MODE_PUBLIC)
    expect(policyDocument.featurePolicies.aepOverview.mode).toBe(ACCESS_MODE_ALLOWLIST)
    expect(evaluateFeatureAccess(policyDocument, 'apiMonitor', null)).toBe(true)
    expect(evaluateFeatureAccess(policyDocument, 'aepOverview', 'jmagana@adobe.com')).toBe(true)
    expect(evaluateFeatureAccess(policyDocument, 'aepOverview', 'unknown@example.com')).toBe(false)
  })

  test('keeps jmagana as the bootstrap administrator', () => {
    const policyDocument = normalizePolicyDocument({
      featurePolicies: {
        [ADMINISTRATION_FEATURE_KEY]: {
          mode: ACCESS_MODE_PUBLIC,
          allowedEmails: []
        }
      }
    })

    expect(policyDocument.featurePolicies[ADMINISTRATION_FEATURE_KEY]).toEqual({
      mode: ACCESS_MODE_ALLOWLIST,
      allowedEmails: [DEFAULT_ADMINISTRATOR_EMAIL]
    })
    expect(isAdministrator(policyDocument, 'jmagana@adobe.com')).toBe(true)
  })

  test('creates permission maps without exposing policy email lists', () => {
    const permissions = createPermissionMap(createDefaultPolicyDocument(), 'unknown@example.com')

    expect(permissions.apiMonitor).toBe(true)
    expect(permissions.aepOverview).toBe(false)
    expect(Object.values(permissions).some(Array.isArray)).toBe(false)
  })

  test('rejects unknown features, invalid modes, invalid emails, and public administration', () => {
    const validation = validatePolicyDocumentUpdate({
      featurePolicies: {
        missingFeature: {
          mode: ACCESS_MODE_PUBLIC
        },
        apiMonitor: {
          mode: 'team',
          allowedEmails: ['bad-email']
        },
        [ADMINISTRATION_FEATURE_KEY]: {
          mode: ACCESS_MODE_PUBLIC
        }
      }
    })

    expect(validation.valid).toBe(false)
    expect(validation.errors).toEqual(expect.arrayContaining([
      'Unknown feature key: missingFeature',
      'Invalid access mode for apiMonitor: team',
      'Invalid email for apiMonitor: bad-email',
      'Administration cannot be public'
    ]))
  })
})
