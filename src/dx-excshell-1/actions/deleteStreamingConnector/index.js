const fetch = require('node-fetch')
const { Core } = require('@adobe/aio-sdk')
const { errorResponse, getBearerToken, stringParameters, checkMissingRequestInputs } = require('../utils')

async function main(params) {
  const logger = Core.Logger('deleteStreamingConnector', { level: params.LOG_LEVEL || 'info' })

  try {
    logger.info('Starting streaming connector deletion')
    
    // check for missing request input parameters and headers
    const requiredParams = ['connectorId', 'sandbox']
    const requiredHeaders = ['Authorization']
    const errorMessage = checkMissingRequestInputs(params, requiredParams, requiredHeaders)
    if (errorMessage) {
      // return and log client errors
      return errorResponse(400, errorMessage, logger)
    }

    // Safety check: prevent production operations
    if (params.sandbox === 'prod' || params.sandbox === 'production') {
      return errorResponse(400, 'Production sandbox operations are not allowed for safety reasons', logger)
    }

    // extract the user Bearer token from the Authorization header
    const token = getBearerToken(params)

    // Use the same pattern as working actions - get org from headers or fallback
    const imsOrgId = (params.__ow_headers && params.__ow_headers['x-gw-ims-org-id']) || params.orgId || process.env.AEP_ORG_ID
    
    // Hardcoded values from your workspace
    const API_KEY = params.apiKey || process.env.AEP_API_KEY

    logger.info(`Deleting streaming connector: ${params.connectorId} in sandbox: ${params.sandbox}`)

    // Step 1: Find source connections that use this base connection
    logger.info('Step 1: Finding source connections for base connector:', params.connectorId)
    
    const sourceConnectionsResponse = await fetch('https://platform.adobe.io/data/foundation/flowservice/sourceConnections', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-api-key': API_KEY,
        'x-gw-ims-org-id': imsOrgId,
        'x-sandbox-name': params.sandbox
      }
    })
    
    let sourceConnectionIds = []
    if (sourceConnectionsResponse.ok) {
      const sourceConnectionsData = await sourceConnectionsResponse.json()
      const associatedSourceConnections = (sourceConnectionsData.items || []).filter(conn => 
        conn.baseConnectionId === params.connectorId
      )
      sourceConnectionIds = associatedSourceConnections.map(conn => conn.id)
      logger.info(`Found ${associatedSourceConnections.length} source connections:`, sourceConnectionIds)
    }
    
    // Step 2: Find target connections that use this base connection
    logger.info('Step 2: Finding target connections for base connector:', params.connectorId)
    
    const targetConnectionsResponse = await fetch('https://platform.adobe.io/data/foundation/flowservice/targetConnections', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-api-key': API_KEY,
        'x-gw-ims-org-id': imsOrgId,
        'x-sandbox-name': params.sandbox
      }
    })
    
    let targetConnectionIds = []
    if (targetConnectionsResponse.ok) {
      const targetConnectionsData = await targetConnectionsResponse.json()
      const associatedTargetConnections = (targetConnectionsData.items || []).filter(conn => 
        conn.baseConnectionId === params.connectorId
      )
      targetConnectionIds = associatedTargetConnections.map(conn => conn.id)
      logger.info(`Found ${associatedTargetConnections.length} target connections:`, targetConnectionIds)
    }
    
    // Step 3: Find dataflows that use these source/target connections
    logger.info('Step 3: Finding dataflows that use these connections...')
    
    const dataflowsResponse = await fetch('https://platform.adobe.io/data/foundation/flowservice/flows', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-api-key': API_KEY,
        'x-gw-ims-org-id': imsOrgId,
        'x-sandbox-name': params.sandbox
      }
    })

    let associatedFlows = []
    if (dataflowsResponse.ok) {
      const dataflowsData = await dataflowsResponse.json()
      logger.info('Total flows in sandbox:', dataflowsData.items?.length || 0)
      
      // Find flows that use our source or target connections
      associatedFlows = (dataflowsData.items || []).filter(flow => {
        const hasSourceConnection = flow.sourceConnectionIds?.some(id => sourceConnectionIds.includes(id))
        const hasTargetConnection = flow.targetConnectionIds?.some(id => targetConnectionIds.includes(id))
        
        logger.info(`Flow ${flow.id}:`, {
          name: flow.name,
          sourceConnectionIds: flow.sourceConnectionIds,
          targetConnectionIds: flow.targetConnectionIds,
          matchesSource: hasSourceConnection,
          matchesTarget: hasTargetConnection,
          matches: hasSourceConnection || hasTargetConnection
        })
        
        return hasSourceConnection || hasTargetConnection
      })
      
      logger.info(`Found ${associatedFlows.length} associated dataflows:`, associatedFlows.map(f => ({ id: f.id, name: f.name })))
    }
    
    // Step 4: Delete dataflows first
    for (const flow of associatedFlows) {
      logger.info('Deleting dataflow:', flow.id, flow.name)
      
      const deleteFlowResponse = await fetch(`https://platform.adobe.io/data/foundation/flowservice/flows/${flow.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-api-key': API_KEY,
          'x-gw-ims-org-id': imsOrgId,
          'x-sandbox-name': params.sandbox,
          'Content-Type': 'application/json'
        }
      })
      
      if (!deleteFlowResponse.ok) {
        const errorText = await deleteFlowResponse.text()
        logger.error(`Failed to delete dataflow ${flow.id}:`, errorText)
        return errorResponse(deleteFlowResponse.status, `Failed to delete dataflow ${flow.id}: ${errorText}`, logger)
      } else {
        logger.info(`Successfully deleted dataflow ${flow.id}`)
      }
    }
    
    // Step 5: Delete source connections
    for (const sourceConnId of sourceConnectionIds) {
      logger.info('Deleting source connection:', sourceConnId)
      
      const deleteSourceResponse = await fetch(`https://platform.adobe.io/data/foundation/flowservice/sourceConnections/${sourceConnId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-api-key': API_KEY,
          'x-gw-ims-org-id': imsOrgId,
          'x-sandbox-name': params.sandbox,
          'Content-Type': 'application/json'
        }
      })
      
      if (!deleteSourceResponse.ok) {
        const errorText = await deleteSourceResponse.text()
        logger.error(`Failed to delete source connection ${sourceConnId}:`, errorText)
        // Don't throw error, continue with other deletions
      } else {
        logger.info(`Successfully deleted source connection ${sourceConnId}`)
      }
    }
    
    // Step 6: Delete target connections
    for (const targetConnId of targetConnectionIds) {
      logger.info('Deleting target connection:', targetConnId)
      
      const deleteTargetResponse = await fetch(`https://platform.adobe.io/data/foundation/flowservice/targetConnections/${targetConnId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-api-key': API_KEY,
          'x-gw-ims-org-id': imsOrgId,
          'x-sandbox-name': params.sandbox,
          'Content-Type': 'application/json'
        }
      })
      
      if (!deleteTargetResponse.ok) {
        const errorText = await deleteTargetResponse.text()
        logger.error(`Failed to delete target connection ${targetConnId}:`, errorText)
        // Don't throw error, continue with other deletions
      } else {
        logger.info(`Successfully deleted target connection ${targetConnId}`)
      }
    }
    
    // Wait for Adobe to process all deletions
    const totalDeletions = associatedFlows.length + sourceConnectionIds.length + targetConnectionIds.length
    if (totalDeletions > 0) {
      logger.info(`Waiting for Adobe to process ${totalDeletions} deletions...`)
      await new Promise(resolve => setTimeout(resolve, 5000))
    }

    // Step 7: Finally delete the base connection (streaming connector)
    logger.info('Step 7: Deleting base connection (streaming connector)')
    const response = await fetch(`https://platform.adobe.io/data/foundation/flowservice/connections/${params.connectorId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-api-key': API_KEY,
        'x-gw-ims-org-id': imsOrgId,
        'x-sandbox-name': params.sandbox,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('Failed to delete base connection:', errorText)
      return errorResponse(response.status, `Failed to delete streaming connector: ${errorText}`, logger)
    }

    logger.info('Streaming connector and all associated components deleted successfully')

    const response_obj = {
      statusCode: 200,
      body: {
        success: true,
        message: 'Streaming connector and all associated components deleted successfully',
        connectorId: params.connectorId,
        sandbox: params.sandbox,
        deletedComponents: {
          dataflows: associatedFlows.length,
          sourceConnections: sourceConnectionIds.length,
          targetConnections: targetConnectionIds.length
        },
        deletedAt: new Date().toISOString()
      }
    }

    // log the response status code
    logger.info(`${response_obj.statusCode}: successful request`)
    return response_obj

  } catch (error) {
    // log any server errors
    logger.error('Server error:', error)
    // return with 500
    return errorResponse(500, 'Internal server error', logger)
  }
}

exports.main = main 