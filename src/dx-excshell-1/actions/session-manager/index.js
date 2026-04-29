const {
  createBlobServiceClient,
  deleteBlobIfExists,
  readJsonBlob,
  writeJsonBlob
} = require('../shared/blobStore')
const {
  LEGACY_SESSION_CONTAINER_NAME,
  getSessionManagerBlobPath,
  normalizeFeatureSessionDocument
} = require('../shared/sessionStore')

const SESSION_MANAGER_BLOB_OPTIONS = Object.freeze({
  containerName: LEGACY_SESSION_CONTAINER_NAME
})

// Helper function to get blob service client using environment variables
function getBlobServiceClient(params) {
  return createBlobServiceClient(params)
}

// Helper function to get user identifier from headers
function getUserIdentifier(headers) {
  // Try multiple sources for user identification
  const userId = headers['x-ims-user-id'] || 
                 headers['x-gw-ims-user-id'] || 
                 headers['user-id'] ||
                 headers['ims-user-id']
  
  if (!userId) {
    throw new Error('User identifier not found in request headers')
  }
  
  return userId.replace(/[^a-zA-Z0-9-]/g, '') // Sanitize for blob naming
}

// Helper function to get session blob path
function getSessionBlobPath(userId) {
  return getSessionManagerBlobPath(userId)
}

// Helper function to read JSON from blob
async function readJsonFromBlob(blobServiceClient, blobPath) {
  try {
    const sessionData = await readJsonBlob(blobServiceClient, blobPath, SESSION_MANAGER_BLOB_OPTIONS)
    return sessionData ? normalizeFeatureSessionDocument(sessionData) : null
  } catch (error) {
    console.error('Error reading session from blob:', error)
    if (error.statusCode === 404) {
      return null // Blob doesn't exist
    }
    return null
  }
}

// Helper function to write JSON to blob
async function writeJsonToBlob(blobServiceClient, blobPath, data) {
  try {
    const uploadResponse = await writeJsonBlob(blobServiceClient, blobPath, normalizeFeatureSessionDocument(data), {
      ...SESSION_MANAGER_BLOB_OPTIONS,
      metadata: {
        purpose: 'session-manager'
      }
    })
    
    return uploadResponse
  } catch (error) {
    console.error('Error writing session to blob:', error)
    throw error
  }
}

// Main function
async function main(params) {
  try {
    console.log('Session Manager called with action:', params.action)
    
    const blobServiceClient = getBlobServiceClient(params)
    const userId = getUserIdentifier(params.__ow_headers || {})
    const blobPath = getSessionBlobPath(userId)
    
    console.log('User ID:', userId)
    console.log('Blob path:', blobPath)
    
    switch (params.action) {
      case 'save':
        return await saveSession(blobServiceClient, blobPath, params)
      case 'load':
        return await loadSession(blobServiceClient, blobPath, params)
      case 'delete':
        return await deleteSession(blobServiceClient, blobPath, params)
      default:
        throw new Error(`Unknown action: ${params.action}`)
    }
  } catch (error) {
    console.error('Session Manager error:', error)
    return {
      statusCode: 500,
      body: {
        success: false,
        error: error.message
      }
    }
  }
}

// Save session function
async function saveSession(blobServiceClient, blobPath, params) {
  const { featureName, sessionData } = params
  
  if (!featureName || !sessionData) {
    throw new Error('featureName and sessionData are required for save action')
  }
  
  // Read existing session data
  let existingData = await readJsonFromBlob(blobServiceClient, blobPath) || {
    userId: getUserIdentifier(params.__ow_headers || {}),
    created: new Date().toISOString(),
    features: {}
  }
  
  // Update the specific feature data
  existingData.features[featureName] = {
    ...sessionData,
    lastModified: new Date().toISOString()
  }
  existingData.lastModified = new Date().toISOString()
  
  // Write back to blob
  await writeJsonToBlob(blobServiceClient, blobPath, existingData)
  
  console.log(`Session saved for feature: ${featureName}`)
  
  return {
    statusCode: 200,
    body: {
      success: true,
      message: `Session saved for feature: ${featureName}`,
      data: existingData.features[featureName]
    }
  }
}

// Load session function
async function loadSession(blobServiceClient, blobPath, params) {
  const { featureName } = params
  
  const sessionData = await readJsonFromBlob(blobServiceClient, blobPath)
  
  if (!sessionData) {
    return {
      statusCode: 200,
      body: {
        success: true,
        message: 'No session found',
        data: null
      }
    }
  }
  
  const featureData = featureName ? sessionData.features[featureName] : sessionData
  
  console.log(`Session loaded for feature: ${featureName || 'all'}`)
  
  return {
    statusCode: 200,
    body: {
      success: true,
      message: 'Session loaded successfully',
      data: featureData,
      metadata: {
        userId: sessionData.userId,
        created: sessionData.created,
        lastModified: sessionData.lastModified
      }
    }
  }
}

// Delete session function
async function deleteSession(blobServiceClient, blobPath, params) {
  const { featureName } = params
  
  if (!featureName) {
    // Delete entire session file
    try {
      await deleteBlobIfExists(blobServiceClient, blobPath, SESSION_MANAGER_BLOB_OPTIONS)
      
      return {
        statusCode: 200,
        body: {
          success: true,
          message: 'Entire session deleted successfully'
        }
      }
    } catch (error) {
      if (error.statusCode === 404) {
        return {
          statusCode: 200,
          body: {
            success: true,
            message: 'Session was already deleted or does not exist'
          }
        }
      }
      throw error
    }
  } else {
    // Delete specific feature data
    let existingData = await readJsonFromBlob(blobServiceClient, blobPath)
    
    if (!existingData || !existingData.features[featureName]) {
      return {
        statusCode: 200,
        body: {
          success: true,
          message: `No session data found for feature: ${featureName}`
        }
      }
    }
    
    delete existingData.features[featureName]
    existingData.lastModified = new Date().toISOString()
    
    await writeJsonToBlob(blobServiceClient, blobPath, existingData)
    
    return {
      statusCode: 200,
      body: {
        success: true,
        message: `Session data deleted for feature: ${featureName}`
      }
    }
  }
}

exports.main = main
