/*
* <license header>
*/

const axios = require('axios')

// main function that will be executed by Adobe I/O Runtime
async function main (params) {
  try {
    console.log('Calling the getSchemaDetails action')
    console.log('Available params:', Object.keys(params))
    
    // Get the bearer token from Authorization header (this comes from the frontend user)
    const authHeader = params.__ow_headers && params.__ow_headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 400,
        body: { error: 'Missing or invalid Authorization header' }
      }
    }
    
    const token = authHeader.substring('Bearer '.length)
    
    // Get parameters from headers
    const sandboxName = params.__ow_headers?.sandboxname || 'prod'
    const schemaId = params.__ow_headers?.schemaid
    
    if (!schemaId) {
      return {
        statusCode: 400,
        body: { error: 'Missing required parameter: schemaId' }
      }
    }
    
    // Get IMS org from headers (sent by frontend) or use known workspace value
    const imsOrgId = (params.__ow_headers && params.__ow_headers['x-gw-ims-org-id']) || params.orgId || process.env.AEP_ORG_ID
    
    // Use stored API key or known workspace value
    const apiKey = params.apiKey || process.env.AEP_API_KEY
    
    console.log('Using frontend user token with API key and org')
    console.log('Sandbox:', sandboxName)
    console.log('Schema ID:', schemaId)
    console.log('Making request to Adobe Platform Schema Registry API for detailed schema...')
    
    // Use the frontend token with stored API key and org
    const platformHeaders = {
      'Authorization': 'Bearer ' + token,
      'x-api-key': apiKey,
      'x-gw-ims-org-id': imsOrgId,
      'x-sandbox-name': sandboxName,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.adobe.xed+json' // Full schema definition
    }
    
    // Encode the schema ID for URL
    const encodedSchemaId = encodeURIComponent(schemaId)
    
    // Get detailed schema from Adobe Experience Platform Schema Registry
    const response = await axios.get(`https://platform.adobe.io/data/foundation/schemaregistry/tenant/schemas/${encodedSchemaId}`, {
      headers: platformHeaders
    })
    
    console.log('Successfully retrieved detailed schema')
    
    const schema = response.data
    
    // Extract field groups and tenant attributes
    const fieldGroups = schema.allOf || []
    const properties = schema.properties || {}
    const tenantProperties = {}
    
    // Look for tenant-specific properties (usually under the org ID)
    const tenantId = imsOrgId.replace('@AdobeOrg', '')
    if (properties[`_${tenantId}`]) {
      tenantProperties[`_${tenantId}`] = properties[`_${tenantId}`]
    }
    
    // Extract all custom field groups
    const customFieldGroups = fieldGroups.filter(fg => 
      fg['$ref'] && (
        fg['$ref'].includes('/tenant/') || 
        fg['$ref'].includes(tenantId)
      )
    )
    
    console.log('Found field groups to resolve:', fieldGroups.length)
    
    // Resolve field group definitions
    const resolvedFieldGroups = await resolveFieldGroups(fieldGroups, platformHeaders)
    
    // Extract identity information
    const identityInfo = extractIdentityInfo(schema)
    
    // Merge all properties from resolved field groups
    const allProperties = mergeFieldGroupProperties(properties, resolvedFieldGroups)
    
    // Build a comprehensive field structure
    const detailedSchema = {
      id: schema['$id'],
      title: schema.title,
      description: schema.description,
      type: schema.type,
      version: schema.version,
      class: schema['meta:class'],
      created: schema['meta:created'],
      updated: schema['meta:updated'],
      
      // Field groups information with resolved definitions
      fieldGroups: {
        total: fieldGroups.length,
        custom: customFieldGroups.length,
        standard: fieldGroups.length - customFieldGroups.length,
        list: fieldGroups.map(fg => ({
          ref: fg['$ref'],
          isCustom: fg['$ref'] && (fg['$ref'].includes('/tenant/') || fg['$ref'].includes(tenantId))
        })),
        resolved: resolvedFieldGroups
      },
      
      // Identity information
      identities: identityInfo,
      
      // All properties including tenant and field groups
      properties: allProperties,
      
      // Original schema properties (before field group merge)
      originalProperties: properties,
      
      // Tenant-specific properties
      tenantProperties: tenantProperties,
      
      // Flattened field structure for AI (using merged properties)
      flattenedFields: flattenSchemaProperties(allProperties, ''),
      
      // Raw schema for debugging
      rawSchema: schema
    }

    return {
      statusCode: 200,
      body: {
        schema: detailedSchema,
        message: `Successfully retrieved detailed schema with ${fieldGroups.length} field groups`
      }
    }
    
  } catch (error) {
    console.error('Error in getSchemaDetails action:', error.message)
    if (error.response) {
      console.error(`API failed with status: ${error.response.status}`)
      console.error('API error details:', JSON.stringify(error.response.data))
      return {
        statusCode: error.response.status,
        body: { 
          error: `Adobe Platform Schema Registry API failed with status: ${error.response.status}`,
          details: error.response.data
        }
      }
    }
    
    return {
      statusCode: 500,
      body: { error: 'Internal server error', details: error.message }
    }
  }
}

