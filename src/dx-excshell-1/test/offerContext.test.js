const {
  contextFieldPath,
  getMissingRequiredContextFields
} = require('../web-src/src/utils/offerContext')

describe('offerContext helpers', () => {
  test('contextFieldPath prefers relativePath then path', () => {
    expect(contextFieldPath({ relativePath: 'a.b', path: '_tenant.a.b' })).toBe('a.b')
    expect(contextFieldPath({ path: '_tenant.a.b' })).toBe('_tenant.a.b')
    expect(contextFieldPath({})).toBe('')
  })

  test('flags required fields with no matching row', () => {
    const required = [{ relativePath: 'productInfo.sku' }, { relativePath: 'productInfo.price' }]
    const rows = [{ path: 'productInfo.sku', value: 'ABC' }]
    expect(getMissingRequiredContextFields(required, rows)).toEqual(['productInfo.price'])
  })

  test('flags required fields whose row is empty or whitespace', () => {
    const required = [{ relativePath: 'productInfo.sku' }]
    expect(getMissingRequiredContextFields(required, [{ path: 'productInfo.sku', value: '   ' }]))
      .toEqual(['productInfo.sku'])
    expect(getMissingRequiredContextFields(required, [{ path: 'productInfo.sku', value: '' }]))
      .toEqual(['productInfo.sku'])
  })

  test('treats non-empty and object values as filled', () => {
    const required = [{ relativePath: 'a.count' }, { relativePath: 'a.meta' }]
    const rows = [
      { path: 'a.count', value: '0' },
      { path: 'a.meta', value: { nested: true } }
    ]
    expect(getMissingRequiredContextFields(required, rows)).toEqual([])
  })

  test('returns empty when there are no required fields', () => {
    expect(getMissingRequiredContextFields([], [{ path: 'x', value: '' }])).toEqual([])
  })

  test('de-dupes repeated required paths', () => {
    const required = [{ relativePath: 'a.b' }, { path: 'a.b' }]
    expect(getMissingRequiredContextFields(required, [])).toEqual(['a.b'])
  })
})
