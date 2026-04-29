const fetch = require('node-fetch')
const { Core } = require('@adobe/aio-sdk')
const { errorResponse, stringParameters, checkMissingRequestInputs } = require('../utils')

// main function that will be executed by Adobe I/O Runtime
async function main(params) {
  // create a Logger
  const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' })

  try {
    // 'info' is the default level if not set
    logger.info('Calling the Get Org Sandboxes action')

    // log parameters, only if params.LOG_LEVEL === 'debug'
    logger.debug(stringParameters(params))

    // check for missing request input parameters and headers
    const requiredParams = ['org']
    const requiredHeaders = []
    const errorMessage = checkMissingRequestInputs(params, requiredParams, requiredHeaders)
    if (errorMessage) {
      // return and log client errors
      return errorResponse(400, errorMessage, logger)
    }

    const selectedOrg = params.org
    const orgConfig = getOrgConfigs(params)[selectedOrg]
    
    if (!orgConfig) {
      return errorResponse(400, `Invalid organization: ${selectedOrg}`, logger)
    }

    const missingConfig = getMissingOrgConfigValues(orgConfig)
    if (missingConfig.length) {
      return errorResponse(500, `Missing configuration for ${selectedOrg}: ${missingConfig.join(', ')}`, logger)
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

function getOrgConfigs(params) {
  return {
    MA1HOL: {
      CLIENT_SECRET: params.MA1HOL_CLIENT_SECRET,
      API_KEY: params.MA1HOL_API_KEY,
      IMS_ORG: params.MA1HOL_IMS_ORG,
      TENANT: params.MA1HOL_TENANT,
      META_SCOPE: 'additional_info.job_function,openid,session,user_management_sdk,cjm.suppression_service.client.delete,AdobeID,target_sdk,read_organizations,additional_info.roles,cjm.suppression_service.client.all,additional_info.projectedProductContext',
      IMS: 'ims-na1.adobelogin.com'
    },
    POT5HOL: {
      CLIENT_SECRET: params.POT5HOL_CLIENT_SECRET,
      API_KEY: params.POT5HOL_API_KEY,
      IMS_ORG: params.POT5HOL_IMS_ORG,
      TENANT: params.POT5HOL_TENANT,
      META_SCOPE: 'cjm.suppression_service.client.delete, cjm.suppression_service.client.all, openid, session, AdobeID, read_organizations, additional_info.projectedProductContext, read_pc.acp, read_pc, read_pc.dma_tartan, additional_info, target_sdk, additional_info.roles, additional_info.job_function, user_management_sdk',
      IMS: 'ims-na1.adobelogin.com'
    }
  }
}

function getMissingOrgConfigValues(orgConfig) {
  return ['CLIENT_SECRET', 'API_KEY', 'IMS_ORG', 'TENANT'].filter(key => !orgConfig[key])
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
