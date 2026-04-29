/*
* <license header>
*/

/**
 * API Monitor Action - Acts as a proxy to capture and log API requests/responses
 * Uses Azure Blob Storage for persistent data storage across sessions
 */

const axios = require('axios')
const { v4: uuidv4 } = require('uuid')
const {
  createBlobServiceClient,
  readJsonBlob
} = require('../shared/blobStore')
const {
  clearMonitorRequestEvents,
  clearWebhookEvents,
  createMonitorSessionData,
  findMonitorSession,
  getSessionBlobPath,
  listMonitorSessions,
  listMonitorRequestEvents,
  listWebhookEvents,
  updateMonitorSessionDescription,
  writeMonitorSession
} = require('../shared/apiMonitorStore')
const { readAccessPolicyDocument } = require('../shared/accessPolicyStore')
const {
  evaluateFeatureAccess,
  getRequestUserEmail
} = require('../shared/accessPolicy')
const { redactObject, redactValue, safeStringify } = require('../shared/redaction')

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

async function hasApiMonitorAccess(params, blobServiceClient) {
  const policyDocument = await readAccessPolicyDocument(blobServiceClient, {
    source: params
  })

  return evaluateFeatureAccess(policyDocument, 'apiMonitor', getRequestUserEmail(params), {
    source: params
  })
}

