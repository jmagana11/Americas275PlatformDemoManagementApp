/*
* <license header>
*/

const { Core } = require('@adobe/aio-sdk')
const fetch = require('node-fetch')
const { errorResponse, getBearerToken, mergeJsonBodyParams } = require('../utils')
const {
  buildCurl,
  buildEdgeInteractRequest,
  normalizeEdgeResponse
} = require('../shared/offerDecisioning')

function successResponse(body) {
  return {
    statusCode: 200,
    body
  }
}

async function callEdgeInteract(input, options = {}) {
  const request = buildEdgeInteractRequest(input)
  const edgeFetch = options.fetch || fetch
  const response = await edgeFetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: JSON.stringify(request.body)
  })
  const responseText = await response.text()
  let rawResponse

  try {
    rawResponse = responseText ? JSON.parse(responseText) : {}
  } catch (error) {
    rawResponse = {
      body: responseText
    }
  }

  if (!response.ok) {
    const error = new Error(`Experience Edge interact failed with status ${response.status}`)
    error.statusCode = response.status
    error.rawResponse = rawResponse
    error.request = request
    throw error
  }

  return {
    success: true,
    request,
    rawResponse,
    normalized: normalizeEdgeResponse(rawResponse),
    curl: buildCurl(request)
  }
}

async function main(params) {
  const logger = Core.Logger('edge-interact', { level: params.LOG_LEVEL || 'info' })
  const mergedParams = mergeJsonBodyParams(params)

  try {
    const token = getBearerToken(params)
    if (!token) {
      return errorResponse(401, 'Authorization token is missing', logger)
    }

    logger.info('Calling Experience Edge interact proxy')
    const result = await callEdgeInteract(mergedParams)
    return successResponse(result)
  } catch (error) {
    logger.error(error)
    if (error.validationErrors) {
      return errorResponse(400, error.message, logger)
    }
    if (error.rawResponse) {
      return {
        statusCode: error.statusCode || 502,
        body: {
          success: false,
          error: error.message,
          request: error.request,
          rawResponse: error.rawResponse,
          curl: error.request ? buildCurl(error.request) : null
        }
      }
    }
    return errorResponse(500, error.message || 'Experience Edge request failed', logger)
  }
}

exports.main = main
exports.callEdgeInteract = callEdgeInteract
