/*
* <license header>
*/

const axios = require('axios')

// main function that will be executed by Adobe I/O Runtime
async function main (params) {
  try {
    console.log('Calling the getProfileCount action')
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
    
    // Get sandbox name from headers (like other AEP actions)
    const sandboxName = params.__ow_headers?.sandboxname || 'prod'
    
    // Get IMS org from headers (sent by frontend) or use known workspace value
    const imsOrgId = (params.__ow_headers && params.__ow_headers['x-gw-ims-org-id']) || params.orgId || process.env.AEP_ORG_ID
    
    // Use stored API key or known workspace value
    const apiKey = params.apiKey || process.env.AEP_API_KEY
    
    console.log('Using frontend user token with API key and org')
    console.log('Sandbox:', sandboxName)
    console.log('Making request to Adobe Platform Real-time Customer Profile API...')
    
    // Use the frontend token with stored API key and org
    const platformHeaders = {
      'Authorization': 'Bearer ' + token,
      'x-api-key': apiKey,
      'x-gw-ims-org-id': imsOrgId,
      'x-sandbox-name': sandboxName,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
    
        // Simplified approach: For now, return a placeholder since the exact profile count API
    // requires specific preview IDs that we don't have access to in this context
    console.log('Profile count API requires preview ID - using simplified approach')
    
    // Return 0 for now with a clear message
    const profileCount = 0
    
    return {
      statusCode: 200,
      body: {
        profileCount: profileCount,
        sandbox: sandboxName,
        message: `Profile count feature temporarily unavailable - API requires additional configuration`,
        lastUpdated: new Date().toISOString(),
        note: 'Adobe Platform Profile Count API requires preview ID parameter'
      }
    }
    
  } catch (error) {
    console.error('Error in getProfileCount action:', error.message)
    if (error.response) {
      console.error(`API failed with status: ${error.response.status}`)
      console.error('API error details:', JSON.stringify(error.response.data))
      return {
        statusCode: error.response.status,
        body: { 
          error: `Adobe Platform Real-time Customer Profile API failed with status: ${error.response.status}`,
          details: error.response.data,
          profileCount: 0 // Return 0 as fallback
        }
      }
    }
    
    return {
      statusCode: 500,
      body: { 
        error: 'Internal server error', 
        details: error.message,
        profileCount: 0 // Return 0 as fallback
      }
    }
  }
}

exports.main = main 