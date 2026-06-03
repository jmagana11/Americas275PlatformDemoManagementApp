/*
* <license header>
*/

import React, { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import {
  ActionButton,
  Badge,
  Button,
  ButtonGroup,
  ComboBox,
  Divider,
  Flex,
  Form,
  Heading,
  Item,
  Picker,
  ProgressCircle,
  StatusLight,
  Switch,
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
  const [activeTab, setActiveTab] = useState('request')
  const [requestState, setRequestState] = useState({
    datastreamId: '',
    identityNamespace: 'ECID',
    identityValue: '',
    mode: 'decisionScopes',
    decisionScopes: '',
    surfaces: '',
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

  useEffect(() => {
    loadConfigs()
    loadSchemaOrgs()
  }, [])

  useEffect(() => {
    localStorage.setItem('offerDecisioningStateEntries', JSON.stringify(stateEntries || []))
  }, [stateEntries])

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
    const xdm = buildXdmFromFields(xdmFields, requestState.tenantField)
    return {
      datastreamId: requestState.datastreamId.trim(),
      identityNamespace: requestState.identityNamespace.trim(),
      identityValue: requestState.identityValue.trim(),
      mode: requestState.mode,
      decisionScopes: parseList(requestState.decisionScopes),
      surfaces: parseList(requestState.surfaces),
      schemas: [...DEFAULT_PERSONALIZATION_SCHEMAS],
      xdm,
      contextTenantField: requestState.tenantField.trim(),
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
        surfaces: requestPayload.surfaces,
        schemas: [...DEFAULT_PERSONALIZATION_SCHEMAS],
        contextTenantField: requestPayload.contextTenantField,
        xdmDefaults: requestPayload.xdm,
        preserveState: requestPayload.preserveState
      },
      template: cleanTemplateMappings(template)
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
    try {
      const payload = buildRequestPayload()
      setLoading(true)
      const response = await callAction('edge-interact', payload)
      setResult(response)
      setStateEntries(response.normalized?.stateEntries || [])
      setActiveTab('inspect')
      setMessage('Offer decision returned.')
    } catch (requestError) {
      setError(requestError.message || 'Offer decision request failed')
    } finally {
      setLoading(false)
    }
  }

  const handleLoadSample = () => {
    setResult(SAMPLE_RESULT)
    setStateEntries(SAMPLE_RESULT.normalized.stateEntries)
    setActiveTab('inspect')
    setMessage('Sample offer response loaded.')
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

  const handleLoadConfig = async () => {
    if (!selectedConfigId) return
    setError('')
    setMessage('')
    try {
      setConfigLoading(true)
      const response = await callAction('offer-configs', {
        operation: 'getConfig',
        configId: selectedConfigId
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
      setResult((prev) => ({
        ...(prev || {}),
        config
      }))
      setMessage('Configuration loaded.')
    } catch (loadError) {
      setError(loadError.message || 'Load failed')
    } finally {
      setConfigLoading(false)
    }
  }

  const handleDeleteConfig = async () => {
    if (!selectedConfigId) return
    setError('')
    setMessage('')
    try {
      setConfigLoading(true)
      await callAction('offer-configs', {
        operation: 'deleteConfig',
        configId: selectedConfigId
      })
      if (selectedConfigId === configId) {
        setConfigId('')
      }
      setSelectedConfigId('')
      await loadConfigs()
      setMessage('Configuration deleted.')
    } catch (deleteError) {
      setError(deleteError.message || 'Delete failed')
    } finally {
      setConfigLoading(false)
    }
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

  const renderSchemaAssistant = () => (
    <View marginTop="size-250" UNSAFE_style={panelStyle}>
      <Flex justifyContent="space-between" alignItems="center" wrap gap="size-100">
        <Heading level={3} marginTop="size-0" marginBottom="size-0">Schema assistant</Heading>
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

  const renderRequestTab = () => (
    <Flex direction="column" gap="size-250">
      <View UNSAFE_style={panelStyle}>
        <Form>
          <Flex gap="size-250" wrap>
            <TextField
              label="Datastream ID"
              value={requestState.datastreamId}
              onChange={(value) => setRequestValue('datastreamId', value)}
              width="size-3600"
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
            <TextArea
              label="Surfaces"
              value={requestState.surfaces}
              onChange={(value) => setRequestValue('surfaces', value)}
              width="100%"
              height="size-1200"
              marginTop="size-200"
            />
          )}
          {renderSchemaAssistant()}
          <View marginTop="size-250" UNSAFE_style={panelStyle}>
            <Flex justifyContent="space-between" alignItems="center" wrap gap="size-100">
              <Heading level={3} marginTop="size-0" marginBottom="size-0">XDM / context fields</Heading>
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
          <TextField
            label="Assurance session ID"
            value={requestState.assuranceSessionId}
            onChange={(value) => setRequestValue('assuranceSessionId', value)}
            width="size-4600"
            marginTop="size-200"
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
    </Flex>
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

  const renderInspectTab = () => (
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

  const renderCanvasPreview = () => {
    if (offerItems.length === 0) {
      return (
        <View UNSAFE_style={{ ...previewShellStyle, display: 'grid', placeItems: 'center' }}>
          <StatusLight variant="neutral">No offer payload loaded</StatusLight>
        </View>
      )
    }

    const previewItems = template.type === 'card' ? offerItems.slice(0, 1) : offerItems
    const layoutStyle = template.type === 'carousel'
      ? previewCarouselStyle
      : previewGridStyle

    return (
      <View UNSAFE_style={previewShellStyle}>
        {template.type === 'hero' ? (
          <OfferCardPreview item={previewItems[0]} template={template} hero />
        ) : (
          <div style={layoutStyle}>
            {previewItems.map((item, index) => (
              <OfferCardPreview key={item.id || index} item={item} template={template} />
            ))}
          </div>
        )}
      </View>
    )
  }

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

  const renderCanvasTab = () => (
    <Flex gap="size-250" wrap alignItems="start">
      <View UNSAFE_style={panelStyle} flex="1" minWidth="size-3600">
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
        {renderCanvasPreview()}
      </View>
    </Flex>
  )

  const renderPublishTab = () => (
    <Flex direction="column" gap="size-250">
      <View UNSAFE_style={panelStyle}>
        <Form>
          <TextField
            label="Configuration name"
            value={configName}
            onChange={setConfigName}
            width="size-4600"
          />
          <ButtonGroup marginTop="size-250">
            <Button variant="cta" onPress={handleSaveConfig} isDisabled={configLoading}>
              {configLoading && <ProgressCircle size="S" />}
              <Text>Save config</Text>
            </Button>
            <ActionButton onPress={handlePublishConfig} isDisabled={configLoading}>
              <Preview size="S" />
              <Text>Publish preview</Text>
            </ActionButton>
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
      <View UNSAFE_style={panelStyle}>
        <Flex justifyContent="space-between" alignItems="center" wrap gap="size-100">
          <Heading level={3}>Saved configurations</Heading>
          <ActionButton onPress={loadConfigs} isDisabled={configLoading}>
            <Refresh size="S" />
            <Text>Refresh</Text>
          </ActionButton>
        </Flex>
        <Flex gap="size-150" alignItems="end" wrap>
          <ComboBox
            label="Configuration"
            selectedKey={selectedConfigId}
            onSelectionChange={(key) => setSelectedConfigId(key || '')}
            width="size-6000"
            minWidth="size-3600"
            menuWidth={560}
            menuTrigger="focus"
          >
            {savedConfigs.map((config) => (
              <Item key={config.id} textValue={getConfigLabel(config)}>{getConfigLabel(config)}</Item>
            ))}
          </ComboBox>
          <ButtonGroup>
            <ActionButton onPress={handleLoadConfig} isDisabled={!selectedConfigId || configLoading}>
              <SaveFloppy size="S" />
              <Text>Load</Text>
            </ActionButton>
            <ActionButton onPress={handleDeleteConfig} isDisabled={!selectedConfigId || configLoading}>
              <Text>Delete</Text>
            </ActionButton>
          </ButtonGroup>
        </Flex>
      </View>
    </Flex>
  )

  return (
    <View width="100%">
      <Flex direction="column" gap="size-250">
        <Flex justifyContent="space-between" alignItems="center" wrap gap="size-150">
          <Heading level={1} marginBottom="size-0">
            <Function size="L" />
            <Text>Offer Decisioning Studio</Text>
          </Heading>
          <Badge variant={configId ? 'positive' : 'neutral'}>{configId ? 'Saved draft' : 'Unsaved'}</Badge>
        </Flex>

        {message && <StatusLight variant="positive">{message}</StatusLight>}
        {error && <StatusLight variant="negative">{error}</StatusLight>}

        <Divider size="M" />

        <Tabs selectedKey={activeTab} onSelectionChange={setActiveTab}>
          <TabList>
            <Item key="request">Request</Item>
            <Item key="inspect">Inspect</Item>
            <Item key="canvas">Canvas</Item>
            <Item key="publish">Publish</Item>
          </TabList>
          <TabPanels>
            <Item key="request">{renderRequestTab()}</Item>
            <Item key="inspect">{renderInspectTab()}</Item>
            <Item key="canvas">{renderCanvasTab()}</Item>
            <Item key="publish">{renderPublishTab()}</Item>
          </TabPanels>
        </Tabs>

        <Well>
          <Text>
            Active request: {requestState.mode === 'surfaces' ? parseList(requestState.surfaces).length : parseList(requestState.decisionScopes).length} target(s),
            {DEFAULT_PERSONALIZATION_SCHEMAS.length} schema(s), {countContextFields(xdmFields)} context field(s), {stateEntries.length} state entr{stateEntries.length === 1 ? 'y' : 'ies'}.
          </Text>
        </Well>
      </Flex>
    </View>
  )
}

OfferSimulator.propTypes = {
  ims: PropTypes.any
}

export default OfferSimulator
