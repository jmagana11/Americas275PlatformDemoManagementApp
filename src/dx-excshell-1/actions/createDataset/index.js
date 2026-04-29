/*
* <license header>
*/

const axios = require('axios')

// main function that will be executed by Adobe I/O Runtime
async function main (params) {
  try {
    console.log('Calling the createDataset action')
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
    
    // Get required parameters
    const sandboxName = params.__ow_headers?.sandboxname || 'prod'
    const schemaId = params.__ow_headers?.schemaid || params.schemaId
    const datasetName = params.__ow_headers?.datasetname || params.datasetName || 'Golden Profile Dataset v0'
    
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
    
    console.log('Creating dataset with parameters:')
    console.log('- Sandbox:', sandboxName)
    console.log('- Schema ID:', schemaId)
    console.log('- Dataset Name:', datasetName)
    
    // Use the frontend token with stored API key and org
    const platformHeaders = {
      'Authorization': 'Bearer ' + token,
      'x-api-key': apiKey,
      'x-gw-ims-org-id': imsOrgId,
      'x-sandbox-name': sandboxName,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
    
    // Create dataset payload
    const datasetPayload = {
      name: datasetName,
      description: 'Dataset for Golden Profile testing - automatically created by AEP Profile Injector',
      schemaRef: {
        id: schemaId,
        contentType: 'application/vnd.adobe.xed+json;version=1'
      },
      tags: {
        'unifiedProfile': ['enabled:true'],
        'unifiedIdentity': ['enabled:true'],
        'acp_validationContext': ['enabled'],
        'acp_granular_validation_flags': ['requiredFieldCheck:enabled'],
        'goldenProfile': ['true'],
        'autoCreated': ['true']
      }
    }
    
    console.log('Creating dataset with payload:', JSON.stringify(datasetPayload, null, 2))
    
    // Create dataset using Adobe Experience Platform Catalog API
    const response = await axios.post('https://platform.adobe.io/data/foundation/catalog/dataSets', datasetPayload, {
      headers: platformHeaders
    })
    
    console.log('Dataset creation response status:', response.status)
    console.log('Dataset creation response:', JSON.stringify(response.data, null, 2))
    
    // Extract dataset ID from response
    const datasetIds = Object.keys(response.data)
    console.log('Dataset IDs from response:', datasetIds)
    console.log('Number of dataset IDs:', datasetIds.length)
    
    let datasetId = null
    
    if (datasetIds.length > 0 && datasetIds[0] !== '0') {
      datasetId = datasetIds[0]
      console.log('Got dataset ID from creation response:', datasetId)
    } else {
      console.log('Dataset ID not found in creation response, fetching by name...')
      
        // Fetch datasets and find the one we just created by name
  const listResponse = await axios.get('https://platform.adobe.io/data/foundation/catalog/dataSets', {
    headers: platformHeaders,
    params: {
      property: `name==${datasetName}`,
      orderBy: 'desc:created',  // CRITICAL FIX: Order by created date DESCENDING to get newest first
      limit: 10
    }
  })
  
  console.log('Dataset list response:', JSON.stringify(listResponse.data, null, 2))
  
  const foundDatasets = Object.keys(listResponse.data)
  if (foundDatasets.length > 0) {
    // Get the most recently created one (should be ours) - now guaranteed to be first due to desc order
    datasetId = foundDatasets[0]
    console.log('Found dataset ID by name lookup (newest first):', datasetId)
    
    // Additional validation: ensure we got a recently created dataset (within last 5 minutes)
    const datasetInfo = listResponse.data[datasetId]
    if (datasetInfo && datasetInfo.created) {
      const createdTime = new Date(datasetInfo.created)
      const now = new Date()
      const timeDiff = now - createdTime
      const fiveMinutes = 5 * 60 * 1000
      
      console.log('Dataset creation validation:', {
        datasetId,
        createdTime: createdTime.toISOString(),
        timeDiffMinutes: Math.round(timeDiff / (60 * 1000)),
        isRecent: timeDiff < fiveMinutes
      })
      
      if (timeDiff > fiveMinutes) {
        console.warn('⚠️ Found dataset is older than 5 minutes - might not be the one we just created')
      }
    }
  } else {
    throw new Error(`Could not find created dataset with name: ${datasetName}`)
  }
    }
    
    console.log('Final dataset ID:', datasetId)
    console.log('Type of dataset ID:', typeof datasetId)
    
    // Return the created dataset information
    const createdDataset = {
      id: datasetId,
      name: datasetName,
      description: datasetPayload.description,
      schemaRef: datasetPayload.schemaRef,
      tags: datasetPayload.tags,
      state: 'DRAFT',
      profileEnabled: true,
      identityEnabled: true,
      created: new Date().toISOString()
    }
    
    return {
      statusCode: 200,
      body: {
        dataset: createdDataset,
        message: `Successfully created dataset: ${datasetName}`,
        datasetId: datasetId
      }
    }
    
  } catch (error) {
    console.error('Error in createDataset action:', error.message)
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