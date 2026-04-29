const { BlobServiceClient } = require('@azure/storage-blob')
const axios = require('axios')
const { v4: uuidv4 } = require('uuid')
const https = require('https')
const { redactObject, safeStringify } = require('../shared/redaction')

async function main(params) {
  try {
    console.log('API Proxy action called with params:', safeStringify(params))
    
    // Extract request details
    const method = params.__ow_method || 'get'
    const path = params.__ow_path || '/'
    const headers = params.__ow_headers || {}
    const body = params.__ow_body || null
    const query = params.__ow_query || {}
    
    console.log('Available headers:', Object.keys(headers))
    console.log('Raw user ID from headers:', headers['x-ims-user-id'])
    console.log('Sanitized user ID:', getUserIdentifier(headers))
    console.log('Query parameters:', safeStringify(query))
    console.log('All params keys:', Object.keys(params))
    
    // Check for bearer token authentication (except for debug endpoint and proxy requests with sessionId)
    const isDebugEndpoint = path === '/debug'
    const hasSessionId = query.sessionId || params.sessionId
    const isProxyRequest = hasSessionId && path === '/'
    
    console.log(`=== AUTHENTICATION CHECK ===`)
    console.log(`Path: ${path}`)
    console.log(`Has sessionId: ${hasSessionId}`)
    console.log(`Is debug endpoint: ${isDebugEndpoint}`)
    console.log(`Is proxy request: ${isProxyRequest}`)
    
    if (!isDebugEndpoint && !isProxyRequest) {
      const authHeader = headers['authorization'] || headers['Authorization']
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return {
          statusCode: 401,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            error: 'Bearer token required',
            message: 'Please provide a valid Bearer token in the Authorization header'
          })
        }
      }
      
      // Validate that we have the required Adobe I/O headers
      if (!headers['x-ims-user-id'] || !headers['x-gw-ims-org-id']) {
        return {
          statusCode: 401,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            error: 'Adobe I/O authentication required',
            message: 'Please provide valid Adobe I/O authentication headers (x-ims-user-id, x-gw-ims-org-id)'
          })
        }
      }
    }
    
    // Robust sessionId extraction from multiple sources
    const extractSessionId = () => {
      // Try query parameters first
      if (query && query.sessionId) {
        console.log('Found sessionId in query:', query.sessionId)
        return query.sessionId
      }
      
      // Try direct params
      if (params.sessionId) {
        console.log('Found sessionId in params:', params.sessionId)
        return params.sessionId
      }
      
      // Try headers
      if (headers['x-session-id']) {
        console.log('Found sessionId in x-session-id header:', headers['x-session-id'])
        return headers['x-session-id']
      }
      
      if (headers['X-Session-Id']) {
        console.log('Found sessionId in X-Session-Id header:', headers['X-Session-Id'])
        return headers['X-Session-Id']
      }
      
      console.log('No sessionId found in any location')
      return null
    }
    
    // Debug endpoint to show session data
    if (path === '/debug' && method.toLowerCase() === 'get') {
      const userId = getUserIdentifier(headers)
      const sessionId = extractSessionId()
      
      if (!sessionId) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            error: 'sessionId parameter required for debug endpoint',
            debug: {
              query: query,
              params: Object.keys(params),
              headers: Object.keys(headers)
            }
          })
        }
      }
      
      console.log(`=== DEBUG ENDPOINT ===`)
      console.log(`User ID: ${userId}`)
      console.log(`Session ID: ${sessionId}`)
      
      const blobServiceClient = getBlobServiceClient(params)
      const blobPath = getSessionBlobPath(userId)
      
      try {
        const sessionData = await readJsonFromBlob(blobServiceClient, blobPath)
        
        const debugInfo = {
          userId,
          sessionId,
          blobPath,
          sessionDataExists: !!sessionData,
          sessionData: redactObject(sessionData),
          proxyConfigs: redactObject(sessionData?.features?.apiProxy?.proxyConfigs || []),
          sessions: sessionData?.features?.apiProxy?.sessions || [],
          matchingConfigs: []
        }
        
        // Find configs for this session
        if (sessionData?.features?.apiProxy?.proxyConfigs) {
          debugInfo.matchingConfigs = sessionData.features.apiProxy.proxyConfigs.filter(
            config => config.sessionId === sessionId
          )
        }
        
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: safeStringify(debugInfo)
        }
      } catch (error) {
        return {
          statusCode: 500,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Failed to load debug info', details: error.message })
        }
      }
    }
    
    // Copy config to anonymous format endpoint
    if (path === '/copy-to-anonymous' && method.toLowerCase() === 'post') {
      const userId = getUserIdentifier(headers)
      const sessionId = extractSessionId()
      
      if (!sessionId) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'sessionId parameter required' })
        }
      }
      
      try {
        const blobServiceClient = getBlobServiceClient(params)
        const blobPath = getSessionBlobPath(userId)
        const sessionData = await readJsonFromBlob(blobServiceClient, blobPath)
        
        if (!sessionData?.features?.apiProxy?.proxyConfigs) {
          return {
            statusCode: 404,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'No configurations found for this session' })
          }
        }
        
        const config = sessionData.features.apiProxy.proxyConfigs.find(c => c.sessionId === sessionId)
        if (!config) {
          return {
            statusCode: 404,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'No configuration found for this session' })
          }
        }
        
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            success: true, 
            message: 'Configuration copied to anonymous format',
            config: redactObject(config)
          })
        }
      } catch (error) {
        return {
          statusCode: 500,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Failed to copy configuration', details: error.message })
        }
      }
    }
    
    // Handle different endpoints
    if (path === '/sessions' && method.toLowerCase() === 'get') {
      return await listSessions(params)
    }
    
    if (path === '/sessions' && method.toLowerCase() === 'post') {
      return await createSession(params, body)
    }
    
    if (path === '/config' && method.toLowerCase() === 'post') {
      console.log('=== SAVE PROXY CONFIG REQUEST ===')
      console.log('Raw body:', safeStringify(body))
      console.log('Body type:', typeof body)
      console.log('Headers:', safeStringify(headers))
      console.log('Content-Type:', headers['content-type'] || headers['Content-Type'])
      console.log('__ow_body:', safeStringify(params.__ow_body))
      
      // Try to get the config data from multiple sources
      let configData = null
      
      // First try the body parameter
      if (body && typeof body === 'object') {
        configData = body
        console.log('Using body object:', safeStringify(configData))
      } else if (body && typeof body === 'string') {
        try {
          configData = JSON.parse(body)
          console.log('Parsed JSON body:', safeStringify(configData))
        } catch (e) {
          console.error('JSON parse error from body:', e)
        }
      }
      
      // If body didn't work, try __ow_body
      if (!configData && params.__ow_body) {
        if (typeof params.__ow_body === 'object') {
          configData = params.__ow_body
          console.log('Using __ow_body object:', safeStringify(configData))
        } else if (typeof params.__ow_body === 'string') {
          try {
            configData = JSON.parse(params.__ow_body)
            console.log('Parsed JSON __ow_body:', safeStringify(configData))
          } catch (e) {
            console.error('JSON parse error from __ow_body:', e)
          }
        }
      }
      
      // If still no config data, try direct params
      if (!configData) {
        // Check if the config data is directly in params
        const configKeys = ['sessionId', 'name', 'targetUrl', 'pathPattern', 'method', 'headers', 'transformations', 'enabled']
        const hasConfigData = configKeys.some(key => params[key] !== undefined)
        if (hasConfigData) {
          configData = {}
          configKeys.forEach(key => {
            if (params[key] !== undefined) {
              configData[key] = params[key]
            }
          })
          console.log('Using direct params as config data:', safeStringify(configData))
        }
      }
      
      if (!configData) {
        console.error('No config data found in any source')
        console.log('Available params keys:', Object.keys(params))
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            error: 'Request body is required',
            debug: {
              body: body,
              bodyType: typeof body,
              owBody: params.__ow_body,
              owBodyType: typeof params.__ow_body,
              availableParams: Object.keys(params)
            }
          })
        }
      }
      
      console.log('Final config data:', safeStringify(configData))
      return await saveProxyConfig(params, configData)
    }
    
    if (path === '/config' && method.toLowerCase() === 'delete') {
      const sessionId = extractSessionId()
      if (!sessionId) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            error: 'sessionId parameter required',
            debug: {
              query: query,
              params: Object.keys(params),
              headers: Object.keys(headers)
            }
          })
        }
      }
      return await deleteProxyConfig(params, sessionId)
    }
    
    if (path === '/config' && method.toLowerCase() === 'get') {
      const sessionId = extractSessionId()
      if (!sessionId) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            error: 'sessionId parameter required',
            debug: {
              query: query,
              params: Object.keys(params),
              headers: Object.keys(headers)
            }
          })
        }
      }
      return await getProxyConfig(params, sessionId)
    }
    
    if (path === '/logs' && method.toLowerCase() === 'get') {
      const sessionId = extractSessionId()
      if (!sessionId) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            error: 'sessionId parameter required',
            debug: {
              query: query,
              params: Object.keys(params),
              headers: Object.keys(headers)
            }
          })
        }
      }
      return await listProxyLogs(params, sessionId)
    }
    
    if (path === '/logs' && method.toLowerCase() === 'delete') {
      const sessionId = extractSessionId()
      if (!sessionId) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            error: 'sessionId parameter required',
            debug: {
              query: query,
              params: Object.keys(params),
              headers: Object.keys(headers)
            }
          })
        }
      }
      return await clearProxyLogs(params, sessionId)
    }
    
    if (path === '/stats' && method.toLowerCase() === 'get') {
      const sessionId = extractSessionId()
      if (!sessionId) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            error: 'sessionId parameter required',
            debug: {
              query: query,
              params: Object.keys(params),
              headers: Object.keys(headers)
            }
          })
        }
      }
      return await getSessionStats(params, sessionId)
    }
    
    if (path === '/migrate' && method.toLowerCase() === 'post') {
      return await migrateConfigsToSessions(params)
    }
    
    // Handle proxy requests
    const sessionId = extractSessionId()
    if (!sessionId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'sessionId parameter required for proxy requests',
          debug: {
            query: query,
            params: Object.keys(params),
            headers: Object.keys(headers)
          }
        })
      }
    }
    
    // Find matching proxy configuration (authenticated or anonymous)
    const userId = getUserIdentifier(headers)
    if (userId) {
      console.log('Authenticated user - checking user-specific session storage')
    } else {
      console.log('Anonymous user - checking anonymous session storage')
    }
    
    const proxyConfig = await findMatchingProxyConfig(params, sessionId, path, method)
    
    if (!proxyConfig) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No matching proxy configuration found' })
      }
    }
    
    // Forward the request
    const request = { method, path, headers, body, query }
    return await forwardRequest(params, sessionId, proxyConfig, request)
    
  } catch (error) {
    console.error('Error in API proxy:', error)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal proxy error', details: error.message })
    }
  }
}

