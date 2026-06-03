const {
  DEFAULT_PERSONALIZATION_SCHEMAS,
  buildCurl,
  buildEdgeInteractRequest,
  normalizeEdgeResponse
} = require('../actions/shared/offerDecisioning')

describe('Offer Decisioning Edge helpers', () => {
  test('builds a decision-scope interact request with identity, XDM, Assurance, and state', () => {
    const request = buildEdgeInteractRequest({
      datastreamId: 'abc123',
      identityNamespace: 'ECID',
      identityValue: 'profile-1',
      mode: 'decisionScopes',
      decisionScopes: ['scope-1'],
      xdm: {
        web: {
          webPageDetails: {
            name: 'debug'
          }
        },
        identityMap: {
          CRMID: [{ id: 'crm-1', primary: false }]
        }
      },
      assuranceSessionId: 'assurance-1',
      preserveState: true,
      stateEntries: [{ key: 'state-key', value: 'state-value' }]
    }, {
      createRequestId: () => 'request-1'
    })

    expect(request.url).toBe('https://edge.adobedc.net/ee/v1/interact?configId=abc123&requestId=request-1')
    expect(request.headers['x-adobe-aep-validation-token']).toBe('assurance-1')
    expect(request.body.events[0].xdm.identityMap).toEqual({
      CRMID: [{ id: 'crm-1', primary: false }],
      ECID: [{ id: 'profile-1', primary: true }]
    })
    expect(request.body.events[0].query.personalization.decisionScopes).toEqual(['scope-1'])
    expect(request.body.events[0].query.personalization.schemas).toEqual(DEFAULT_PERSONALIZATION_SCHEMAS)
    expect(request.body.meta.state.entries).toEqual([{ key: 'state-key', value: 'state-value' }])
    expect(buildCurl(request)).toContain('x-adobe-aep-validation-token: assurance-1')
  })

  test('builds a surface request with default schemas and omits optional state when absent', () => {
    const request = buildEdgeInteractRequest({
      datastreamId: 'abc123',
      identityNamespace: 'ECID',
      identityValue: 'profile-1',
      mode: 'surfaces',
      surfaces: 'https://example.com/surface'
    }, {
      createRequestId: () => 'request-2'
    })

    expect(request.body.events[0].query.personalization.surfaces).toEqual(['https://example.com/surface'])
    expect(request.body.events[0].query.personalization.schemas).toEqual(DEFAULT_PERSONALIZATION_SCHEMAS)
    expect(request.body.meta).toBeUndefined()
    expect(request.headers['x-adobe-aep-validation-token']).toBeUndefined()
  })

  test('normalizes personalized and fallback offers from Edge handles', () => {
    const normalized = normalizeEdgeResponse({
      requestId: 'request-1',
      handle: [{
        type: 'personalization:decisions',
        payload: [{
          id: 'prop-1',
          scope: 'scope-1',
          activity: { id: 'activity-1' },
          placement: { id: 'placement-1' },
          scopeDetails: {
            characteristics: {
              eventToken: 'scope-token'
            }
          },
          items: [{
            id: 'xcore:personalized-offer:1',
            schema: 'json-schema',
            data: {
              format: 'application/json',
              content: '{"title":"Offer"}',
              deliveryURL: 'https://cdn.example.test/offer.png',
              linkURL: 'https://example.test',
              characteristics: {
                eventToken: 'item-token'
              }
            }
          }, {
            id: 'xcore:fallback-offer:1',
            schema: 'json-schema',
            data: {
              format: 'application/json',
              content: '{"title":"Fallback"}'
            }
          }]
        }]
      }, {
        type: 'locationHint:result',
        payload: [{ scope: 'edge', hint: 'va6' }]
      }, {
        type: 'state:store',
        payload: [{ key: 'kndctr_test', value: 'abc' }]
      }, {
        type: 'identity:result',
        payload: [{ id: 'identity' }]
      }]
    })

    expect(normalized.requestId).toBe('request-1')
    expect(normalized.propositions).toHaveLength(1)
    expect(normalized.propositions[0].items[0]).toMatchObject({
      id: 'xcore:personalized-offer:1',
      isFallback: false,
      parsedContent: { title: 'Offer' },
      deliveryURL: 'https://cdn.example.test/offer.png',
      linkURL: 'https://example.test'
    })
    expect(normalized.propositions[0].items[0].tokens).toEqual(['item-token', 'scope-token'])
    expect(normalized.propositions[0].items[1].isFallback).toBe(true)
    expect(normalized.summary).toMatchObject({
      propositionCount: 1,
      itemCount: 2,
      fallbackCount: 1,
      personalizedCount: 1
    })
    expect(normalized.locationHints).toEqual([{ scope: 'edge', hint: 'va6' }])
    expect(normalized.stateEntries).toEqual([{ key: 'kndctr_test', value: 'abc' }])
    expect(normalized.identity).toEqual([{ id: 'identity' }])
  })

  test('reports empty personalization decisions without failing', () => {
    const normalized = normalizeEdgeResponse({
      requestId: 'request-empty',
      handle: [{
        type: 'personalization:decisions',
        payload: []
      }]
    })

    expect(normalized.propositions).toEqual([])
    expect(normalized.summary).toMatchObject({
      propositionCount: 0,
      itemCount: 0
    })
  })

  test('normalizes object JSON content into parsedContent for canvas mappings', () => {
    const normalized = normalizeEdgeResponse({
      requestId: 'request-object-content',
      handle: [{
        type: 'personalization:decisions',
        payload: [{
          id: 'prop-object',
          scope: 'scope-object',
          items: [{
            id: 'offer-object',
            schema: 'https://ns.adobe.com/personalization/json-content-item',
            data: {
              content: {
                title: 'Object title',
                description: 'Object description',
                ctaLabel: 'Open'
              },
              linkURL: 'https://example.test/object'
            }
          }]
        }]
      }]
    })

    expect(normalized.propositions[0].items[0]).toMatchObject({
      content: {
        title: 'Object title',
        description: 'Object description',
        ctaLabel: 'Open'
      },
      parsedContent: {
        title: 'Object title',
        description: 'Object description',
        ctaLabel: 'Open'
      },
      linkURL: 'https://example.test/object'
    })
  })
})
