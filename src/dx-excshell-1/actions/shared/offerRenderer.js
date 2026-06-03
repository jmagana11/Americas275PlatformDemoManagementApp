/*
* <license header>
*/

const DEFAULT_TEMPLATE = Object.freeze({
  type: 'card',
  fieldMappings: {
    title: 'parsedContent.title',
    description: 'parsedContent.description',
    image: 'deliveryURL',
    ctaLabel: 'parsedContent.ctaLabel',
    ctaUrl: 'linkURL',
    badge: 'parsedContent.badge'
  },
  style: {},
  layout: {}
})

function ensureObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function ensureArray(value) {
  return Array.isArray(value) ? value : []
}

function escapeHtml(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function sanitizeHtml(html) {
  return String(html || '')
    .replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/\s+(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, ' $1="#"')
}

function getContentObject(content) {
  if (content && typeof content === 'object' && !Array.isArray(content)) {
    return content
  }
  if (typeof content !== 'string') {
    return {}
  }

  const trimmed = content.trim()
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) {
    return {}
  }

  try {
    const parsed = JSON.parse(trimmed)
    return ensureObject(parsed)
  } catch (error) {
    return {}
  }
}

function normalizePath(path) {
  return String(path || '')
    .trim()
    .replace(/^\$\./, '')
    .replace(/\[(\d+)\]/g, '.$1')
}

function getCandidateMappingPaths(path) {
  const rawPath = String(path || '').trim()
  if (!rawPath) {
    return []
  }

  const paths = [rawPath]
  const nestedMatches = rawPath.match(/(?:parsedContent|contentObject|characteristics|data)(?:\.[a-zA-Z0-9_$-]+|\[\d+\])+/g) || []
  const topLevelMatches = rawPath.match(/\b(?:deliveryURL|deliveryUrl|linkURL|linkUrl|schema|format|scope|propositionId)\b/g) || []

  return [...new Set([...paths, ...nestedMatches, ...topLevelMatches])]
}

function extractMappingPath(path) {
  const candidates = getCandidateMappingPaths(path)
  return candidates.find((candidate) => candidate !== String(path || '').trim()) || candidates[0] || ''
}

function getByPath(source, path) {
  const normalizedPath = normalizePath(path)
  if (!normalizedPath) {
    return ''
  }

  return normalizedPath.split('.').reduce((current, part) => {
    if (current === undefined || current === null || part === '') {
      return undefined
    }
    return current[part]
  }, source)
}

function normalizeTemplate(template = {}) {
  const incoming = ensureObject(template)
  const incomingMappings = {
    ...DEFAULT_TEMPLATE.fieldMappings,
    ...ensureObject(incoming.fieldMappings)
  }
  const fieldMappings = Object.entries(incomingMappings).reduce((mappings, [key, value]) => ({
    ...mappings,
    [key]: extractMappingPath(value)
  }), {})

  return {
    ...DEFAULT_TEMPLATE,
    ...incoming,
    fieldMappings,
    style: {
      ...DEFAULT_TEMPLATE.style,
      ...ensureObject(incoming.style)
    },
    layout: {
      ...DEFAULT_TEMPLATE.layout,
      ...ensureObject(incoming.layout)
    }
  }
}

function getOfferItems(normalized = {}) {
  return ensureArray(normalized.propositions)
    .flatMap((proposition) => ensureArray(proposition.items).map((item) => ({
      ...item,
      propositionId: proposition.id,
      scope: proposition.scope,
      activity: proposition.activity,
      placement: proposition.placement,
      scopeDetails: proposition.scopeDetails
    })))
}

function buildMappingSource(item = {}) {
  const parsedContent = Object.keys(ensureObject(item.parsedContent)).length > 0
    ? ensureObject(item.parsedContent)
    : getContentObject(item.content)
  return {
    ...item,
    parsedContent,
    contentObject: parsedContent,
    content: item.content,
    data: {
      ...parsedContent,
      content: item.content
    }
  }
}

