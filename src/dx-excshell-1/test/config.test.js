const {
  ConfigError,
  RUNTIME_INPUT_KEYS,
  getAzureBlobConfig,
  getAzureOpenAIConfig,
  getCampaignTriggerConfig,
  getDefaultAepConfig,
  getOrgConfig,
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
