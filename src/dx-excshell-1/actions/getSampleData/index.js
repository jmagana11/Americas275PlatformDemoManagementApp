const axios = require('axios')

// main function that will be executed by Adobe I/O Runtime
async function main(params) {
  try {
    console.log('Calling the getSampleData action')
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

    const platformHeaders = {
      'Authorization': 'Bearer ' + token,
      'x-api-key': apiKey,
      'x-gw-ims-org-id': imsOrgId,
      'x-sandbox-name': sandboxName,
      'Content-Type': 'application/json'
    }

    // Encode the schema ID for URL
    const encodedSchemaId = encodeURIComponent(schemaId)

    // Fetch sample data from Schema Registry API
    const response = await axios.get(`https://platform.adobe.io/data/foundation/schemaregistry/rpc/sampledata/${encodedSchemaId}`, {
      headers: platformHeaders
    })

    return {
      statusCode: 200,
      body: {
        sampleData: response.data,
        message: 'Successfully retrieved sample data for schema.'
      }
    }
  } catch (error) {
    console.error('Error in getSampleData action:', error.message)
    if (error.response) {
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