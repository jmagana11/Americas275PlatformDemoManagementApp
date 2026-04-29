const fetch = require('node-fetch')

function getAdobeCredentials(params) {
  if (params.apiKey && params.clientSecret) {
    return {
      apiKey: params.apiKey,
      clientSecret: params.clientSecret
    }
  }

  const environmentKey = (params.environmentKey || params.org || '').toUpperCase()
  if (!environmentKey) {
    return {}
  }

  return {
    apiKey: params[`${environmentKey}_API_KEY`],
    clientSecret: params[`${environmentKey}_CLIENT_SECRET`]
  }
}

async function main(params) {
  const { apiKey, clientSecret } = getAdobeCredentials(params)

  // Validate required parameters
  if (!apiKey || !clientSecret) {
    return {
      statusCode: 400,
      body: {
        error: 'Missing required Adobe credentials'
      }
    }
  }

  try {
    // Adobe IMS Client Credentials flow
    const authData = new URLSearchParams({
      client_id: apiKey,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
      scope: 'additional_info.job_function,openid,session,user_management_sdk,AdobeID,target_sdk,read_organizations,additional_info.roles,additional_info.projectedProductContext'
    })

    const response = await fetch('https://ims-na1.adobelogin.com/ims/token/v3', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: authData
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Adobe IMS authentication failed:', errorData)
      return {
        statusCode: response.status,
        body: {
          error: 'Adobe IMS authentication failed',
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
    console.error('Adobe IMS authentication error:', error)
    return {
      statusCode: 500,
      body: {
        error: 'Internal server error',
        details: error.message
      }
    }
  }
}

exports.main = main 
