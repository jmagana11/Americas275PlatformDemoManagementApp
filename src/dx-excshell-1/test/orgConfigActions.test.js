jest.mock('@adobe/aio-sdk', () => ({
  Core: {
    Logger: jest.fn()
  }
}))

const { Core } = require('@adobe/aio-sdk')
const mockLoggerInstance = { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() }
Core.Logger.mockReturnValue(mockLoggerInstance)

jest.mock('node-fetch')
const fetch = require('node-fetch')

const adobeAuth = require('../actions/adobe-auth/index.js')
const microsoftAuth = require('../actions/microsoft-auth/index.js')
const getOrgSandboxes = require('../actions/get-org-sandboxes/index.js')
const getSandboxes = require('../actions/getsandboxes/index.js')
const contentTemplates = require('../actions/content-templates/index.js')

const orgParams = {
  MA1HOL_API_KEY: 'ma1-api-key',
  MA1HOL_CLIENT_SECRET: 'ma1-secret',
  MA1HOL_IMS_ORG: 'ma1-ims-org',
  MA1HOL_TENANT: 'ma1-tenant',
  MA1HOL_EMAIL_DOMAIN: 'ma1.example.test',
  MA1HOL_MS_CLIENT_ID: 'ma1-ms-client',
  MA1HOL_MS_CLIENT_SECRET: 'ma1-ms-secret',
  MA1HOL_MS_TENANT_ID: 'ma1-ms-tenant',
  MA1HOL_MS_APP_RESOURCE_ID: 'ma1-ms-resource',
  POT5HOL_API_KEY: 'pot5-api-key',
  POT5HOL_CLIENT_SECRET: 'pot5-secret',
  POT5HOL_CONTENT_API_KEY: 'pot5-content-api-key',
  POT5HOL_CONTENT_CLIENT_SECRET: 'pot5-content-secret',
  POT5HOL_IMS_ORG: 'pot5-ims-org',
  POT5HOL_TENANT: 'pot5-tenant',
  MS_APP_ROLE_ID: 'shared-role-id'
}

beforeEach(() => {
  fetch.mockReset()
  Core.Logger.mockClear()
  mockLoggerInstance.info.mockReset()
  mockLoggerInstance.debug.mockReset()
  mockLoggerInstance.error.mockReset()
  mockLoggerInstance.warn.mockReset()
})