async function findMatchingProxyConfig(params, sessionId, path, method) {
  try {
    const userId = getUserIdentifier(params.__ow_headers || {})
    const isProxyRequest = path === '/' || path === ''
    
    console.log(`=== FINDING MATCHING PROXY CONFIG ===`)
    console.log(`User ID: ${userId}`)
    console.log(`Session ID: ${sessionId}`)
    console.log(`Path: ${path}`)
    console.log(`Method: ${method}`)
    console.log(`Is proxy request: ${isProxyRequest}`)
    
    const blobServiceClient = getBlobServiceClient(params)
    
    if (isProxyRequest) {
      // PROXY REQUEST: Only check session-level storage
      console.log('Proxy request - checking session-level storage only...')
      const sessionBlobPath = getSessionLevelBlobPath(sessionId)
      const sessionLevelData = await readJsonFromBlob(blobServiceClient, sessionBlobPath)
      
      if (sessionLevelData && sessionLevelData.config && sessionLevelData.config.enabled) {
        const config = sessionLevelData.config
        console.log(`Found config in session-level storage: ${config.name}`)
        console.log(`  - Method: ${config.method} vs ${method}`)
        console.log(`  - Path pattern: ${config.pathPattern} vs ${path}`)
        
        if (matchesProxyConfig(config, path, method)) {
          console.log(`Found matching proxy config from session-level storage: ${config.name} (ID: ${config.id})`)
          return config
        } else {
          console.log(`Session-level config ${config.name} does not match`)
        }
      }
      
      console.log('No matching proxy configuration found in session-level storage')
      return null
      
    } else {
      // UI REQUEST: Check user-level storage
      if (!userId) {
        console.log('No user ID for UI request')
        return null
      }
      
      console.log('UI request - checking user-level storage...')
      const userBlobPath = getSessionBlobPath(userId)
      const userSessionData = await readJsonFromBlob(blobServiceClient, userBlobPath)
      
      if (userSessionData && userSessionData.features && userSessionData.features.apiProxy) {
        const proxyConfigs = userSessionData.features.apiProxy.proxyConfigs || []
        const sessionConfigs = proxyConfigs.filter(config => {
          console.log(`Checking user config ${config.id}: sessionId=${config.sessionId}, enabled=${config.enabled}`)
          return config.sessionId === sessionId && config.enabled
        })
        
        console.log(`Total configs for user: ${proxyConfigs.length}`)
        console.log(`Configs for session ${sessionId}: ${sessionConfigs.length}`)
        
        for (const config of sessionConfigs) {
          console.log(`Testing user config: ${config.name}`)
          console.log(`  - Method: ${config.method} vs ${method}`)
          console.log(`  - Path pattern: ${config.pathPattern} vs ${path}`)
          if (matchesProxyConfig(config, path, method)) {
            console.log(`Found matching proxy config from user-level storage: ${config.name} (ID: ${config.id})`)
            return config
          } else {
            console.log(`User config ${config.name} does not match`)
          }
        }
      }
      
      console.log('No matching proxy configuration found in user-level storage')
      return null
    }
    
  } catch (error) {
    console.error('Error finding proxy config:', error)
    return null
  }
}

