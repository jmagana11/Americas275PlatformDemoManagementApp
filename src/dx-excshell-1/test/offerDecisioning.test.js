const {
  DEFAULT_PERSONALIZATION_SCHEMAS,
  applyContextOverrides,
  buildCurl,
  buildEdgeInteractRequest,
  flattenXdmPaths,
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

  // Regression for the RBC carousel: AJO returns the whole carousel as a single
  // json-content-item whose content is { type: 'carousel', items: [3 slides] }.
  // All three slides must be expanded into individual offer items so the preview
  // and published page render every card, not just one.
  test('expands a house-format carousel content item into one offer per slide', () => {
    const normalized = normalizeEdgeResponse({
      requestId: '0a0eb19c-2071-4e43-9879-a2c0691d0252',
      handle: [{
        type: 'personalization:decisions',
        payload: [{
          id: '16fdbcbc-f325-45f5-8920-2c6a823c5f62',
          scope: 'web://lab.rbc.com/home#carousel',
          scopeDetails: {
            characteristics: { eventToken: 'carousel-event-token' }
          },
          items: [{
            id: '815dfdbe-5b43-4d91-a090-c5467b60d981',
            schema: 'https://ns.adobe.com/personalization/json-content-item',
            data: {
              content: {
                type: 'carousel',
                items: [{
                  badge: 'RBC-NBAS',
                  ctaLabel: 'Open My FHSA Today',
                  ctaUrl: 'https://www.rbcroyalbank.com/investments/fhsa.html',
                  description: 'Save tax-free with an FHSA.',
                  image: 'https://cdn.example.test/fhsa.png',
                  title: 'First-Time Home Buyer Advantage: Save Tax-Free with an FHSA'
                }, {
                  badge: 'RBC-NBAS',
                  ctaLabel: 'Talk to a Mortgage Specialist',
                  ctaUrl: 'https://www.rbcroyalbank.com/mortgages/special-mortgage-offers.html',
                  description: 'Get more value from your next RBC mortgage.',
                  image: 'https://cdn.example.test/mortgage.png',
                  title: 'Get More Value From Your Next RBC Mortgage'
                }, {
                  badge: 'RBC-NBAS',
                  ctaLabel: 'Send Money Now',
                  ctaUrl: 'https://www.rbcroyalbank.com/banking-services/international-money-transfer.html',
                  description: 'Send money home, simply and securely.',
                  image: 'https://cdn.example.test/imt.png',
                  title: 'Send Money Home, Simply and Securely'
                }]
              }
            }
          }]
        }]
      }]
    })

    // One proposition, but its single container item is split into three slides.
    expect(normalized.propositions).toHaveLength(1)
    expect(normalized.propositions[0].items).toHaveLength(3)
    expect(normalized.experienceType).toBe('carousel')
    expect(normalized.summary).toMatchObject({
      propositionCount: 1,
      itemCount: 3,
      experienceType: 'carousel'
    })

    // Each slide is projected onto the shape DEFAULT_TEMPLATE maps against:
    // text fields on parsedContent, image via deliveryURL, CTA via linkURL.
    const [first, , third] = normalized.propositions[0].items
    expect(first).toMatchObject({
      experienceType: 'carousel',
      containerIndex: 0,
      deliveryURL: 'https://cdn.example.test/fhsa.png',
      linkURL: 'https://www.rbcroyalbank.com/investments/fhsa.html',
      parsedContent: {
        title: 'First-Time Home Buyer Advantage: Save Tax-Free with an FHSA',
        ctaLabel: 'Open My FHSA Today',
        badge: 'RBC-NBAS'
      }
    })
    expect(third).toMatchObject({
      containerIndex: 2,
      deliveryURL: 'https://cdn.example.test/imt.png',
      parsedContent: { title: 'Send Money Home, Simply and Securely' }
    })
    // Split items get stable, distinct ids derived from the parent item id.
    expect(new Set(normalized.propositions[0].items.map((item) => item.id)).size).toBe(3)
  })

  test('leaves a single-item card container as one offer item', () => {
    const normalized = normalizeEdgeResponse({
      requestId: 'request-card',
      handle: [{
        type: 'personalization:decisions',
        payload: [{
          id: 'prop-card',
          scope: 'scope-card',
          items: [{
            id: 'offer-card',
            schema: 'https://ns.adobe.com/personalization/json-content-item',
            data: {
              content: {
                type: 'card',
                items: [{ title: 'Solo card', description: 'One item', image: 'https://cdn.example.test/card.png' }]
              }
            }
          }]
        }]
      }]
    })

    expect(normalized.propositions[0].items).toHaveLength(1)
    expect(normalized.experienceType).toBe('card')
    expect(normalized.propositions[0].items[0]).toMatchObject({
      deliveryURL: 'https://cdn.example.test/card.png',
      parsedContent: { title: 'Solo card' }
    })
  })
})

describe('Context override helpers', () => {
  const defaults = {
    _tenant: {
      productInfo: { sku: 'ABC', price: 10 },
      loyalty: { member: true }
    }
  }

  test('flattenXdmPaths returns dotted leaf paths with values', () => {
    expect(flattenXdmPaths(defaults)).toEqual([
      { path: '_tenant.productInfo.sku', value: 'ABC' },
      { path: '_tenant.productInfo.price', value: 10 },
      { path: '_tenant.loyalty.member', value: true }
    ])
    expect(flattenXdmPaths({})).toEqual([])
  })

  test('applyContextOverrides applies allowed paths and coerces to the saved type', () => {
    const allowed = flattenXdmPaths(defaults).map((entry) => entry.path)
    const result = applyContextOverrides(defaults, {
      '_tenant.productInfo.sku': 'XYZ',
      '_tenant.productInfo.price': '25',
      '_tenant.loyalty.member': 'false'
    }, allowed)

    expect(result._tenant.productInfo.sku).toBe('XYZ')
    expect(result._tenant.productInfo.price).toBe(25) // coerced number
    expect(result._tenant.loyalty.member).toBe(false) // coerced boolean
    // original defaults are not mutated
    expect(defaults._tenant.productInfo.price).toBe(10)
  })

  test('applyContextOverrides ignores paths that are not in the allow-list', () => {
    const allowed = ['_tenant.productInfo.sku']
    const result = applyContextOverrides(defaults, {
      '_tenant.productInfo.sku': 'XYZ',
      '_tenant.productInfo.price': '999',
      'evil.injected': 'nope'
    }, allowed)

    expect(result._tenant.productInfo.sku).toBe('XYZ')
    expect(result._tenant.productInfo.price).toBe(10) // unchanged
    expect(result.evil).toBeUndefined()
  })
})
