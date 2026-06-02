const {
  compareValues,
  csvToJson,
  jsonToCsv,
  normalizeRows,
  queryRows,
  resolveUserKey
} = require('../actions/shared/customActionStore')

describe('customActionStore', () => {
  test('resolveUserKey hashes email consistently', () => {
    const first = resolveUserKey({}, { ownerEmail: 'User@Adobe.com' })
    const second = resolveUserKey({}, { userEmail: 'user@adobe.com' })
    expect(first).toBe(second)
    expect(first).toHaveLength(32)
  })

  test('csvToJson and jsonToCsv round-trip simple rows', () => {
    const rows = [
      { customer_id: 'CUST-001', status: 'shipped' },
      { customer_id: 'CUST-002', status: 'pending' }
    ]
    const csv = jsonToCsv(rows)
    const parsed = csvToJson(csv)
    expect(parsed).toEqual(rows)
  })

  test('normalizeRows rejects oversized uploads', () => {
    const rows = Array.from({ length: 10001 }, (_, index) => ({ id: String(index) }))
    expect(() => normalizeRows(rows)).toThrow(/maximum/)
  })

  test('queryRows filters, limits, and formats object responses', () => {
    const rows = [
      { customer_id: 'A', total: '10' },
      { customer_id: 'B', total: '20' },
      { customer_id: 'A', total: '30' }
    ]

    const result = queryRows(rows, {
      where: { column: 'customer_id', op: 'eq', value: 'a' },
      limit: 1,
      format: 'object',
      fields: ['customer_id', 'total']
    })

    expect(result.success).toBe(true)
    expect(result.data).toEqual({ customer_id: 'A', total: '10' })
    expect(result.meta.totalMatches).toBe(2)
    expect(result.meta.returned).toBe(1)
  })

  test('compareValues supports contains and numeric operators', () => {
    expect(compareValues('Hello World', 'world', 'contains')).toBe(true)
    expect(compareValues('15', '10', 'gt')).toBe(true)
    expect(compareValues('5', '10', 'lte')).toBe(true)
  })
})
