/*
* <license header>
*/

import React, { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import {
  ActionButton,
  ActionMenu,
  AlertDialog,
  Badge,
  Button,
  ButtonGroup,
  Cell,
  Column,
  ComboBox,
  ContextualHelp,
  Content,
  DialogContainer,
  Divider,
  Flex,
  Footer,
  Form,
  Heading,
  Item,
  Link,
  Picker,
  ProgressCircle,
  Row,
  StatusLight,
  Switch,
  TableBody,
  TableHeader,
  TableView,
  TabList,
  TabPanels,
  Tabs,
  Text,
  TextArea,
  TextField,
  View,
  Well
} from '@adobe/react-spectrum'
import Add from '@spectrum-icons/workflow/Add'
import Copy from '@spectrum-icons/workflow/Copy'
import Delete from '@spectrum-icons/workflow/Delete'
import Function from '@spectrum-icons/workflow/Function'
import Gift from '@spectrum-icons/workflow/Gift'
import Preview from '@spectrum-icons/workflow/Preview'
import Refresh from '@spectrum-icons/workflow/Refresh'
import SaveFloppy from '@spectrum-icons/workflow/SaveFloppy'

import allActions from '../config.json'
import actionWebInvoke from '../utils'
import {
  DESIGN_TYPE_LIMITS,
  createDesignItem,
  createDefaultDesign,
  buildDesignJson,
  buildDesignHtml,
  toPreviewItem
} from '../utils/offerDesign'
import { getMissingRequiredContextFields } from '../utils/offerContext'

const DEFAULT_PERSONALIZATION_SCHEMAS = Object.freeze([
  'https://ns.adobe.com/personalization/dom-action',
  'https://ns.adobe.com/personalization/html-content-item',
  'https://ns.adobe.com/personalization/json-content-item',
  'https://ns.adobe.com/personalization/redirect-item',
  'https://ns.adobe.com/personalization/ruleset-item',
  'https://ns.adobe.com/personalization/message/in-app',
  'https://ns.adobe.com/personalization/message/content-card',
  'https://ns.adobe.com/personalization/message/native-alert',
  'https://ns.adobe.com/personalization/measurement',
  'https://ns.adobe.com/personalization/eventHistoryOperation',
  'https://ns.adobe.com/personalization/default-content-item'
])
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
const TEMPLATE_FIELD_LABELS = Object.freeze({
  title: 'Title',
  description: 'Description',
  image: 'Image',
  ctaLabel: 'CTA label',
  ctaUrl: 'CTA URL',
  badge: 'Badge'
})

// Ordered editing steps revealed progressively via "Save & continue".
// Request and Inspect are folded into one step so building the request and viewing
// the results happen on the same screen (no tab hopping).
const STEP_ORDER = Object.freeze(['design', 'request', 'publish'])
const STEP_LABELS = Object.freeze({ design: 'Design', request: 'Request & inspect', publish: 'Publish' })

// Per-section guidance shown in the info popovers: purpose, how to use, and a doc link.
const SECTION_GUIDANCE = Object.freeze({
  design: {
    title: 'Design the experience',
    body: 'Author a code-based experience (card, carousel, grid, or hero) and export its JSON — the author-defined content payload you paste into AJO to build the code-based experience / Experience Decision.',
    docHref: 'https://experienceleague.adobe.com/en/docs/journey-optimizer/using/channels/code-based-experience/get-started-code-based',
    docLabel: 'Code-based experiences'
  },
  designJson: {
    title: 'Experience JSON',
    body: 'The content payload — standard fields plus any custom keys you add. Copy JSON (or Copy as HTML) and paste it into your AJO code-based experience content.',
    docHref: 'https://experienceleague.adobe.com/en/docs/journey-optimizer/using/channels/code-based-experience/create-code-based-experiences/create-code-based-experiences-landing-page',
    docLabel: 'Create code-based experiences'
  },
  requestBasics: {
    title: 'Decision request',
    body: 'Sends a personalization decision request to Adobe Experience Edge for a test profile. Provide the Datastream ID and the identity (namespace + value) that maps to the profile you want to test.',
    docHref: 'https://experienceleague.adobe.com/en/docs/experience-platform/web-sdk/personalization/offer-decisioning/offer-decisioning-overview',
    docLabel: 'Offer decisioning via Web SDK'
  },
  decisionInput: {
    title: 'Decision input',
    body: 'Request by decision scopes or by surfaces. Surfaces target specific app/page locations; decision scopes are Base64 activity/placement scopes. Pick one input type per request.',
    docHref: 'https://experienceleague.adobe.com/en/docs/experience-platform/tags/extensions/client/web-sdk/actions/send-event',
    docLabel: 'Scopes & surfaces'
  },
  surfaces: {
    title: 'Surfaces',
    body: 'Full surface URIs (Type://Property/Container), e.g. web://my.site.com/about.html or web://my.site.com/*#hero_image. Enter one per line; the request targets the single surface you select below.',
    docHref: 'https://experienceleague.adobe.com/en/docs/journey-optimizer/using/channels/code-based-experience/configure-code-based-channel/code-based-surface',
    docLabel: 'Code-based surfaces'
  },
  schemaAssistant: {
    title: 'Schema assistant (optional)',
    body: 'Browse an XDM ExperienceEvent schema to see its fields, how many are required, and the tenant root, then add fields as XDM context. A simple decision needs only an identity plus a scope or surface.',
    docHref: 'https://experienceleague.adobe.com/en/docs/journey-optimizer/using/decisioning/offer-decisioning/context-data/context-data-edge',
    docLabel: 'Context data & Edge decisioning'
  },
  contextFields: {
    title: 'XDM / context fields',
    body: 'Optional XDM context sent with the request. It must be XDM ExperienceEvent-compliant (under the tenant field group). Required schema fields must be filled before sending; leave empty for a simple event.',
    docHref: 'https://experienceleague.adobe.com/en/docs/journey-optimizer/using/decisioning/offer-decisioning/context-data/context-data-edge',
    docLabel: 'Context data & Edge decisioning'
  },
  visualPreview: {
    title: 'Visual preview',
    body: 'Renders the returned decision as a card, carousel, grid, or hero. Map the response payload fields to the display slots, or use Suggest mappings to auto-map common fields.'
  },
  assurance: {
    title: 'Assurance session ID',
    body: 'Optional. Attach this request to an Adobe Experience Platform Assurance session so you can inspect the live Edge call, XDM, and returned decisions in Assurance for debugging. Copy the session ID from an active Assurance session; leave blank to skip.',
    docHref: 'https://experienceleague.adobe.com/en/docs/experience-platform/assurance/home',
    docLabel: 'Adobe Experience Platform Assurance'
  },
  publish: {
    title: 'Publish & share',
    body: 'Save this studio configuration and publish a standalone preview page. On that page a tester enters an identity (and picks a surface / edits context fields) to retrieve the live decision.',
    docHref: 'https://experienceleague.adobe.com/en/docs/journey-optimizer/using/channels/code-based-experience/create-code-based-experiences/create-code-based-experiences-landing-page',
    docLabel: 'Publish & manage experiences'
  }
})

const SAMPLE_RESULT = Object.freeze({
  request: {
    requestId: 'sample-request',
    url: 'https://edge.adobedc.net/ee/v1/interact?configId=sample&requestId=sample-request',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      events: [{
        xdm: {
          identityMap: {
            ECID: [{ id: 'sample-profile', primary: true }]
          }
        },
        query: {
          personalization: {
            decisionScopes: ['sample-scope'],
            schemas: DEFAULT_PERSONALIZATION_SCHEMAS
          }
        }
      }]
    }
  },
  rawResponse: {
    requestId: 'sample-request',
    handle: [{
      type: 'personalization:decisions',
      payload: [{
        id: 'sample-proposition',
        scope: 'sample-scope',
        activity: { id: 'xcore:offer-activity:sample' },
        placement: { id: 'xcore:offer-placement:sample' },
        items: [{
          id: 'xcore:personalized-offer:sample',
          schema: 'https://ns.adobe.com/experience/offer-management/content-component-json',
          data: {
            format: 'application/json',
            content: JSON.stringify({
              title: 'Premium 5G plan',
              description: 'Unlimited data with priority support and device protection.',
              ctaLabel: 'View plan',
              badge: 'Personalized'
            }),
            deliveryURL: 'https://adbecdn.blob.core.windows.net/labs/edu/5g.png',
            linkURL: 'https://example.com/offers/5g',
            characteristics: {
              eventToken: 'sample-token'
            }
          }
        }]
      }]
    }, {
      type: 'state:store',
      payload: [{ key: 'kndctr_sample', value: 'state-value', maxAge: 1800 }]
    }]
  },
  normalized: {
    requestId: 'sample-request',
    propositions: [{
      id: 'sample-proposition',
      scope: 'sample-scope',
      scopeDetails: null,
      activity: { id: 'xcore:offer-activity:sample' },
      placement: { id: 'xcore:offer-placement:sample' },
      items: [{
        id: 'xcore:personalized-offer:sample',
        isFallback: false,
        schema: 'https://ns.adobe.com/experience/offer-management/content-component-json',
        format: 'application/json',
        content: '{"title":"Premium 5G plan","description":"Unlimited data with priority support and device protection.","ctaLabel":"View plan","badge":"Personalized"}',
        parsedContent: {
          title: 'Premium 5G plan',
          description: 'Unlimited data with priority support and device protection.',
          ctaLabel: 'View plan',
          badge: 'Personalized'
        },
        deliveryURL: 'https://adbecdn.blob.core.windows.net/labs/edu/5g.png',
        linkURL: 'https://example.com/offers/5g',
        characteristics: { eventToken: 'sample-token' },
        tokens: ['sample-token']
      }]
    }],
    locationHints: [],
    stateEntries: [{ key: 'kndctr_sample', value: 'state-value', maxAge: 1800 }],
    identity: [],
    handles: [],
    summary: {
      propositionCount: 1,
      itemCount: 1,
      fallbackCount: 0,
      personalizedCount: 1
    }
  },
  curl: 'curl -X POST https://edge.adobedc.net/ee/v1/interact'
})

function getActionUrl(actionName) {
  return allActions[actionName] || allActions[`dx-excshell-1/${actionName}`]
}