function matchesProxyConfig(config, path, method) {
  console.log(`=== MATCHING PROXY CONFIG ===`)
  console.log(`Config: ${config.name}`)
  console.log(`Config method: ${config.method}, Request method: ${method}`)
  console.log(`Config path pattern: ${config.pathPattern}, Request path: ${path}`)
  
  // Check method match
  if (config.method !== 'ALL' && config.method !== method) {
    console.log(`Method mismatch: ${config.method} !== ${method}`)
    return false
  }
  console.log(`Method matches: ${config.method}`)
  
  // Check path pattern match
  const pattern = config.pathPattern || '/*'
  console.log(`Using pattern: ${pattern}`)
  
  // Simple wildcard matching
  if (pattern === '/*') {
    console.log(`Pattern is wildcard '/*' - matches everything`)
    return true
  }
  
  // Exact match
  if (pattern === path) {
    console.log(`Exact path match: ${pattern} === ${path}`)
    return true
  }
  
  // Wildcard at end
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1)
    const matches = path.startsWith(prefix)
    console.log(`Wildcard at end: ${pattern} -> prefix: ${prefix}, matches: ${matches}`)
    return matches
  }
  
  // Wildcard at start
  if (pattern.startsWith('*')) {
    const suffix = pattern.slice(1)
    const matches = path.endsWith(suffix)
    console.log(`Wildcard at start: ${pattern} -> suffix: ${suffix}, matches: ${matches}`)
    return matches
  }
  
  console.log(`No pattern match found`)
  return false
}

