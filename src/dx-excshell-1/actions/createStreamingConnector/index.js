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
    logger.info('Calling the main action')

    // log parameters, only if params.LOG_LEVEL === 'debug'
    logger.debug(stringParameters(params))

    // check for missing request input parameters and headers
    const requiredParams = ['name', 'description', 'sandbox']
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

    logger.info(`Creating streaming connector: ${params.name} in sandbox: ${params.sandbox}`)

    // Create streaming connection payload
    const connectionPayload = {
      name: params.name,
      description: params.description,
      connectionSpec: {
        id: 'bc7b00d6-623a-4dfc-9fdb-f1240aeadaeb', // HTTP API connection spec
        version: '1.0'
      },
      auth: {
        specName: 'Streaming Connection',
        params: {
          dataType: 'xdm',
          name: params.name,
          authenticationRequired: false
        }
      }
    }

    // Create the streaming connection using Flow Service API
    const response = await fetch('https://platform.adobe.io/data/foundation/flowservice/connections', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-api-key': API_KEY,
        'x-gw-ims-org-id': imsOrgId,
        'x-sandbox-name': params.sandbox,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(connectionPayload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('Failed to create streaming connector:', errorText)
      return errorResponse(response.status, `Failed to create streaming connector: ${errorText}`, logger)
    }

    const data = await response.json()
    logger.info('Streaming connector created successfully:', data.id)

    // Wait a moment for Adobe to provision the inlet URL
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Retrieve the complete connector details including inlet URL using the same technique as getStreamingConnectors
    const connectorResponse = await fetch('https://platform.adobe.io/data/foundation/flowservice/connections?property=connectionSpec.id==bc7b00d6-623a-4dfc-9fdb-f1240aeadaeb', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-api-key': API_KEY,
        'x-gw-ims-org-id': imsOrgId,
        'x-sandbox-name': params.sandbox,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    })

    let fullConnector = null
    if (connectorResponse.ok) {
      const connectorData = await connectorResponse.json()
      // Find the connector we just created
      fullConnector = connectorData.items?.find(item => item.id === data.id)
    }

    // Extract inlet URL using the same logic as getStreamingConnectors
    const inletUrl = fullConnector?.auth?.params?.inletUrl || fullConnector?.inletUrl || fullConnector?.params?.inletUrl

    const response_obj = {
      statusCode: 200,
      body: {
        success: true,
        message: 'Streaming connector created successfully',
        connector: {
          id: data.id,
          name: params.name,
          description: params.description,
          sandbox: params.sandbox,
          createdAt: new Date().toISOString(),
          connectionSpec: connectionPayload.connectionSpec,
          auth: fullConnector?.auth || connectionPayload.auth,
          state: fullConnector?.state || 'enabled',
          // Include inlet URL for frontend compatibility
          inletUrl: inletUrl
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