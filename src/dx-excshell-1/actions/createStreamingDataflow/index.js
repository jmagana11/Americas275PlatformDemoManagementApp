/*
* <license header>
*/

const fetch = require('node-fetch')
const { Core } = require('@adobe/aio-sdk')
const { errorResponse, getBearerToken, stringParameters, checkMissingRequestInputs } = require('../utils')

// main function that will be executed by Adobe I/O Runtime
async function main(params) {
  // create a Logger
  const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' })

  try {
    // 'info' is the default level if not set
    logger.info('Calling the createStreamingDataflow action')

    // log parameters, only if params.LOG_LEVEL === 'debug'
    logger.debug(stringParameters(params))

    // check for missing request input parameters and headers
    const requiredParams = ['connectorId', 'datasetId', 'schemaId', 'sandbox']
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

    logger.info(`Creating streaming dataflow for connector: ${params.connectorId} to dataset: ${params.datasetId}`)

    // Step 1: Create source connection
    const sourceConnectionPayload = {
      name: `Source connection for ${params.connectorId}`,
      description: 'Source connection for streaming dataflow',
      baseConnectionId: params.connectorId,
      connectionSpec: {
        id: 'bc7b00d6-623a-4dfc-9fdb-f1240aeadaeb', // HTTP API connection spec
        version: '1.0'
      }
    }

    const sourceResponse = await fetch('https://platform.adobe.io/data/foundation/flowservice/sourceConnections', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-api-key': API_KEY,
        'x-gw-ims-org-id': imsOrgId,
        'x-sandbox-name': params.sandbox,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(sourceConnectionPayload)
    })

    if (!sourceResponse.ok) {
      const errorText = await sourceResponse.text()
      logger.error('Failed to create source connection:', errorText)
      return errorResponse(sourceResponse.status, `Failed to create source connection: ${errorText}`, logger)
    }

    const sourceData = await sourceResponse.json()
    const sourceConnectionId = sourceData.id
    logger.info('Source connection created:', sourceConnectionId)

    // Step 2: Create target connection
    const targetConnectionPayload = {
      name: `Target connection for dataset ${params.datasetId}`,
      description: 'Target connection for streaming dataflow',
      data: {
        schema: {
          id: params.schemaId,
          version: 'application/vnd.adobe.xed-full+json;version=1.0'
        }
      },
      params: {
        dataSetId: params.datasetId
      },
      connectionSpec: {
        id: 'c604ff05-7f1a-43c0-8e18-33bf874cb11c', // Data Lake connection spec
        version: '1.0'
      }
    }

    const targetResponse = await fetch('https://platform.adobe.io/data/foundation/flowservice/targetConnections', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-api-key': API_KEY,
        'x-gw-ims-org-id': imsOrgId,
        'x-sandbox-name': params.sandbox,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(targetConnectionPayload)
    })

    if (!targetResponse.ok) {
      const errorText = await targetResponse.text()
      logger.error('Failed to create target connection:', errorText)
      return errorResponse(targetResponse.status, `Failed to create target connection: ${errorText}`, logger)
    }

    const targetData = await targetResponse.json()
    const targetConnectionId = targetData.id
    logger.info('Target connection created:', targetConnectionId)

    // Step 3: Create dataflow
    const dataflowPayload = {
      name: `Streaming dataflow for ${params.connectorId}`,
      description: 'Dataflow for streaming profile data to AEP',
      flowSpec: {
        id: 'd8a6f005-7eaf-4153-983e-e8574508b877', // Streaming flow spec for XDM data
        version: '1.0'
      },
      sourceConnectionIds: [sourceConnectionId],
      targetConnectionIds: [targetConnectionId]
    }

    const dataflowResponse = await fetch('https://platform.adobe.io/data/foundation/flowservice/flows', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-api-key': API_KEY,
        'x-gw-ims-org-id': imsOrgId,
        'x-sandbox-name': params.sandbox,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(dataflowPayload)
    })

    if (!dataflowResponse.ok) {
      const errorText = await dataflowResponse.text()
      logger.error('Failed to create dataflow:', errorText)
      return errorResponse(dataflowResponse.status, `Failed to create dataflow: ${errorText}`, logger)
    }

    const dataflowData = await dataflowResponse.json()
    logger.info('Dataflow created successfully:', dataflowData.id)

    const response_obj = {
      statusCode: 200,
      body: {
        success: true,
        message: 'Streaming dataflow created successfully',
        dataflow: {
          id: dataflowData.id,
          sourceConnectionId: sourceConnectionId,
          targetConnectionId: targetConnectionId,
          connectorId: params.connectorId,
          datasetId: params.datasetId,
          schemaId: params.schemaId,
          sandbox: params.sandbox,
          createdAt: new Date().toISOString()
        }
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