async function forwardRequest(params, sessionId, proxyConfig, request) {
  const startTime = Date.now()
  let targetUrl = 'unknown' // Initialize to avoid undefined errors
  
  try {
    // Build target URL
    targetUrl = buildTargetUrl(proxyConfig.targetUrl, request.path, proxyConfig.pathPattern)
    console.log(`Forwarding to: ${targetUrl}`)
    
    // Check if this is a runtime action URL
    const isRuntimeAction = targetUrl.includes('adobeio-static.net/api/v1/web/')
    
    console.log(`Is Runtime Action: ${isRuntimeAction}`)
    
    // For runtime actions, we'll return a special response indicating this isn't supported
    // due to CloudFront restrictions and authentication issues
    if (isRuntimeAction) {
      console.log('Runtime-to-runtime calls are not supported due to CloudFront restrictions')
      
      // Log the attempt
      await logProxyRequest(params, sessionId, proxyConfig, {
        originalRequest: request,
        targetUrl,
        error: 'Runtime-to-runtime calls not supported',
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      })
      
      return {
        statusCode: 501,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Runtime-to-runtime calls not supported',
          message: 'The proxy cannot forward requests to other Adobe I/O Runtime actions due to CloudFront restrictions and authentication requirements.',
          suggestion: 'Use this proxy for external APIs only. For runtime-to-runtime communication, call actions directly from your client application.',
          config: proxyConfig.name,
          targetUrl: targetUrl
        })
      }
    }
    
    // Prepare headers for external HTTP calls
    const forwardHeaders = prepareHeaders(request.headers, proxyConfig.headers)
    
    // Transform request body if needed
    const transformedBody = transformRequestBody(request.body, proxyConfig.transformations)
    
        // Create HTTPS agent for runtime-to-runtime calls with aggressive SSL options
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false, // Allow self-signed certificates
      keepAlive: true,
      timeout: 30000,
      secureProtocol: 'TLSv1_2_method', // Force TLS 1.2
      ciphers: 'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384',
      honorCipherOrder: true,
      checkServerIdentity: () => undefined // Disable server identity check
    })

    console.log(`=== PROXY DEBUG ===`)
    console.log(`Target URL: ${targetUrl}`)
    console.log(`Method: ${request.method}`)
    console.log(`Headers:`, safeStringify(forwardHeaders))
    console.log(`Original Body:`, safeStringify(request.body))
    console.log(`Transformed Body:`, safeStringify(transformedBody))
    console.log(`Body type:`, typeof transformedBody)
    console.log(`Body length: ${transformedBody ? (typeof transformedBody === 'string' ? transformedBody.length : JSON.stringify(transformedBody).length) : 0}`)
    console.log(`Is Runtime Action: ${isRuntimeAction}`)

    // Configure axios request with enhanced SSL options
    const axiosConfig = {
      method: request.method.toLowerCase(),
      url: targetUrl,
      headers: forwardHeaders,
      timeout: 30000,
      httpsAgent: targetUrl.startsWith('https://') ? httpsAgent : undefined,
      validateStatus: () => true, // Don't throw on any status code
      maxRedirects: 5,
      // Additional SSL options for axios
      rejectUnauthorized: false,
      insecureHTTPParser: true
    }

    // Add body for methods that support it (not just POST, PUT, PATCH)
    if (transformedBody !== null && transformedBody !== undefined && request.method.toLowerCase() !== 'get') {
      // Handle different body types
      if (typeof transformedBody === 'string') {
        axiosConfig.data = transformedBody
      } else if (typeof transformedBody === 'object') {
        axiosConfig.data = JSON.stringify(transformedBody)
        // Ensure content-type is set for JSON
        if (!forwardHeaders['content-type'] && !forwardHeaders['Content-Type']) {
          axiosConfig.headers['Content-Type'] = 'application/json'
        }
      } else {
        axiosConfig.data = transformedBody
      }
      console.log(`Added body to axios config:`, typeof axiosConfig.data, axiosConfig.data ? axiosConfig.data.length || 'object' : 'empty')
    } else {
      console.log(`No body added - transformedBody:`, safeStringify(transformedBody), `method:`, request.method)
    }

    // Make the forwarded request
    console.log(`Making axios request to: ${targetUrl}`)
    const response = await axios(axiosConfig)
    
    console.log(`Response received - Status: ${response.status}`)
    console.log(`Response headers:`, safeStringify(response.headers))
    
    const responseBody = typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
    const endTime = Date.now()
    const responseTime = endTime - startTime
    
    console.log(`Request completed in ${responseTime}ms`)
    
        // Log the proxy request
    await logProxyRequest(params, sessionId, proxyConfig, {
      originalRequest: request,
      targetUrl,
      forwardHeaders,
      transformedBody,
      response: {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        body: responseBody
      },
      responseTime,
      timestamp: new Date().toISOString()
    })

    // Return the response
    return {
      statusCode: response.status,
      headers: {
        'Content-Type': response.headers['content-type'] || 'application/json',
        'X-Proxy-Config': proxyConfig.name,
        'X-Response-Time': `${responseTime}ms`
      },
      body: responseBody
    }
    
  } catch (error) {
    const endTime = Date.now()
    const responseTime = endTime - startTime
    
    console.error('=== PROXY ERROR ===')
    console.error('Error type:', error.constructor.name)
    console.error('Error message:', error.message)
    console.error('Error code:', error.code)
    console.error('Error stack:', error.stack)
    
    // Check if it's an axios error
    if (error.response) {
      console.error('Axios response error - Status:', error.response.status)
      console.error('Axios response headers:', safeStringify(error.response.headers))
      console.error('Axios response data:', safeStringify(error.response.data))
    } else if (error.request) {
      console.error('Axios request error - No response received')
      console.error('Request config:', safeStringify(error.config))
    }
    
    // Log the failed proxy request
    await logProxyRequest(params, sessionId, proxyConfig, {
      originalRequest: request,
      targetUrl: targetUrl,
      error: `${error.constructor.name}: ${error.message}`,
      responseTime,
      timestamp: new Date().toISOString()
    })
    
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Proxy forwarding failed (axios)', 
        details: `${error.constructor.name}: ${error.message}`,
        config: proxyConfig.name,
        targetUrl: targetUrl,
        errorCode: error.code
      })
    }
  }
}

function buildTargetUrl(baseUrl, requestPath, pathPattern) {
  console.log(`=== BUILD TARGET URL ===`)
  console.log(`Base URL: ${baseUrl}`)
  console.log(`Request Path: ${requestPath}`)
  console.log(`Path Pattern: ${pathPattern}`)
  
  // Remove trailing slash from base URL
  const cleanBaseUrl = baseUrl.replace(/\/$/, '')
  
  // If pattern is /* or exact match, append the full path
  if (pathPattern === '/*') {
    const result = `${cleanBaseUrl}${requestPath}`
    console.log(`Pattern /* - Result: ${result}`)
    return result
  }
  
  // If pattern has wildcard, replace the matched portion
  if (pathPattern.endsWith('*')) {
    const prefix = pathPattern.slice(0, -1)
    if (requestPath.startsWith(prefix)) {
      const remainingPath = requestPath.slice(prefix.length)
      return `${cleanBaseUrl}${remainingPath}`
    }
  }
  
  // Default: append full path
  return `${cleanBaseUrl}${requestPath}`
}

function prepareHeaders(originalHeaders, configHeaders) {
  const headers = { ...originalHeaders }
  
  // Remove Adobe I/O Runtime specific headers
  delete headers['x-forwarded-for']
  delete headers['x-forwarded-proto']
  delete headers['x-forwarded-host']
  delete headers['x-real-ip']
  delete headers['x-session-id']
  
  // Add configured headers
  Object.assign(headers, configHeaders || {})
  
  // Ensure content-type is preserved
  if (!headers['content-type'] && originalHeaders['content-type']) {
    headers['content-type'] = originalHeaders['content-type']
  }
  
  return headers
}

function transformRequestBody(body, transformations) {
  if (!body || !transformations) {
    return body
  }
  
  try {
    // If body is JSON and we have transformations
    if (transformations.jsonTransform && typeof body === 'string') {
      const jsonBody = JSON.parse(body)
      
      // Apply simple field transformations
      if (transformations.fieldMappings) {
        const transformed = {}
        for (const [sourceField, targetField] of Object.entries(transformations.fieldMappings)) {
          if (jsonBody[sourceField] !== undefined) {
            transformed[targetField] = jsonBody[sourceField]
          }
        }
        return JSON.stringify(transformed)
      }
    }
    
    return body
  } catch (error) {
    console.error('Error transforming request body:', error)
    return body
  }
}

