/*
* <license header>
*/

/**
 * API Monitor Action - Acts as a proxy to capture and log API requests/responses
 * Uses Azure Blob Storage for persistent data storage across sessions
 */

const axios = require('axios')
const { v4: uuidv4 } = require('uuid')
const { BlobServiceClient } = require('@azure/storage-blob')
const { redactObject, redactValue, safeStringify } = require('../shared/redaction')

// Helper function to get Azure Blob Storage client
function getBlobServiceClient(params) {
  const blobUrl = params.AZURE_BLOB_URL
  const sasToken = params.AZURE_SAS_TOKEN
  const containerUrl = `${blobUrl}${sasToken}`
  return new BlobServiceClient(containerUrl)
}

// Helper function to get IMS user identifier
function getUserIdentifier(headers) {
  console.log('=== DEBUG: Getting user identifier ===')
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
    console.log('=== DEBUG: Reading from blob ===')
    console.log('Blob path:', blobPath)
    console.log('BlobServiceClient configured:', !!blobServiceClient)
    
    const containerClient = blobServiceClient.getContainerClient('')
    console.log('Container client created')
    
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath)
    console.log('Block blob client created')
    
    console.log('Attempting to download blob...')
    const downloadResponse = await blockBlobClient.download(0)
    console.log('Download response received')
    
    const content = await streamToString(downloadResponse.readableStreamBody)
    const parsed = JSON.parse(content)
    console.log('Content length:', content.length)
    console.log('Content preview:', safeStringify(parsed).substring(0, 200))
    console.log('Successfully parsed JSON')
    return parsed
  } catch (error) {
    console.error('Error reading from blob:', error)
    console.error('Error code:', error.code)
    console.error('Error statusCode:', error.statusCode)
    console.error('Error message:', error.message)
    
    if (error.statusCode === 404 || error.code === 'BlobNotFound') {
      console.log('File doesn\'t exist, returning null')
      return null
    }
    throw error
  }
}

// Helper function to write JSON to blob
async function writeJsonToBlob(blobServiceClient, blobPath, data) {
  try {
    console.log('=== DEBUG: Writing to blob ===')
    console.log('Blob path:', blobPath)
    console.log('Data keys:', Object.keys(data))
    console.log('BlobServiceClient configured:', !!blobServiceClient)
    
    const containerClient = blobServiceClient.getContainerClient('')
    console.log('Container client created')
    
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath)
    console.log('Block blob client created')
    
    const jsonContent = JSON.stringify(data, null, 2)
    console.log('JSON content length:', jsonContent.length)
    console.log('JSON content preview:', safeStringify(data).substring(0, 200))
    
    console.log('Attempting to upload blob...')
    await blockBlobClient.upload(jsonContent, jsonContent.length, {
      blobHTTPHeaders: {
        blobContentType: 'application/json'
      },
      metadata: {
        updatedAt: new Date().toISOString(),
        purpose: 'api-monitor-session-data'
      }
    })
    
    console.log('Successfully uploaded blob')
  } catch (error) {
    console.error('Error writing to blob:', error)
    console.error('Error code:', error.code)
    console.error('Error statusCode:', error.statusCode)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
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
    console.log('API Monitor Action called with:', Object.keys(params))
    console.log('=== DEBUG: All params ===')
    console.log('Full params:', safeStringify(params))
    
    const action = params.action || 'createSession'
    
    switch (action) {
      case 'createSession':
        return await createSession(params)
      
      case 'proxy':
        return await proxyRequest(params)
      
      case 'getLogs':
        return await getLogs(params)
      
      case 'clearLogs':
        return await clearLogs(params)
      
      case 'getWebhookLogs':
        return await getWebhookLogs(params)
      
      case 'clearWebhookLogs':
        return await clearWebhookLogs(params)
      
      case 'createProxyConfig':
        return await createProxyConfig(params)
      
      case 'getProxyConfigs':
        return await getProxyConfigs(params)
      
      case 'updateProxyConfig':
        return await updateProxyConfig(params)
      
      case 'deleteProxyConfig':
        return await deleteProxyConfig(params)
      
      case 'getSession':
        return await getSession(params)
      
      default:
        return {
          statusCode: 400,
          body: { error: 'Invalid action. Use: createSession, proxy, getLogs, clearLogs, getWebhookLogs, clearWebhookLogs, createProxyConfig, getProxyConfigs, updateProxyConfig, deleteProxyConfig, or getSession' }
        }
    }
    
  } catch (error) {
    console.error('Error in API Monitor action:', error.message)
    return {
      statusCode: 500,
      body: { 
        error: 'Internal server error', 
        details: error.message 
      }
    }
  }
}

