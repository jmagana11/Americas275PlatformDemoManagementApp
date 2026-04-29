/*
* <license header>
*/

/**
 * Webhook Receiver Action - Receives and logs incoming webhook calls
 * Uses Azure Blob Storage for persistent data storage shared with api-monitor
 */

const { v4: uuidv4 } = require('uuid')
const { BlobServiceClient } = require('@azure/storage-blob')
const {
  buildRequestBodyFromFlattenedParams,
  redactObject,
  safeStringify
} = require('../shared/redaction')

// Helper function to get Azure Blob Storage client
function getBlobServiceClient(params) {
  const blobUrl = params.AZURE_BLOB_URL
  const sasToken = params.AZURE_SAS_TOKEN
  const containerUrl = `${blobUrl}${sasToken}`
  return new BlobServiceClient(containerUrl)
}

// Helper function to get IMS user identifier
function getUserIdentifier(headers) {
  console.log('=== DEBUG WEBHOOK: Getting user identifier ===')
  console.log('Available headers:', Object.keys(headers || {}))
  console.log('Full headers:', safeStringify(headers))
  
  // Try to get from IMS context
  if (headers && headers['x-gw-ims-org-id']) {
    const orgId = headers['x-gw-ims-org-id'].replace(/[^a-zA-Z0-9]/g, '_')
    console.log('Found IMS org ID:', orgId)
    return orgId
  }
  
  // Try alternative header names
  if (headers && headers['x-ims-org-id']) {
    const orgId = headers['x-ims-org-id'].replace(/[^a-zA-Z0-9]/g, '_')
    console.log('Found alternative IMS org ID:', orgId)
    return orgId
  }
  
  // Try authorization header for user info
  if (headers && headers['authorization']) {
    const authId = 'user_' + Math.abs(headers['authorization'].substring(0, 10).split('').reduce((a,b) => a + b.charCodeAt(0), 0))
    console.log('Using auth-based identifier:', authId)
    return authId
  }
  
  // Fallback to a default identifier
  console.log('Using default user identifier')
  return 'default_user'
}

// Helper function to get blob path for session data
function getSessionBlobPath(userId, sessionId) {
  return `api-monitor/DO_NOT_DELETE_APPBUILDER_${userId}_${sessionId}.json`
}

// Helper function to read JSON from blob
async function readJsonFromBlob(blobServiceClient, blobPath) {
  try {
    const containerClient = blobServiceClient.getContainerClient('')
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath)
    
    const downloadResponse = await blockBlobClient.download(0)
    const content = await streamToString(downloadResponse.readableStreamBody)
    return JSON.parse(content)
  } catch (error) {
    if (error.statusCode === 404) {
      // File doesn't exist, return empty structure
      return null
    }
    throw error
  }
}

// Helper function to write JSON to blob
async function writeJsonToBlob(blobServiceClient, blobPath, data) {
  try {
    const containerClient = blobServiceClient.getContainerClient('')
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath)
    
    const jsonContent = JSON.stringify(data, null, 2)
    
    await blockBlobClient.upload(jsonContent, jsonContent.length, {
      blobHTTPHeaders: {
        blobContentType: 'application/json'
      },
      metadata: {
        updatedAt: new Date().toISOString(),
        purpose: 'api-monitor-session-data'
      }
    })
  } catch (error) {
    console.error('Error writing to blob:', error)
    throw error
  }
}

// Helper function to convert stream to string
async function streamToString(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = []
    readableStream.on('data', (data) => {
      chunks.push(data.toString())
    })
    readableStream.on('end', () => {
      resolve(chunks.join(''))
    })
    readableStream.on('error', reject)
  })
}

