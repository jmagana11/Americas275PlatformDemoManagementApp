/*
* <license header>
*/

const { Core } = require('@adobe/aio-sdk')
const { createBlobServiceClient } = require('../shared/blobStore')
const {
  deleteOfferConfig,
  getOfferConfig,
  getOrgIdentifier,
  getUserIdentifier,
  listOfferConfigs,
  publishOfferConfig,
  saveOfferConfig,
  unpublishOfferConfig
} = require('../shared/offerConfigStore')
const { errorResponse, getBearerToken, mergeJsonBodyParams } = require('../utils')

function successResponse(body) {
  return {
    statusCode: 200,
    body
  }
}

function getOwner(params = {}) {
  const headers = params.__ow_headers || {}
  return {
    userId: getUserIdentifier(headers),
    orgId: getOrgIdentifier(headers, params)
  }
}

async function main(params) {
  const logger = Core.Logger('offer-configs', { level: params.LOG_LEVEL || 'info' })
  const mergedParams = mergeJsonBodyParams(params)

  try {
    const token = getBearerToken(params)
    if (!token) {
      return errorResponse(401, 'Authorization token is missing', logger)
    }

    const operation = mergedParams.operation || mergedParams.action
    if (!operation) {
      return errorResponse(400, 'operation is required', logger)
    }

    const blobServiceClient = createBlobServiceClient(params)
    const owner = getOwner(params)

    if (operation === 'saveConfig') {
      const result = await saveOfferConfig(blobServiceClient, mergedParams.config || mergedParams, owner)
      return successResponse({
        success: true,
        config: result.config,
        blobPath: result.blobPath
      })
    }

    if (operation === 'getConfig') {
      const configId = mergedParams.configId || mergedParams.id
      if (!configId) {
        return errorResponse(400, 'configId is required', logger)
      }
      const result = await getOfferConfig(blobServiceClient, configId, owner)
      if (!result.config) {
        return errorResponse(404, 'Offer config not found', logger)
      }
      return successResponse({
        success: true,
        config: result.config,
        blobPath: result.blobPath
      })
    }

    if (operation === 'listConfigs') {
      const configs = await listOfferConfigs(blobServiceClient, owner)
      return successResponse({
        success: true,
        configs
      })
    }

    if (operation === 'deleteConfig') {
      const configId = mergedParams.configId || mergedParams.id
      if (!configId) {
        return errorResponse(400, 'configId is required', logger)
      }
      const result = await deleteOfferConfig(blobServiceClient, configId, owner)
      return successResponse({
        success: true,
        ...result
      })
    }

    if (operation === 'publishConfig') {
      const configId = mergedParams.configId || mergedParams.id
      if (!configId) {
        return errorResponse(400, 'configId is required', logger)
      }
      const result = await publishOfferConfig(blobServiceClient, configId, owner)
      if (!result) {
        return errorResponse(404, 'Offer config not found', logger)
      }
      return successResponse({
        success: true,
        config: result.config,
        publishedConfig: result.publishedConfig
      })
    }

    if (operation === 'unpublishConfig') {
      const configId = mergedParams.configId || mergedParams.id
      if (!configId) {
        return errorResponse(400, 'configId is required', logger)
      }
      const config = await unpublishOfferConfig(blobServiceClient, configId, owner)
      if (!config) {
        return errorResponse(404, 'Offer config not found', logger)
      }
      return successResponse({
        success: true,
        config
      })
    }

    return errorResponse(400, `Unsupported operation: ${operation}`, logger)
  } catch (error) {
    logger.error(error)
    return errorResponse(500, error.message || 'Offer config operation failed', logger)
  }
}

exports.main = main
