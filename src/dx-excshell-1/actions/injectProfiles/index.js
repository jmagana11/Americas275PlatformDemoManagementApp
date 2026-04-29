/*
* <license header>
*/

const axios = require('axios')

// main function that will be executed by Adobe I/O Runtime
async function main (params) {
  try {
    console.log('Calling the injectProfiles action')
    console.log('Available params:', Object.keys(params))
    
    // Get required parameters
    const profiles = params.profiles || []
    const connectorId = params.connectorId  // Changed from inletUrl to connectorId
    const datasetId = params.datasetId
    const schemaId = params.schemaId
    const batchSize = params.batchSize || 5
    const sandboxName = params.sandboxName || 'prod'
    
    if (!profiles || profiles.length === 0) {
      return {
        statusCode: 400,
        body: { error: 'Missing or empty profiles array' }
      }
    }
    
    if (!connectorId) {
      return {
        statusCode: 400,
        body: { error: 'Missing required parameter: connectorId' }
      }
    }
    
    if (!datasetId) {
      return {
        statusCode: 400,
        body: { error: 'Missing required parameter: datasetId' }
      }
    }
    
    if (!schemaId) {
      return {
        statusCode: 400,
        body: { error: 'Missing required parameter: schemaId' }
      }
    }
    
    // Get authentication details
    const authHeader = params.__ow_headers && params.__ow_headers.authorization
    const token = authHeader ? authHeader.substring('Bearer '.length) : null
    const imsOrgId = (params.__ow_headers && params.__ow_headers['x-gw-ims-org-id']) || params.orgId || process.env.AEP_ORG_ID
    const apiKey = params.apiKey || process.env.AEP_API_KEY
    
    console.log(`Retrieving connector details for ID: ${connectorId}`)
    
    // Use the EXACT same technique as getStreamingConnectors - fetch all connectors and find the specific one
    // This ensures we get the same data structure that works in the dropdown
    const connectorResponse = await axios.get('https://platform.adobe.io/data/foundation/flowservice/connections?property=connectionSpec.id==bc7b00d6-623a-4dfc-9fdb-f1240aeadaeb', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-api-key': apiKey,
        'x-gw-ims-org-id': imsOrgId,
        'x-sandbox-name': sandboxName,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    })
    
    if (!connectorResponse.data || !connectorResponse.data.items) {
      return {
        statusCode: 404,
        body: { error: 'Failed to retrieve streaming connectors' }
      }
    }
    
    // Find the specific connector by ID from the list (same as getStreamingConnectors does)
    const connector = connectorResponse.data.items.find(item => item.id === connectorId)
    
    if (!connector) {
      return {
        statusCode: 404,
        body: { error: `Connector not found: ${connectorId}` }
      }
    }
    
    console.log('Retrieved connector details:', JSON.stringify(connector, null, 2))
    
    // Extract inlet ID and URL using the EXACT same logic as getStreamingConnectors
    const inletId = connector.id // Use the connector's ID as the inlet ID
    const inletUrl = connector.auth?.params?.inletUrl || connector.inletUrl || connector.params?.inletUrl
    
    if (!inletUrl) {
      return {
        statusCode: 400,
        body: { 
          error: 'Inlet URL not available for this connector. The connector may still be provisioning.',
          connectorId: connectorId,
          connectorState: connector.state
        }
      }
    }
    
    console.log(`Injecting ${profiles.length} profiles to Adobe Experience Platform`)
    console.log('Connector ID:', connectorId)
    console.log('Inlet ID:', inletId)
    console.log('Inlet URL:', inletUrl)
    console.log('Dataset ID:', datasetId)
    console.log('Schema ID:', schemaId)
    console.log('Batch size:', batchSize)
    
    // Prepare headers for Adobe streaming ingestion
    const streamingHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-gw-ims-org-id': imsOrgId,
      'x-api-key': apiKey,
      'x-sandbox-name': sandboxName
    }
    
    // Add authorization if available
    if (token) {
      streamingHeaders['Authorization'] = `Bearer ${token}`
    }
    
    const injectionResults = []
    let successCount = 0
    let errorCount = 0
    
    // Process profiles one by one (Adobe streaming ingestion expects single profile per request)
    for (let i = 0; i < profiles.length; i++) {
      const profile = profiles[i]
      console.log(`Processing profile ${i + 1} of ${profiles.length}`)
      
      try {
        // Create the proper Adobe streaming ingestion payload structure
        const streamingPayload = {
          header: {
            schemaRef: {
              id: schemaId,
              contentType: 'application/vnd.adobe.xed-full+json;version=1.0'
            },
            imsOrgId: imsOrgId,
            datasetId: datasetId
          },
          body: {
            xdmMeta: {
              schemaRef: {
                id: schemaId,
                contentType: 'application/vnd.adobe.xed-full+json;version=1.0'
              }
            },
            xdmEntity: {
              ...profile,
              // Ensure timestamp is present
              timestamp: profile.timestamp || new Date().toISOString(),
              // Ensure event type is set
              eventType: profile.eventType || 'profile.create'
            }
          }
        }
        
        if (i === 0) {
          console.log('Sample streaming payload structure:', JSON.stringify(streamingPayload, null, 2))
        }
        
        // Send to Adobe streaming endpoint
        const response = await axios.post(inletUrl, streamingPayload, {
          headers: {
            ...streamingHeaders,
            'x-inlet-id': inletId // Add the inlet ID to the headers
          },
          timeout: 30000 // 30 second timeout
        })
        
        console.log(`Profile ${i + 1} injection response status: ${response.status}`)
        if (i === 0) {
          console.log('Sample response data:', JSON.stringify(response.data, null, 2))
        }
        
        // Record successful injection
        injectionResults.push({
          profileId: profile.id || `profile-${i}`,
          success: true,
          status: response.status,
          message: 'Successfully streamed to Adobe Experience Platform',
          xactionId: response.data?.xactionId,
          receivedTimeMs: response.data?.receivedTimeMs,
          timestamp: new Date().toISOString()
        })
        successCount++
        
        // Add small delay between profiles to avoid overwhelming the endpoint
        if (i < profiles.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200))
        }
        
      } catch (error) {
        console.error(`Error injecting profile ${i + 1}:`, error.message)
        
        // Record failed injection
        injectionResults.push({
          profileId: profile.id || `profile-${i}`,
          success: false,
          error: error.message,
          status: error.response?.status || 500,
          details: error.response?.data || null,
          timestamp: new Date().toISOString()
        })
        errorCount++
        
        // Continue with next profile even if this one fails
        continue
      }
    }
    
    const summary = {
      totalProfiles: profiles.length,
      successCount: successCount,
      errorCount: errorCount,
      successRate: ((successCount / profiles.length) * 100).toFixed(2) + '%',
      processingTime: new Date().toISOString()
    }
    
    console.log('Injection Summary:', summary)
    
    return {
      statusCode: 200,
      body: {
        summary: summary,
        results: injectionResults,
        message: `Profile injection completed: ${successCount} successful, ${errorCount} failed`
      }
    }
    
  } catch (error) {
    console.error('Error in injectProfiles action:', error.message)
    
    if (error.response) {
      console.error(`API failed with status: ${error.response.status}`)
      console.error('API error details:', JSON.stringify(error.response.data))
      return {
        statusCode: error.response.status,
        body: { 
          error: `Adobe streaming ingestion failed with status: ${error.response.status}`,
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