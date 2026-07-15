const {
  DESIGN_TYPE_LIMITS,
  createDesignItem,
  createDefaultDesign,
  buildExportItem,
  buildDesignJson,
  buildDesignHtml,
  toPreviewItem
} = require('../web-src/src/utils/offerDesign')

describe('offerDesign helpers', () => {
  test('createDefaultDesign starts as a single-item card with empty style/layout', () => {
    const design = createDefaultDesign()
    expect(design.type).toBe('card')
    expect(design.items).toHaveLength(1)
    expect(design.style).toEqual({})
    expect(design.layout).toEqual({})
    expect(design.items[0]).toMatchObject({
      title: '',
      description: '',
      image: '',
      ctaLabel: '',
      ctaUrl: '',
      badge: '',
      custom: []
    })
    expect(typeof design.items[0].id).toBe('string')
  })

  test('DESIGN_TYPE_LIMITS caps single-item types and allows many for multi-item types', () => {
    expect(DESIGN_TYPE_LIMITS.card).toBe(1)
    expect(DESIGN_TYPE_LIMITS.hero).toBe(1)
    expect(DESIGN_TYPE_LIMITS.carousel).toBe(Infinity)
    expect(DESIGN_TYPE_LIMITS.grid).toBe(Infinity)
  })

  test('buildExportItem drops empty fields and trims values', () => {
    const exported = buildExportItem(createDesignItem({
      title: '  Premium plan  ',
      description: '',
      image: 'https://cdn.example.test/a.png',
      ctaLabel: '   ',
      ctaUrl: '',
      badge: 'New'
    }))
    expect(exported).toEqual({
      title: 'Premium plan',
      image: 'https://cdn.example.test/a.png',
      badge: 'New'
    })
  })

  test('buildExportItem merges named custom key/value pairs and ignores blanks', () => {
    const exported = buildExportItem(createDesignItem({
      title: 'Card',
      custom: [
        { key: 'eyebrow', value: 'Limited time' },
        { key: '', value: 'ignored' },
        { key: 'empty', value: '   ' }
      ]
    }))
    expect(exported).toEqual({
      title: 'Card',
      eyebrow: 'Limited time'
    })
  })

  test('buildDesignJson caps card/hero to one item but keeps every carousel item', () => {
    const items = [
      createDesignItem({ title: 'One' }),
      createDesignItem({ title: 'Two' }),
      createDesignItem({ title: 'Three' })
    ]

    const card = buildDesignJson({ type: 'card', items, style: {}, layout: {} })
    expect(card).toEqual({ type: 'card', items: [{ title: 'One' }] })

    const carousel = buildDesignJson({ type: 'carousel', items, style: {}, layout: {} })
    expect(carousel.items).toHaveLength(3)
    expect(carousel.items.map((entry) => entry.title)).toEqual(['One', 'Two', 'Three'])
  })

  test('buildDesignJson only includes style/layout when populated', () => {
    const base = { type: 'grid', items: [createDesignItem({ title: 'A' })] }
    expect(buildDesignJson({ ...base, style: {}, layout: {} })).not.toHaveProperty('style')

    const withStyle = buildDesignJson({ ...base, style: { theme: 'dark' }, layout: { columns: 2 } })
    expect(withStyle.style).toEqual({ theme: 'dark' })
    expect(withStyle.layout).toEqual({ columns: 2 })
  })

  test('buildDesignHtml emits a scoped, type-tagged, escaped HTML fragment', () => {
    const html = buildDesignHtml({
      type: 'carousel',
      items: [
        createDesignItem({
          title: 'Premium <5G> "plan"',
          description: 'Body',
          image: 'https://cdn.example.test/a.png',
          ctaLabel: 'View',
          ctaUrl: 'https://example.test/go',
          custom: [{ key: 'eyebrow', value: 'Limited' }]
        })
      ]
    })
    expect(html).toContain('<style>')
    expect(html).toContain('ods-experience--carousel')
    // title is HTML-escaped
    expect(html).toContain('Premium &lt;5G&gt; &quot;plan&quot;')
    expect(html).not.toContain('<5G>')
    expect(html).toContain('href="https://example.test/go"')
    expect(html).toContain('>View</a>')
    expect(html).toContain('<strong>eyebrow:</strong> Limited')
  })

  test('buildDesignHtml caps a card to one item and neutralizes javascript: URLs', () => {
    const html = buildDesignHtml({
      type: 'card',
      items: [
        createDesignItem({ title: 'One', ctaUrl: 'javascript:alert(1)' }),
        createDesignItem({ title: 'Two' })
      ]
    })
    expect(html).toContain('>One</h2>')
    expect(html).not.toContain('>Two</h2>')
    expect(html).not.toContain('javascript:')
    expect(html).toContain('href="#"')
  })

  test('toPreviewItem maps authored fields onto the renderer shape', () => {
    const preview = toPreviewItem(createDesignItem({
      title: 'Hero',
      description: 'Body',
      image: 'https://cdn.example.test/hero.png',
      ctaLabel: 'Go',
      ctaUrl: 'https://example.test/go',
      badge: 'Featured'
    }))
    expect(preview).toMatchObject({
      isFallback: false,
      format: 'application/json',
      parsedContent: {
        title: 'Hero',
        description: 'Body',
        ctaLabel: 'Go',
        badge: 'Featured'
      },
      deliveryURL: 'https://cdn.example.test/hero.png',
      linkURL: 'https://example.test/go'
    })
  })
})
