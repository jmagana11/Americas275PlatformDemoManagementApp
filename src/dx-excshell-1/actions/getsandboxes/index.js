/*
* <license header>
*/

/**
 * This is a sample action showcasing how to access an external API
 *
 * Note:
 * You might want to disable authentication and authorization checks against Adobe Identity Management System for a generic action. In that case:
 *   - Remove the require-adobe-auth annotation for this action in the manifest.yml of your application
 *   - Remove the Authorization header from the array passed in checkMissingRequestInputs
 *   - The two steps above imply that every client knowing the URL to this deployed action will be able to invoke it without any authentication and authorization checks against Adobe Identity Management System
 *   - Make sure to validate these changes against your security requirements before deploying the action
 */


const fetch = require('node-fetch')
const { Core } = require('@adobe/aio-sdk')
const { errorResponse, getBearerToken, stringParameters, checkMissingRequestInputs } = require('../utils')
const { ConfigError, getOrgConfigByImsOrg } = require('../shared/config')

// main function that will be executed by Adobe I/O Runtime
async function main(params) {
  // create a Logger
  const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' })

  try {
    // 'info' is the default level if not set
    logger.info('Calling the Get SandBoxes action')

    // log parameters, only if params.LOG_LEVEL === 'debug'
    logger.debug(stringParameters(params))

    // check for missing request input parameters and headers
    const requiredParams = []
    const requiredHeaders = ['Authorization', 'x-gw-ims-org-id']
    const errorMessage = checkMissingRequestInputs(params, requiredParams, requiredHeaders)
    if (errorMessage) {
      // return and log client errors
      return errorResponse(400, errorMessage, logger)
    }

    // Get the bearer token from the Authorization header
    const bearerToken = getBearerToken(params)
    if (!bearerToken) {
      return errorResponse(400, 'Missing or invalid Authorization header', logger)
    }

    // Get the IMS organization ID from headers
    const imsOrgId = params.__ow_headers['x-gw-ims-org-id']
    if (!imsOrgId) {
      return errorResponse(400, 'Missing x-gw-ims-org-id header', logger)
    }

    let environment
    try {
      environment = getOrgConfigByImsOrg(params, imsOrgId, 'aep')
    } catch (error) {
      if (error instanceof ConfigError) {
        return errorResponse(error.missingKeys.includes('x-gw-ims-org-id') ? 400 : 500, error.message, logger)
      }
      throw error
    }

    // Use the bearer token from the frontend for authentication
    const ims_headers = {
      'Authorization': 'Bearer ' + bearerToken,
      'x-api-key': environment.apiKey,
      'x-gw-ims-org-id': environment.imsOrg
    }

    // Use the AEP API to get sandboxes
    const apiEndpoint = 'https://platform.adobe.io/data/foundation/sandbox-management/sandboxes'

    // fetch content from external api endpoint
    const res = await fetch(apiEndpoint, {
      method: "GET",
      headers: {
        ...ims_headers,
        'Accept': 'application/json'
      }
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

exports.main = main