async function logProxyRequest(params, sessionId, proxyConfig, logData) {
  try {
    const userId = getUserIdentifier(params.__ow_headers || {})
    const blobServiceClient = getBlobServiceClient(params)
    
    // Use session-level blob path for logs
    const sessionBlobPath = getSessionLevelBlobPath(sessionId)
    
    // Read current session data
    let sessionData = await readJsonFromBlob(blobServiceClient, sessionBlobPath)
    if (!sessionData) {
      sessionData = {
        sessionId: sessionId,
        userId: userId,
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        proxyConfig: proxyConfig,
        requestLogs: []
      }
    }
    
    // Ensure requestLogs array exists
    if (!Array.isArray(sessionData.requestLogs)) {
      sessionData.requestLogs = []
    }
    
    // Create comprehensive log entry with complete request/response data
    const logEntry = {
      id: uuidv4(),
      timestamp: logData.timestamp || new Date().toISOString(),
      configId: proxyConfig.id,
      configName: proxyConfig.name,
      
      // Original request details
      originalRequest: {
        method: logData.originalRequest.method,
        path: logData.originalRequest.path,
        query: redactObject(logData.originalRequest.query || {}),
        headers: redactObject(logData.originalRequest.headers || {}),
        body: redactObject(logData.originalRequest.body),
        bodySize: logData.originalRequest.body ? JSON.stringify(logData.originalRequest.body).length : 0
      },
      
      // Target request details
      targetRequest: {
        url: logData.targetUrl,
        method: logData.originalRequest.method,
        headers: redactObject(logData.forwardHeaders || {}),
        body: redactObject(logData.transformedBody),
        bodySize: logData.transformedBody ? JSON.stringify(logData.transformedBody).length : 0
      },
      
      // Response details
      response: {
        status: logData.response?.status || 0,
        statusText: logData.response?.statusText || 'ERROR',
        headers: redactObject(logData.response?.headers || {}),
        body: redactObject(logData.response?.body),
        bodySize: logData.response?.body ? JSON.stringify(logData.response?.body).length : 0
      },
      
      // Performance metrics
      responseTime: logData.responseTime || 0,
      error: logData.error || null,
      
      // Additional metadata
      userAgent: logData.originalRequest.headers?.['user-agent'] || 'Unknown',
      clientIP: logData.originalRequest.headers?.['x-forwarded-for'] || 
                logData.originalRequest.headers?.['x-real-ip'] || 'Unknown',
      requestId: logData.requestId || uuidv4()
    }
    
    // Add to beginning of logs array (most recent first)
    sessionData.requestLogs.unshift(logEntry)
    
    // Keep only last 1000 logs to prevent storage bloat
    if (sessionData.requestLogs.length > 1000) {
      sessionData.requestLogs = sessionData.requestLogs.slice(0, 1000)
    }
    
    // Update session metadata
    sessionData.lastModified = new Date().toISOString()
    sessionData.totalRequests = sessionData.requestLogs.length
    sessionData.lastRequestTime = logEntry.timestamp
    
    // Save session data
    await writeJsonToBlob(blobServiceClient, sessionBlobPath, sessionData)
    
    console.log(`Logged proxy request for config: ${proxyConfig.name}, session: ${sessionId}`)
    
  } catch (error) {
    console.error('Error logging proxy request:', error)
    // Don't throw error to avoid breaking the main request flow
  }
}

// Utility functions (shared with api-monitor)
function getUserIdentifier(headers) {
  // Try multiple sources for user identification, prioritizing IMS user ID
  const userId = headers['x-ims-user-id'] || 
                 headers['x-gw-ims-user-id'] || 
                 headers['user-id'] ||
                 headers['ims-user-id'] ||
                 headers['x-user-id'] ||
                 headers['x-gw-ims-org-id'] ||
                 process.env.AEP_ORG_ID ||
                 'default_user'
  
  if (!userId) {
    throw new Error('User identifier not found in request headers')
  }
  
  // Log the user ID for debugging
  console.log('Raw user ID from headers:', userId)
  console.log('Available headers:', Object.keys(headers))
  
  // Sanitize for blob naming but preserve the IMS org part
  const parts = userId.split('@')
  const sanitizedId = parts[0].replace(/[^a-zA-Z0-9-]/g, '')
  const result = parts.length > 1 ? `${sanitizedId}@${parts[1]}` : sanitizedId
  
  console.log('Sanitized user ID:', result)
  return result
}

function getBlobServiceClient(params) {
  const blobUrl = params.AZURE_BLOB_URL
  const sasToken = params.AZURE_SAS_TOKEN
  if (!blobUrl || !sasToken) {
    throw new Error('AZURE_BLOB_URL and AZURE_SAS_TOKEN are required')
  }
  const containerUrl = `${blobUrl}${sasToken}`
  return new BlobServiceClient(containerUrl)
}

function getSessionBlobPath(userId) {
  return `users/${userId}/sessions.json`
}

function getSessionLevelBlobPath(sessionId) {
  return `sessions/${sessionId}/config.json`
}

async function readJsonFromBlob(blobServiceClient, blobPath) {
  try {
    const containerClient = blobServiceClient.getContainerClient('demos')
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath)
    
    if (!(await blockBlobClient.exists())) {
      return null // Session doesn't exist yet
    }
    
    const downloadResponse = await blockBlobClient.download()
    const streamBody = downloadResponse.readableStreamBody || downloadResponse._response.readableStreamBody
    const downloaded = await streamToString(streamBody)
    return JSON.parse(downloaded)
  } catch (error) {
    console.error('Error reading session from blob:', error)
    if (error.statusCode === 404) {
      return null // Blob doesn't exist
    }
    return null
  }
}

async function writeJsonToBlob(blobServiceClient, blobPath, data) {
  try {
    const containerClient = blobServiceClient.getContainerClient('demos')
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath)
    
    const content = JSON.stringify(data, null, 2)
    await blockBlobClient.upload(content, content.length, {
      blobHTTPHeaders: {
        blobContentType: 'application/json'
      },
      metadata: {
        lastModified: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Error writing session to blob:', error)
    throw error
  }
}

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

// Add new function to list sessions
async function listSessions(params) {
  try {
    const userId = getUserIdentifier(params.__ow_headers || {})
    const blobServiceClient = getBlobServiceClient(params)
    const blobPath = getSessionBlobPath(userId)
    
    const sessionData = await readJsonFromBlob(blobServiceClient, blobPath)
    let sessions = []
    if (sessionData && sessionData.features && sessionData.features.apiProxy && Array.isArray(sessionData.features.apiProxy.sessions)) {
      sessions = sessionData.features.apiProxy.sessions
    }
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, sessions })
    }
  } catch (error) {
    console.error('Error listing sessions:', error)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Failed to list sessions', details: error.message })
    }
  }
}

