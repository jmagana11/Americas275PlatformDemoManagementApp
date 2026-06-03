const {
  createPreviewInteractInput,
  renderPublishedOffer
} = require('../actions/offer-preview')
const {
  DEFAULT_PERSONALIZATION_SCHEMAS
} = require('../actions/shared/offerDecisioning')

const publishedConfig = {
  publicId: 'public-1',
  edge: {
    datastreamId: 'saved-datastream',
    identityNamespace: 'ECID',
    mode: 'decisionScopes',
    decisionScopes: ['saved-scope'],
    surfaces: [],
    schemas: ['saved-schema'],
    xdmDefaults: {
      web: {
        webPageDetails: {
          name: 'saved-page'
        }
      }
    },
    preserveState: true
  },
  template: {
    type: 'card',
    fieldMappings: {
      title: 'parsedContent.title',
      description: 'parsedContent.description',
      image: 'deliveryURL',
      ctaUrl: 'linkURL',
      ctaLabel: 'parsedContent.ctaLabel'
    }
  },
  publish: {
    enabled: true,
    publicId: 'public-1'
  }
}

describe('Offer preview public guardrails', () => {
  test('creates preview requests only from the saved public config plus identity value', () => {
    const input = createPreviewInteractInput(publishedConfig, {
      identityValue: 'profile-1',
      datastreamId: 'caller-datastream',
      identityNamespace: 'EMAIL',
      decisionScopes: ['caller-scope'],
      surfaces: ['caller-surface'],
      schemas: ['caller-schema'],
      xdm: {
        malicious: true
      },
      stateEntries: [{ key: 'state', value: 'value' }]
    })

    expect(input).toMatchObject({
      datastreamId: 'saved-datastream',
      identityNamespace: 'ECID',
      identityValue: 'profile-1',
      mode: 'decisionScopes',
      decisionScopes: ['saved-scope'],
      schemas: DEFAULT_PERSONALIZATION_SCHEMAS,
      xdm: publishedConfig.edge.xdmDefaults,
      preserveState: true,
      stateEntries: [{ key: 'state', value: 'value' }]
    })
    expect(input.surfaces).toEqual([])
  })

  test('renders a public offer without exposing raw Edge response', async () => {
    const edgeFetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        requestId: 'request-1',
        handle: [{
          type: 'personalization:decisions',
          payload: [{
            id: 'prop-1',
            scope: 'saved-scope',
            items: [{
              id: 'offer-1',
              schema: 'json-schema',
              data: {
                format: 'application/json',
                content: '{"title":"Rendered offer","description":"Ready","ctaLabel":"Open"}',
                deliveryURL: 'https://cdn.example.test/offer.png',
                linkURL: 'https://example.test/offer'
              }
            }]
          }]
        }, {
          type: 'state:store',
          payload: [{ key: 'state', value: 'next' }]
        }]
      })
    }))

    const result = await renderPublishedOffer(publishedConfig, {
      identityValue: 'profile-1',
      datastreamId: 'caller-datastream'
    }, {
      fetch: edgeFetch
    })

    expect(edgeFetch.mock.calls[0][0]).toContain('configId=saved-datastream')
    expect(edgeFetch.mock.calls[0][1].body).toContain('saved-scope')
    expect(edgeFetch.mock.calls[0][1].body).not.toContain('caller-datastream')
    expect(result.success).toBe(true)
    expect(result.renderedHtml).toContain('Rendered offer')
    expect(result.stateEntries).toEqual([{ key: 'state', value: 'next' }])
    expect(result.rawResponse).toBeUndefined()
  })

  test('renders object content through saved field mappings', async () => {
    const edgeFetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        requestId: 'request-object',
        handle: [{
          type: 'personalization:decisions',
          payload: [{
            id: 'prop-object',
            scope: 'saved-scope',
            items: [{
              id: 'offer-object',
              schema: 'https://ns.adobe.com/personalization/json-content-item',
              data: {
                content: {
                  title: 'Object rendered offer',
                  description: 'Object ready',
                  ctaLabel: 'Open object'
                },
                linkURL: 'https://example.test/object'
              }
            }]
          }]
        }]
      })
    }))

    const result = await renderPublishedOffer(publishedConfig, {
      identityValue: 'profile-1'
    }, {
      fetch: edgeFetch
    })

    expect(result.success).toBe(true)
    expect(result.renderedHtml).toContain('Object rendered offer')
    expect(result.renderedHtml).toContain('Object ready')
    expect(result.renderedHtml).toContain('Open object')
  })

  test('renders nested object array content when saved mappings include display text', async () => {
    const verboseMappingConfig = {
      ...publishedConfig,
      template: {
        type: 'hero',
        fieldMappings: {
          title: 'Content Default Offer Main Title parsedContent.defaultOffer[0].keynoteName',
          description: 'Content Default Offer Keynote Line1 parsedContent.defaultOffer[0].keynoteLine1',
          image: 'Content Default Offer Keynote Image Url1 parsedContent.defaultOffer[0].keynoteImageUrl1',
          ctaLabel: 'Content Default Offer CTA Label parsedContent.defaultOffer[0].ctaLabel',
          ctaUrl: 'Content Default Offer CTA URL parsedContent.defaultOffer[0].ctaUrl'
        }
      }
    }
    const edgeFetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        requestId: 'request-nested',
        handle: [{
          type: 'personalization:decisions',
          payload: [{
            id: 'prop-nested',
            scope: 'saved-scope',
            items: [{
              id: 'offer-nested',
              schema: 'https://ns.adobe.com/personalization/json-content-item',
              data: {
                content: {
                  defaultOffer: [{
                    keynoteName: 'NeuroPax Clinical Perspectives Series',
                    keynoteLine1: 'Professionals with real-world experience.',
                    keynoteImageUrl1: 'https://cdn.example.test/neuro-keynote.jpg',
                    ctaLabel: 'Explore series',
                    ctaUrl: 'https://example.test/neuro'
                  }]
                }
              }
            }]
          }]
        }]
      })
    }))

    const result = await renderPublishedOffer(verboseMappingConfig, {
      identityValue: 'profile-1'
    }, {
      fetch: edgeFetch
    })

    expect(result.success).toBe(true)
    expect(result.templateType).toBe('hero')
    expect(result.renderedHtml).toContain('NeuroPax Clinical Perspectives Series')
    expect(result.renderedHtml).toContain('Professionals with real-world experience.')
    expect(result.renderedHtml).toContain('https://cdn.example.test/neuro-keynote.jpg')
    expect(result.renderedHtml).toContain('Explore series')
  })
})