describe('org config action integrations', () => {
  test('get-org-sandboxes returns non-secret org metadata for frontend pickers', async () => {
    const response = await getOrgSandboxes.main({
      ...orgParams,
      action: 'list-orgs'
    })

    expect(response.statusCode).toBe(200)
    const ma1hol = response.body.organizations.find((org) => org.key === 'MA1HOL')
    expect(ma1hol).toMatchObject({
      label: 'MA1HOL',
      segmentRefreshLabel: 'MA1HOL - Americas 275 Demo',
      tenant: 'ma1-tenant',
      emailDomain: 'ma1.example.test',
      msAppRoleId: 'shared-role-id',
      msAppResourceId: 'ma1-ms-resource'
    })
    expect(JSON.stringify(response.body)).not.toContain('ma1-secret')
    expect(JSON.stringify(response.body)).not.toContain('ma1-api-key')
    expect(JSON.stringify(response.body)).not.toContain('pot5-content-secret')
  })

  test('get-org-sandboxes uses shared org config for service-token sandbox lookup', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'adobe-token' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sandboxes: [{ name: 'dev' }] })
      })

    const response = await getOrgSandboxes.main({
      ...orgParams,
      org: 'MA1HOL'
    })

    expect(response).toEqual({
      statusCode: 200,
      body: { sandboxes: [{ name: 'dev' }] }
    })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[1][1].headers).toMatchObject({
      'x-api-key': 'ma1-api-key',
      'x-gw-ims-org-id': 'ma1-ims-org'
    })
  })

  test('get-org-sandboxes accepts org from JSON body params', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'adobe-token' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sandboxes: [{ name: 'dev' }] })
      })

    const response = await getOrgSandboxes.main({
      ...orgParams,
      body: JSON.stringify({
        org: 'MA1HOL'
      })
    })

    expect(response).toEqual({
      statusCode: 200,
      body: { sandboxes: [{ name: 'dev' }] }
    })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  test('getsandboxes resolves API key by IMS org through shared org config', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sandboxes: [{ name: 'prod' }] })
    })

    const response = await getSandboxes.main({
      ...orgParams,
      __ow_headers: {
        authorization: 'Bearer user-token',
        'x-gw-ims-org-id': 'ma1-ims-org'
      }
    })

    expect(response).toEqual({
      statusCode: 200,
      body: { sandboxes: [{ name: 'prod' }] }
    })
    expect(fetch.mock.calls[0][1].headers).toMatchObject({
      Authorization: 'Bearer user-token',
      'x-api-key': 'ma1-api-key',
      'x-gw-ims-org-id': 'ma1-ims-org'
    })
  })

  test('adobe-auth resolves credentials by environment key through shared org config', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        access_token: 'adobe-token',
        expires_in: 3600,
        token_type: 'bearer'
      })
    })

    const response = await adobeAuth.main({
      ...orgParams,
      environmentKey: 'MA1HOL'
    })

    expect(response.statusCode).toBe(200)
    expect(fetch.mock.calls[0][1].body.get('client_id')).toBe('ma1-api-key')
    expect(fetch.mock.calls[0][1].body.get('client_secret')).toBe('ma1-secret')
  })

  test('microsoft-auth resolves token credentials without requiring graph assignment config', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        access_token: 'microsoft-token',
        expires_in: 3600,
        token_type: 'Bearer'
      })
    })

    const response = await microsoftAuth.main({
      MA1HOL_MS_CLIENT_ID: 'ma1-ms-client',
      MA1HOL_MS_CLIENT_SECRET: 'ma1-ms-secret',
      MA1HOL_MS_TENANT_ID: 'ma1-ms-tenant',
      environmentKey: 'MA1HOL'
    })

    expect(response.statusCode).toBe(200)
    expect(fetch.mock.calls[0][0]).toContain('/ma1-ms-tenant/')
    expect(fetch.mock.calls[0][1].body.get('client_id')).toBe('ma1-ms-client')
    expect(fetch.mock.calls[0][1].body.get('client_secret')).toBe('ma1-ms-secret')
  })

  test('content-templates keeps POT5HOL content credential overrides', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'content-token' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          items: [{
            id: 'template-1',
            name: 'Template One',
            templateType: 'content'
          }]
        })
      })

    const response = await contentTemplates.main({
      ...orgParams,
      action: 'list-templates',
      org: 'POT5HOL',
      sandbox: 'dev'
    })

    expect(response.statusCode).toBe(200)
    expect(response.body.templates).toEqual([{
      id: 'template-1',
      name: 'Template One',
      type: 'content',
      description: '',
      content: undefined,
      createdAt: undefined,
      updatedAt: undefined
    }])
    expect(fetch.mock.calls[1][1].headers).toMatchObject({
      'x-api-key': 'pot5-content-api-key',
      'x-gw-ims-org-id': 'pot5-ims-org',
      'x-sandbox-name': 'dev'
    })
  })

  test('content-templates accepts action params from JSON body', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'content-token' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: [] })
      })

    const response = await contentTemplates.main({
      ...orgParams,
      body: JSON.stringify({
        action: 'list-templates',
        org: 'POT5HOL',
        sandbox: 'dev'
      })
    })

    expect(response).toEqual({
      statusCode: 200,
      body: {
        success: true,
        templates: [],
        count: 0
      }
    })
    expect(fetch.mock.calls[1][1].headers).toMatchObject({
      'x-api-key': 'pot5-content-api-key',
      'x-gw-ims-org-id': 'pot5-ims-org'
    })
  })
})