async function saveProxyConfig(params, config) {
  try {
    const userId = getUserIdentifier(params.__ow_headers || {})
    
    // Validate config parameter
    if (!config) {
      throw new Error('Config parameter is required')
    }
    
    const sessionId = config.sessionId || params.sessionId
    const blobServiceClient = getBlobServiceClient(params)
    
    console.log(`=== SAVING PROXY CONFIG (DUAL STORAGE) ===`)
    console.log(`User ID: ${userId}`)
    console.log(`Session ID: ${sessionId}`)
    console.log(`Config:`, config)
    
    if (!sessionId) {
      throw new Error('Session ID is required to save proxy configuration')
    }
    
    // Add sessionId to the config
    const configWithSessionId = {
      ...config,
      sessionId: sessionId
    }
    
    // Add timestamps
    if (config.id) {
      // Update existing config
      configWithSessionId.id = config.id
      configWithSessionId.lastModified = new Date().toISOString()
    } else {
      // Create new config
      configWithSessionId.id = uuidv4()
      configWithSessionId.created = new Date().toISOString()
      configWithSessionId.lastModified = new Date().toISOString()
    }
    
    // 1. SAVE TO USER-LEVEL STORAGE (for UI experience)
    console.log(`Saving to user-level storage...`)
    const userBlobPath = getSessionBlobPath(userId)
    let userSessionData = await readJsonFromBlob(blobServiceClient, userBlobPath)
    
    if (!userSessionData) {
      userSessionData = {
        userId: userId,
        created: new Date().toISOString(),
        features: {}
      }
    }
    
    // Initialize apiProxy feature if not exists
    if (!userSessionData.features.apiProxy) {
      userSessionData.features.apiProxy = {
        sessions: [],
        proxyConfigs: [],
        proxyLogs: []
      }
    }
    
    // Ensure sessions array exists
    if (!Array.isArray(userSessionData.features.apiProxy.sessions)) {
      userSessionData.features.apiProxy.sessions = []
    }
    
    // Check if session exists, if not create it
    let sessionExists = userSessionData.features.apiProxy.sessions.find(s => s.id === sessionId)
    if (!sessionExists) {
      console.log(`Session ${sessionId} not found in user storage, creating new session`)
      userSessionData.features.apiProxy.sessions.push({
        id: sessionId,
        name: config.name || `Session ${sessionId.substring(0, 8)}`,
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString()
      })
    } else {
      // Update last used timestamp and name if provided
      sessionExists.lastUsed = new Date().toISOString()
      if (config.name) {
        sessionExists.name = config.name
      }
    }
    
    // Remove any existing config for this session (ensure 1:1 relationship)
    userSessionData.features.apiProxy.proxyConfigs = userSessionData.features.apiProxy.proxyConfigs.filter(c => c.sessionId !== sessionId)
    
    // Add the new config
    userSessionData.features.apiProxy.proxyConfigs.push(configWithSessionId)
    
    // Save to user-level blob storage
    await writeJsonToBlob(blobServiceClient, userBlobPath, userSessionData)
    console.log(`Saved to user-level storage: ${userBlobPath}`)
    
    // 2. SAVE TO SESSION-LEVEL STORAGE (for anonymous proxy access)
    console.log(`Saving to session-level storage...`)
    const sessionBlobPath = getSessionLevelBlobPath(sessionId)
    
    // Create session-level data structure
    const sessionLevelData = {
      sessionId: sessionId,
      userId: userId, // Keep reference to owner
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      config: configWithSessionId
    }
    
    // Save to session-level blob storage
    await writeJsonToBlob(blobServiceClient, sessionBlobPath, sessionLevelData)
    console.log(`Saved to session-level storage: ${sessionBlobPath}`)
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: true, 
        config: configWithSessionId,
        message: 'Configuration saved to both user and session storage'
      })
    }
  } catch (error) {
    console.error('Error saving proxy config:', error)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Failed to save proxy config', details: error.message })
    }
  }
}

// Add a stub for createSession if not present
async function createSession(params, body) {
  try {
    const userId = getUserIdentifier(params.__ow_headers || {})
    const blobServiceClient = getBlobServiceClient(params)

    // Generate new session id and name
    const sessionId = uuidv4()
    const sessionName = params.name || `Session ${sessionId.substring(0, 8)}`

    console.log(`=== CREATING SESSION (DUAL STORAGE) ===`)
    console.log(`User ID: ${userId}`)
    console.log(`Session ID: ${sessionId}`)
    console.log(`Session Name: ${sessionName}`)

    // 1. CREATE IN USER-LEVEL STORAGE
    console.log(`Creating in user-level storage...`)
    const userBlobPath = getSessionBlobPath(userId)
    let userSessionData = await readJsonFromBlob(blobServiceClient, userBlobPath)
    
    if (!userSessionData) {
      userSessionData = {
        userId,
        created: new Date().toISOString(),
        features: {}
      }
    }

    // Ensure apiProxy feature section
    if (!userSessionData.features.apiProxy) {
      userSessionData.features.apiProxy = {
        sessions: [],
        proxyConfigs: [],
        proxyLogs: []
      }
    }

    // Ensure sessions array exists
    if (!Array.isArray(userSessionData.features.apiProxy.sessions)) {
      userSessionData.features.apiProxy.sessions = []
    }
    
    // Add session metadata
    userSessionData.features.apiProxy.sessions.push({
      id: sessionId,
      name: sessionName,
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString()
    })
    userSessionData.lastModified = new Date().toISOString()

    // Persist to user-level storage
    await writeJsonToBlob(blobServiceClient, userBlobPath, userSessionData)
    console.log(`Created in user-level storage: ${userBlobPath}`)

    // 2. CREATE SESSION-LEVEL STORAGE (empty config for now)
    console.log(`Creating session-level storage...`)
    const sessionBlobPath = getSessionLevelBlobPath(sessionId)
    
    const sessionLevelData = {
      sessionId: sessionId,
      userId: userId,
      name: sessionName,
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      config: null // No config yet
    }
    
    await writeJsonToBlob(blobServiceClient, sessionBlobPath, sessionLevelData)
    console.log(`Created session-level storage: ${sessionBlobPath}`)

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: true, 
        sessionId,
        sessionName,
        message: 'Session created in both user and session storage'
      })
    }
  } catch (error) {
    console.error('Error creating session:', error)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Failed to create session', details: error.message })
    }
  }
}

