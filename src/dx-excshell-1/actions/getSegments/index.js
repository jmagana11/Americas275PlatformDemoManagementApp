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
const { errorResponse, stringParameters, checkMissingRequestInputs } = require('../utils')

// main function that will be executed by Adobe I/O Runtime
async function main (params) {
  // create a Logger
  const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' })

  try {
    // 'info' is the default level if not set
    logger.info('Calling the get Segments action')

    // log parameters, only if params.LOG_LEVEL === 'debug'
    logger.debug(stringParameters(params))

    // Get sandbox name from headers
    const headers = params.__ow_headers || {}
    const sandboxName = headers.sandboxname
    const selectedOrg = headers['x-gw-ims-org-id']

    if (!sandboxName || !selectedOrg) {
      return errorResponse(400, 'Missing required headers: sandboxname or x-gw-ims-org-id', logger)
    }

    // Use the user's token directly
    const userToken = headers.authorization?.replace('Bearer ', '') || 
                     headers.Authorization?.replace('Bearer ', '')
    
    if (!userToken) {
      return errorResponse(400, 'No authorization token provided', logger)
    }

    const ims_headers = {
      'Authorization': `Bearer ${userToken}`,
      'x-api-key': params.apiKey,
      'x-gw-ims-org-id': params.orgId,
      'x-sandbox-name': sandboxName,
      'Content-Type': 'application/json'
    }

    // replace this with the api you want to access
    const apiEndpoint = 'https://platform.adobe.io/data/core/ups/segment/definitions'

    // fetch content from external api endpoint
    const res = await fetch(apiEndpoint,{
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

exports.main = main
