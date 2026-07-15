/*
* <license header>
*/

/**
 * Pure helpers for the Offer Decisioning Studio "Design" step.
 *
 * The Design step lets a user author a code-based experience (card / carousel /
 * grid / hero-banner) and export the JSON content payload they paste into AJO
 * when building the code-based experience / Experience Decision.
 *
 * Authored as CommonJS (no React, no browser APIs) so the same logic can be
 * imported by the React component and exercised directly by the Jest suite.
 */

// Standard content fields every experience type exposes in the authoring form.
const DESIGN_FIELDS = ['title', 'description', 'image', 'ctaLabel', 'ctaUrl', 'badge']

// How many content items each experience type carries. Card and hero render a
// single item; carousel and grid render many.
const DESIGN_TYPE_LIMITS = {
  card: 1,
  hero: 1,
  carousel: Infinity,
  grid: Infinity
}

function createDesignItem (overrides = {}) {
  return {
    id: `design-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: '',
    description: '',
    image: '',
    ctaLabel: '',
    ctaUrl: '',
    badge: '',
    custom: [],
    ...overrides
  }
}

function createDefaultDesign () {
  return {
    type: 'card',
    items: [createDesignItem()],
    style: {},
    layout: {}
  }
}

function isNonEmpty (value) {
  return value !== undefined && value !== null && String(value).trim() !== ''
}

// Collapse one authored item to the exported shape: only non-empty standard
// fields, plus any named custom key/value pairs merged in.
function buildExportItem (item = {}) {
  const exported = {}
  DESIGN_FIELDS.forEach((field) => {
    if (isNonEmpty(item[field])) {
      exported[field] = String(item[field]).trim()
    }
  })
  ;(item.custom || []).forEach((pair) => {
    const key = String((pair && pair.key) || '').trim()
    if (key && isNonEmpty(pair && pair.value)) {
      exported[key] = String(pair.value).trim()
    }
  })
  return exported
}

// The house-format JSON handed to AJO:
//   { type, items: [{ title, description, image, ctaLabel, ctaUrl, badge, ...custom }], style?, layout? }
function buildDesignJson (design = {}) {
  const type = design.type || 'card'
  const limit = DESIGN_TYPE_LIMITS[type] || Infinity
  const sourceItems = design.items || []
  const items = (limit === Infinity ? sourceItems : sourceItems.slice(0, limit))
    .map(buildExportItem)

  const json = { type, items }
  if (design.style && Object.keys(design.style).length > 0) {
    json.style = design.style
  }
  if (design.layout && Object.keys(design.layout).length > 0) {
    json.layout = design.layout
  }
  return json
}

// Map an authored item to the shape the existing OfferCardPreview /
// getResolvedOffer renderer understands, so the Design preview reuses the same
// card/carousel/grid/hero rendering as the Inspect (response) preview via the
// DEFAULT_TEMPLATE field mappings.
function toPreviewItem (item = {}) {
  return {
    id: item.id,
    isFallback: false,
    format: 'application/json',
    parsedContent: {
      title: item.title,
      description: item.description,
      ctaLabel: item.ctaLabel,
      badge: item.badge
    },
    deliveryURL: item.image,
    linkURL: item.ctaUrl
  }
}

function escapeHtml (value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Drop javascript: (and other script) URL schemes so exported markup is safe to paste.
function safeUrl (value) {
  const url = String(value || '').trim()
  return /^\s*(javascript|data|vbscript):/i.test(url) ? '#' : url
}

// Self-contained styles scoped to .ods-experience, mirroring the in-app preview.
const DESIGN_HTML_STYLES = `.ods-experience { display: grid; gap: 16px; }
.ods-experience--card { grid-template-columns: minmax(0, 360px); }
.ods-experience--grid { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
.ods-experience--carousel { grid-auto-flow: column; grid-auto-columns: minmax(240px, 34%); overflow-x: auto; padding-bottom: 8px; }
.ods-experience--hero { grid-template-columns: minmax(0, 1fr); }
.ods-card { background: #fff; border: 1px solid #d5d5d5; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,.08); }
.ods-card--hero { display: grid; grid-template-columns: minmax(180px, 42%) 1fr; }
.ods-card__image { width: 100%; height: 180px; object-fit: cover; display: block; background: #f5f5f5; }
.ods-card--hero .ods-card__image { height: 100%; min-height: 260px; }
.ods-card__body { padding: 18px; display: flex; flex-direction: column; gap: 10px; }
.ods-card__badge { align-self: flex-start; background: #e8f2ff; color: #0d66d0; border-radius: 4px; padding: 2px 8px; font-size: 12px; font-weight: 700; }
.ods-card__title { margin: 0; font-size: 22px; line-height: 1.18; overflow-wrap: anywhere; }
.ods-card__desc { margin: 0; color: #555; line-height: 1.45; overflow-wrap: anywhere; }
.ods-card__meta { margin: 0; color: #666; font-size: 13px; }
.ods-card__cta { align-self: flex-start; background: #1473e6; border-radius: 6px; color: #fff; font-weight: 700; margin-top: 4px; padding: 9px 13px; text-decoration: none; }`

function buildCardHtml (item = {}, hero = false) {
  const lines = []
  if (isNonEmpty(item.image)) {
    lines.push(`    <img class="ods-card__image" src="${escapeHtml(safeUrl(item.image))}" alt="${escapeHtml(String(item.title || '').trim())}" />`)
  }
  lines.push('    <div class="ods-card__body">')
  if (isNonEmpty(item.badge)) {
    lines.push(`      <span class="ods-card__badge">${escapeHtml(String(item.badge).trim())}</span>`)
  }
  if (isNonEmpty(item.title)) {
    lines.push(`      <h2 class="ods-card__title">${escapeHtml(String(item.title).trim())}</h2>`)
  }
  if (isNonEmpty(item.description)) {
    lines.push(`      <p class="ods-card__desc">${escapeHtml(String(item.description).trim())}</p>`)
  }
  ;(item.custom || []).forEach((pair) => {
    const key = String((pair && pair.key) || '').trim()
    if (key && isNonEmpty(pair && pair.value)) {
      lines.push(`      <p class="ods-card__meta"><strong>${escapeHtml(key)}:</strong> ${escapeHtml(String(pair.value).trim())}</p>`)
    }
  })
  if (isNonEmpty(item.ctaLabel) || isNonEmpty(item.ctaUrl)) {
    const href = isNonEmpty(item.ctaUrl) ? escapeHtml(safeUrl(item.ctaUrl)) : '#'
    const label = isNonEmpty(item.ctaLabel) ? escapeHtml(String(item.ctaLabel).trim()) : 'Learn more'
    lines.push(`      <a class="ods-card__cta" href="${href}">${label}</a>`)
  }
  lines.push('    </div>')
  return `  <article class="ods-card${hero ? ' ods-card--hero' : ''}">\n${lines.join('\n')}\n  </article>`
}

// Render the authored design as a self-contained HTML fragment (styles + markup)
// that can be pasted into an AJO code-based experience configured for HTML content.
function buildDesignHtml (design = {}) {
  const type = design.type || 'card'
  const limit = DESIGN_TYPE_LIMITS[type] || Infinity
  const sourceItems = design.items || []
  const items = limit === Infinity ? sourceItems : sourceItems.slice(0, limit)
  const hero = type === 'hero'
  const cards = items.map((item) => buildCardHtml(item, hero)).join('\n')
  return `<style>\n${DESIGN_HTML_STYLES}\n</style>\n<div class="ods-experience ods-experience--${escapeHtml(type)}">\n${cards}\n</div>\n`
}

module.exports = {
  DESIGN_FIELDS,
  DESIGN_TYPE_LIMITS,
  createDesignItem,
  createDefaultDesign,
  buildExportItem,
  buildDesignJson,
  buildDesignHtml,
  toPreviewItem
}