// List proxy logs for a given session
async function listProxyLogs(params, sessionId) {
  try {
    const userId = getUserIdentifier(params.__ow_headers || {})
    const blobServiceClient = getBlobServiceClient(params)
    
    console.log(`=== LISTING PROXY LOGS ===`)
    console.log(`Session ID: ${sessionId}`)
    console.log(`User ID: ${userId}`)
    
    // Use session-level blob path for logs
    const sessionBlobPath = getSessionLevelBlobPath(sessionId)
    console.log(`Session blob path: ${sessionBlobPath}`)
    
    let sessionData = await readJsonFromBlob(blobServiceClient, sessionBlobPath)
    
    // If session-level data not found, try user-level as fallback
    if (!sessionData) {
      console.log(`Session-level data not found, trying user-level fallback...`)
      const userBlobPath = getSessionBlobPath(userId)
      const userSessionData = await readJsonFromBlob(blobServiceClient, userBlobPath)
      
      if (userSessionData && userSessionData.features && userSessionData.features.apiProxy) {
        // Filter logs for this sessionId from user-level storage
        const userLogs = userSessionData.features.apiProxy.proxyLogs || []
        const filteredLogs = userLogs.filter(log => log.sessionId === sessionId)
        
        console.log(`Found ${filteredLogs.length} logs in user-level storage for session ${sessionId}`)
        
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            success: true, 
            logs: redactObject(filteredLogs),
            source: 'user-level-fallback',
            totalCount: filteredLogs.length
          })
        }
      }
      
      console.log(`No logs found for session ${sessionId}`)
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          success: true, 
          logs: [],
          source: 'no-data',
          totalCount: 0
        })
      }
    }
    
    // Extract logs from session-level storage
    const logs = sessionData.requestLogs || []
    console.log(`Found ${logs.length} logs in session-level storage for session ${sessionId}`)
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: true, 
        logs: redactObject(logs),
        source: 'session-level',
        totalCount: logs.length,
        sessionInfo: {
          sessionId: sessionData.sessionId,
          userId: sessionData.userId,
          created: sessionData.created,
          lastModified: sessionData.lastModified,
          totalRequests: sessionData.totalRequests,
          lastRequestTime: sessionData.lastRequestTime
        }
      })
    }
    
  } catch (error) {
    console.error('Error listing proxy logs:', error)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false, 
        error: 'Failed to list logs', 
        details: error.message 
      })
    }
  }
}

// Return the proxy configuration(s) for a session without modifying storage
async function getProxyConfig(params, sessionId) {
  try {
    const userId = getUserIdentifier(params.__ow_headers || {})
    const blobServiceClient = getBlobServiceClient(params)
    const blobPath = getSessionBlobPath(userId)

    console.log(`=== GETTING PROXY CONFIG ===`)
    console.log(`User ID: ${userId}`)
    console.log(`Session ID: ${sessionId}`)

    const sessionData = await readJsonFromBlob(blobServiceClient, blobPath)

    let config = null
    if (
      sessionData &&
      sessionData.features &&
      sessionData.features.apiProxy &&
      Array.isArray(sessionData.features.apiProxy.proxyConfigs)
    ) {
      // Find config specifically for this session ID
      config = sessionData.features.apiProxy.proxyConfigs.find(c => c.sessionId === sessionId) || null
      
      console.log(`Found config for session ${sessionId}:`, config)
      console.log(`Total configs available:`, sessionData.features.apiProxy.proxyConfigs.length)
      console.log(`All configs:`, sessionData.features.apiProxy.proxyConfigs.map(c => ({ id: c.id, sessionId: c.sessionId, name: c.name })))
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, config })
    }
  } catch (error) {
    console.error('Error retrieving proxy config:', error)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Failed to retrieve config', details: error.message })
    }
  }
}

// Migration function to convert existing configs to session-based structure
async function migrateConfigsToSessions(params) {
  try {
    const userId = getUserIdentifier(params.__ow_headers || {})
    const blobServiceClient = getBlobServiceClient(params)
    const blobPath = getSessionBlobPath(userId)
    
    console.log(`=== MIGRATING CONFIGS TO SESSIONS ===`)
    console.log(`User ID: ${userId}`)
    
    const sessionData = await readJsonFromBlob(blobServiceClient, blobPath)
    if (!sessionData || !sessionData.features || !sessionData.features.apiProxy) {
      console.log('No session data found, nothing to migrate')
      return { success: true, message: 'No data to migrate' }
    }
    
    const apiProxy = sessionData.features.apiProxy
    const oldConfigs = apiProxy.proxyConfigs || []
    const sessions = apiProxy.sessions || []
    
    console.log(`Found ${oldConfigs.length} old configs and ${sessions.length} sessions`)
    
    // Create a default session if none exist
    if (sessions.length === 0 && oldConfigs.length > 0) {
      const defaultSessionId = uuidv4()
      sessions.push({
        id: defaultSessionId,
        name: 'Default Session',
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString()
      })
      console.log(`Created default session: ${defaultSessionId}`)
    }
    
    // Migrate each config to the first session (or create individual sessions)
    const migratedConfigs = []
    for (let i = 0; i < oldConfigs.length; i++) {
      const config = oldConfigs[i]
      const sessionId = sessions[i] ? sessions[i].id : sessions[0].id
      
      const migratedConfig = {
        ...config,
        sessionId: sessionId,
        migrated: true,
        originalIndex: i
      }
      
      migratedConfigs.push(migratedConfig)
      console.log(`Migrated config ${i} to session ${sessionId}`)
    }
    
    // Update the session data
    sessionData.features.apiProxy.proxyConfigs = migratedConfigs
    sessionData.features.apiProxy.sessions = sessions
    sessionData.lastModified = new Date().toISOString()
    
    // Save back to blob storage
    await writeJsonToBlob(blobServiceClient, blobPath, sessionData)
    
    console.log(`Migration completed: ${migratedConfigs.length} configs migrated`)
    
    return {
      success: true,
      message: `Migrated ${migratedConfigs.length} configurations to ${sessions.length} sessions`,
      migratedCount: migratedConfigs.length,
      sessionCount: sessions.length
    }
    
  } catch (error) {
    console.error('Error migrating configs:', error)
    throw error
  }
}

