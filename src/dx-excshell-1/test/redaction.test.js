const {
  buildRequestBodyFromFlattenedParams,
  isRuntimeInjectedParam,
  redactObject
} = require('../actions/shared/redaction')

describe('redaction helpers', () => {
  test('removes App Builder runtime inputs from flattened webhook bodies', () => {
    const body = buildRequestBodyFromFlattenedParams({
      AZURE_OPENAI_KEY: 'should-not-leak',
      CAMPAIGN_TRIGGER_CLIENT_SECRET: 'should-not-leak',
      MA1HOL_MS_CLIENT_SECRET: 'should-not-leak',
      apiKey: 'should-not-leak',
      test: 1,
      nested: { value: true }
    })

    expect(body).toEqual({
      test: 1,
      nested: { value: true }
    })
  })

  test('redacts sensitive request fields recursively', () => {
    expect(redactObject({
      headers: {
        authorization: 'Bearer token',
        'x-api-key': 'secret',
        accept: 'application/json'
      },
      body: {
        password: 'secret',
        normal: 'visible'
      }
    })).toEqual({
      headers: {
        authorization: '<redacted>',
        'x-api-key': '<redacted>',
        accept: 'application/json'
      },
      body: {
        password: '<redacted>',
        normal: 'visible'
      }
    })
  })

  test('knows package-level credential inputs are Runtime-injected parameters', () => {
    expect(isRuntimeInjectedParam('POT5HOL_CONTENT_CLIENT_SECRET')).toBe(true)
    expect(isRuntimeInjectedParam('AZURE_BLOB_URL')).toBe(true)
    expect(isRuntimeInjectedParam('test')).toBe(false)
  })
})