async function createSession(params) {
  try {
    console.log('=== DEBUG: Creating session ===')
    console.log('Params keys:', Object.keys(params))
    console.log('Environment variables:', {
      AZURE_STORAGE_ACCOUNT: !!process.env.AZURE_STORAGE_ACCOUNT,
      AZURE_STORAGE_KEY: !!process.env.AZURE_STORAGE_KEY,
      AZURE_STORAGE_CONTAINER_NAME: process.env.AZURE_STORAGE_CONTAINER_NAME
    })
    
    const sessionId = uuidv4()
    const timestamp = new Date().toISOString()
    const userId = getUserIdentifier(params.__ow_headers || {})
    
    console.log(`Creating session for user: ${userId}`)
    console.log(`Session ID: ${sessionId}`)
    
    // Create session data structure
    const sessionData = {
      session: {
        id: sessionId,
        userId: userId,
        created: timestamp,
        requestCount: 0,
        webhookCount: 0,
        lastActivity: timestamp
      },
      requestLogs: [],
      webhookLogs: []
    }
    
    console.log('Session data structure created')
    
    // Store in Azure Blob Storage
    console.log('Getting blob service client...')
    const blobServiceClient = getBlobServiceClient(params)
    const blobPath = getSessionBlobPath(userId, sessionId)
    
    console.log('Writing to blob storage...')
    await writeJsonToBlob(blobServiceClient, blobPath, sessionData)
    
    console.log(`Session created: ${sessionId} for user: ${userId}`)
    
    return {
      statusCode: 200,
      body: {
        success: true,
        sessionId: sessionId,
        userId: userId,
        proxyUrl: `${process.env.__OW_ACTION_NAME}/proxy`,
        created: timestamp,
        message: 'Session created successfully. Use this sessionId in your API calls.'
      }
    }
    
  } catch (error) {
    console.error('Error creating session:', error)
    console.error('Error details:', error.message)
    console.error('Error stack:', error.stack)
    return {
      statusCode: 500,
      body: { error: 'Failed to create session', details: error.message }
    }
  }
}