// Helper function to resolve field group definitions
async function resolveFieldGroups(fieldGroups, headers) {
  const resolved = []
  
  for (const fieldGroup of fieldGroups) {
    if (fieldGroup['$ref']) {
      try {
        console.log('Resolving field group:', fieldGroup['$ref'])
        
        // Extract the field group ID from the $ref
        const fgId = fieldGroup['$ref']
        const encodedFgId = encodeURIComponent(fgId)
        
        // Fetch the field group definition
        const response = await axios.get(`https://platform.adobe.io/data/foundation/schemaregistry/tenant/fieldgroups/${encodedFgId}`, {
          headers: headers
        })
        
        const fgDefinition = response.data
        
        resolved.push({
          ref: fieldGroup['$ref'],
          title: fgDefinition.title,
          description: fgDefinition.description,
          type: fgDefinition.type,
          properties: fgDefinition.properties || {},
          definitions: fgDefinition.definitions || {},
          isCustom: fieldGroup['$ref'].includes('/tenant/') || fieldGroup['$ref'].includes('_'),
          rawDefinition: fgDefinition
        })
        
        console.log(`Successfully resolved field group: ${fgDefinition.title}`)
        
      } catch (error) {
        console.error(`Failed to resolve field group ${fieldGroup['$ref']}:`, error.message)
        
        // Add placeholder for failed resolution
        resolved.push({
          ref: fieldGroup['$ref'],
          title: 'Failed to resolve',
          description: `Error: ${error.message}`,
          type: 'unknown',
          properties: {},
          definitions: {},
          isCustom: fieldGroup['$ref'].includes('/tenant/') || fieldGroup['$ref'].includes('_'),
          error: error.message
        })
      }
    }
  }
  
  return resolved
}

// Helper function to extract identity information from schema
function extractIdentityInfo(schema) {
  const identities = {
    primary: null,
    namespaces: [],
    fields: []
  }
  
  // Look for identity descriptors in meta:identityDescriptors
  if (schema['meta:identityDescriptors']) {
    identities.fields = schema['meta:identityDescriptors'].map(desc => ({
      path: desc['xdm:sourceProperty'],
      namespace: desc['xdm:namespace'],
      isPrimary: desc['xdm:isPrimary'] || false
    }))
    
    // Find primary identity
    const primaryIdentity = identities.fields.find(field => field.isPrimary)
    if (primaryIdentity) {
      identities.primary = primaryIdentity
    }
    
    // Extract unique namespaces
    identities.namespaces = [...new Set(identities.fields.map(field => field.namespace))]
  }
  
  return identities
}

// Helper function to deeply merge two property objects
function deepMergeProperties(target, source) {
  for (const key of Object.keys(source)) {
    if (
      target[key] &&
      source[key] &&
      typeof target[key] === 'object' &&
      typeof source[key] === 'object' &&
      target[key].type === 'object' &&
      source[key].type === 'object'
    ) {
      // If both have properties, merge them recursively
      if (target[key].properties && source[key].properties) {
        target[key] = {
          ...target[key],
          ...source[key],
          properties: deepMergeProperties({ ...target[key].properties }, source[key].properties)
        }
      } else {
        // Merge other keys at this level
        target[key] = { ...target[key], ...source[key] }
      }
    } else {
      target[key] = source[key]
    }
  }
  return target
}

// Helper function to merge properties from field groups (deep merge)
function mergeFieldGroupProperties(baseProperties, resolvedFieldGroups) {
  let merged = { ...baseProperties }

  for (const fieldGroup of resolvedFieldGroups) {
    if (fieldGroup.properties) {
      merged = deepMergeProperties(merged, fieldGroup.properties)
    }
    // Also check for definitions that might contain additional properties
    if (fieldGroup.definitions) {
      for (const [defKey, defValue] of Object.entries(fieldGroup.definitions)) {
        if (defValue.properties) {
          merged = deepMergeProperties(merged, defValue.properties)
        }
      }
    }
  }

  return merged
}

// Helper function to flatten nested schema properties for AI consumption
function flattenSchemaProperties(properties, prefix = '') {
  const flattened = {}
  
  for (const [key, value] of Object.entries(properties)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    
    if (value.type === 'object' && value.properties) {
      // Recursively flatten nested objects
      Object.assign(flattened, flattenSchemaProperties(value.properties, fullKey))
    } else if (value.type === 'array' && value.items && value.items.properties) {
      // Handle arrays of objects
      Object.assign(flattened, flattenSchemaProperties(value.items.properties, `${fullKey}[]`))
    } else {
      // Leaf property
      flattened[fullKey] = {
        type: value.type,
        description: value.description || value.title || '',
        format: value.format,
        enum: value.enum,
        required: value.required || false,
        example: value.example
      }
    }
  }
  
  return flattened
}

exports.main = main 