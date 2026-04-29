const fetch = require('node-fetch')
const { Core } = require('@adobe/aio-sdk')
const { errorResponse, mergeJsonBodyParams, stringParameters, checkMissingRequestInputs } = require('../utils')
const { ConfigError, getOrgConfig, listOrgMetadata } = require('../shared/config')

// main function that will be executed by Adobe I/O Runtime
async function main(params) {
  const requestParams = mergeJsonBodyParams(params)
  // create a Logger
  const logger = Core.Logger('main', { level: requestParams.LOG_LEVEL || 'info' })

  try {
    // 'info' is the default level if not set
    logger.info('Calling the Get Org Sandboxes action')

    // log parameters, only if params.LOG_LEVEL === 'debug'
    logger.debug(stringParameters(requestParams))

    if (requestParams.action === 'list-orgs') {
      return {
        statusCode: 200,
        body: {
          success: true,
          organizations: listOrgMetadata(requestParams)
        }
      }
    }

    // check for missing request input parameters and headers
    const requiredParams = ['org']
    const requiredHeaders = []
    const errorMessage = checkMissingRequestInputs(requestParams, requiredParams, requiredHeaders)
    if (errorMessage) {
      // return and log client errors
      return errorResponse(400, errorMessage, logger)
    }

    const selectedOrg = String(requestParams.org || '').toUpperCase()
    const knownOrg = listOrgMetadata(requestParams).some((org) => org.orgKey === selectedOrg)
    
    if (!knownOrg) {
      return errorResponse(400, `Invalid organization: ${selectedOrg}`, logger)
    }

    let orgConfig
    try {
      orgConfig = getOrgConfig(requestParams, selectedOrg, 'sandboxes')
    } catch (error) {
      if (error instanceof ConfigError) {
        return errorResponse(500, error.message, logger)
      }
      throw error
    }

    // Get organization-specific access token using client credentials
    const accessToken = await getAccessToken(orgConfig, logger)

    const ims_headers = {
      'Authorization': 'Bearer ' + accessToken,
      'x-api-key': orgConfig.API_KEY,
      'x-gw-ims-org-id': orgConfig.IMS_ORG,
      'Accept': 'application/json'
    }

    // Use the sandbox management API endpoint
    const apiEndpoint = 'https://platform.adobe.io/data/foundation/sandbox-management/sandboxes'

    // fetch content from external api endpoint
    const res = await fetch(apiEndpoint, {
      method: "GET",
      headers: ims_headers
    })
    if (!res.ok) {
      throw new Error('request to ' + apiEndpoint + ' failed with status code ' + res.status)
    }
    const content = await res.json()
    const response = {
      statusCode: 200,
      body: content
    }

    // log the response status code
    logger.info(`${response.statusCode}: successful request`)
    return response
  } catch (error) {
    // log any server errors
    logger.error(error)
    // return with 500
    return errorResponse(500, 'server error', logger)
  }
}

async function getAccessToken(orgConfig, logger) {
  try {
    // Use client credentials flow to get access token
    const tokenResponse = await fetch(`https://${orgConfig.IMS}/ims/token/v3`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: orgConfig.API_KEY,
        client_secret: orgConfig.CLIENT_SECRET,
        scope: orgConfig.META_SCOPE
      })
    })

    if (!tokenResponse.ok) {
      throw new Error(`Failed to get access token: ${tokenResponse.status}`)
    }

    const tokenData = await tokenResponse.json()
    return tokenData.access_token
  } catch (error) {
    logger.error('Error getting access token:', error)
    throw error
  }
}

exports.main = main 
