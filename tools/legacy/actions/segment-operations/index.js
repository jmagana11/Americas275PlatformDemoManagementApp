const fetch = require('node-fetch')
const { Core } = require('@adobe/aio-sdk')
const { errorResponse, stringParameters, checkMissingRequestInputs } = require('../utils')

// main function that will be executed by Adobe I/O Runtime
async function main (params) {
  // create a Logger
  const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' })

  try {
    // 'info' is the default level if not set
    logger.info('Calling the segment operations action')

    // log parameters, only if params.LOG_LEVEL === 'debug'
    logger.debug(stringParameters(params))

    // check for missing request input parameters and headers
    const requiredParams = ['action']
    const requiredHeaders = []
    const errorMessage = checkMissingRequestInputs(params, requiredParams, requiredHeaders)
    if (errorMessage) {
      // return and log client errors
      return errorResponse(400, errorMessage, logger)
    }

    const { action, ...actionParams } = params
    logger.info(`Action called: ${action} with params:`, JSON.stringify(actionParams, null, 2))

    switch (action) {
      case 'get-sandboxes':
        return await getSandboxes(actionParams, logger)
      case 'get-segments':
        return await getSegments(actionParams, logger)
      case 'refresh-segments':
        return await refreshSegments(actionParams, logger)
      case 'get-job-status':
        return await getJobStatus(actionParams, logger)
      default:
        return errorResponse(400, `Unknown action: ${action}`, logger)
    }
  } catch (error) {
    // log any server errors
    logger.error(error)
    // return with 500
    return errorResponse(500, 'server error', logger)
  }
}

async function getSandboxes(params, logger) {
  const { org } = params
  
  if (!org) {
    return errorResponse(400, 'Missing required parameters: org', logger)
  }

  try {
    // Organization-specific configurations
    const orgConfigs = getOrgConfigs(params)

    const orgConfig = orgConfigs[org]
    
    if (!orgConfig) {
      return errorResponse(400, `Invalid organization: ${org}`, logger)
    }

    // Get access token for the specified environment
    const accessToken = await getAccessToken(orgConfig, logger)
    
    // Use the sandbox management API endpoint
    const apiEndpoint = 'https://platform.adobe.io/data/foundation/sandbox-management/sandboxes'

    const ims_headers = {
      'Authorization': 'Bearer ' + accessToken,
      'x-api-key': orgConfig.API_KEY,
      'x-gw-ims-org-id': orgConfig.IMS_ORG,
      'Accept': 'application/json'
    }

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
    logger.error('Error getting sandboxes:', error)
    return errorResponse(500, 'Failed to get sandboxes', logger)
  }
}

async function getSegments(params, logger) {
  const { org, sandbox } = params
  
  if (!org || !sandbox) {
    return errorResponse(400, 'Missing required parameters: org, sandbox', logger)
  }

  try {
    // Organization-specific configurations
    const orgConfigs = getOrgConfigs(params)

    const orgConfig = orgConfigs[org]
    
    if (!orgConfig) {
      return errorResponse(400, `Invalid organization: ${org}`, logger)
    }

    // Get access token for the specified environment
    const accessToken = await getAccessToken(orgConfig, logger)
    
    // Call Adobe Experience Platform API to get segments
    const apiEndpoint = 'https://platform.adobe.io/data/core/ups/segment/definitions'
    
    const ims_headers = {
      'Authorization': `Bearer ${accessToken}`,
      'x-api-key': orgConfig.API_KEY,
      'x-gw-ims-org-id': orgConfig.IMS_ORG,
      'x-sandbox-name': sandbox,
      'Accept': 'application/json'
    }

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
    logger.error('Error getting segments:', error)
    return errorResponse(500, 'Failed to get segments', logger)
  }
}

