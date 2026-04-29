const {
  ConfigError,
  RUNTIME_INPUT_KEYS,
  getAzureBlobConfig,
  getAzureOpenAIConfig,
  getCampaignTriggerConfig,
  getDefaultAepConfig,
  getOrgConfig,
  getOrgConfigByImsOrg,
  getOrgKeysFromParams,
  listOrgMetadata,
  getRequiredInput
} = require('../actions/shared/config')
const { isRuntimeInjectedParam } = require('../actions/shared/redaction')

const MANAGED_ENV_KEYS = [
  ...RUNTIME_INPUT_KEYS,
  'CANONICAL_KEY',
  'LEGACY_KEY'
]

let originalEnv

beforeEach(() => {
  originalEnv = {}
  for (const key of MANAGED_ENV_KEYS) {
    originalEnv[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(() => {
  for (const key of MANAGED_ENV_KEYS) {
    if (originalEnv[key] === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = originalEnv[key]
    }
  }
})

describe('Runtime config resolver', () => {
  test('resolves canonical params before legacy aliases', () => {
    expect(getRequiredInput({
      CANONICAL_KEY: 'canonical-value',
      LEGACY_KEY: 'legacy-value'
    }, 'CANONICAL_KEY', ['LEGACY_KEY'])).toBe('canonical-value')
  })

  test('resolves legacy aliases before process env values', () => {
    process.env.CANONICAL_KEY = 'env-value'

    expect(getRequiredInput({
      LEGACY_KEY: 'legacy-value'
    }, 'CANONICAL_KEY', ['LEGACY_KEY'])).toBe('legacy-value')
  })

  test('missing config errors name keys without including provided values', () => {
    try {
      getRequiredInput({
        IRRELEVANT_KEY: 'provided-secret-like-value'
      }, 'CANONICAL_KEY', {
        aliases: ['LEGACY_KEY'],
        context: 'Test config'
      })
      throw new Error('Expected config resolution to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError)
      expect(error.missingKeys).toEqual(['CANONICAL_KEY', 'LEGACY_KEY'])
      expect(error.message).toContain('CANONICAL_KEY')
      expect(error.message).toContain('LEGACY_KEY')
      expect(error.message).not.toContain('provided-secret-like-value')
    }
  })

  test('resolves default AEP config with header org and AEP env aliases', () => {
    process.env.AEP_API_KEY = 'env-api-key'
    process.env.AEP_CLIENT_SECRET = 'env-client-secret'
    process.env.AEP_ORG_ID = 'env-org'

    const config = getDefaultAepConfig({}, {
      'x-gw-ims-org-id': 'header-org'
    })

    expect(config).toMatchObject({
      apiKey: 'env-api-key',
      clientSecret: 'env-client-secret',
      orgId: 'header-org',
      imsOrgId: 'header-org'
    })
  })

  test('resolves POT5HOL content-template overrides before base org aliases', () => {
    const config = getOrgConfig({
      POT5HOL_CONTENT_API_KEY: 'content-api-key',
      POT5HOL_API_KEY: 'base-api-key',
      POT5HOL_CONTENT_CLIENT_SECRET: 'content-client-secret',
      POT5HOL_CLIENT_SECRET: 'base-client-secret',
      POT5HOL_IMS_ORG: 'pot5hol-org',
      POT5HOL_TENANT: 'pot5hol-tenant'
    }, 'pot5hol', 'content-templates')

    expect(config).toMatchObject({
      orgKey: 'POT5HOL',
      capability: 'contentTemplates',
      apiKey: 'content-api-key',
      API_KEY: 'content-api-key',
      clientSecret: 'content-client-secret',
      CLIENT_SECRET: 'content-client-secret',
      imsOrg: 'pot5hol-org',
      tenant: 'pot5hol-tenant'
    })
  })

  test('falls back from POT5HOL content-template aliases to base org config', () => {
    const config = getOrgConfig({
      POT5HOL_API_KEY: 'base-api-key',
      POT5HOL_CLIENT_SECRET: 'base-client-secret',
      POT5HOL_IMS_ORG: 'pot5hol-org',
      POT5HOL_TENANT: 'pot5hol-tenant'
    }, 'POT5HOL', 'contentTemplates')

    expect(config.apiKey).toBe('base-api-key')
    expect(config.clientSecret).toBe('base-client-secret')
  })

  test('uses shared Microsoft app role id before org-specific legacy aliases', () => {
    const config = getOrgConfig({
      MS_APP_ROLE_ID: 'shared-role-id',
      MA1HOL_MS_APP_ROLE_ID: 'legacy-role-id',
      MA1HOL_MS_CLIENT_ID: 'ms-client-id',
      MA1HOL_MS_CLIENT_SECRET: 'ms-client-secret',
      MA1HOL_MS_TENANT_ID: 'ms-tenant-id',
      MA1HOL_MS_APP_RESOURCE_ID: 'ms-resource-id'
    }, 'MA1HOL', 'microsoft')

    expect(config.msAppRoleId).toBe('shared-role-id')
    expect(config.MS_APP_ROLE_ID).toBe('shared-role-id')
  })

  test('resolves Microsoft auth config without requiring graph role assignment fields', () => {
    const config = getOrgConfig({
      MA1HOL_MS_CLIENT_ID: 'ms-client-id',
      MA1HOL_MS_CLIENT_SECRET: 'ms-client-secret',
      MA1HOL_MS_TENANT_ID: 'ms-tenant-id'
    }, 'MA1HOL', 'microsoft-auth')

    expect(config).toMatchObject({
      capability: 'microsoftAuth',
      msClientId: 'ms-client-id',
      msClientSecret: 'ms-client-secret',
      msTenantId: 'ms-tenant-id'
    })
  })

  test('discovers org keys from Runtime-style org config inputs', () => {
    expect(getOrgKeysFromParams({
      MA1HOL_API_KEY: 'ma1-api-key',
      POT5HOL_API_KEY: 'pot5-api-key',
      NEWORG_API_KEY: 'new-api-key',
      NEWORG_IMS_ORG: 'new-ims-org',
      AEP_API_KEY: 'global-aep-api-key',
      JMETER_API_KEY: 'jmeter-api-key',
      SERVICE_API_KEY: 'service-api-key'
    })).toEqual(['MA1HOL', 'POT5HOL', 'NEWORG'])
  })

  test('lists non-secret org metadata with capability flags', () => {
    const organizations = listOrgMetadata({
      MA1HOL_API_KEY: 'ma1-api-key',
      MA1HOL_CLIENT_SECRET: 'ma1-secret',
      MA1HOL_IMS_ORG: 'ma1-ims-org',
      MA1HOL_TENANT: 'ma1-tenant',
      MA1HOL_EMAIL_DOMAIN: 'ma1.example.test',
      MA1HOL_MS_CLIENT_ID: 'ma1-ms-client',
      MA1HOL_MS_CLIENT_SECRET: 'ma1-ms-secret',
      MA1HOL_MS_TENANT_ID: 'ma1-ms-tenant',
      MA1HOL_MS_APP_RESOURCE_ID: 'ma1-ms-resource',
      MS_APP_ROLE_ID: 'shared-role-id'
    })

    const ma1hol = organizations.find((org) => org.key === 'MA1HOL')
    expect(ma1hol).toMatchObject({
      key: 'MA1HOL',
      label: 'MA1HOL',
      segmentRefreshLabel: 'MA1HOL - Americas 275 Demo',
      tenant: 'ma1-tenant',
      emailDomain: 'ma1.example.test',
      capabilities: {
        adobe: true,
        sandboxes: true,
        contentTemplates: true,
        microsoftAuth: true,
        microsoft: true
      }
    })
    expect(ma1hol).not.toHaveProperty('apiKey')
    expect(ma1hol).not.toHaveProperty('clientSecret')
    expect(JSON.stringify(ma1hol)).not.toContain('ma1-secret')
    expect(JSON.stringify(ma1hol)).not.toContain('ma1-api-key')
  })

  test('requires sandbox config without echoing configured values', () => {
    expect(() => getOrgConfig({
      MA1HOL_API_KEY: 'ma1-api-key',
      MA1HOL_CLIENT_SECRET: 'ma1-secret'
    }, 'MA1HOL', 'sandboxes')).toThrow(ConfigError)

    try {
      getOrgConfig({
        MA1HOL_API_KEY: 'ma1-api-key',
        MA1HOL_CLIENT_SECRET: 'ma1-secret'
      }, 'MA1HOL', 'sandboxes')
      throw new Error('Expected config resolution to fail')
    } catch (error) {
      expect(error.missingKeys).toEqual(['MA1HOL_IMS_ORG', 'MA1HOL_TENANT'])
      expect(error.message).not.toContain('ma1-api-key')
      expect(error.message).not.toContain('ma1-secret')
    }
  })

  test('resolves org config by IMS org without exposing unmatched IMS values', () => {
    const config = getOrgConfigByImsOrg({
      MA1HOL_API_KEY: 'ma1-api-key',
      MA1HOL_IMS_ORG: 'ma1-ims-org'
    }, 'ma1-ims-org', 'aep')

    expect(config).toMatchObject({
      orgKey: 'MA1HOL',
      apiKey: 'ma1-api-key',
      imsOrg: 'ma1-ims-org'
    })

    expect(() => getOrgConfigByImsOrg({}, 'unknown-ims-org', 'aep')).toThrow(ConfigError)
  })

  test('resolves campaign trigger Adobe credentials from canonical MA1HOL inputs', () => {
    const config = getCampaignTriggerConfig({
      MA1HOL_API_KEY: 'canonical-client-id',
      CAMPAIGN_TRIGGER_CLIENT_ID: 'legacy-client-id',
      MA1HOL_CLIENT_SECRET: 'canonical-client-secret',
      CAMPAIGN_TRIGGER_CLIENT_SECRET: 'legacy-client-secret',
      MA1HOL_IMS_ORG: 'canonical-ims-org',
      CAMPAIGN_TRIGGER_IMS_ORG: 'legacy-ims-org',
      CAMPAIGN_TRIGGER_SCOPE: 'campaign-scope',
      CAMPAIGN_TRIGGER_SANDBOX: 'campaign-sandbox'
    })

    expect(config).toEqual({
      clientId: 'canonical-client-id',
      clientSecret: 'canonical-client-secret',
      scope: 'campaign-scope',
      imsOrg: 'canonical-ims-org',
      sandbox: 'campaign-sandbox'
    })
  })

  test('keeps campaign trigger legacy aliases as fallback during migration', () => {
    const config = getCampaignTriggerConfig({
      CAMPAIGN_TRIGGER_CLIENT_ID: 'legacy-client-id',
      CAMPAIGN_TRIGGER_CLIENT_SECRET: 'legacy-client-secret',
      CAMPAIGN_TRIGGER_IMS_ORG: 'legacy-ims-org',
      CAMPAIGN_TRIGGER_SCOPE: 'campaign-scope',
      CAMPAIGN_TRIGGER_SANDBOX: 'campaign-sandbox'
    })

    expect(config).toMatchObject({
      clientId: 'legacy-client-id',
      clientSecret: 'legacy-client-secret',
      imsOrg: 'legacy-ims-org'
    })
  })

  test('requires Azure Blob URL and SAS token without echoing configured values', () => {
    process.env.AZURE_BLOB_URL = 'https://storage.example.test'

    expect(() => getAzureBlobConfig({})).toThrow(ConfigError)

    try {
      getAzureBlobConfig({})
      throw new Error('Expected config resolution to fail')
    } catch (error) {
      expect(error.missingKeys).toEqual(['AZURE_SAS_TOKEN'])
      expect(error.message).not.toContain('https://storage.example.test')
    }
  })

  test('resolves Azure OpenAI text, image, and vision config groups', () => {
    expect(getAzureOpenAIConfig({
      AZURE_OPENAI_ENDPOINT: 'https://openai.example.test/text',
      AZURE_OPENAI_KEY: 'text-key'
    }, 'text')).toMatchObject({
      purpose: 'text',
      endpoint: 'https://openai.example.test/text',
      apiKey: 'text-key'
    })

    expect(getAzureOpenAIConfig({
      AZURE_OPENAI_IMAGE_ENDPOINT: 'https://openai.example.test/image',
      AZURE_OPENAI_IMAGE_KEY: 'image-key'
    }, 'image')).toMatchObject({
      purpose: 'image',
      endpoint: 'https://openai.example.test/image',
      apiKey: 'image-key'
    })

    expect(getAzureOpenAIConfig({
      AZURE_VISION_ENDPOINT: 'https://vision.example.test/analyze',
      AZURE_VISION_KEY: 'vision-key'
    }, 'vision')).toMatchObject({
      purpose: 'vision',
      endpoint: 'https://vision.example.test/analyze',
      apiKey: 'vision-key'
    })
  })

  test('keeps config runtime inputs synced with redaction filtering', () => {
    for (const key of RUNTIME_INPUT_KEYS) {
      expect(isRuntimeInjectedParam(key)).toBe(true)
    }
  })
})
