jest.mock('@adobe/aio-sdk', () => ({
  Core: {
    Logger: jest.fn()
  }
}))

jest.mock('node-fetch')

const { Core } = require('@adobe/aio-sdk')
const fetch = require('node-fetch')
const action = require('../actions/campaign-trigger/index.js')

const mockLoggerInstance = { info: jest.fn(), debug: jest.fn(), error: jest.fn() }
Core.Logger.mockReturnValue(mockLoggerInstance)

beforeEach(() => {
  fetch.mockReset()
  Core.Logger.mockClear()
  mockLoggerInstance.info.mockReset()
  mockLoggerInstance.debug.mockReset()
  mockLoggerInstance.error.mockReset()
})

const basePayload = {
  campaignId: 'campaign-1',
  recipients: [
    {
      type: 'aep',
      userId: 'user-1'
    }
  ]
}

describe('campaign-trigger', () => {
  test('returns existing missing-config response when required config is absent', async () => {
    const response = await action.main(basePayload)

    expect(fetch).not.toHaveBeenCalled()
    expect(response).toEqual({
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: { error: 'Campaign trigger configuration is missing' }
    })
  })

  test('uses canonical MA1HOL credentials for token and campaign requests', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'access-token' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      })

    const response = await action.main({
      ...basePayload,
      MA1HOL_API_KEY: 'canonical-client-id',
      MA1HOL_CLIENT_SECRET: 'canonical-client-secret',
      MA1HOL_IMS_ORG: 'canonical-ims-org',
      CAMPAIGN_TRIGGER_SCOPE: 'campaign-scope',
      CAMPAIGN_TRIGGER_SANDBOX: 'campaign-sandbox'
    })

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[0][0]).toBe('https://ims-na1.adobelogin.com/ims/token/v3')
    expect(fetch.mock.calls[0][1].body.toString()).toContain('client_id=canonical-client-id')
    expect(fetch.mock.calls[0][1].body.toString()).toContain('client_secret=canonical-client-secret')
    expect(fetch.mock.calls[0][1].body.toString()).toContain('scope=campaign-scope')

    expect(fetch.mock.calls[1][1].headers).toMatchObject({
      'x-api-key': 'canonical-client-id',
      'x-gw-ims-org-id': 'canonical-ims-org',
      'x-sandbox-name': 'campaign-sandbox',
      Authorization: 'Bearer access-token'
    })
    expect(response).toEqual({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { success: true }
    })
  })
})