async function refreshSegments(params, logger) {
  const { org, sandbox, segmentIds } = params
  
  if (!org || !sandbox || !segmentIds) {
    return errorResponse(400, 'Missing required parameters: org, sandbox, segmentIds', logger)
  }

  try {
    // Organization-specific configurations
    const orgConfigs = getOrgConfigs(params)

    const orgConfig = orgConfigs[org]
    
    if (!orgConfig) {
      return errorResponse(400, `Invalid organization: ${org}`, logger)
    }

    // Get access token for the specified environment
    const accessToken = await getAccessToken(orgConfig, logger)
    
    // Process segment IDs
    const processedSegmentIds = Array.isArray(segmentIds) ? segmentIds : segmentIds.split(',').map(id => id.trim())
    logger.info('Processing refresh for segments:', processedSegmentIds.join(', '))

    if (!processedSegmentIds.length) {
      throw new Error('No segment IDs provided')
    }
    
    // Prepare request to Adobe API
    const apiUrl = 'https://platform.adobe.io/data/core/ups/segment/jobs'
    
    // Format request body according to Adobe API specifications for batch evaluation
    const requestBody = {
      name: `Batch Segment Refresh Job - ${new Date().toISOString()}`,
      segments: processedSegmentIds.map(id => ({
        segmentId: id
      })),
      operation: "refresh",
      evaluationInfo: {
        batch: {
          enabled: true
        }
      }
    }

    // Set up headers for the Adobe API request
    const apiHeaders = {
      'Authorization': `Bearer ${accessToken}`,
      'x-api-key': orgConfig.API_KEY,
      'x-gw-ims-org-id': orgConfig.IMS_ORG,
      'x-sandbox-name': sandbox,
      'Content-Type': 'application/json'
    }
    
    logger.info('Request body:', JSON.stringify(requestBody, null, 2))
    logger.info('Request headers:', apiHeaders)

    // Make the request to Adobe API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('Adobe API error:', errorText)
      throw new Error(`Adobe API request failed with status ${response.status}: ${errorText}`)
    }

    const responseData = await response.json()
    logger.info('Adobe API response:', responseData)

    return {
      statusCode: 200,
      body: responseData
    }
  } catch (error) {
    logger.error('Error refreshing segments:', error)
    return errorResponse(500, error.message, logger)
  }
}

async function getJobStatus(params, logger) {
  const { org, sandbox, jobId } = params
  
  if (!org || !sandbox || !jobId) {
    return errorResponse(400, 'Missing required parameters: org, sandbox, jobId', logger)
  }

  try {
    // Organization-specific configurations
    const orgConfigs = getOrgConfigs(params)

    const orgConfig = orgConfigs[org]
    
    if (!orgConfig) {
      return errorResponse(400, `Invalid organization: ${org}`, logger)
    }

    // Get access token for the specified environment
    const accessToken = await getAccessToken(orgConfig, logger)
    
    // Call Adobe Experience Platform API to get job status
    const apiEndpoint = `https://platform.adobe.io/data/core/ups/segment/jobs/${jobId}`
    
    const ims_headers = {
      'Authorization': `Bearer ${accessToken}`,
      'x-api-key': orgConfig.API_KEY,
      'x-gw-ims-org-id': orgConfig.IMS_ORG,
      'x-sandbox-name': sandbox,
      'Accept': 'application/json'
    }

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
      body: JSON.stringify(content)
    }

    // log the response status code
    logger.info(`${response.statusCode}: successful request`)
    return response
  } catch (error) {
    logger.error('Error getting job status:', error)
    return errorResponse(500, 'Failed to get job status', logger)
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
      META_SCOPE: 'cjm.suppression_service.client.delete, cjm.suppression_service.client.all, openid, session, AdobeID, read_organizations, additional_info.projectedProductContext, read_pc.acp, read_pc.dma_tartan, additional_info, target_sdk, additional_info.roles, additional_info.job_function, user_management_sdk',
      IMS: 'ims-na1.adobelogin.com'
    }
  }
}

exports.main = main 