// main function that will be executed by Adobe I/O Runtime
async function main(params) {
  try {
    console.log('Webhook Receiver called with action:', params.action)
    console.log('Method:', params.__ow_method)
    console.log('=== DEBUG: All received parameters ===')
    console.log('Available params:', Object.keys(params))
    console.log('Body type:', typeof params.__ow_body)
    console.log('Body length:', params.__ow_body ? params.__ow_body.length : 'N/A')
    
    // Handle internal API calls from api-monitor (not needed anymore with Azure Blob Storage)
    if (params.action) {
      return {
        statusCode: 400,
        body: { error: 'Direct action calls not supported. Use Azure Blob Storage.' }
      }
    }
    
    console.log('Headers:', safeStringify(params.__ow_headers || {}))
    
    // Extract session ID from URL path or query
    const sessionId = extractSessionId(params)
    
    if (!sessionId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: { 
          error: 'Invalid webhook URL. Session ID not found.',
          message: 'Use the webhook URL generated in your API Monitor session.',
          debug: {
            path: params.__ow_path,
            method: params.__ow_method,
            receivedParams: Object.keys(params)
          }
        }
      }
    }
    
    const userId = getUserIdentifier(params.__ow_headers || {})
    console.log(`Webhook for user: ${userId}, session: ${sessionId}`)
    
    // Load session data from Azure Blob Storage
    const blobServiceClient = getBlobServiceClient(params)
    
        // Try to find the session data with different user IDs (find the best match)
    let sessionData = null
    let actualUserId = userId
    let blobPath = getSessionBlobPath(userId, sessionId)
    let bestSessionData = null
    let bestUserId = null
    let bestBlobPath = null
    let bestScore = -1
    const configuredOrgUserId = (params.orgId || process.env.AEP_ORG_ID || '').replace('@', '_')
    
    // Try all possible user IDs and pick the one with the most complete session
    const allUserIds = [
      userId, // Start with detected user ID
      configuredOrgUserId,
      'user_anonymous',
      'default_user'
    ].filter(Boolean)
    
    for (const testUserId of allUserIds) {
      console.log(`Trying user ID: ${testUserId}`)
      const testBlobPath = getSessionBlobPath(testUserId, sessionId)
      console.log(`Blob path: ${testBlobPath}`)
      
      const testSessionData = await readJsonFromBlob(blobServiceClient, testBlobPath)
      if (testSessionData) {
        // Calculate a score based on session completeness
        const requestCount = testSessionData.session.requestCount || 0
        const webhookCount = testSessionData.session.webhookCount || 0
        const score = requestCount * 10 + webhookCount // Prioritize request logs
        
        console.log(`Found session data with user ID: ${testUserId}`)
        console.log(`Session score: ${score} (requests: ${requestCount}, webhooks: ${webhookCount})`)
        
        if (score > bestScore) {
          bestSessionData = testSessionData
          bestUserId = testUserId
          bestBlobPath = testBlobPath
          bestScore = score
          console.log(`New best session found with user ID: ${testUserId}`)
        }
      } else {
        console.log(`No session data found with user ID: ${testUserId}`)
      }
    }
    
    // Use the best session found
    if (bestSessionData) {
      sessionData = bestSessionData
      actualUserId = bestUserId
      blobPath = bestBlobPath
      console.log(`Using session with user ID: ${actualUserId}, score: ${bestScore}`)
    }
    
    // Create session if it doesn't exist (for external webhook calls)
    if (!sessionData) {
      console.log(`Creating new session data for webhook: ${sessionId}`)
      sessionData = {
        session: {
          id: sessionId,
          userId: actualUserId,
          created: new Date().toISOString(),
          requestCount: 0,
          webhookCount: 0,
          lastActivity: new Date().toISOString()
        },
        requestLogs: [],
        webhookLogs: []
      }
    }
    
    const webhookId = uuidv4()
    const timestamp = new Date().toISOString()
    
    // Parse the request body
    let requestBody = null
    let requestBodySize = 0
    
    if (params.__ow_body) {
      // External calls: body comes in __ow_body
      if (typeof params.__ow_body === 'string') {
        try {
          // Try to parse as JSON if it's a string
          requestBody = JSON.parse(params.__ow_body)
          requestBodySize = params.__ow_body.length
        } catch (e) {
          // If not JSON, store as string
          requestBody = params.__ow_body
          requestBodySize = params.__ow_body.length
        }
      } else {
        // If it's already an object, use it directly
          requestBody = params.__ow_body
          requestBodySize = JSON.stringify(params.__ow_body).length
      }
      requestBody = redactObject(requestBody)
      requestBodySize = JSON.stringify(requestBody).length
      console.log('=== DEBUG: Body from __ow_body ===')
      console.log('Original body type:', typeof params.__ow_body)
      console.log('Processed body:', safeStringify(requestBody))
      console.log('Body size:', requestBodySize)
    } else {
      requestBody = buildRequestBodyFromFlattenedParams(params)
      if (requestBody) {
        requestBodySize = JSON.stringify(requestBody).length
        console.log('=== DEBUG: Body from flattened params ===')
        console.log('Extracted body params:', safeStringify(requestBody))
        console.log('Body size:', requestBodySize)
      }
    }
    
    // Extract query parameters
    const queryParams = redactObject(params.__ow_query || {})
    
    // Get client IP
    const rawHeaders = params.__ow_headers || {}
    const headers = redactObject(rawHeaders)
    const clientIP = rawHeaders['x-forwarded-for'] || 
                    rawHeaders['x-real-ip'] || 
                    'unknown'
    
    // Create the webhook log entry
    const webhookEntry = {
      webhookId,
      sessionId,
      timestamp,
      request: {
        method: params.__ow_method || 'GET',
        path: params.__ow_path || '/',
        headers: headers,
        query: queryParams,
        body: requestBody,
        bodySize: requestBodySize,
        clientIP,
        userAgent: rawHeaders['user-agent'] || 'Unknown'
      },
      response: {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-ID': webhookId
        },
        body: {
          success: true,
          message: 'Webhook received successfully',
          webhookId: webhookId,
          timestamp: timestamp
        }
      }
    }
    
    // Update session data
    sessionData.webhookLogs = sessionData.webhookLogs || []
    sessionData.webhookLogs.push(webhookEntry)
    sessionData.session.webhookCount++
    sessionData.session.lastActivity = timestamp
    
    // Save back to Azure Blob Storage with retry mechanism to handle race conditions
    console.log(`Saving updated session data to blob path: ${blobPath}`)
    console.log(`Updated session data:`, JSON.stringify({
      sessionId: sessionData.session.id,
      userId: sessionData.session.userId,
      webhookCount: sessionData.session.webhookCount,
      webhookLogsLength: (sessionData.webhookLogs || []).length,
      requestLogsLength: (sessionData.requestLogs || []).length
    }, null, 2))
    
    // Retry mechanism to handle concurrent updates
    let saveAttempts = 0
    const maxAttempts = 3
    
    while (saveAttempts < maxAttempts) {
      try {
        // Re-read the latest session data before saving to avoid overwriting concurrent changes
        if (saveAttempts > 0) {
          console.log(`Retry attempt ${saveAttempts}: Re-reading session data before save`)
          const latestSessionData = await readJsonFromBlob(blobServiceClient, blobPath)
          if (latestSessionData) {
            // Merge the webhook data with the latest session data
            latestSessionData.webhookLogs = latestSessionData.webhookLogs || []
            latestSessionData.webhookLogs.push(webhookEntry)
            latestSessionData.session.webhookCount = (latestSessionData.webhookLogs || []).length
            latestSessionData.session.lastActivity = timestamp
            sessionData = latestSessionData
            console.log(`Merged with latest session data. New counts: requests=${(sessionData.requestLogs || []).length}, webhooks=${(sessionData.webhookLogs || []).length}`)
          }
        }
        
        await writeJsonToBlob(blobServiceClient, blobPath, sessionData)
        console.log(`Successfully saved session data on attempt ${saveAttempts + 1}`)
        break
        
      } catch (error) {
        saveAttempts++
        console.error(`Save attempt ${saveAttempts} failed:`, error.message)
        if (saveAttempts >= maxAttempts) {
          throw error
        }
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 100 * saveAttempts))
      }
    }
    
    console.log(`Webhook logged for session ${sessionId}:`, webhookEntry.webhookId)
    
    // Check if there's a custom response configured for this session
    const customResponse = getCustomResponse(sessionId, params.__ow_method)
    
    if (customResponse) {
      return {
        statusCode: customResponse.status || 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-ID': webhookId,
          ...customResponse.headers
        },
        body: customResponse.body || webhookEntry.response.body
      }
    }
    
    // Default success response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-ID': webhookId
      },
      body: webhookEntry.response.body
    }
    
  } catch (error) {
    console.error('Error in webhook receiver:', error.message)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: { 
        error: 'Webhook processing failed', 
        details: error.message,
        timestamp: new Date().toISOString()
      }
    }
  }
}