function parseList(value) {
  return String(value || '')
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function stringifyJson(value) {
  return JSON.stringify(value || {}, null, 2)
}

function parseJsonField(value, fallback = {}) {
  if (!String(value || '').trim()) {
    return fallback
  }
  return JSON.parse(value)
}

function createXdmField(overrides = {}) {
  return {
    id: `xdm-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    path: '',
    type: 'string',
    value: '',
    ...overrides
  }
}

function inferXdmFieldType(value) {
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  if (value && typeof value === 'object') return 'json'
  return 'string'
}

function stringifyXdmFieldValue(value) {
  if (value && typeof value === 'object') {
    return JSON.stringify(value)
  }
  return value === undefined || value === null ? '' : String(value)
}

function flattenXdmObject(value, prefix = '') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [createXdmField({
      path: prefix,
      type: inferXdmFieldType(value),
      value: stringifyXdmFieldValue(value)
    })] : []
  }

  return Object.entries(value).flatMap(([key, entryValue]) => {
    const path = prefix ? `${prefix}.${key}` : key
    if (entryValue && typeof entryValue === 'object' && !Array.isArray(entryValue)) {
      return flattenXdmObject(entryValue, path)
    }
    return [createXdmField({
      path,
      type: inferXdmFieldType(entryValue),
      value: stringifyXdmFieldValue(entryValue)
    })]
  })
}

function parseXdmFieldValue(field) {
  if (field.type === 'number') {
    const parsed = Number(field.value)
    if (Number.isNaN(parsed)) {
      throw new Error(`XDM field "${field.path}" must be a number`)
    }
    return parsed
  }
  if (field.type === 'boolean') {
    return String(field.value).toLowerCase() === 'true'
  }
  if (field.type === 'json') {
    return parseJsonField(field.value, null)
  }
  return field.value
}

function setNestedValue(target, path, value) {
  const parts = String(path || '').split('.').map((part) => part.trim()).filter(Boolean)
  if (parts.length === 0) {
    return
  }

  let current = target
  parts.forEach((part, index) => {
    const isArrayPart = part.endsWith('[]')
    const safePart = isArrayPart ? part.slice(0, -2) : part
    if (index === parts.length - 1) {
      current[safePart] = isArrayPart ? [value] : value
      return
    }
    if (isArrayPart) {
      if (!Array.isArray(current[safePart])) {
        current[safePart] = [{}]
      }
      current = current[safePart][0]
      return
    }
    if (!current[safePart] || typeof current[safePart] !== 'object' || Array.isArray(current[safePart])) {
      current[safePart] = {}
    }
    current = current[safePart]
  })
}

function buildXdmFromFields(fields = [], tenantField = '') {
  const safeTenantField = String(tenantField || '').trim()
  const context = fields.reduce((xdm, field) => {
    let fieldPath = String(field.path || '').trim()
    if (safeTenantField && fieldPath === safeTenantField) {
      fieldPath = ''
    } else if (safeTenantField && fieldPath.startsWith(`${safeTenantField}.`)) {
      fieldPath = fieldPath.slice(safeTenantField.length + 1)
    }

    if (!fieldPath) {
      return xdm
    }
    setNestedValue(xdm, fieldPath, parseXdmFieldValue(field))
    return xdm
  }, {})

  if (!safeTenantField) {
    return context
  }

  if (Object.keys(context).length === 0) {
    return {}
  }

  return {
    [safeTenantField]: context
  }
}

function getContextFieldsFromConfig(edge = {}) {
  const xdmDefaults = edge.xdmDefaults || {}
  const tenantField = String(edge.contextTenantField || '').trim()
  if (tenantField && xdmDefaults && typeof xdmDefaults === 'object' && !Array.isArray(xdmDefaults) && xdmDefaults[tenantField]) {
    return flattenXdmObject(xdmDefaults[tenantField])
  }

  return flattenXdmObject(xdmDefaults)
}

function countContextFields(fields = []) {
  return fields.reduce((xdm, field) => {
    if (String(field.path || '').trim()) {
      xdm += 1
    }
    return xdm
  }, 0)
}

function getFieldInputType(schemaField = {}) {
  if (schemaField.type === 'number' || schemaField.type === 'integer') return 'number'
  if (schemaField.type === 'boolean') return 'boolean'
  if (schemaField.type === 'array' || schemaField.type === 'object') return 'json'
  return 'string'
}

function stringifySchemaSampleValue(value, type) {
  if (value === undefined || value === null) {
    return type === 'json' ? '{}' : ''
  }
  if (type === 'json') {
    return JSON.stringify(value)
  }
  return String(value)
}

function createXdmFieldFromSchemaField(schemaField = {}) {
  const type = getFieldInputType(schemaField)
  return createXdmField({
    path: schemaField.relativePath || schemaField.path || '',
    type,
    value: stringifySchemaSampleValue(schemaField.sampleValue, type),
    schemaField
  })
}

function upsertXdmFields(existingFields, incomingFields) {
  const incomingByPath = new Map(incomingFields.map((field) => [field.path, field]))
  const updatedFields = existingFields.map((field) => incomingByPath.has(field.path)
    ? {
        ...field,
        ...incomingByPath.get(field.path),
        id: field.id
      }
    : field)
  const existingPaths = new Set(existingFields.map((field) => field.path))
  const newFields = incomingFields.filter((field) => !existingPaths.has(field.path))
  return [...updatedFields, ...newFields]
}

function getOrgKey(org = {}) {
  return org.orgKey || org.key || org.name || ''
}

function getOrgLabel(org = {}) {
  return org.label || org.name || org.orgKey || org.key || ''
}

function getSandboxKey(sandbox = {}) {
  return sandbox.name || sandbox.id || sandbox.title || ''
}

function getSandboxLabel(sandbox = {}) {
  return sandbox.title || sandbox.name || sandbox.id || ''
}

function getSchemaLabel(schema = {}) {
  return schema.title || schema.id || ''
}

function getSchemaFieldLabel(field = {}) {
  return (field.relativePath || field.path || '') +
    (field.required ? ' · required' : '') +
    (field.isIdentity ? ' · identity' : '')
}

function getConfigLabel(config = {}) {
  return `${config.name || config.id || 'Untitled config'} · ${config.templateType || 'card'} · ${config.publish?.enabled ? 'published' : 'draft'}`
}

function mergeSchemasById(existingSchemas = [], incomingSchemas = []) {
  const schemasById = new Map()
  for (const schema of [...existingSchemas, ...incomingSchemas]) {
    if (schema?.id) {
      schemasById.set(schema.id, schema)
    }
  }
  return Array.from(schemasById.values())
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

function getContentObject(content) {
  if (isPlainObject(content)) {
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
    return isPlainObject(parsed) ? parsed : {}
  } catch (error) {
    return {}
  }
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

function formatDisplayValue(value, maxLength = 120) {
  if (value === undefined || value === null || value === '') {
    return ''
  }

  const displayValue = typeof value === 'object'
    ? JSON.stringify(value)
    : String(value)

  return displayValue.length > maxLength
    ? `${displayValue.slice(0, maxLength - 1)}...`
    : displayValue
}

function formatOfferContent(content) {
  if (content && typeof content === 'object') {
    return JSON.stringify(content, null, 2)
  }
  return content === undefined || content === null ? '' : String(content)
}

function buildMappingSource(item = {}) {
  const parsedContent = Object.keys(isPlainObject(item.parsedContent) ? item.parsedContent : {}).length > 0
    ? item.parsedContent
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

function getPathLabel(path) {
  return String(path || '')
    .replace(/^parsedContent\./, '')
    .replace(/^contentObject\./, '')
    .replace(/^characteristics\./, '')
    .replace(/\[\d+\]/g, '')
    .replace(/\./g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function addMappingOption(optionsByPath, path, value, source = 'Offer') {
  if (!path || value === undefined || value === null || value === '') {
    return
  }

  const preview = formatDisplayValue(value, 96)
  if (!optionsByPath.has(path)) {
      optionsByPath.set(path, {
        path,
        label: `${source}: ${getPathLabel(path)}`,
        preview,
        textValue: `${source}: ${getPathLabel(path)}`
      })
    return
  }

  const existing = optionsByPath.get(path)
  if (!existing.preview && preview) {
    optionsByPath.set(path, {
      ...existing,
      preview,
      textValue: existing.textValue
    })
  }
}

function collectMappingOptions(value, prefix, optionsByPath, source, depth = 0) {
  if (value === undefined || value === null || depth > 6) {
    return
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return
    }
    if (isPlainObject(value[0])) {
      collectMappingOptions(value[0], `${prefix}[0]`, optionsByPath, source, depth + 1)
      return
    }
    addMappingOption(optionsByPath, prefix, value[0], source)
    return
  }

  if (isPlainObject(value)) {
    for (const [key, childValue] of Object.entries(value)) {
      collectMappingOptions(childValue, prefix ? `${prefix}.${key}` : key, optionsByPath, source, depth + 1)
    }
    return
  }

  addMappingOption(optionsByPath, prefix, value, source)
}

function buildMappingOptions(items = []) {
  const optionsByPath = new Map()
  for (const item of items) {
    const source = buildMappingSource(item)
    const candidatePaths = [
      'id',
      'schema',
      'format',
      'deliveryURL',
      'linkURL',
      'scope',
      'propositionId',
      'activity.id',
      'placement.id'
    ]
    candidatePaths.forEach((path) => addMappingOption(optionsByPath, path, getByPath(source, path), 'Offer'))
    collectMappingOptions(source.parsedContent, 'parsedContent', optionsByPath, 'Content')
    collectMappingOptions(source.characteristics, 'characteristics', optionsByPath, 'Metadata')
  }

  return Array.from(optionsByPath.values()).sort((a, b) => a.label.localeCompare(b.label))
}

function getMappingOptionsForValue(mappingOptions, value, sampleItem) {
  const cleanValue = extractMappingPath(value)
  if (!cleanValue || mappingOptions.some((option) => option.path === cleanValue)) {
    return mappingOptions
  }

  const sampleValue = sampleItem ? resolveMappedValue(sampleItem, cleanValue) : ''
  return [{
    path: cleanValue,
    label: `Custom: ${getPathLabel(cleanValue)}`,
    preview: formatDisplayValue(sampleValue, 96),
    textValue: `Custom ${getPathLabel(cleanValue)}`
  }, ...mappingOptions]
}

function getSuggestedMappingPath(slot, mappingOptions) {
  const candidates = {
    title: [/parsedContent\.(title|headline|name)$/i, /parsedContent\..*(title|headline|name)/i],
    description: [/parsedContent\.(description|body|summary|subtitle)$/i, /parsedContent\..*(description|body|summary|subtitle)/i],
    image: [/^deliveryURL$/i, /parsedContent\..*(image|asset|thumbnail|banner).*url/i, /parsedContent\..*(image|asset|thumbnail|banner)/i],
    ctaLabel: [/parsedContent\.(ctaLabel|buttonText|linkText|label)$/i, /parsedContent\..*(cta|button|link).*label/i],
    ctaUrl: [/^linkURL$/i, /parsedContent\..*(cta|button|link|url|href).*url/i, /parsedContent\..*(url|href)$/i],
    badge: [/parsedContent\.(badge|tag|category|type)$/i, /parsedContent\..*(badge|tag|category|type)/i]
  }[slot] || []

  return mappingOptions.find((option) => candidates.some((pattern) => pattern.test(option.path)))?.path || ''
}

function cleanTemplateMappings(templateConfig = {}) {
  const mappings = templateConfig.fieldMappings || {}
  return {
    ...templateConfig,
    fieldMappings: Object.entries(mappings).reduce((fieldMappings, [key, value]) => ({
      ...fieldMappings,
      [key]: extractMappingPath(value)
    }), {})
  }
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

function getByPath(source, path) {
  const normalizedPath = String(path || '').trim().replace(/^\$\./, '').replace(/\[(\d+)\]/g, '.$1')
  if (!normalizedPath) return ''
  return normalizedPath.split('.').reduce((current, part) => {
    if (current === undefined || current === null || part === '') return undefined
    return current[part]
  }, source)
}

function resolveMappedValue(item, path) {
  const source = buildMappingSource(item)
  const value = getByPath(source, path)
  if (value === undefined || value === null) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return value
}

function getOfferItems(normalized) {
  return (normalized?.propositions || []).flatMap((proposition) => (
    (proposition.items || []).map((item) => ({
      ...item,
      propositionId: proposition.id,
      scope: proposition.scope,
      activity: proposition.activity,
      placement: proposition.placement,
      scopeDetails: proposition.scopeDetails
    }))
  ))
}

function getResolvedOffer(item, template) {
  const mappings = template.fieldMappings || DEFAULT_TEMPLATE.fieldMappings
  return {
    title: resolveMappedValue(item, mappings.title) || item.id || 'Offer',
    description: resolveMappedValue(item, mappings.description),
    image: resolveMappedValue(item, mappings.image) || item.deliveryURL,
    ctaLabel: resolveMappedValue(item, mappings.ctaLabel) || 'Learn more',
    ctaUrl: resolveMappedValue(item, mappings.ctaUrl) || item.linkURL || '#',
    badge: resolveMappedValue(item, mappings.badge) || (item.isFallback ? 'Fallback' : 'Personalized'),
    htmlContent: item.format === 'text/html' ? sanitizeHtml(item.content) : '',
    isFallback: Boolean(item.isFallback)
  }
}

const panelStyle = {
  border: '1px solid #d5d5d5',
  borderRadius: '8px',
  padding: '16px',
  background: '#fff'
}

const mappingRowStyle = {
  borderTop: '1px solid #e6e6e6',
  paddingTop: '12px'
}

const mappingSampleStyle = {
  maxWidth: '100%',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word'
}

const previewShellStyle = {
  border: '1px solid #d5d5d5',
  borderRadius: '8px',
  background: '#f8f8f8',
  padding: '16px',
  minHeight: '320px'
}

const previewGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '16px'
}

const previewCarouselStyle = {
  display: 'grid',
  gridAutoFlow: 'column',
  gridAutoColumns: 'minmax(240px, 34%)',
  gap: '16px',
  overflowX: 'auto',
  paddingBottom: '8px'
}

const offerCardStyle = {
  background: '#fff',
  border: '1px solid #d5d5d5',
  borderRadius: '8px',
  overflow: 'hidden',
  minWidth: 0,
  boxShadow: '0 1px 2px rgba(0,0,0,0.08)'
}

const offerImageStyle = {
  width: '100%',
  height: '180px',
  objectFit: 'cover',
  display: 'block',
  background: '#f5f5f5'
}

const OfferCardPreview = ({ item, template, hero }) => {
  const offer = getResolvedOffer(item, template)
  const cardStyle = hero
    ? { ...offerCardStyle, display: 'grid', gridTemplateColumns: 'minmax(180px, 42%) 1fr' }
    : offerCardStyle

  return (
    <div style={cardStyle}>
      {offer.image && (
        <img
          src={offer.image}
          alt={offer.title}
          style={hero ? { ...offerImageStyle, height: '100%', minHeight: '260px' } : offerImageStyle}
        />
      )}
      <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <Badge variant={offer.isFallback ? 'notice' : 'positive'}>{offer.badge}</Badge>
        <h2 style={{ margin: 0, fontSize: '22px', lineHeight: 1.18, overflowWrap: 'anywhere' }}>{offer.title}</h2>
        {offer.htmlContent ? (
          <div
            style={{ lineHeight: 1.45, overflowWrap: 'anywhere' }}
            dangerouslySetInnerHTML={{ __html: offer.htmlContent }}
          />
        ) : (
          <p style={{ margin: 0, color: '#555', lineHeight: 1.45, overflowWrap: 'anywhere' }}>{offer.description}</p>
        )}
        <a
          href={offer.ctaUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            alignSelf: 'flex-start',
            background: '#1473e6',
            borderRadius: '6px',
            color: '#fff',
            fontWeight: 700,
            marginTop: '4px',
            padding: '9px 13px',
            textDecoration: 'none'
          }}
        >
          {offer.ctaLabel}
        </a>
      </div>
    </div>
  )
}

OfferCardPreview.propTypes = {
  item: PropTypes.object,
  template: PropTypes.object,
  hero: PropTypes.bool
}

const OfferSimulator = (props) => {
  const [activeTab, setActiveTab] = useState('overview')
  const [editing, setEditing] = useState(false)
  const [unlockedStep, setUnlockedStep] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [requestState, setRequestState] = useState({
    datastreamId: '',
    identityNamespace: 'ECID',
    identityValue: '',
    mode: 'decisionScopes',
    decisionScopes: '',
    surfaces: '',
    selectedSurface: '',
    includeContext: false,
    tenantField: '',
    assuranceSessionId: '',
    preserveState: true
  })
  const [xdmFields, setXdmFields] = useState([])
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE)
  const [configName, setConfigName] = useState('Untitled offer config')
  const [configId, setConfigId] = useState('')
  const [savedConfigs, setSavedConfigs] = useState([])
  const [selectedConfigId, setSelectedConfigId] = useState('')
  const [schemaAssistant, setSchemaAssistant] = useState({
    orgs: [],
    selectedOrg: '',
    sandboxes: [],
    selectedSandbox: '',
    schemas: [],
    schemaNextStart: '',
    schemaHasMore: false,
    schemaPageLimit: 100,
    schemaLoadedCount: 0,
    schemaTotalCount: 0,
    schemaSearch: '',
    selectedSchemaId: '',
    details: null,
    selectedFieldPath: '',
    fieldSearch: '',
    loading: false,
    error: ''
  })
  const [result, setResult] = useState(null)
  const [stateEntries, setStateEntries] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('offerDecisioningStateEntries') || '[]')
    } catch (error) {
      return []
    }
  })
  const [design, setDesign] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('offerDecisioningDesign') || 'null')
      return stored && Array.isArray(stored.items) && stored.items.length > 0 ? stored : createDefaultDesign()
    } catch (error) {
      return createDefaultDesign()
    }
  })
  const [loading, setLoading] = useState(false)
  const [configLoading, setConfigLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const normalized = result?.normalized || null
  const offerItems = useMemo(() => getOfferItems(normalized), [normalized])
  const sampleOfferItem = offerItems[0] || null
  const mappingOptions = useMemo(() => buildMappingOptions(offerItems), [offerItems])
  const schemaFields = schemaAssistant.details?.fields || []
  const requiredSchemaFields = schemaAssistant.details?.requiredFields || []
  const requiredContextPaths = useMemo(
    () => new Set(requiredSchemaFields.map((field) => field.relativePath || field.path).filter(Boolean)),
    [requiredSchemaFields]
  )
  const missingRequiredContextFields = useMemo(
    () => (requestState.includeContext ? getMissingRequiredContextFields(requiredSchemaFields, xdmFields) : []),
    [requestState.includeContext, requiredSchemaFields, xdmFields]
  )
  const selectedSchemaField = useMemo(() => (
    schemaFields.find((field) => field.path === schemaAssistant.selectedFieldPath) || null
  ), [schemaAssistant.selectedFieldPath, schemaFields])
  const xdmPreview = useMemo(() => {
    try {
      return stringifyJson(buildXdmFromFields(xdmFields, requestState.tenantField))
    } catch (previewError) {
      return stringifyJson({
        error: previewError.message
      })
    }
  }, [requestState.tenantField, xdmFields])
  const previewUrl = useMemo(() => {
    const publicId = result?.publishedConfig?.publicId || result?.config?.publish?.publicId
    const previewActionUrl = getActionUrl('offer-preview')
    return publicId && previewActionUrl ? `${previewActionUrl}?publicId=${encodeURIComponent(publicId)}` : ''
  }, [result])
  const surfaceOptions = useMemo(() => parseList(requestState.surfaces), [requestState.surfaces])
  const designJson = useMemo(() => buildDesignJson(design), [design])
  const designJsonText = useMemo(() => stringifyJson(designJson), [designJson])
  const designHtml = useMemo(() => buildDesignHtml(design), [design])
  const designItemLimit = DESIGN_TYPE_LIMITS[design.type] || Infinity
  const canAddDesignItem = design.items.length < designItemLimit

  useEffect(() => {
    loadConfigs()
    loadSchemaOrgs()
  }, [])

  useEffect(() => {
    localStorage.setItem('offerDecisioningStateEntries', JSON.stringify(stateEntries || []))
  }, [stateEntries])

  useEffect(() => {
    localStorage.setItem('offerDecisioningDesign', JSON.stringify(design))
  }, [design])

  // Keep the "send to surface" selection valid as the surface list changes.
  useEffect(() => {
    setRequestState((prev) => {
      const options = parseList(prev.surfaces)
      if (options.length === 0) {
        return prev.selectedSurface ? { ...prev, selectedSurface: '' } : prev
      }
      if (!options.includes(prev.selectedSurface)) {
        return { ...prev, selectedSurface: options[0] }
      }
      return prev
    })
  }, [requestState.surfaces])

  const setRequestValue = (key, value) => {
    setRequestState((prev) => ({
      ...prev,
      [key]: value
    }))
  }

  const updateXdmField = (fieldId, key, value) => {
    setXdmFields((prev) => prev.map((field) => (
      field.id === fieldId ? { ...field, [key]: value } : field
    )))
  }

  const addXdmField = () => {
    setXdmFields((prev) => [...prev, createXdmField()])
  }

  const removeXdmField = (fieldId) => {
    setXdmFields((prev) => prev.filter((field) => field.id !== fieldId))
  }

  const setMappingValue = (key, value) => {
    setTemplate((prev) => ({
      ...prev,
      fieldMappings: {
        ...prev.fieldMappings,
        [key]: extractMappingPath(value)
      }
    }))
  }

  const handleSuggestMappings = () => {
    if (mappingOptions.length === 0) return
    setTemplate((prev) => {
      const fieldMappings = { ...prev.fieldMappings }
      Object.keys(fieldMappings).forEach((slot) => {
        const suggestedPath = getSuggestedMappingPath(slot, mappingOptions)
        if (suggestedPath) {
          fieldMappings[slot] = suggestedPath
        }
      })
      return {
        ...prev,
        fieldMappings
      }
    })
    setMessage('Template fields mapped from the current offer payload.')
  }

  const setDesignType = (type) => {
    setDesign((prev) => {
      const limit = DESIGN_TYPE_LIMITS[type] || Infinity
      const items = prev.items.length > limit ? prev.items.slice(0, limit) : prev.items
      return {
        ...prev,
        type,
        items: items.length > 0 ? items : [createDesignItem()]
      }
    })
  }

  const addDesignItem = () => {
    setDesign((prev) => {
      const limit = DESIGN_TYPE_LIMITS[prev.type] || Infinity
      if (prev.items.length >= limit) return prev
      return { ...prev, items: [...prev.items, createDesignItem()] }
    })
  }

  const removeDesignItem = (itemId) => {
    setDesign((prev) => {
      if (prev.items.length <= 1) return prev
      return { ...prev, items: prev.items.filter((item) => item.id !== itemId) }
    })
  }

  const updateDesignItemField = (itemId, field, value) => {
    setDesign((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === itemId ? { ...item, [field]: value } : item))
    }))
  }

  const addCustomField = (itemId) => {
    setDesign((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === itemId
        ? {
            ...item,
            custom: [
              ...(item.custom || []),
              { id: `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`, key: '', value: '' }
            ]
          }
        : item))
    }))
  }

  const updateCustomField = (itemId, customId, key, value) => {
    setDesign((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === itemId
        ? {
            ...item,
            custom: (item.custom || []).map((pair) => (pair.id === customId ? { ...pair, [key]: value } : pair))
          }
        : item))
    }))
  }

  const removeCustomField = (itemId, customId) => {
    setDesign((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === itemId
        ? { ...item, custom: (item.custom || []).filter((pair) => pair.id !== customId) }
        : item))
    }))
  }

  const getHeaders = () => {
    if (!props.ims) {
      return {}
    }
    return {
      authorization: `Bearer ${props.ims.token}`,
      'x-gw-ims-org-id': props.ims.org,
      'x-ims-user-id': props.ims.profile?.userId || props.ims.profile?.email || props.ims.org
    }
  }

  const callAction = async (actionName, params, options = { method: 'POST' }) => {
    const actionUrl = getActionUrl(actionName)
    if (!actionUrl) {
      throw new Error(`${actionName} action URL not found`)
    }
    const response = await actionWebInvoke(actionUrl, getHeaders(), params, options)
    const payload = response?.body || response
    if (payload?.error?.body?.error) {
      throw new Error(payload.error.body.error)
    }
    if (payload?.success === false) {
      throw new Error(payload.error || `${actionName} failed`)
    }
    return payload
  }

  const updateSchemaAssistant = (updates) => {
    setSchemaAssistant((prev) => ({
      ...prev,
      ...updates
    }))
  }

  const callSchemaAssistant = async (params) => {
    return callAction('offer-schema-assistant', params)
  }

  const loadSchemaOrgs = async () => {
    try {
      const response = await callSchemaAssistant({ operation: 'listOrgs' })
      const orgs = (response.organizations || []).filter((org) => org.capabilities?.sandboxes)
      setSchemaAssistant((prev) => ({
        ...prev,
        orgs,
        selectedOrg: prev.selectedOrg || getOrgKey(orgs[0])
      }))
    } catch (schemaError) {
      updateSchemaAssistant({ error: schemaError.message || 'Unable to load organizations' })
    }
  }

  const loadSchemaSandboxes = async () => {
    if (!schemaAssistant.selectedOrg) return
    updateSchemaAssistant({
      loading: true,
      error: '',
      sandboxes: [],
      selectedSandbox: '',
      schemas: [],
      schemaNextStart: '',
      schemaHasMore: false,
      schemaLoadedCount: 0,
      schemaTotalCount: 0,
      selectedSchemaId: '',
      details: null,
      selectedFieldPath: '',
      fieldSearch: ''
    })
    try {
      const response = await callSchemaAssistant({
        operation: 'listSandboxes',
        org: schemaAssistant.selectedOrg
      })
      const sandboxes = response.sandboxes || []
      updateSchemaAssistant({
        sandboxes,
        selectedSandbox: getSandboxKey(sandboxes[0]),
        loading: false
      })
    } catch (schemaError) {
      updateSchemaAssistant({
        loading: false,
        error: schemaError.message || 'Unable to load sandboxes'
      })
    }
  }

  const loadSchemaList = async ({ append = false } = {}) => {
    if (!schemaAssistant.selectedOrg || !schemaAssistant.selectedSandbox) return
    const nextStart = append ? schemaAssistant.schemaNextStart : ''
    if (append && !nextStart) return

    updateSchemaAssistant(append
      ? {
          loading: true,
          error: ''
        }
      : {
          loading: true,
          error: '',
          schemas: [],
          schemaNextStart: '',
          schemaHasMore: false,
          schemaLoadedCount: 0,
          schemaTotalCount: 0,
          selectedSchemaId: '',
          details: null,
          selectedFieldPath: '',
          fieldSearch: ''
        })
    try {
      const response = await callSchemaAssistant({
        operation: 'listSchemas',
        org: schemaAssistant.selectedOrg,
        sandboxName: schemaAssistant.selectedSandbox,
        limit: schemaAssistant.schemaPageLimit,
        start: nextStart || undefined
      })
      const incomingSchemas = (response.eventSchemas && response.eventSchemas.length > 0)
        ? response.eventSchemas
        : (response.schemas || [])
      setSchemaAssistant((prev) => {
        const schemas = append ? mergeSchemasById(prev.schemas, incomingSchemas) : incomingSchemas
        return {
          ...prev,
          schemas,
          schemaNextStart: response.page?.nextStart || '',
          schemaHasMore: Boolean(response.page?.hasMore),
          schemaLoadedCount: schemas.length,
          schemaTotalCount: response.page?.count || incomingSchemas.length,
          selectedSchemaId: append ? (prev.selectedSchemaId || schemas[0]?.id || '') : (schemas[0]?.id || ''),
          loading: false
        }
      })
      setMessage(`${append ? 'Loaded more' : 'Loaded'} ${incomingSchemas.length} event schema${incomingSchemas.length === 1 ? '' : 's'}.`)
    } catch (schemaError) {
      updateSchemaAssistant({
        loading: false,
        error: schemaError.message || 'Unable to load schemas'
      })
    }
  }

  const loadSelectedSchemaFields = async () => {
    if (!schemaAssistant.selectedOrg || !schemaAssistant.selectedSandbox || !schemaAssistant.selectedSchemaId) return
    updateSchemaAssistant({
      loading: true,
      error: '',
      details: null,
      selectedFieldPath: '',
      fieldSearch: ''
    })
    try {
      const response = await callSchemaAssistant({
        operation: 'getSchemaFields',
        org: schemaAssistant.selectedOrg,
        sandboxName: schemaAssistant.selectedSandbox,
        schemaId: schemaAssistant.selectedSchemaId
      })
      updateSchemaAssistant({
        details: response,
        selectedFieldPath: response.fields?.[0]?.path || '',
        loading: false
      })
      if (response.tenantRoot && !requestState.tenantField) {
        setRequestValue('tenantField', response.tenantRoot)
      }
      // When context is opted in, seed the required fields so they must be filled before sending.
      if (requestState.includeContext && (response.requiredFields || []).length > 0) {
        addSchemaFieldsToContext(response.requiredFields)
      }
      setMessage(`Loaded ${response.fieldCount || 0} schema fields.`)
    } catch (schemaError) {
      updateSchemaAssistant({
        loading: false,
        error: schemaError.message || 'Unable to load schema fields'
      })
    }
  }

  const addSchemaFieldsToContext = (fields) => {
    const contextFields = fields
      .filter((field) => field.relativePath || field.path)
      .map(createXdmFieldFromSchemaField)

    if (schemaAssistant.details?.tenantRoot && !requestState.tenantField) {
      setRequestValue('tenantField', schemaAssistant.details.tenantRoot)
    }

    setXdmFields((prev) => upsertXdmFields(prev, contextFields))
    setMessage(`${contextFields.length} schema field${contextFields.length === 1 ? '' : 's'} added to context.`)
  }

  const addSelectedSchemaField = () => {
    if (!selectedSchemaField) return
    addSchemaFieldsToContext([selectedSchemaField])
  }

  const addRequiredSchemaFields = () => {
    if (requiredSchemaFields.length === 0) return
    addSchemaFieldsToContext(requiredSchemaFields)
  }

  const buildRequestPayload = () => {
    // Context is opt-in: when off, send a minimal event (identity + scope/surface only).
    const xdm = requestState.includeContext ? buildXdmFromFields(xdmFields, requestState.tenantField) : {}
    const contextTenantField = requestState.includeContext ? requestState.tenantField.trim() : ''
    const allSurfaces = parseList(requestState.surfaces)
    // A request targets a single chosen surface, not the whole list.
    const targetSurfaces = requestState.mode === 'surfaces' && requestState.selectedSurface
      ? [requestState.selectedSurface]
      : allSurfaces
    return {
      datastreamId: requestState.datastreamId.trim(),
      identityNamespace: requestState.identityNamespace.trim(),
      identityValue: requestState.identityValue.trim(),
      mode: requestState.mode,
      decisionScopes: parseList(requestState.decisionScopes),
      surfaces: targetSurfaces,
      schemas: [...DEFAULT_PERSONALIZATION_SCHEMAS],
      xdm,
      contextTenantField,
      assuranceSessionId: requestState.assuranceSessionId.trim(),
      preserveState: requestState.preserveState,
      stateEntries: requestState.preserveState ? stateEntries : []
    }
  }

  const buildConfigPayload = () => {
    const requestPayload = buildRequestPayload()
    return {
      id: configId || undefined,
      name: configName.trim() || 'Untitled offer config',
      edge: {
        datastreamId: requestPayload.datastreamId,
        identityNamespace: requestPayload.identityNamespace,
        mode: requestPayload.mode,
        decisionScopes: requestPayload.decisionScopes,
        // Persist the full surface list so the published preview can offer all of them.
        surfaces: parseList(requestState.surfaces),
        schemas: [...DEFAULT_PERSONALIZATION_SCHEMAS],
        contextTenantField: requestPayload.contextTenantField,
        xdmDefaults: requestPayload.xdm,
        preserveState: requestPayload.preserveState
      },
      template: cleanTemplateMappings(template),
      design
    }
  }

  const loadConfigs = async () => {
    try {
      setConfigLoading(true)
      const response = await callAction('offer-configs', { operation: 'listConfigs' })
      setSavedConfigs(response.configs || [])
    } catch (loadError) {
      setSavedConfigs([])
    } finally {
      setConfigLoading(false)
    }
  }

  const handleSendRequest = async () => {
    setError('')
    setMessage('')
    if (requestState.includeContext && missingRequiredContextFields.length > 0) {
      setError(`Fill required context field${missingRequiredContextFields.length === 1 ? '' : 's'} before sending: ${missingRequiredContextFields.join(', ')}`)
      return
    }
    try {
      const payload = buildRequestPayload()
      setLoading(true)
      const response = await callAction('edge-interact', payload)
      setResult(response)
      setStateEntries(response.normalized?.stateEntries || [])
      // Results render inline below the request on the same "Request & inspect" step.
      setMessage('Offer decision returned. Results are below.')
    } catch (requestError) {
      setError(requestError.message || 'Offer decision request failed')
    } finally {
      setLoading(false)
    }
  }

  const handleLoadSample = () => {
    setResult(SAMPLE_RESULT)
    setStateEntries(SAMPLE_RESULT.normalized.stateEntries)
    setMessage('Sample offer response loaded. Results are below.')
    setError('')
  }

  const handleClearState = () => {
    setStateEntries([])
    setMessage('Edge state cleared.')
  }

  const handleCopy = async (value, copiedMessage) => {
    try {
      await navigator.clipboard.writeText(value)
      setMessage(copiedMessage)
    } catch (copyError) {
      setError('Clipboard write failed')
    }
  }

  const saveConfig = async () => {
    const config = buildConfigPayload()
    const response = await callAction('offer-configs', {
      operation: 'saveConfig',
      config
    })
    setConfigId(response.config.id)
    setResult((prev) => ({
      ...(prev || {}),
      config: response.config
    }))
    await loadConfigs()
    setMessage('Configuration saved.')
    return response.config
  }

  const handleSaveConfig = async () => {
    setError('')
    setMessage('')
    try {
      setConfigLoading(true)
      await saveConfig()
    } catch (saveError) {
      setError(saveError.message || 'Save failed')
    } finally {
      setConfigLoading(false)
    }
  }

  const handleSaveAndContinueStep = async (stepKey) => {
    const index = STEP_ORDER.indexOf(stepKey)
    const nextKey = STEP_ORDER[index + 1]
    setError('')
    setMessage('')
    // Enforce required context before leaving the Request step (same guard as Send request).
    if (stepKey === 'request' && requestState.includeContext && missingRequiredContextFields.length > 0) {
      setError(`Fill required context field${missingRequiredContextFields.length === 1 ? '' : 's'} before continuing: ${missingRequiredContextFields.join(', ')}`)
      return
    }
    try {
      setConfigLoading(true)
      await saveConfig()
      if (nextKey) {
        setUnlockedStep((prev) => Math.max(prev, index + 1))
        setActiveTab(nextKey)
      }
    } catch (saveError) {
      setError(saveError.message || 'Save failed')
    } finally {
      setConfigLoading(false)
    }
  }

  const handlePublishConfig = async () => {
    setError('')
    setMessage('')
    try {
      setConfigLoading(true)
      const saved = await saveConfig()
      const response = await callAction('offer-configs', {
        operation: 'publishConfig',
        configId: saved.id
      })
      setResult((prev) => ({
        ...(prev || {}),
        config: response.config,
        publishedConfig: response.publishedConfig
      }))
      await loadConfigs()
      setMessage('Preview published.')
    } catch (publishError) {
      setError(publishError.message || 'Publish failed')
    } finally {
      setConfigLoading(false)
    }
  }

  const handleUnpublishConfig = async () => {
    if (!configId) return
    setError('')
    setMessage('')
    try {
      setConfigLoading(true)
      const response = await callAction('offer-configs', {
        operation: 'unpublishConfig',
        configId
      })
      setResult((prev) => ({
        ...(prev || {}),
        config: response.config,
        publishedConfig: null
      }))
      await loadConfigs()
      setMessage('Preview unpublished.')
    } catch (unpublishError) {
      setError(unpublishError.message || 'Unpublish failed')
    } finally {
      setConfigLoading(false)
    }
  }

  const handleLoadConfig = async (configIdArg) => {
    const targetId = configIdArg || selectedConfigId
    if (!targetId) return
    setError('')
    setMessage('')
    try {
      setConfigLoading(true)
      const response = await callAction('offer-configs', {
        operation: 'getConfig',
        configId: targetId
      })
      const config = response.config
      setConfigId(config.id)
      setConfigName(config.name)
      setRequestState((prev) => ({
        ...prev,
        datastreamId: config.edge.datastreamId || '',
        identityNamespace: config.edge.identityNamespace || 'ECID',
        mode: config.edge.mode || 'decisionScopes',
        decisionScopes: (config.edge.decisionScopes || []).join('\n'),
        surfaces: (config.edge.surfaces || []).join('\n'),
        selectedSurface: (config.edge.surfaces || [])[0] || '',
        includeContext: Object.keys(config.edge.xdmDefaults || {}).length > 0,
        tenantField: config.edge.contextTenantField || '',
        preserveState: Boolean(config.edge.preserveState)
      }))
      setXdmFields(getContextFieldsFromConfig(config.edge || {}))
      setTemplate(cleanTemplateMappings({
        ...DEFAULT_TEMPLATE,
        ...(config.template || {}),
        fieldMappings: {
          ...DEFAULT_TEMPLATE.fieldMappings,
          ...((config.template && config.template.fieldMappings) || {})
        }
      }))
      setDesign(config.design && Array.isArray(config.design.items) && config.design.items.length > 0
        ? config.design
        : createDefaultDesign())
      setResult((prev) => ({
        ...(prev || {}),
        config
      }))
      setEditing(true)
      setUnlockedStep(STEP_ORDER.length - 1)
      setActiveTab('request')
      setMessage('Experience loaded.')
    } catch (loadError) {
      setError(loadError.message || 'Load failed')
    } finally {
      setConfigLoading(false)
    }
  }

  const handleDeleteConfig = async (configIdArg) => {
    const targetId = configIdArg || selectedConfigId
    if (!targetId) return
    setError('')
    setMessage('')
    try {
      setConfigLoading(true)
      await callAction('offer-configs', {
        operation: 'deleteConfig',
        configId: targetId
      })
      if (targetId === configId) {
        setConfigId('')
      }
      if (targetId === selectedConfigId) {
        setSelectedConfigId('')
      }
      await loadConfigs()
      setMessage('Experience deleted.')
    } catch (deleteError) {
      setError(deleteError.message || 'Delete failed')
    } finally {
      setConfigLoading(false)
    }
  }

  const publishConfigById = async (configIdArg) => {
    if (!configIdArg) return
    setError('')
    setMessage('')
    try {
      setConfigLoading(true)
      await callAction('offer-configs', {
        operation: 'publishConfig',
        configId: configIdArg
      })
      await loadConfigs()
      setMessage('Experience published.')
    } catch (publishError) {
      setError(publishError.message || 'Publish failed')
    } finally {
      setConfigLoading(false)
    }
  }

  const duplicateConfig = async (configIdArg) => {
    if (!configIdArg) return
    setError('')
    setMessage('')
    try {
      setConfigLoading(true)
      const response = await callAction('offer-configs', {
        operation: 'getConfig',
        configId: configIdArg
      })
      const source = response.config
      await callAction('offer-configs', {
        operation: 'saveConfig',
        config: {
          name: `Copy of ${source.name || 'Untitled offer config'}`,
          edge: source.edge,
          template: source.template,
          design: source.design,
          publish: { enabled: false }
        }
      })
      await loadConfigs()
      setMessage('Experience duplicated.')
    } catch (duplicateError) {
      setError(duplicateError.message || 'Duplicate failed')
    } finally {
      setConfigLoading(false)
    }
  }

  const copyPublicUrl = (row) => {
    const publicId = row?.publish?.publicId
    const previewActionUrl = getActionUrl('offer-preview')
    if (!publicId || !previewActionUrl) {
      setError('This experience has no published preview URL yet. Publish it first.')
      return
    }
    handleCopy(`${previewActionUrl}?publicId=${encodeURIComponent(publicId)}`, 'Public URL copied.')
  }

  const startNewExperience = () => {
    setError('')
    setMessage('')
    setConfigId('')
    setConfigName('Untitled offer config')
    setDesign(createDefaultDesign())
    setTemplate(DEFAULT_TEMPLATE)
    setXdmFields([])
    setResult(null)
    setRequestState({
      datastreamId: '',
      identityNamespace: 'ECID',
      identityValue: '',
      mode: 'decisionScopes',
      decisionScopes: '',
      surfaces: '',
      selectedSurface: '',
      includeContext: false,
      tenantField: '',
      assuranceSessionId: '',
      preserveState: true
    })
    setEditing(true)
    setUnlockedStep(0)
    setActiveTab('design')
  }

  const openPublicSite = (row) => {
    const publicId = row?.publish?.publicId
    const previewActionUrl = getActionUrl('offer-preview')
    if (!publicId || !previewActionUrl) {
      setError('This experience has no published preview yet. Publish it first.')
      return
    }
    window.open(`${previewActionUrl}?publicId=${encodeURIComponent(publicId)}`, '_blank', 'noopener')
  }

  const handleRowAction = (key, row) => {
    if (key === 'publish') publishConfigById(row.id)
    else if (key === 'openSite') openPublicSite(row)
    else if (key === 'copyUrl') copyPublicUrl(row)
    else if (key === 'duplicate') duplicateConfig(row.id)
    else if (key === 'load') handleLoadConfig(row.id)
    else if (key === 'delete') setDeleteTarget(row)
  }

  const formatConfigDate = (value) => {
    if (!value) return '—'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
  }

  const renderSummary = () => {
    const summary = normalized?.summary || {
      propositionCount: 0,
      itemCount: 0,
      personalizedCount: 0,
      fallbackCount: 0
    }
    const cards = [
      ['Request ID', normalized?.requestId || 'None'],
      ['Propositions', summary.propositionCount],
      ['Items', summary.itemCount],
      ['Personalized', summary.personalizedCount],
      ['Fallback', summary.fallbackCount],
      ['State entries', stateEntries.length]
    ]

    return (
      <Flex gap="size-150" wrap>
        {cards.map(([label, value]) => (
          <View key={label} UNSAFE_style={panelStyle} minWidth="size-1600">
            <Text>{label}</Text>
            <Heading level={4} marginTop="size-50" marginBottom="size-0">{value}</Heading>
          </View>
        ))}
      </Flex>
    )
  }

  const renderSectionHelp = (key) => {
    const guidance = SECTION_GUIDANCE[key]
    if (!guidance) return null
    return (
      <ContextualHelp variant="info">
        <Heading>{guidance.title}</Heading>
        <Content>
          <Text>{guidance.body}</Text>
        </Content>
        {guidance.docHref && (
          <Footer>
            <Link>
              <a href={guidance.docHref} target="_blank" rel="noopener noreferrer">{guidance.docLabel}</a>
            </Link>
          </Footer>
        )}
      </ContextualHelp>
    )
  }

  const renderSchemaAssistant = () => (
    <View marginTop="size-250" UNSAFE_style={panelStyle}>
      <Flex justifyContent="space-between" alignItems="center" wrap gap="size-100">
        <Flex alignItems="center" gap="size-100">
          <Heading level={3} marginTop="size-0" marginBottom="size-0">Schema assistant</Heading>
          {renderSectionHelp('schemaAssistant')}
        </Flex>
        {schemaAssistant.loading && <ProgressCircle size="S" />}
      </Flex>
      {schemaAssistant.error && (
        <StatusLight variant="negative">{schemaAssistant.error}</StatusLight>
      )}
      <Flex gap="size-150" alignItems="end" wrap marginTop="size-150">
        <ComboBox
          label="Organization"
          selectedKey={schemaAssistant.selectedOrg || null}
          onSelectionChange={(key) => updateSchemaAssistant({
            selectedOrg: key || '',
            sandboxes: [],
            selectedSandbox: '',
            schemas: [],
            schemaNextStart: '',
            schemaHasMore: false,
            schemaLoadedCount: 0,
            schemaTotalCount: 0,
            selectedSchemaId: '',
            details: null,
            selectedFieldPath: '',
            fieldSearch: ''
          })}
          width="size-3000"
          minWidth="size-2400"
          menuWidth={380}
          menuTrigger="focus"
          isDisabled={schemaAssistant.loading}
        >
          {schemaAssistant.orgs.map((org, index) => {
            const orgKey = getOrgKey(org) || `org-${index}`
            const orgLabel = getOrgLabel(org) || orgKey
            return (
              <Item key={orgKey} textValue={orgLabel}>{orgLabel}</Item>
            )
          })}
        </ComboBox>
        <ActionButton onPress={loadSchemaSandboxes} isDisabled={!schemaAssistant.selectedOrg || schemaAssistant.loading}>
          <Refresh size="S" />
          <Text>Load sandboxes</Text>
        </ActionButton>
        <ComboBox
          label="Sandbox"
          selectedKey={schemaAssistant.selectedSandbox || null}
          onSelectionChange={(key) => updateSchemaAssistant({
            selectedSandbox: key || '',
            schemas: [],
            schemaNextStart: '',
            schemaHasMore: false,
            schemaLoadedCount: 0,
            schemaTotalCount: 0,
            selectedSchemaId: '',
            details: null,
            selectedFieldPath: '',
            fieldSearch: ''
          })}
          width="size-3600"
          minWidth="size-2800"
          menuWidth={480}
          menuTrigger="focus"
          isDisabled={schemaAssistant.loading || schemaAssistant.sandboxes.length === 0}
        >
          {schemaAssistant.sandboxes.map((sandbox, index) => {
            const sandboxKey = getSandboxKey(sandbox) || `sandbox-${index}`
            const sandboxLabel = getSandboxLabel(sandbox) || sandboxKey
            return (
              <Item key={sandboxKey} textValue={sandboxLabel}>{sandboxLabel}</Item>
            )
          })}
        </ComboBox>
        <ActionButton onPress={() => loadSchemaList()} isDisabled={!schemaAssistant.selectedSandbox || schemaAssistant.loading}>
          <Refresh size="S" />
          <Text>Load schemas</Text>
        </ActionButton>
      </Flex>
      <Flex gap="size-150" alignItems="end" wrap marginTop="size-150">
        <ComboBox
          label="Event schema"
          selectedKey={schemaAssistant.selectedSchemaId || null}
          onSelectionChange={(key) => updateSchemaAssistant({
            selectedSchemaId: key || '',
            details: null,
            selectedFieldPath: '',
            fieldSearch: ''
          })}
          width="size-6000"
          minWidth="size-3600"
          menuWidth={560}
          menuTrigger="focus"
          isDisabled={schemaAssistant.loading || schemaAssistant.schemas.length === 0}
        >
          {schemaAssistant.schemas.map((schema) => (
            <Item key={schema.id} textValue={`${getSchemaLabel(schema)} ${schema.id || ''}`}>{getSchemaLabel(schema)}</Item>
          ))}
        </ComboBox>
        <ActionButton onPress={loadSelectedSchemaFields} isDisabled={!schemaAssistant.selectedSchemaId || schemaAssistant.loading}>
          <Function size="S" />
          <Text>Load fields</Text>
        </ActionButton>
        {schemaAssistant.schemas.length > 0 && (
          <Badge variant={schemaAssistant.schemaHasMore ? 'notice' : 'info'}>
            {schemaAssistant.schemaLoadedCount || schemaAssistant.schemas.length} loaded
          </Badge>
        )}
        {schemaAssistant.schemaHasMore && (
          <ActionButton onPress={() => loadSchemaList({ append: true })} isDisabled={schemaAssistant.loading}>
            <Refresh size="S" />
            <Text>Load more</Text>
          </ActionButton>
        )}
      </Flex>
      {schemaAssistant.details && (
        <Flex direction="column" gap="size-150" marginTop="size-200">
          <Flex gap="size-100" wrap alignItems="center">
            <Badge variant="info">{schemaAssistant.details.fieldCount || 0} fields</Badge>
            <Badge variant={requiredSchemaFields.length > 0 ? 'notice' : 'neutral'}>
              {requiredSchemaFields.length} required
            </Badge>
            {schemaAssistant.details.tenantRoot && (
              <Badge variant="positive">Tenant {schemaAssistant.details.tenantRoot}</Badge>
            )}
            {schemaAssistant.details.identities?.length > 0 && (
              <Badge variant="info">{schemaAssistant.details.identities.length} identity field(s)</Badge>
            )}
          </Flex>
          <Flex gap="size-150" alignItems="end" wrap>
            <ComboBox
              label="Schema field"
              selectedKey={schemaAssistant.selectedFieldPath || null}
              onSelectionChange={(key) => updateSchemaAssistant({ selectedFieldPath: key || '' })}
              width="size-6000"
              minWidth="size-3600"
              menuWidth={560}
              menuTrigger="focus"
              isDisabled={schemaFields.length === 0}
            >
              {schemaFields.map((field) => (
                <Item
                  key={field.path}
                  textValue={`${getSchemaFieldLabel(field)} ${field.label || ''} ${field.description || ''}`}
                >
                  {getSchemaFieldLabel(field)}
                </Item>
              ))}
            </ComboBox>
            <ButtonGroup>
              <ActionButton onPress={addSelectedSchemaField} isDisabled={!selectedSchemaField}>
                <Add size="S" />
                <Text>Add field</Text>
              </ActionButton>
              <ActionButton onPress={addRequiredSchemaFields} isDisabled={requiredSchemaFields.length === 0}>
                <Add size="S" />
                <Text>Add required</Text>
              </ActionButton>
            </ButtonGroup>
          </Flex>
          {selectedSchemaField && (
            <Well>
              <Flex direction="column" gap="size-50">
                <Text><strong>Path:</strong> {selectedSchemaField.relativePath || selectedSchemaField.path}</Text>
                <Text><strong>Type:</strong> {selectedSchemaField.type}{selectedSchemaField.format ? ` (${selectedSchemaField.format})` : ''}</Text>
                {selectedSchemaField.enum && <Text><strong>Allowed values:</strong> {selectedSchemaField.enum.join(', ')}</Text>}
                {selectedSchemaField.description && <Text>{selectedSchemaField.description}</Text>}
              </Flex>
            </Well>
          )}
        </Flex>
      )}
    </View>
  )

  const renderRequestBody = () => (
    <View UNSAFE_style={panelStyle}>
      <Form>
          <Flex gap="size-250" wrap>
            <TextField
              label="Datastream ID"
              value={requestState.datastreamId}
              onChange={(value) => setRequestValue('datastreamId', value)}
              width="size-3600"
              contextualHelp={renderSectionHelp('requestBasics')}
            />
            <TextField
              label="Identity namespace"
              value={requestState.identityNamespace}
              onChange={(value) => setRequestValue('identityNamespace', value)}
              width="size-2400"
            />
            <TextField
              label="Identity value"
              value={requestState.identityValue}
              onChange={(value) => setRequestValue('identityValue', value)}
              width="size-3600"
            />
          </Flex>
          <Flex gap="size-250" wrap marginTop="size-200" alignItems="end">
            <Picker
              label="Decision input"
              selectedKey={requestState.mode}
              onSelectionChange={(key) => setRequestValue('mode', key)}
              width="size-2400"
              menuWidth={240}
              contextualHelp={renderSectionHelp('decisionInput')}
            >
              <Item key="decisionScopes">Decision scopes</Item>
              <Item key="surfaces">Surfaces</Item>
            </Picker>
            <Switch
              isSelected={requestState.preserveState}
              onChange={(value) => setRequestValue('preserveState', value)}
            >
              Preserve Edge state
            </Switch>
            <Switch
              isSelected={requestState.includeContext}
              onChange={(value) => setRequestValue('includeContext', value)}
            >
              Include context data
            </Switch>
          </Flex>
          {requestState.mode === 'decisionScopes' ? (
            <TextArea
              label="Decision scopes"
              value={requestState.decisionScopes}
              onChange={(value) => setRequestValue('decisionScopes', value)}
              width="100%"
              height="size-1200"
              marginTop="size-200"
            />
          ) : (
            <Flex direction="column" gap="size-150" marginTop="size-200">
              <TextArea
                label="Surfaces"
                value={requestState.surfaces}
                onChange={(value) => setRequestValue('surfaces', value)}
                width="100%"
                height="size-1200"
                placeholder={'web://my.site.com/about.html\nweb://my.site.com/*#hero_image'}
                contextualHelp={renderSectionHelp('surfaces')}
              />
              <Text UNSAFE_style={{ fontSize: '12px', color: '#6e6e6e' }}>
                One full surface URI per line — Type://Property/Container (e.g. web://my.site.com/page#location).
              </Text>
              {surfaceOptions.length > 0 && (
                <Picker
                  label="Send to surface"
                  selectedKey={requestState.selectedSurface || surfaceOptions[0]}
                  onSelectionChange={(key) => setRequestValue('selectedSurface', key)}
                  width="size-4600"
                  menuWidth={460}
                >
                  {surfaceOptions.map((surface) => (
                    <Item key={surface}>{surface}</Item>
                  ))}
                </Picker>
              )}
            </Flex>
          )}
          {!requestState.includeContext && (
            <View marginTop="size-250" UNSAFE_style={panelStyle}>
              <StatusLight variant="neutral">
                Simple event — identity + scope/surface only. Turn on "Include context data" to add XDM context.
              </StatusLight>
            </View>
          )}
          {requestState.includeContext && renderSchemaAssistant()}
          {requestState.includeContext && (
          <View marginTop="size-250" UNSAFE_style={panelStyle}>
            <Flex justifyContent="space-between" alignItems="center" wrap gap="size-100">
              <Flex alignItems="center" gap="size-100">
                <Heading level={3} marginTop="size-0" marginBottom="size-0">XDM / context fields</Heading>
                {renderSectionHelp('contextFields')}
              </Flex>
              <ButtonGroup>
                <ActionButton onPress={addXdmField}>
                  <Add size="S" />
                  <Text>Add field</Text>
                </ActionButton>
              </ButtonGroup>
            </Flex>
            <TextField
              label="Tenant field"
              value={requestState.tenantField}
              onChange={(value) => setRequestValue('tenantField', value)}
              placeholder="_adobedemoamericas275"
              width="size-3600"
              marginTop="size-150"
            />
            {xdmFields.length === 0 && (
              <StatusLight variant="neutral">No context fields</StatusLight>
            )}
            {missingRequiredContextFields.length > 0 && (
              <StatusLight variant="negative">
                Required by schema: {missingRequiredContextFields.join(', ')}
              </StatusLight>
            )}
            <Flex direction="column" gap="size-150" marginTop="size-150">
              {xdmFields.map((field) => (
                <Flex key={field.id} gap="size-150" alignItems="end" wrap>
                  <TextField
                    label="XDM path"
                    value={field.path}
                    onChange={(value) => updateXdmField(field.id, 'path', value)}
                    placeholder="web.webPageDetails.name"
                    width="size-3600"
                  />
                  <Picker
                    label="Type"
                    selectedKey={field.type}
                    onSelectionChange={(value) => updateXdmField(field.id, 'type', value)}
                    width="size-1800"
                    menuWidth={190}
                  >
                    <Item key="string">String</Item>
                    <Item key="number">Number</Item>
                    <Item key="boolean">Boolean</Item>
                    <Item key="json">JSON</Item>
                  </Picker>
                  <TextField
                    label="Value"
                    value={field.value}
                    onChange={(value) => updateXdmField(field.id, 'value', value)}
                    width="size-3600"
                    isRequired={requiredContextPaths.has(field.path)}
                    validationState={requiredContextPaths.has(field.path) && !String(field.value).trim() ? 'invalid' : undefined}
                  />
                  <ActionButton onPress={() => removeXdmField(field.id)}>
                    <Delete size="S" />
                    <Text>Remove</Text>
                  </ActionButton>
                </Flex>
              ))}
            </Flex>
            <TextArea
              label="XDM preview"
              value={xdmPreview}
              isReadOnly
              width="100%"
              height="size-1200"
              marginTop="size-200"
            />
            <StatusLight variant="info">
              {DEFAULT_PERSONALIZATION_SCHEMAS.length} personalization schemas included automatically
            </StatusLight>
          </View>
          )}
          <TextField
            label="Assurance session ID"
            value={requestState.assuranceSessionId}
            onChange={(value) => setRequestValue('assuranceSessionId', value)}
            width="size-4600"
            marginTop="size-200"
            contextualHelp={renderSectionHelp('assurance')}
          />
          <ButtonGroup marginTop="size-300">
            <Button variant="cta" onPress={handleSendRequest} isDisabled={loading}>
              {loading && <ProgressCircle size="S" />}
              <Text>Send request</Text>
            </Button>
            <ActionButton onPress={handleLoadSample}>
              <Gift size="S" />
              <Text>Load sample</Text>
            </ActionButton>
            <ActionButton onPress={handleClearState}>
              <Refresh size="S" />
              <Text>Clear state</Text>
            </ActionButton>
          </ButtonGroup>
        </Form>
      </View>
  )

  const renderOfferItem = (item, index, proposition) => (
    <View key={`${item.id || index}-${index}`} UNSAFE_style={panelStyle}>
      <Flex direction="column" gap="size-100">
        <Flex gap="size-100" alignItems="center" wrap>
          <Badge variant={item.isFallback ? 'notice' : 'positive'}>
            {item.isFallback ? 'Fallback' : 'Personalized'}
          </Badge>
          <Text>{item.id || `Item ${index + 1}`}</Text>
        </Flex>
        <Text><strong>Scope:</strong> {proposition.scope || 'N/A'}</Text>
        <Text><strong>Activity:</strong> {proposition.activity?.id || 'N/A'}</Text>
        <Text><strong>Placement:</strong> {proposition.placement?.id || 'N/A'}</Text>
        <Text><strong>Schema:</strong> {item.schema || 'N/A'}</Text>
        <Text><strong>Format:</strong> {item.format || 'N/A'}</Text>
        {item.deliveryURL && <Text><strong>Asset:</strong> {item.deliveryURL}</Text>}
        {item.linkURL && <Text><strong>Link:</strong> {item.linkURL}</Text>}
        {item.content && (
          <TextArea
            label="Content"
            value={formatOfferContent(item.content)}
            isReadOnly
            width="100%"
            height="size-1000"
          />
        )}
      </Flex>
    </View>
  )

  const renderInspectBody = () => (
    <Flex direction="column" gap="size-250">
      {renderSummary()}
      <View UNSAFE_style={panelStyle}>
        <Heading level={3}>Resolved offers</Heading>
        <Flex direction="column" gap="size-150">
          {(normalized?.propositions || []).length === 0 && (
            <StatusLight variant="neutral">No propositions loaded</StatusLight>
          )}
          {(normalized?.propositions || []).map((proposition, propositionIndex) => (
            <Flex key={proposition.id || propositionIndex} direction="column" gap="size-150">
              {(proposition.items || []).length === 0 ? (
                <View UNSAFE_style={panelStyle}>
                  <StatusLight variant="notice">No proposition items returned for {proposition.scope || proposition.id}</StatusLight>
                </View>
              ) : (
                proposition.items.map((item, itemIndex) => renderOfferItem(item, itemIndex, proposition))
              )}
            </Flex>
          ))}
        </Flex>
      </View>
      <View UNSAFE_style={panelStyle}>
        <Flex alignItems="center" gap="size-100">
          <Heading level={3}>Visual preview</Heading>
          {renderSectionHelp('visualPreview')}
        </Flex>
        <Flex gap="size-250" wrap alignItems="start">
          <View flex="1" minWidth="size-3600">
            <Form>
              <Flex gap="size-150" alignItems="end" wrap>
                <Picker
                  label="Template"
                  selectedKey={template.type}
                  onSelectionChange={(key) => setTemplate((prev) => ({ ...prev, type: key }))}
                  width="size-2400"
                  menuWidth={240}
                >
                  <Item key="card">Card</Item>
                  <Item key="carousel">Carousel</Item>
                  <Item key="grid">Grid</Item>
                  <Item key="hero">Hero / banner</Item>
                </Picker>
                <ActionButton onPress={handleSuggestMappings} isDisabled={mappingOptions.length === 0}>
                  <Function size="S" />
                  <Text>Suggest mappings</Text>
                </ActionButton>
              </Flex>
              <Flex gap="size-100" wrap marginTop="size-150" alignItems="center">
                <Badge variant={mappingOptions.length > 0 ? 'info' : 'neutral'}>
                  {mappingOptions.length} payload field{mappingOptions.length === 1 ? '' : 's'}
                </Badge>
                {offerItems.length > 0 && (
                  <Badge variant="positive">{offerItems.length} offer item{offerItems.length === 1 ? '' : 's'}</Badge>
                )}
              </Flex>
              <Flex direction="column" gap="size-150" marginTop="size-150">
                {Object.entries(template.fieldMappings).map(renderMappingField)}
              </Flex>
            </Form>
          </View>
          <View flex="2" minWidth="size-4600">
            {renderPreview(offerItems, template)}
          </View>
        </Flex>
      </View>
      <View UNSAFE_style={panelStyle}>
        <Flex justifyContent="space-between" alignItems="center" wrap gap="size-100">
          <Heading level={3}>Raw and debug</Heading>
          <ButtonGroup>
            <ActionButton
              onPress={() => handleCopy(result?.curl || '', 'cURL copied.')}
              isDisabled={!result?.curl}
            >
              <Copy size="S" />
              <Text>Copy cURL</Text>
            </ActionButton>
            <ActionButton
              onPress={() => handleCopy(stringifyJson(result?.rawResponse), 'Response JSON copied.')}
              isDisabled={!result?.rawResponse}
            >
              <Copy size="S" />
              <Text>Copy response</Text>
            </ActionButton>
          </ButtonGroup>
        </Flex>
        <Flex gap="size-200" wrap>
          <TextArea
            label="Request"
            value={stringifyJson(result?.request)}
            isReadOnly
            width="size-4600"
            height="size-2400"
          />
          <TextArea
            label="Response"
            value={stringifyJson(result?.rawResponse)}
            isReadOnly
            width="size-4600"
            height="size-2400"
          />
          <TextArea
            label="Debug metadata"
            value={stringifyJson({
              locationHints: normalized?.locationHints || [],
              stateEntries,
              identity: normalized?.identity || [],
              handles: normalized?.handles || []
            })}
            isReadOnly
            width="size-4600"
            height="size-2400"
          />
        </Flex>
      </View>
    </Flex>
  )

  const renderRequestInspectTab = () => (
    <Flex direction="column" gap="size-250">
      {renderStepActions('request')}
      {renderRequestBody()}
      <Divider size="M" />
      <Heading level={3} marginBottom="size-0">Results</Heading>
      {renderInspectBody()}
    </Flex>
  )

  const renderPreview = (items, previewTemplate, emptyMessage = 'No offer payload loaded') => {
    if (!items || items.length === 0) {
      return (
        <View UNSAFE_style={{ ...previewShellStyle, display: 'grid', placeItems: 'center' }}>
          <StatusLight variant="neutral">{emptyMessage}</StatusLight>
        </View>
      )
    }

    const type = previewTemplate.type
    const previewItems = type === 'card' ? items.slice(0, 1) : items
    const layoutStyle = type === 'carousel' ? previewCarouselStyle : previewGridStyle

    return (
      <View UNSAFE_style={previewShellStyle}>
        {type === 'hero' ? (
          <OfferCardPreview item={previewItems[0]} template={previewTemplate} hero />
        ) : (
          <div style={layoutStyle}>
            {previewItems.map((item, index) => (
              <OfferCardPreview key={item.id || index} item={item} template={previewTemplate} />
            ))}
          </div>
        )}
      </View>
    )
  }

  const renderDesignItemFields = (item, index) => (
    <View key={item.id} UNSAFE_style={mappingRowStyle}>
      <Flex justifyContent="space-between" alignItems="center" wrap gap="size-100">
        <Heading level={4} marginTop="size-100" marginBottom="size-100">Item {index + 1}</Heading>
        {design.items.length > 1 && (
          <ActionButton onPress={() => removeDesignItem(item.id)}>
            <Delete size="S" />
            <Text>Remove item</Text>
          </ActionButton>
        )}
      </Flex>
      <Flex direction="column" gap="size-150">
        <TextField
          label="Title"
          value={item.title}
          onChange={(value) => updateDesignItemField(item.id, 'title', value)}
          width="100%"
        />
        <TextArea
          label="Description"
          value={item.description}
          onChange={(value) => updateDesignItemField(item.id, 'description', value)}
          width="100%"
        />
        <TextField
          label="Image URL"
          value={item.image}
          onChange={(value) => updateDesignItemField(item.id, 'image', value)}
          width="100%"
        />
        <Flex gap="size-150" wrap>
          <TextField
            label="CTA label"
            value={item.ctaLabel}
            onChange={(value) => updateDesignItemField(item.id, 'ctaLabel', value)}
            width="size-3000"
          />
          <TextField
            label="CTA URL"
            value={item.ctaUrl}
            onChange={(value) => updateDesignItemField(item.id, 'ctaUrl', value)}
            width="size-3600"
          />
        </Flex>
        <TextField
          label="Badge"
          value={item.badge}
          onChange={(value) => updateDesignItemField(item.id, 'badge', value)}
          width="size-3000"
        />
        {(item.custom || []).map((pair) => (
          <Flex key={pair.id} gap="size-150" alignItems="end" wrap>
            <TextField
              label="Custom field"
              value={pair.key}
              onChange={(value) => updateCustomField(item.id, pair.id, 'key', value)}
              width="size-3000"
            />
            <TextField
              label="Value"
              value={pair.value}
              onChange={(value) => updateCustomField(item.id, pair.id, 'value', value)}
              width="size-3000"
            />
            <ActionButton onPress={() => removeCustomField(item.id, pair.id)}>
              <Delete size="S" />
              <Text>Remove</Text>
            </ActionButton>
          </Flex>
        ))}
        <ActionButton onPress={() => addCustomField(item.id)} alignSelf="start">
          <Add size="S" />
          <Text>Add custom field</Text>
        </ActionButton>
      </Flex>
    </View>
  )

  const renderStepActions = (stepKey) => {
    const index = STEP_ORDER.indexOf(stepKey)
    const nextKey = STEP_ORDER[index + 1]
    return (
      <View
        UNSAFE_style={{ ...panelStyle, position: 'sticky', top: 0, zIndex: 2 }}
      >
        <Flex justifyContent="space-between" alignItems="center" wrap gap="size-150">
          <Flex alignItems="center" gap="size-100">
            <Badge variant="info">Step {index + 1} of {STEP_ORDER.length}</Badge>
            <Text><strong>{STEP_LABELS[stepKey]}</strong></Text>
          </Flex>
          <ButtonGroup>
            <Button variant="secondary" onPress={handleSaveConfig} isDisabled={configLoading}>
              {configLoading && <ProgressCircle size="S" />}
              <SaveFloppy size="S" />
              <Text>Save</Text>
            </Button>
            {nextKey && (
              <Button variant="cta" onPress={() => handleSaveAndContinueStep(stepKey)} isDisabled={configLoading}>
                <Text>Save &amp; continue</Text>
              </Button>
            )}
          </ButtonGroup>
        </Flex>
      </View>
    )
  }

  const renderOverviewTab = () => (
    <Flex direction="column" gap="size-250">
      <Flex justifyContent="space-between" alignItems="center" wrap gap="size-150">
        <Flex alignItems="center" gap="size-100">
          <Heading level={3} marginTop="size-0" marginBottom="size-0">Experiences</Heading>
          <Badge variant="neutral">{savedConfigs.length}</Badge>
        </Flex>
        <ButtonGroup>
          <ActionButton onPress={loadConfigs} isDisabled={configLoading}>
            <Refresh size="S" />
            <Text>Refresh</Text>
          </ActionButton>
          <Button variant="cta" onPress={startNewExperience}>
            <Add size="S" />
            <Text>Create experience</Text>
          </Button>
        </ButtonGroup>
      </Flex>
      {savedConfigs.length === 0 ? (
        <View UNSAFE_style={panelStyle}>
          <Flex direction="column" gap="size-200" alignItems="start">
            <StatusLight variant="neutral">No experiences yet. Create one to start designing, requesting, and publishing.</StatusLight>
            <Button variant="cta" onPress={startNewExperience}>
              <Add size="S" />
              <Text>Create your first experience</Text>
            </Button>
          </Flex>
        </View>
      ) : (
        <TableView aria-label="Saved experiences" selectionMode="none" density="spacious">
          <TableHeader>
            <Column key="name">Name</Column>
            <Column key="type" width={130}>Type</Column>
            <Column key="input" width={150}>Decision input</Column>
            <Column key="status" width={120}>Status</Column>
            <Column key="updated" width={200}>Updated</Column>
            <Column key="actions" width={140} align="end">Actions</Column>
          </TableHeader>
          <TableBody items={savedConfigs}>
            {(config) => (
              <Row key={config.id}>
                <Cell>{config.name || config.id}</Cell>
                <Cell>{config.experienceType || config.templateType || 'card'}</Cell>
                <Cell>{config.mode === 'surfaces' ? 'Surfaces' : 'Decision scopes'}</Cell>
                <Cell>
                  <Badge variant={config.publish && config.publish.enabled ? 'positive' : 'neutral'}>
                    {config.publish && config.publish.enabled ? 'Published' : 'Draft'}
                  </Badge>
                </Cell>
                <Cell>{formatConfigDate(config.updatedAt)}</Cell>
                <Cell>
                  <Flex gap="size-100" justifyContent="end" alignItems="center">
                    <ActionMenu onAction={(key) => handleRowAction(key, config)}>
                      <Item key="publish">Publish</Item>
                      <Item key="openSite">Open public site</Item>
                      <Item key="copyUrl">Copy public URL</Item>
                      <Item key="duplicate">Duplicate</Item>
                      <Item key="load">Load</Item>
                      <Item key="delete">Delete</Item>
                    </ActionMenu>
                  </Flex>
                </Cell>
              </Row>
            )}
          </TableBody>
        </TableView>
      )}
    </Flex>
  )

  const renderDesignTab = () => (
    <Flex direction="column" gap="size-250">
      {renderStepActions('design')}
      <Flex gap="size-250" wrap alignItems="start">
      <View UNSAFE_style={panelStyle} flex="1" minWidth="size-3600">
        <Form>
          <Flex gap="size-150" alignItems="end" wrap>
            <Picker
              label="Experience type"
              selectedKey={design.type}
              onSelectionChange={setDesignType}
              width="size-2400"
              menuWidth={240}
              contextualHelp={renderSectionHelp('design')}
            >
              <Item key="card">Card</Item>
              <Item key="carousel">Carousel</Item>
              <Item key="grid">Grid</Item>
              <Item key="hero">Hero / banner</Item>
            </Picker>
            {canAddDesignItem && (
              <ActionButton onPress={addDesignItem}>
                <Add size="S" />
                <Text>Add item</Text>
              </ActionButton>
            )}
          </Flex>
          <Flex direction="column" gap="size-150" marginTop="size-150">
            {design.items.map(renderDesignItemFields)}
          </Flex>
        </Form>
      </View>
      <View flex="2" minWidth="size-4600">
        <Flex direction="column" gap="size-250">
          {renderPreview(
            design.items.map(toPreviewItem),
            { ...DEFAULT_TEMPLATE, type: design.type },
            'Add content to preview your experience'
          )}
          <View UNSAFE_style={panelStyle}>
            <Flex justifyContent="space-between" alignItems="center" wrap gap="size-100">
              <Flex alignItems="center" gap="size-100">
                <Heading level={3} marginTop="size-0" marginBottom="size-0">Experience JSON</Heading>
                {renderSectionHelp('designJson')}
              </Flex>
              <ButtonGroup>
                <ActionButton onPress={() => handleCopy(designJsonText, 'Design JSON copied.')}>
                  <Copy size="S" />
                  <Text>Copy JSON</Text>
                </ActionButton>
                <ActionButton onPress={() => handleCopy(designHtml, 'Design HTML copied.')}>
                  <Copy size="S" />
                  <Text>Copy as HTML</Text>
                </ActionButton>
              </ButtonGroup>
            </Flex>
            <StatusLight variant="info">Paste the JSON (or HTML) into your AJO code-based experience content.</StatusLight>
            <TextArea
              label="JSON"
              value={designJsonText}
              isReadOnly
              width="100%"
              height="size-3600"
              marginTop="size-100"
            />
          </View>
        </Flex>
      </View>
      </Flex>
    </Flex>
  )

  const renderMappingField = ([key, value]) => {
    const selectedPath = extractMappingPath(value)
    const options = getMappingOptionsForValue(mappingOptions, selectedPath, sampleOfferItem)
    const sampleValue = sampleOfferItem ? resolveMappedValue(sampleOfferItem, selectedPath) : ''
    const label = TEMPLATE_FIELD_LABELS[key] || getPathLabel(key)

    return (
      <View key={key} UNSAFE_style={mappingRowStyle}>
        <Flex direction="column" gap="size-100">
          <ComboBox
            label={`${label} field`}
            selectedKey={selectedPath || null}
            onSelectionChange={(nextValue) => setMappingValue(key, nextValue || '')}
            width="100%"
            menuWidth={620}
            menuTrigger="focus"
            isDisabled={mappingOptions.length === 0}
          >
            {options.map((option) => (
              <Item key={option.path} textValue={option.textValue}>{option.label}</Item>
            ))}
          </ComboBox>
          {sampleValue ? (
            <View UNSAFE_style={mappingSampleStyle}>
              <Text>Sample: {formatDisplayValue(sampleValue, 180)}</Text>
            </View>
          ) : (
            <StatusLight variant="neutral">No sample value</StatusLight>
          )}
        </Flex>
      </View>
    )
  }

  const renderPublishTab = () => (
    <Flex direction="column" gap="size-250">
      {renderStepActions('publish')}
      <View UNSAFE_style={panelStyle}>
        <Heading level={3} marginTop="size-0">Experience summary</Heading>
        <Flex direction="column" gap="size-100" marginTop="size-100">
          <Text><strong>Name:</strong> {configName || 'Untitled'}</Text>
          <Text><strong>Experience:</strong> {design.type} · {design.items.length} item{design.items.length === 1 ? '' : 's'}</Text>
          <Text><strong>Decision input:</strong> {requestState.mode === 'surfaces'
            ? `${surfaceOptions.length} surface(s)${requestState.selectedSurface ? ` · target: ${requestState.selectedSurface}` : ''}`
            : `${parseList(requestState.decisionScopes).length} decision scope(s)`}</Text>
          <Text><strong>Datastream:</strong> {requestState.datastreamId || '—'}</Text>
          <Text><strong>Identity namespace:</strong> {requestState.identityNamespace || '—'}</Text>
          <Text><strong>Context:</strong> {requestState.includeContext
            ? `on · ${countContextFields(xdmFields)} field(s) · ${requiredSchemaFields.length} required`
            : 'off (simple event)'}</Text>
          <Text><strong>Template:</strong> {template.type}</Text>
          <Flex alignItems="center" gap="size-100">
            <Text><strong>Status:</strong></Text>
            <Badge variant={previewUrl ? 'positive' : 'neutral'}>{previewUrl ? 'Published' : 'Draft'}</Badge>
          </Flex>
        </Flex>
      </View>
      <View UNSAFE_style={panelStyle}>
        <Form>
          <TextField
            label="Configuration name"
            value={configName}
            onChange={setConfigName}
            width="size-4600"
            contextualHelp={renderSectionHelp('publish')}
          />
          <ButtonGroup marginTop="size-250">
            <Button variant="cta" onPress={handlePublishConfig} isDisabled={configLoading}>
              {configLoading && <ProgressCircle size="S" />}
              <Preview size="S" />
              <Text>Publish preview</Text>
            </Button>
            <ActionButton onPress={handleUnpublishConfig} isDisabled={!configId || configLoading}>
              <Text>Unpublish</Text>
            </ActionButton>
          </ButtonGroup>
        </Form>
        {previewUrl && (
          <View marginTop="size-250">
            <TextField label="Standalone preview URL" value={previewUrl} isReadOnly width="100%" />
            <ButtonGroup marginTop="size-100">
              <ActionButton onPress={() => handleCopy(previewUrl, 'Preview URL copied.')}>
                <Copy size="S" />
                <Text>Copy URL</Text>
              </ActionButton>
              <a href={previewUrl} target="_blank" rel="noopener noreferrer" style={{ alignSelf: 'center' }}>
                Open preview
              </a>
            </ButtonGroup>
          </View>
        )}
      </View>
    </Flex>
  )

  const stepRenderers = {
    design: renderDesignTab,
    request: renderRequestInspectTab,
    publish: renderPublishTab
  }
  const tabDefs = [
    { key: 'overview', label: 'Overview', render: renderOverviewTab },
    ...(editing
      ? STEP_ORDER.slice(0, unlockedStep + 1).map((key) => ({
          key,
          label: STEP_LABELS[key],
          render: stepRenderers[key]
        }))
      : [])
  ]

  return (
    <View width="100%">
      <Flex direction="column" gap="size-250">
        <Flex justifyContent="space-between" alignItems="center" wrap gap="size-150">
          <Heading level={1} marginBottom="size-0">
            <Function size="L" />
            <Text>Offer Decisioning Studio</Text>
          </Heading>
          {editing && activeTab !== 'overview' && (
            <Badge variant={configId ? 'positive' : 'neutral'}>{configId ? 'Saved draft' : 'Unsaved'}</Badge>
          )}
        </Flex>

        {message && <StatusLight variant="positive">{message}</StatusLight>}
        {error && <StatusLight variant="negative">{error}</StatusLight>}

        <Divider size="M" />

        <Tabs items={tabDefs} selectedKey={activeTab} onSelectionChange={setActiveTab}>
          <TabList>
            {(tab) => <Item key={tab.key}>{tab.label}</Item>}
          </TabList>
          <TabPanels>
            {(tab) => <Item key={tab.key}>{tab.render()}</Item>}
          </TabPanels>
        </Tabs>

        {editing && activeTab !== 'overview' && (
          <Well>
            <Text>
              Active request: {requestState.mode === 'surfaces' ? parseList(requestState.surfaces).length : parseList(requestState.decisionScopes).length} target(s),
              {DEFAULT_PERSONALIZATION_SCHEMAS.length} schema(s), {countContextFields(xdmFields)} context field(s), {stateEntries.length} state entr{stateEntries.length === 1 ? 'y' : 'ies'}.
            </Text>
          </Well>
        )}

        <DialogContainer onDismiss={() => setDeleteTarget(null)}>
          {deleteTarget && (
            <AlertDialog
              title="Delete experience"
              variant="destructive"
              primaryActionLabel="Delete"
              cancelLabel="Cancel"
              onPrimaryAction={() => {
                handleDeleteConfig(deleteTarget.id)
                setDeleteTarget(null)
              }}
            >
              Delete "{deleteTarget.name || deleteTarget.id}"? This also removes any published preview and cannot be undone.
            </AlertDialog>
          )}
        </DialogContainer>

      </Flex>
    </View>
  )
}

OfferSimulator.propTypes = {
  ims: PropTypes.any
}

export default OfferSimulator
