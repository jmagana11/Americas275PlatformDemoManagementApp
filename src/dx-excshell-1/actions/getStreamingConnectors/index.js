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
    const requiredParams = ['sandbox']
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

    logger.info(`Retrieving streaming connectors for sandbox: ${params.sandbox}`)
    logger.info(`Using org ID: ${imsOrgId}`)

    // Get streaming connections from Adobe Experience Platform Flow Service API
    // Filter for HTTP API connections (streaming connectors)
    const response = await fetch('https://platform.adobe.io/data/foundation/flowservice/connections?property=connectionSpec.id==bc7b00d6-623a-4dfc-9fdb-f1240aeadaeb', {
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

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('Failed to retrieve connectors:', errorText)
      return errorResponse(response.status, `Failed to retrieve streaming connectors: ${errorText}`, logger)
    }

    const data = await response.json()
    logger.info(`Successfully retrieved ${data.items ? data.items.length : 0} streaming connectors`)

    // Log details of each connector for debugging
    if (data.items) {
      data.items.forEach((connector, index) => {
        logger.info(`Connector ${index + 1}:`, {
          id: connector.id,
          name: connector.name,
          sandboxName: connector.sandboxName,
          sandboxId: connector.sandboxId,
          created: connector.createdAt,
          state: connector.state,
          hasInletUrl: !!(connector.auth?.params?.inletUrl)
        })
      })
    }

    // Transform the response to a simpler format
    const connectors = (data.items || []).map(connector => ({
      id: connector.id,
      name: connector.name,
      description: connector.description,
      connectionSpec: connector.connectionSpec,
      auth: connector.auth,
      created: connector.createdAt,
      updated: connector.updatedAt,
      state: connector.state,
      sandboxName: connector.sandboxName,
      sandboxId: connector.sandboxId,
      // Extract inlet URL for frontend compatibility
      inletUrl: connector.auth?.params?.inletUrl || connector.inletUrl || connector.params?.inletUrl
    }))

    // Filter for active connectors
    const activeConnectors = connectors.filter(connector => 
      connector.state === 'enabled'
    )

    const response_obj = {
      statusCode: 200,
      body: {
        success: true,
        connectors: activeConnectors,
        count: activeConnectors.length,
        message: `Successfully retrieved ${activeConnectors.length} streaming connectors`
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