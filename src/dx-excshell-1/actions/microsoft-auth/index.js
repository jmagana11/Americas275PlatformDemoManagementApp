const fetch = require('node-fetch')
const { ConfigError, getOrgConfig } = require('../shared/config')

async function main(params) {
  let msClientId
  let msClientSecret
  let msTenantId
  try {
    const credentials = getMicrosoftCredentials(params)
    msClientId = credentials.msClientId
    msClientSecret = credentials.msClientSecret
    msTenantId = credentials.msTenantId
  } catch (error) {
    if (!(error instanceof ConfigError)) {
      throw error
    }
  }

  // Validate required parameters
  if (!msClientId || !msClientSecret || !msTenantId) {
    return {
      statusCode: 400,
      body: {
        error: 'Missing required parameters: msClientId, msClientSecret, msTenantId'
      }
    }
  }

  try {
    // Use Client Credentials flow for service-to-service authentication
    const tokenData = new URLSearchParams({
      client_id: msClientId,
      client_secret: msClientSecret,
      // Use .default scope to request all configured application permissions
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials'
    })

    const response = await fetch(`https://login.microsoftonline.com/${msTenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: tokenData
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Microsoft authentication failed:', errorData)
      return {
        statusCode: response.status,
        body: {
          error: 'Microsoft authentication failed',
          details: errorData.error_description || errorData.error || 'Unknown error'
        }
      }
    }

    const result = await response.json()
    
    return {
      statusCode: 200,
      body: {
        success: true,
        access_token: result.access_token,
        expires_in: result.expires_in,
        token_type: result.token_type
      }
    }

  } catch (error) {
    console.error('Microsoft authentication error:', error)
    return {
      statusCode: 500,
      body: {
        error: 'Internal server error',
        details: error.message
      }
    }
  }
}

function getMicrosoftCredentials(params) {
  if (params.msClientId && params.msClientSecret && params.msTenantId) {
    return {
      msClientId: params.msClientId,
      msClientSecret: params.msClientSecret,
      msTenantId: params.msTenantId
    }
  }

  const environmentKey = (params.environmentKey || params.org || '').toUpperCase()
  if (!environmentKey) {
    return {}
  }

  return getOrgConfig(params, environmentKey, 'microsoft-auth')
}

exports.main = main 
