jest.mock('@adobe/aio-sdk', () => ({
  Core: {
    Logger: jest.fn(() => ({
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn()
    }))
  }
}))

jest.mock('node-fetch')
const fetch = require('node-fetch')

const {
  buildSchemaListUrl,
  detectTenantRoot,
  flattenFields,
  getNextStart,
  main,
  normalizePageLimit,
  stripTenantPath
} = require('../actions/offer-schema-assistant')

const orgParams = {
  MA1HOL_API_KEY: 'ma1-api-key',
  MA1HOL_CLIENT_SECRET: 'ma1-secret',
  MA1HOL_IMS_ORG: 'ma1-ims-org',
  MA1HOL_TENANT: 'ma1tenant'
}

beforeEach(() => {
  fetch.mockReset()
})

describe('Offer schema assistant helpers', () => {
  test('flattens schema fields with nested required and identity metadata', () => {
    const fields = flattenFields({
      eventType: {
        type: 'string',
        title: 'Event type'
      },
      _tenant123: {
        type: 'object',
        required: ['loyalty'],
        properties: {
          loyalty: {
            type: 'object',
            required: ['status'],
            properties: {
              status: {
                type: 'string',
                enum: ['gold', 'silver']
              },
              score: {
                type: 'number'
              }
            }
          }
        }
      },
      email: {
        type: 'string',
        format: 'email'
      }
    }, {
      rootRequired: ['eventType'],
      identityFields: [{
        path: 'email',
        namespace: 'Email',
        isPrimary: true
      }]
    })

    expect(fields).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: 'eventType',
        type: 'string',
        required: true
      }),
      expect.objectContaining({
        path: '_tenant123.loyalty.status',
        type: 'string',
        enum: ['gold', 'silver'],
        required: true,
        sampleValue: 'gold'
      }),
      expect.objectContaining({
        path: '_tenant123.loyalty.score',
        type: 'number',
        required: false,
        sampleValue: 0
      }),
      expect.objectContaining({
        path: 'email',
        isIdentity: true,
        identity: {
          path: 'email',
          namespace: 'Email',
          isPrimary: true
        }
      })
    ]))
  })

  test('detects and strips tenant roots for context field rows', () => {
    const tenantRoot = detectTenantRoot({
      _tenant123: {
        type: 'object',
        properties: {}
      },
      web: {
        type: 'object',
        properties: {}
      }
    }, {
      TENANT: 'tenant123'
    })

    expect(tenantRoot).toBe('_tenant123')
    expect(stripTenantPath('_tenant123.loyalty.status', tenantRoot)).toBe('loyalty.status')
    expect(stripTenantPath('web.webPageDetails.name', tenantRoot)).toBe('web.webPageDetails.name')
  })

  test('builds paged ExperienceEvent schema list URLs', () => {
    const { url, limit } = buildSchemaListUrl({
      limit: 999,
      start: 'Checkout Event',
      eventSchemasOnly: true
    })
    const parsedUrl = new URL(url)

    expect(limit).toBe(300)
    expect(normalizePageLimit('25')).toBe(25)
    expect(parsedUrl.searchParams.get('orderby')).toBe('title')
    expect(parsedUrl.searchParams.get('limit')).toBe('300')
    expect(parsedUrl.searchParams.get('start')).toBe('Checkout Event')
    expect(parsedUrl.searchParams.get('property')).toBe('meta:class==https://ns.adobe.com/xdm/context/experienceevent')
  })

  test('extracts next pagination cursor from page metadata or next link', () => {
    expect(getNextStart({ _page: { next: 'Loyalty Event' } })).toBe('Loyalty Event')
    expect(getNextStart({
      _links: {
        next: {
          href: 'https://platform.adobe.io/data/foundation/schemaregistry/tenant/schemas?orderby=title&start=Purchase%20Event&limit=100'
        }
      }
    })).toBe('Purchase Event')
  })

  test('listSchemas returns one paged batch and the next cursor', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'platform-token' })
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          results: [{
            $id: 'https://ns.adobe.com/example/schemas/checkout',
            title: 'Checkout Event',
            version: '1.0'
          }],
          _page: {
            orderby: 'title',
            next: 'Checkout Event',
            count: 1
          }
        }))
      })

    const response = await main({
      ...orgParams,
      operation: 'listSchemas',
      org: 'MA1HOL',
      sandboxName: 'dev',
      limit: 1
    })
    const schemaUrl = new URL(fetch.mock.calls[1][0])

    expect(response.statusCode).toBe(200)
    expect(response.body.eventSchemas).toEqual([expect.objectContaining({
      id: 'https://ns.adobe.com/example/schemas/checkout',
      title: 'Checkout Event'
    })])
    expect(response.body.page).toMatchObject({
      limit: 1,
      nextStart: 'Checkout Event',
      hasMore: true,
      eventSchemasOnly: true
    })
    expect(schemaUrl.searchParams.get('orderby')).toBe('title')
    expect(schemaUrl.searchParams.get('limit')).toBe('1')
    expect(schemaUrl.searchParams.get('property')).toBe('meta:class==https://ns.adobe.com/xdm/context/experienceevent')
    expect(fetch.mock.calls[1][1].headers).toMatchObject({
      'x-sandbox-name': 'dev',
      'x-api-key': 'ma1-api-key',
      'x-gw-ims-org-id': 'ma1-ims-org'
    })
  })
})