// Extract session ID from URL path or query parameters
function extractSessionId(params) {
  console.log('Extracting session ID from params:', {
    path: params.__ow_path,
    query: params.__ow_query,
    headers: params.__ow_headers
  })
  
  // Try to get from path first - Adobe I/O Runtime puts extra path after action name
  if (params.__ow_path) {
    const pathParts = params.__ow_path.split('/').filter(part => part.length > 0)
    console.log('Path parts:', pathParts)
    
    // The session ID should be the last part of the path
    if (pathParts.length > 0) {
      const sessionId = pathParts[pathParts.length - 1]
      // Validate it looks like a UUID
      if (sessionId && sessionId.length > 20) {
        console.log('Found session ID in path:', sessionId)
        return sessionId
      }
    }
  }
  
  // Try to get from query parameters
  if (params.__ow_query && params.__ow_query.sessionId) {
    console.log('Found session ID in query:', params.__ow_query.sessionId)
    return params.__ow_query.sessionId
  }
  
  // Try to get from headers
  if (params.__ow_headers && params.__ow_headers['x-session-id']) {
    console.log('Found session ID in headers:', params.__ow_headers['x-session-id'])
    return params.__ow_headers['x-session-id']
  }
  
  console.log('No session ID found')
  return null
}

// Get custom response configuration for a session
function getCustomResponse(sessionId, method) {
  // This could be extended to support custom responses per session
  // For now, return null to use default response
  return null
}

// Export functions for backward compatibility (not used with Azure Blob Storage)
function getWebhookLogs(sessionId, limit = 100) {
  // Deprecated - use Azure Blob Storage directly
  return []
}

function clearWebhookLogs(sessionId) {
  // Deprecated - use Azure Blob Storage directly
  return false
}

function getWebhookSession(sessionId) {
  // Deprecated - use Azure Blob Storage directly
  return null
}

exports.main = main
exports.getWebhookLogs = getWebhookLogs
exports.clearWebhookLogs = clearWebhookLogs
exports.getWebhookSession = getWebhookSession 
