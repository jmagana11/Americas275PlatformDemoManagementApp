/*
* <license header>
*/

const axios = require('axios')

// main function that will be executed by Adobe I/O Runtime
async function main (params) {
  try {
    console.log('Calling the getSchemas action')
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
    
    // Get sandbox name from headers
    const sandboxName = params.__ow_headers?.sandboxname || 'prod'
    
    // Get IMS org from headers (sent by frontend) or use known workspace value
    const imsOrgId = (params.__ow_headers && params.__ow_headers['x-gw-ims-org-id']) || params.orgId || process.env.AEP_ORG_ID
    
    // Use stored API key or known workspace value
    const apiKey = params.apiKey || process.env.AEP_API_KEY
    
    console.log('Using frontend user token with API key and org')
    console.log('Sandbox:', sandboxName)
    console.log('Making request to Adobe Platform Schema Registry API...')
    
    // Use the frontend token with stored API key and org
    const platformHeaders = {
      'Authorization': 'Bearer ' + token,
      'x-api-key': apiKey,
      'x-gw-ims-org-id': imsOrgId,
      'x-sandbox-name': sandboxName,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.adobe.xed-id+json'
    }
    
    // Get schemas from Adobe Experience Platform Schema Registry
    const response = await axios.get('https://platform.adobe.io/data/foundation/schemaregistry/tenant/schemas', {
      headers: platformHeaders
    })
    
    console.log('Successfully retrieved schemas:', response.data.results ? response.data.results.length : 'unknown count')
    
    // Transform the response to a simpler format
    const schemas = (response.data.results || []).map(schema => ({
      id: schema['$id'],
      title: schema.title,
      description: schema.description,
      type: schema.type,
      version: schema.version,
      created: schema['meta:created'],
      updated: schema['meta:updated'],
      class: schema['meta:class']
    }))

    return {
      statusCode: 200,
      body: {
        schemas: schemas,
        count: schemas.length,
        message: `Successfully retrieved ${schemas.length} schemas`
      }
    }
    
  } catch (error) {
    console.error('Error in getSchemas action:', error.message)
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



exports.main = main 