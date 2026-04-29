/*
* <license header>
*/

const axios = require('axios')

// main function that will be executed by Adobe I/O Runtime
async function main (params) {
  try {
    console.log('Calling the getDatasets action')
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
    console.log('Making request to Adobe Platform Catalog API...')
    
    // Use the frontend token with stored API key and org
    const platformHeaders = {
      'Authorization': 'Bearer ' + token,
      'x-api-key': apiKey,
      'x-gw-ims-org-id': imsOrgId,
      'x-sandbox-name': sandboxName,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
    
    // Get datasets from Adobe Experience Platform Catalog API
    // Increase limit to get more datasets and add debugging
    console.log('Requesting datasets from Adobe Platform Catalog API...')
    console.log('Sandbox:', sandboxName)
    
    const response = await axios.get('https://platform.adobe.io/data/foundation/catalog/dataSets?limit=100&orderBy=created&properties=id,name,description,created,updated,schemaRef,tags,state', {
      headers: platformHeaders
    })
    
    console.log('Successfully retrieved datasets:', Object.keys(response.data).length)
    console.log('Sample response keys:', Object.keys(response.data).slice(0, 5))
    
    // Transform the response to a simpler format
    const allDatasets = Object.entries(response.data).map(([id, dataset]) => ({
      id: id,
      name: dataset.name,
      description: dataset.description,
      created: dataset.created,
      updated: dataset.updated,
      schemaRef: dataset.schemaRef,
      tags: dataset.tags || [],
      state: dataset.state
    }))

    console.log('Sample dataset structure:', JSON.stringify(allDatasets[0], null, 2))
    console.log('All dataset states:', allDatasets.map(d => d.state))
    console.log('Dataset IDs returned:', allDatasets.map(d => d.id))

    // Show ALL datasets without any filtering - user requested no restrictions
    const datasets = allDatasets.filter(dataset => 
      dataset.name && dataset.name.trim() !== '' // Only filter out datasets without names
    )

    console.log('Returning all datasets without filtering:', datasets.map(d => `${d.id}: ${d.name}`))
    
    return {
      statusCode: 200,
      body: {
        datasets: datasets,
        count: datasets.length,
        message: `Successfully retrieved ${datasets.length} datasets (ordered by creation date, limit 100)`
      }
    }
    
  } catch (error) {
    console.error('Error in getDatasets action:', error.message)
    if (error.response) {
      console.error(`API failed with status: ${error.response.status}`)
      console.error('API error details:', JSON.stringify(error.response.data))
      return {
        statusCode: error.response.status,
        body: { 
          error: `Adobe Platform Catalog API failed with status: ${error.response.status}`,
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