function sessionManagementForbidden() {
  return {
    statusCode: 403,
    body: {
      success: false,
      error: 'API Monitor access required'
    }
  }
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

      case 'listSessions':
        return await listSessions(params)

      case 'updateSessionDescription':
        return await updateSessionDescription(params)
      
      default:
        return {
          statusCode: 400,
          body: { error: 'Invalid action. Use: createSession, proxy, getLogs, clearLogs, getWebhookLogs, clearWebhookLogs, createProxyConfig, getProxyConfigs, updateProxyConfig, deleteProxyConfig, getSession, listSessions, or updateSessionDescription' }
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
    
    // Create versioned session data structure while preserving the existing blob path.
    const sessionData = createMonitorSessionData(sessionId, userId, timestamp)
    
    console.log('Session data structure created')
    
    // Store in Azure Blob Storage
    console.log('Getting blob service client...')
    const blobServiceClient = createBlobServiceClient(params)
    const blobPath = getSessionBlobPath(userId, sessionId)
    
    console.log('Writing to blob storage...')
    await writeMonitorSession(blobServiceClient, blobPath, sessionData)
    
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
    
    // Load session data from Azure Blob Storage using the shared session lookup rules.
    const blobServiceClient = createBlobServiceClient(params)
    const monitorSession = await findMonitorSession(blobServiceClient, sessionId, {
      params,
      userId
    })

    if (!monitorSession) {
      return {
        statusCode: 404,
        body: { error: 'Session not found. Please create a new session.' }
      }
    }

    const blobPath = monitorSession.blobPath
    let sessionData = monitorSession.sessionData
    
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
        const latestMonitorSession = await findMonitorSession(blobServiceClient, sessionId, {
          params,
          userId
        })
        const latestSessionData = latestMonitorSession && latestMonitorSession.blobPath === blobPath
          ? latestMonitorSession.sessionData
          : null
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
        
        await writeMonitorSession(blobServiceClient, blobPath, sessionData)
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
    
    const blobServiceClient = createBlobServiceClient(params)
    const monitorSession = await findMonitorSession(blobServiceClient, sessionId, {
      params,
      userId
    })

    if (!monitorSession) {
      return {
        statusCode: 404,
        body: {
          error: 'Session not found',
          sessionId,
          userId
        }
      }
    }
    
    const { events: logs, totalCount } = listMonitorRequestEvents(monitorSession.sessionData, { limit })
    
    return {
      statusCode: 200,
      body: {
        success: true,
        sessionId,
        session: monitorSession.sessionData.session,
        logs,
        totalCount
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
    
    const blobServiceClient = createBlobServiceClient(params)
    const monitorSession = await findMonitorSession(blobServiceClient, sessionId, {
      params,
      userId
    })
    
    if (!monitorSession) {
      return {
        statusCode: 404,
        body: { error: 'Session not found' }
      }
    }
    
    await clearMonitorRequestEvents(blobServiceClient, monitorSession)
    
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
    
    const blobServiceClient = createBlobServiceClient(params)
    const monitorSession = await findMonitorSession(blobServiceClient, sessionId, {
      params,
      userId
    })
    
    if (!monitorSession) {
      return {
        statusCode: 404,
        body: { error: 'Session not found' }
      }
    }
    
    const { events: webhooks, totalCount } = await listWebhookEvents(blobServiceClient, sessionId, {
      sessionData: monitorSession.sessionData,
      limit
    })
    const session = {
      ...monitorSession.sessionData.session,
      webhookCount: totalCount
    }
    
    return {
      statusCode: 200,
      body: {
        success: true,
        sessionId,
        session,
        webhooks,
        totalCount
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
    
    const blobServiceClient = createBlobServiceClient(params)
    const monitorSession = await findMonitorSession(blobServiceClient, sessionId, {
      params,
      userId
    })
    
    if (!monitorSession) {
      return {
        statusCode: 404,
        body: { error: 'Session not found' }
      }
    }
    
    await clearWebhookEvents(blobServiceClient, monitorSession)
    
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
    const blobServiceClient = createBlobServiceClient(params)
    const blobPath = getSessionBlobPath(userId, sessionId)
    
    let sessionData = await readJsonBlob(blobServiceClient, blobPath)
    
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
    await writeMonitorSession(blobServiceClient, blobPath, sessionData)
    
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
    const blobServiceClient = createBlobServiceClient(params)
    const blobPath = getSessionBlobPath(userId, sessionId)
    
    const sessionData = await readJsonBlob(blobServiceClient, blobPath)
    
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
    const blobServiceClient = createBlobServiceClient(params)
    const blobPath = getSessionBlobPath(userId, sessionId)
    
    let sessionData = await readJsonBlob(blobServiceClient, blobPath)
    
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
    await writeMonitorSession(blobServiceClient, blobPath, sessionData)
    
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
    const blobServiceClient = createBlobServiceClient(params)
    const blobPath = getSessionBlobPath(userId, sessionId)
    
    let sessionData = await readJsonBlob(blobServiceClient, blobPath)
    
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
    await writeMonitorSession(blobServiceClient, blobPath, sessionData)
    
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

async function listSessions(params) {
  try {
    const blobServiceClient = createBlobServiceClient(params)

    if (!await hasApiMonitorAccess(params, blobServiceClient)) {
      return sessionManagementForbidden()
    }

    const currentUserId = getUserIdentifier(params.__ow_headers || {})
    const userId = params.userIdentifier || params.userId || currentUserId
    const result = await listMonitorSessions(blobServiceClient, userId, {
      limit: params.limit || 100
    })

    return {
      statusCode: 200,
      body: {
        success: true,
        userIdentifier: result.userId,
        currentUserIdentifier: currentUserId,
        sessions: result.sessions,
        totalCount: result.totalCount
      }
    }
  } catch (error) {
    console.error('Error listing API Monitor sessions:', error)
    return {
      statusCode: 500,
      body: {
        success: false,
        error: 'Failed to list sessions',
        details: error.message
      }
    }
  }
}

async function updateSessionDescription(params) {
  try {
    const { sessionId } = params
    const blobServiceClient = createBlobServiceClient(params)

    if (!await hasApiMonitorAccess(params, blobServiceClient)) {
      return sessionManagementForbidden()
    }

    if (!sessionId) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: 'sessionId is required'
        }
      }
    }

    const userId = params.userIdentifier || params.userId || getUserIdentifier(params.__ow_headers || {})
    const session = await updateMonitorSessionDescription(blobServiceClient, userId, sessionId, params.description || '')

    if (!session) {
      return {
        statusCode: 404,
        body: {
          success: false,
          error: 'Session not found'
        }
      }
    }

    return {
      statusCode: 200,
      body: {
        success: true,
        userIdentifier: userId,
        session
      }
    }
  } catch (error) {
    console.error('Error updating API Monitor session description:', error)
    return {
      statusCode: 500,
      body: {
        success: false,
        error: 'Failed to update session description',
        details: error.message
      }
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
    const blobServiceClient = createBlobServiceClient(params)
    const blobPath = getSessionBlobPath(userId, sessionId)
    
    const sessionData = await readJsonBlob(blobServiceClient, blobPath)
    
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