async function proxyRequest(params) {
  try {
    const { sessionId, method = 'GET', url, headers = {}, body, timeout = 30000 } = params
    const userId = getUserIdentifier(params.__ow_headers || {})
    
    if (!sessionId) {
      return {
        statusCode: 400,
        body: { error: 'sessionId is required' }
      }
    }
    
    if (!url) {
      return {
        statusCode: 400,
        body: { error: 'url is required' }
      }
    }
    
    console.log(`Proxy request for user: ${userId}, session: ${sessionId}`)
    
    // Load session data from Azure Blob Storage
    const blobServiceClient = getBlobServiceClient(params)
    const blobPath = getSessionBlobPath(userId, sessionId)
    
    let sessionData = await readJsonFromBlob(blobServiceClient, blobPath)
    
    if (!sessionData) {
      console.log(`Session not found for proxy request, trying fallback...`)
      const fallbackPath = getSessionBlobPath('default_user', sessionId)
      sessionData = await readJsonFromBlob(blobServiceClient, fallbackPath)
      
      if (!sessionData) {
        return {
          statusCode: 404,
          body: { error: 'Session not found. Please create a new session.' }
        }
      } else {
        console.log(`Found session using fallback path for proxy request`)
      }
    }
    
    const requestId = uuidv4()
    const startTime = Date.now()
    const timestamp = new Date().toISOString()
    
    // Prepare the request
    const requestConfig = {
      method: method.toUpperCase(),
      url: url,
      headers: {
        'User-Agent': 'Adobe-API-Monitor/1.0',
        ...headers
      },
      timeout: timeout,
      validateStatus: () => true // Don't throw on HTTP error codes
    }
    
    // Add body if provided and method supports it
    if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      // Body is always sent as string from frontend
      requestConfig.data = body
      if (!headers['Content-Type']) {
        requestConfig.headers['Content-Type'] = 'application/json'
      }
    }
    
    let response
    let error = null
    
    try {
      // Make the actual request
      response = await axios(requestConfig)
    } catch (axiosError) {
      error = {
        message: axiosError.message,
        code: axiosError.code,
        type: 'network_error'
      }
      
      // Create a mock response for logging
      response = {
        status: 0,
        statusText: 'Network Error',
        headers: {},
        data: null
      }
    }
    
    const endTime = Date.now()
    const responseTime = endTime - startTime
    
    // Create the log entry
    const logEntry = redactObject({
      requestId,
      sessionId,
      timestamp,
      request: {
        method: method.toUpperCase(),
        url,
        headers: requestConfig.headers,
        body: body || null
      },
      response: {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers || {},
        body: response.data,
        size: JSON.stringify(response.data || '').length
      },
      responseTime,
      error,
      curlCommand: generateCurlCommand(method, url, requestConfig.headers, body)
    })
    
    // Update session data
    sessionData.requestLogs.push(logEntry)
    sessionData.session.requestCount++
    sessionData.session.lastActivity = timestamp
    
    // Save back to Azure Blob Storage with retry mechanism to handle race conditions
    let saveAttempts = 0
    const maxAttempts = 3
    
    while (saveAttempts < maxAttempts) {
      try {
        // ALWAYS re-read the latest session data before saving to avoid overwriting concurrent changes
        console.log(`Save attempt ${saveAttempts + 1}: Re-reading session data before save`)
        const latestSessionData = await readJsonFromBlob(blobServiceClient, blobPath)
        if (latestSessionData) {
          // Merge the request data with the latest session data
          latestSessionData.requestLogs = latestSessionData.requestLogs || []
          latestSessionData.requestLogs.push(logEntry)
          latestSessionData.session.requestCount = (latestSessionData.requestLogs || []).length
          latestSessionData.session.lastActivity = timestamp
          sessionData = latestSessionData
          console.log(`Merged with latest session data. New counts: requests=${(sessionData.requestLogs || []).length}, webhooks=${(sessionData.webhookLogs || []).length}`)
        } else {
          console.log(`No latest session data found, using original session data`)
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
    
    console.log(`Request logged for session ${sessionId}:`, requestId)
    
    return {
      statusCode: 200,
      body: {
        success: true,
        requestId,
        sessionId,
        response: {
          status: response.status,
          statusText: response.statusText,
          headers: redactObject(response.headers),
          body: redactObject(response.data)
        },
        responseTime,
        error,
        logEntry
      }
    }
    
  } catch (error) {
    console.error('Error in proxy request:', error)
    return {
      statusCode: 500,
      body: { error: 'Proxy request failed', details: error.message }
    }
  }
}

async function getLogs(params) {
  try {
    const { sessionId, limit = 100 } = params
    const userId = getUserIdentifier(params.__ow_headers || {})
    
    if (!sessionId) {
      return {
        statusCode: 400,
        body: { error: 'sessionId is required' }
      }
    }
    
    console.log(`=== DEBUG: Getting logs ===`)
    console.log(`Session ID: ${sessionId}`)
    console.log(`User ID: ${userId}`)
    console.log(`Blob path: ${getSessionBlobPath(userId, sessionId)}`)
    
    // Load session data from Azure Blob Storage
    const blobServiceClient = getBlobServiceClient(params)
    const blobPath = getSessionBlobPath(userId, sessionId)
    
    console.log(`Attempting to read blob: ${blobPath}`)
    let sessionData = await readJsonFromBlob(blobServiceClient, blobPath)
    
    if (!sessionData) {
      console.log(`Session not found with current user ID, trying fallback approaches...`)
      
      // Try with default_user as fallback
      const fallbackPath = getSessionBlobPath('default_user', sessionId)
      console.log(`Trying fallback path: ${fallbackPath}`)
      sessionData = await readJsonFromBlob(blobServiceClient, fallbackPath)
      
      if (!sessionData) {
        // Try to list blobs with the session ID pattern to find the correct file
        console.log(`Fallback also failed, session truly not found`)
        return {
          statusCode: 404,
          body: { 
            error: 'Session not found',
            details: `Tried paths: ${blobPath}, ${fallbackPath}`,
            sessionId,
            userId
          }
        }
      } else {
        console.log(`Found session data using fallback path: ${fallbackPath}`)
      }
    } else {
      console.log(`Found session data using primary path: ${blobPath}`)
    }
    
    // Return the most recent logs (up to limit)
    const logs = redactObject(sessionData.requestLogs.slice(-limit).reverse())
    
    return {
      statusCode: 200,
      body: {
        success: true,
        sessionId,
        session: sessionData.session,
        logs,
        totalCount: sessionData.requestLogs.length
      }
    }
    
  } catch (error) {
    console.error('Error getting logs:', error)
    return {
      statusCode: 500,
      body: { error: 'Failed to get logs', details: error.message }
    }
  }
}

async function clearLogs(params) {
  try {
    const { sessionId } = params
    const userId = getUserIdentifier(params.__ow_headers || {})
    
    if (!sessionId) {
      return {
        statusCode: 400,
        body: { error: 'sessionId is required' }
      }
    }
    
    console.log(`Clearing logs for user: ${userId}, session: ${sessionId}`)
    
    // Load session data from Azure Blob Storage
    const blobServiceClient = getBlobServiceClient(params)
    const blobPath = getSessionBlobPath(userId, sessionId)
    
    const sessionData = await readJsonFromBlob(blobServiceClient, blobPath)
    
    if (!sessionData) {
      return {
        statusCode: 404,
        body: { error: 'Session not found' }
      }
    }
    
    // Clear the logs
    sessionData.requestLogs = []
    sessionData.session.requestCount = 0
    sessionData.session.lastActivity = new Date().toISOString()
    
    // Save back to Azure Blob Storage
    await writeJsonToBlob(blobServiceClient, blobPath, sessionData)
    
    return {
      statusCode: 200,
      body: {
        success: true,
        sessionId,
        message: 'Logs cleared successfully'
      }
    }
    
  } catch (error) {
    console.error('Error clearing logs:', error)
    return {
      statusCode: 500,
      body: { error: 'Failed to clear logs', details: error.message }
    }
  }
}

async function getWebhookLogs(params) {
  try {
    const { sessionId, limit = 100 } = params
    const userId = getUserIdentifier(params.__ow_headers || {})
    
    if (!sessionId) {
      return {
        statusCode: 400,
        body: { error: 'sessionId is required' }
      }
    }
    
    console.log(`Getting webhook logs for user: ${userId}, session: ${sessionId}`)
    
    // Load session data from Azure Blob Storage
    const blobServiceClient = getBlobServiceClient(params)
    const blobPath = getSessionBlobPath(userId, sessionId)
    
    console.log(`Looking for session data at blob path: ${blobPath}`)
    const sessionData = await readJsonFromBlob(blobServiceClient, blobPath)
    
    if (sessionData) {
      console.log(`Found session data. Webhook logs count: ${(sessionData.webhookLogs || []).length}`)
      console.log(`Session data structure:`, JSON.stringify({
        session: sessionData.session,
        requestLogsCount: (sessionData.requestLogs || []).length,
        webhookLogsCount: (sessionData.webhookLogs || []).length
      }, null, 2))
    } else {
      console.log('No session data found')
    }
    
    if (!sessionData) {
      return {
        statusCode: 404,
        body: { error: 'Session not found' }
      }
    }
    
    // Return the most recent webhook logs (up to limit)
    const webhooks = redactObject((sessionData.webhookLogs || []).slice(-limit).reverse())
    
    return {
      statusCode: 200,
      body: {
        success: true,
        sessionId,
        session: sessionData.session,
        webhooks,
        totalCount: (sessionData.webhookLogs || []).length
      }
    }
    
  } catch (error) {
    console.error('Error getting webhook logs:', error)
    return {
      statusCode: 500,
      body: { error: 'Failed to get webhook logs', details: error.message }
    }
  }
}

async function clearWebhookLogs(params) {
  try {
    const { sessionId } = params
    const userId = getUserIdentifier(params.__ow_headers || {})
    
    if (!sessionId) {
      return {
        statusCode: 400,
        body: { error: 'sessionId is required' }
      }
    }
    
    console.log(`Clearing webhook logs for user: ${userId}, session: ${sessionId}`)
    
    // Load session data from Azure Blob Storage
    const blobServiceClient = getBlobServiceClient(params)
    const blobPath = getSessionBlobPath(userId, sessionId)
    
    const sessionData = await readJsonFromBlob(blobServiceClient, blobPath)
    
    if (!sessionData) {
      return {
        statusCode: 404,
        body: { error: 'Session not found' }
      }
    }
    
    // Clear the webhook logs
    sessionData.webhookLogs = []
    sessionData.session.webhookCount = 0
    sessionData.session.lastActivity = new Date().toISOString()
    
    // Save back to Azure Blob Storage
    await writeJsonToBlob(blobServiceClient, blobPath, sessionData)
    
    return {
      statusCode: 200,
      body: {
        success: true,
        sessionId,
        message: 'Webhook logs cleared successfully'
      }
    }
    
  } catch (error) {
    console.error('Error clearing webhook logs:', error)
    return {
      statusCode: 500,
      body: { error: 'Failed to clear webhook logs', details: error.message }
    }
  }
}

function generateCurlCommand(method, url, headers, body) {
  let curl = `curl -X ${method.toUpperCase()}`
  
  // Add headers
  Object.entries(headers).forEach(([key, value]) => {
    if (key.toLowerCase() !== 'user-agent') {
      curl += ` -H "${key}: ${redactValue(value, key)}"`
    }
  })
  
  // Add body if present
  if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
    const safeBody = redactObject(body)
    const bodyStr = typeof safeBody === 'string' ? safeBody : JSON.stringify(safeBody)
    curl += ` -d '${bodyStr}'`
  }
  
  curl += ` "${url}"`
  
  return curl
}

async function createProxyConfig(params) {
  try {
    const { sessionId, name, targetUrl, pathPattern, method, headers, transformations } = params
    const userId = getUserIdentifier(params.__ow_headers || {})
    
    if (!sessionId || !name || !targetUrl) {
      return {
        statusCode: 400,
        body: { error: 'sessionId, name, and targetUrl are required' }
      }
    }
    
    console.log(`Creating proxy config for user: ${userId}, session: ${sessionId}`)
    
    // Load session data from Azure Blob Storage
    const blobServiceClient = getBlobServiceClient(params)
    const blobPath = getSessionBlobPath(userId, sessionId)
    
    let sessionData = await readJsonFromBlob(blobServiceClient, blobPath)
    
    if (!sessionData) {
      return {
        statusCode: 404,
        body: { error: 'Session not found' }
      }
    }
    
    // Initialize proxy configs if not exists
    sessionData.proxyConfigs = sessionData.proxyConfigs || []
    
    // Check if config name already exists
    const existingConfig = sessionData.proxyConfigs.find(config => config.name === name)
    if (existingConfig) {
      return {
        statusCode: 409,
        body: { error: 'Proxy configuration with this name already exists' }
      }
    }
    
    // Create new proxy configuration
    const proxyConfig = {
      id: uuidv4(),
      name,
      targetUrl,
      pathPattern: pathPattern || '/*',
      method: method || 'ALL',
      headers: headers || {},
      transformations: transformations || {},
      created: new Date().toISOString(),
      enabled: true,
      requestCount: 0
    }
    
    sessionData.proxyConfigs.push(proxyConfig)
    sessionData.session.lastActivity = new Date().toISOString()
    
    // Save back to Azure Blob Storage
    await writeJsonToBlob(blobServiceClient, blobPath, sessionData)
    
    return {
      statusCode: 200,
      body: {
        success: true,
        sessionId,
        proxyConfig,
        message: 'Proxy configuration created successfully'
      }
    }
    
  } catch (error) {
    console.error('Error creating proxy config:', error)
    return {
      statusCode: 500,
      body: { error: 'Failed to create proxy config', details: error.message }
    }
  }
}

async function getProxyConfigs(params) {
  try {
    const { sessionId } = params
    const userId = getUserIdentifier(params.__ow_headers || {})
    
    if (!sessionId) {
      return {
        statusCode: 400,
        body: { error: 'sessionId is required' }
      }
    }
    
    console.log(`Getting proxy configs for user: ${userId}, session: ${sessionId}`)
    
    // Load session data from Azure Blob Storage
    const blobServiceClient = getBlobServiceClient(params)
    const blobPath = getSessionBlobPath(userId, sessionId)
    
    const sessionData = await readJsonFromBlob(blobServiceClient, blobPath)
    
    if (!sessionData) {
      return {
        statusCode: 404,
        body: { error: 'Session not found' }
      }
    }
    
    return {
      statusCode: 200,
      body: {
        success: true,
        sessionId,
        proxyConfigs: sessionData.proxyConfigs || [],
        totalCount: (sessionData.proxyConfigs || []).length
      }
    }
    
  } catch (error) {
    console.error('Error getting proxy configs:', error)
    return {
      statusCode: 500,
      body: { error: 'Failed to get proxy configs', details: error.message }
    }
  }
}

async function updateProxyConfig(params) {
  try {
    const { sessionId, configId, name, targetUrl, pathPattern, method, headers, transformations, enabled } = params
    const userId = getUserIdentifier(params.__ow_headers || {})
    
    if (!sessionId || !configId) {
      return {
        statusCode: 400,
        body: { error: 'sessionId and configId are required' }
      }
    }
    
    console.log(`Updating proxy config for user: ${userId}, session: ${sessionId}, config: ${configId}`)
    
    // Load session data from Azure Blob Storage
    const blobServiceClient = getBlobServiceClient(params)
    const blobPath = getSessionBlobPath(userId, sessionId)
    
    let sessionData = await readJsonFromBlob(blobServiceClient, blobPath)
    
    if (!sessionData) {
      return {
        statusCode: 404,
        body: { error: 'Session not found' }
      }
    }
    
    // Find and update the proxy config
    const configIndex = sessionData.proxyConfigs?.findIndex(config => config.id === configId)
    if (configIndex === -1) {
      return {
        statusCode: 404,
        body: { error: 'Proxy configuration not found' }
      }
    }
    
    // Update the configuration
    const updatedConfig = {
      ...sessionData.proxyConfigs[configIndex],
      ...(name && { name }),
      ...(targetUrl && { targetUrl }),
      ...(pathPattern !== undefined && { pathPattern }),
      ...(method && { method }),
      ...(headers && { headers }),
      ...(transformations && { transformations }),
      ...(enabled !== undefined && { enabled }),
      updated: new Date().toISOString()
    }
    
    sessionData.proxyConfigs[configIndex] = updatedConfig
    sessionData.session.lastActivity = new Date().toISOString()
    
    // Save back to Azure Blob Storage
    await writeJsonToBlob(blobServiceClient, blobPath, sessionData)
    
    return {
      statusCode: 200,
      body: {
        success: true,
        sessionId,
        proxyConfig: updatedConfig,
        message: 'Proxy configuration updated successfully'
      }
    }
    
  } catch (error) {
    console.error('Error updating proxy config:', error)
    return {
      statusCode: 500,
      body: { error: 'Failed to update proxy config', details: error.message }
    }
  }
}

async function deleteProxyConfig(params) {
  try {
    const { sessionId, configId } = params
    const userId = getUserIdentifier(params.__ow_headers || {})
    
    if (!sessionId || !configId) {
      return {
        statusCode: 400,
        body: { error: 'sessionId and configId are required' }
      }
    }
    
    console.log(`Deleting proxy config for user: ${userId}, session: ${sessionId}, config: ${configId}`)
    
    // Load session data from Azure Blob Storage
    const blobServiceClient = getBlobServiceClient(params)
    const blobPath = getSessionBlobPath(userId, sessionId)
    
    let sessionData = await readJsonFromBlob(blobServiceClient, blobPath)
    
    if (!sessionData) {
      return {
        statusCode: 404,
        body: { error: 'Session not found' }
      }
    }
    
    // Find and remove the proxy config
    const configIndex = sessionData.proxyConfigs?.findIndex(config => config.id === configId)
    if (configIndex === -1) {
      return {
        statusCode: 404,
        body: { error: 'Proxy configuration not found' }
      }
    }
    
    const deletedConfig = sessionData.proxyConfigs.splice(configIndex, 1)[0]
    sessionData.session.lastActivity = new Date().toISOString()
    
    // Save back to Azure Blob Storage
    await writeJsonToBlob(blobServiceClient, blobPath, sessionData)
    
    return {
      statusCode: 200,
      body: {
        success: true,
        sessionId,
        deletedConfig,
        message: 'Proxy configuration deleted successfully'
      }
    }
    
  } catch (error) {
    console.error('Error deleting proxy config:', error)
    return {
      statusCode: 500,
      body: { error: 'Failed to delete proxy config', details: error.message }
    }
  }
}

async function getSession(params) {
  try {
    const { sessionId } = params
    const userId = getUserIdentifier(params.__ow_headers || {})
    
    if (!sessionId) {
      return {
        statusCode: 400,
        body: { error: 'sessionId is required' }
      }
    }
    
    console.log(`Getting session data for user: ${userId}, session: ${sessionId}`)
    
    // Load session data from Azure Blob Storage
    const blobServiceClient = getBlobServiceClient(params)
    const blobPath = getSessionBlobPath(userId, sessionId)
    
    const sessionData = await readJsonFromBlob(blobServiceClient, blobPath)
    
    if (!sessionData) {
      return {
        statusCode: 404,
        body: { error: 'Session not found' }
      }
    }
    
    console.log(`Found session data with ${(sessionData.proxyLogs || []).length} proxy logs`)
    
    return {
      statusCode: 200,
      body: {
        success: true,
        sessionId,
        sessionData: redactObject({
          session: sessionData.session,
          proxyConfigs: sessionData.proxyConfigs || [],
          proxyLogs: sessionData.proxyLogs || [],
          logs: sessionData.logs || [],
          webhookLogs: sessionData.webhookLogs || []
        })
      }
    }
    
  } catch (error) {
    console.error('Error getting session:', error)
    return {
      statusCode: 500,
      body: { error: 'Failed to get session', details: error.message }
    }
  }
}

exports.main = main 