function resolveMappedValue(item, path) {
  const source = buildMappingSource(item)
  const candidatePaths = getCandidateMappingPaths(path)
  let value

  for (const candidatePath of candidatePaths) {
    value = getByPath(source, candidatePath)
    if (value !== undefined && value !== null && value !== '') {
      break
    }
  }

  if (value === undefined || value === null) {
    return ''
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return value
}

function getResolvedOffer(item = {}, template = DEFAULT_TEMPLATE) {
  const mappings = normalizeTemplate(template).fieldMappings
  const title = resolveMappedValue(item, mappings.title) || item.id || 'Offer'
  const description = resolveMappedValue(item, mappings.description)
  const image = resolveMappedValue(item, mappings.image) || item.deliveryURL
  const ctaLabel = resolveMappedValue(item, mappings.ctaLabel) || 'Learn more'
  const ctaUrl = resolveMappedValue(item, mappings.ctaUrl) || item.linkURL || '#'
  const badge = resolveMappedValue(item, mappings.badge) || (item.isFallback ? 'Fallback' : 'Personalized')

  return {
    title,
    description,
    image,
    ctaLabel,
    ctaUrl,
    badge,
    htmlContent: item.format === 'text/html' ? sanitizeHtml(item.content) : '',
    isFallback: Boolean(item.isFallback),
    itemId: item.id,
    propositionId: item.propositionId,
    scope: item.scope
  }
}

function renderOfferCard(item, template) {
  const offer = getResolvedOffer(item, template)
  const badgeClass = offer.isFallback ? 'ods-badge ods-badge-fallback' : 'ods-badge ods-badge-personalized'
  const imageHtml = offer.image
    ? `<img class="ods-card-image" src="${escapeHtml(offer.image)}" alt="${escapeHtml(offer.title)}" />`
    : ''
  const descriptionHtml = offer.htmlContent
    ? `<div class="ods-html-content">${offer.htmlContent}</div>`
    : `<p class="ods-card-description">${escapeHtml(offer.description)}</p>`

  return `
    <article class="ods-offer-card" data-proposition-id="${escapeHtml(offer.propositionId)}" data-item-id="${escapeHtml(offer.itemId)}">
      ${imageHtml}
      <div class="ods-card-body">
        <span class="${badgeClass}">${escapeHtml(offer.badge)}</span>
        <h2>${escapeHtml(offer.title)}</h2>
        ${descriptionHtml}
        <a class="ods-cta" href="${escapeHtml(offer.ctaUrl)}" data-ods-interact="true">${escapeHtml(offer.ctaLabel)}</a>
      </div>
    </article>
  `
}

function renderHero(items, template) {
  if (items.length === 0) {
    return ''
  }
  return `<section class="ods-hero">${renderOfferCard(items[0], template)}</section>`
}

function renderGrid(items, template) {
  return `<section class="ods-grid">${items.map((item) => renderOfferCard(item, template)).join('')}</section>`
}

function renderCarousel(items, template) {
  return `<section class="ods-carousel" aria-label="Offer carousel">${items.map((item) => renderOfferCard(item, template)).join('')}</section>`
}

function getRendererStyles() {
  return `
    .ods-preview-root { font-family: adobe-clean, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #222; }
    .ods-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
    .ods-carousel { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(240px, 32%); gap: 16px; overflow-x: auto; padding-bottom: 8px; scroll-snap-type: x mandatory; }
    .ods-carousel .ods-offer-card { scroll-snap-align: start; }
    .ods-hero .ods-offer-card { display: grid; grid-template-columns: minmax(180px, 44%) 1fr; align-items: stretch; max-width: 920px; }
    .ods-offer-card { background: #fff; border: 1px solid #d5d5d5; border-radius: 8px; min-width: 0; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.08); }
    .ods-card-image { width: 100%; height: 180px; object-fit: cover; display: block; background: #f5f5f5; }
    .ods-hero .ods-card-image { height: 100%; min-height: 260px; }
    .ods-card-body { padding: 18px; display: flex; flex-direction: column; gap: 10px; }
    .ods-card-body h2 { font-size: 22px; line-height: 1.18; margin: 0; overflow-wrap: anywhere; }
    .ods-card-description { margin: 0; line-height: 1.45; color: #555; overflow-wrap: anywhere; }
    .ods-html-content { line-height: 1.45; overflow-wrap: anywhere; }
    .ods-badge { align-self: flex-start; border-radius: 999px; font-size: 12px; font-weight: 700; line-height: 1; padding: 6px 9px; }
    .ods-badge-personalized { background: #e6f6e6; color: #146c2e; }
    .ods-badge-fallback { background: #fff4ce; color: #6f4d00; }
    .ods-cta { align-self: flex-start; background: #1473e6; border-radius: 6px; color: #fff; font-weight: 700; margin-top: 4px; padding: 9px 13px; text-decoration: none; }
    .ods-empty { border: 1px dashed #b9b9b9; border-radius: 8px; color: #666; padding: 24px; text-align: center; }
    @media (max-width: 640px) {
      .ods-carousel { grid-auto-columns: minmax(240px, 88%); }
      .ods-hero .ods-offer-card { display: block; }
      .ods-hero .ods-card-image { height: 210px; min-height: 0; }
    }
  `
}

function renderOfferExperience(normalized = {}, template = DEFAULT_TEMPLATE) {
  const safeTemplate = normalizeTemplate(template)
  const items = getOfferItems(normalized)
  let html

  if (items.length === 0) {
    html = '<div class="ods-empty">No offer items returned.</div>'
  } else if (safeTemplate.type === 'carousel') {
    html = renderCarousel(items, safeTemplate)
  } else if (safeTemplate.type === 'grid') {
    html = renderGrid(items, safeTemplate)
  } else if (safeTemplate.type === 'hero') {
    html = renderHero(items, safeTemplate)
  } else {
    html = renderGrid(items.slice(0, 1), safeTemplate)
  }

  return {
    html: `<div class="ods-preview-root">${html}</div>`,
    styles: getRendererStyles(),
    itemCount: items.length,
    templateType: safeTemplate.type
  }
}

module.exports = {
  DEFAULT_TEMPLATE,
  escapeHtml,
  extractMappingPath,
  getOfferItems,
  getRendererStyles,
  getResolvedOffer,
  normalizeTemplate,
  renderOfferExperience,
  resolveMappedValue,
  sanitizeHtml
}