async function deleteProxyConfig(params, sessionId) {
  try {
    const userId = getUserIdentifier(params.__ow_headers || {})
    const blobServiceClient = getBlobServiceClient(params)
    
    console.log(`=== DELETING PROXY CONFIG (DUAL STORAGE) ===`)
    console.log(`User ID: ${userId}`)
    console.log(`Session ID: ${sessionId}`)
    
    let deletedFromUser = false
    let deletedFromSession = false
    
    // 1. DELETE FROM USER-LEVEL STORAGE
    if (userId) {
      console.log(`Deleting from user-level storage...`)
      const userBlobPath = getSessionBlobPath(userId)
      const userSessionData = await readJsonFromBlob(blobServiceClient, userBlobPath)
      
      if (userSessionData && userSessionData.features && userSessionData.features.apiProxy) {
        // Remove config from proxyConfigs array
        const originalLength = userSessionData.features.apiProxy.proxyConfigs.length
        userSessionData.features.apiProxy.proxyConfigs = userSessionData.features.apiProxy.proxyConfigs.filter(c => c.sessionId !== sessionId)
        
        if (userSessionData.features.apiProxy.proxyConfigs.length < originalLength) {
          // Also remove session from sessions array
          userSessionData.features.apiProxy.sessions = userSessionData.features.apiProxy.sessions.filter(s => s.id !== sessionId)
          
          await writeJsonToBlob(blobServiceClient, userBlobPath, userSessionData)
          deletedFromUser = true
          console.log(`Deleted from user-level storage: ${userBlobPath}`)
        }
      }
    }
    
    // 2. DELETE FROM SESSION-LEVEL STORAGE
    console.log(`Deleting from session-level storage...`)
    const sessionBlobPath = getSessionLevelBlobPath(sessionId)
    
    try {
      const containerClient = blobServiceClient.getContainerClient('demos')
      const blobClient = containerClient.getBlobClient(sessionBlobPath)
      
      if (await blobClient.exists()) {
        await blobClient.delete()
        deletedFromSession = true
        console.log(`Deleted from session-level storage: ${sessionBlobPath}`)
      }
    } catch (error) {
      console.error('Error deleting from session-level storage:', error)
    }
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: true, 
        message: 'Proxy configuration deleted',
        deletedFromUser,
        deletedFromSession,
        sessionId
      })
    }
  } catch (error) {
    console.error('Error deleting proxy config:', error)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Failed to delete proxy config', details: error.message })
    }
  }
}

// Add new function to clear logs for a session
async function clearProxyLogs(params, sessionId) {
  try {
    const userId = getUserIdentifier(params.__ow_headers || {})
    const blobServiceClient = getBlobServiceClient(params)
    
    console.log(`=== CLEARING PROXY LOGS ===`)
    console.log(`Session ID: ${sessionId}`)
    console.log(`User ID: ${userId}`)
    
    // Use session-level blob path for logs
    const sessionBlobPath = getSessionLevelBlobPath(sessionId)
    
    let sessionData = await readJsonFromBlob(blobServiceClient, sessionBlobPath)
    
    if (!sessionData) {
      console.log(`Session not found: ${sessionId}`)
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          success: false, 
          error: 'Session not found' 
        })
      }
    }
    
    // Clear the logs
    const clearedCount = sessionData.requestLogs ? sessionData.requestLogs.length : 0
    sessionData.requestLogs = []
    sessionData.totalRequests = 0
    sessionData.lastModified = new Date().toISOString()
    
    // Save back to blob storage
    await writeJsonToBlob(blobServiceClient, sessionBlobPath, sessionData)
    
    console.log(`Cleared ${clearedCount} logs for session ${sessionId}`)
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: true, 
        message: `Cleared ${clearedCount} logs`,
        clearedCount: clearedCount,
        sessionId: sessionId
      })
    }
    
  } catch (error) {
    console.error('Error clearing proxy logs:', error)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false, 
        error: 'Failed to clear logs', 
        details: error.message 
      })
    }
  }
}

// Add new function to get session statistics
async function getSessionStats(params, sessionId) {
  try {
    const userId = getUserIdentifier(params.__ow_headers || {})
    const blobServiceClient = getBlobServiceClient(params)
    
    console.log(`=== GETTING SESSION STATS ===`)
    console.log(`Session ID: ${sessionId}`)
    console.log(`User ID: ${userId}`)
    
    // Use session-level blob path for logs
    const sessionBlobPath = getSessionLevelBlobPath(sessionId)
    
    let sessionData = await readJsonFromBlob(blobServiceClient, sessionBlobPath)
    
    if (!sessionData) {
      console.log(`Session not found: ${sessionId}`)
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          success: false, 
          error: 'Session not found' 
        })
      }
    }
    
    const logs = sessionData.requestLogs || []
    
    // Calculate statistics
    const stats = {
      totalRequests: logs.length,
      successfulRequests: logs.filter(log => log.response && log.response.status >= 200 && log.response.status < 300).length,
      failedRequests: logs.filter(log => log.response && (log.response.status < 200 || log.response.status >= 300)).length,
      errorRequests: logs.filter(log => log.error).length,
      averageResponseTime: logs.length > 0 ? 
        Math.round(logs.reduce((sum, log) => sum + (log.responseTime || 0), 0) / logs.length) : 0,
      lastRequestTime: sessionData.lastRequestTime,
      created: sessionData.created,
      lastModified: sessionData.lastModified,
      configName: sessionData.proxyConfig?.name || 'Unknown'
    }
    
    // Add status code distribution
    const statusCodes = {}
    logs.forEach(log => {
      if (log.response && log.response.status) {
        const status = log.response.status
        statusCodes[status] = (statusCodes[status] || 0) + 1
      }
    })
    stats.statusCodeDistribution = statusCodes
    
    console.log(`Session stats calculated for ${sessionId}:`, stats)
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: true, 
        sessionId: sessionId,
        stats: stats
      })
    }
    
  } catch (error) {
    console.error('Error getting session stats:', error)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false, 
        error: 'Failed to get session stats', 
        details: error.message 
      })
    }
  }
}

exports.main = main 
