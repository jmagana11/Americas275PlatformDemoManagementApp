/*
* <license header>
*/

/**
 * This action updates product configurations for a user group using the Adobe User Management API
 * 
 * @param {object} params
 * @param {string} params.imsTenant - The IMS tenant name
 * @param {string} params.sandbox - The sandbox name
 * @param {string} params.api_key - The API key
 * @param {string} params.ims_token - The IMS token
 * @param {string} params.ims_org - The IMS org ID
 * @param {string} params.groupName - The group name
 * @param {array} params.productConfig - Array of product configuration IDs
 * @param {array} params.users - Array of user email addresses
 * @param {boolean} params.testMode - Whether to run in test mode
 * @returns {object} Response from Adobe User Management API
 */
const fetch = require('node-fetch')
const { ConfigError, getOrgConfig } = require('../shared/config')

async function main(params) {
  try {
    const resolvedConfig = resolveAdobeOrgConfig(params)
    if (resolvedConfig.error) {
      return resolvedConfig.error
    }
    const actionParams = {
      ...params,
      imsTenant: params.imsTenant || resolvedConfig.orgConfig?.tenant,
      api_key: params.api_key || resolvedConfig.orgConfig?.apiKey,
      ims_org: params.ims_org || resolvedConfig.orgConfig?.imsOrg
    }

    // Validate required parameters
    const requiredParams = ['imsTenant', 'sandbox', 'api_key', 'ims_token', 'ims_org', 'groupName', 'productConfig', 'users']
    const missingParams = requiredParams.filter(p => !actionParams[p])
    if (missingParams.length > 0) {
      return {
        statusCode: 400,
        body: {
          error: `Missing required parameters: ${missingParams.join(', ')}`
        }
      }
    }

    // Log parameters (excluding sensitive data)
    console.log('Calling ims-product-config action with params:', {
      imsTenant: actionParams.imsTenant,
      sandbox: actionParams.sandbox,
      groupName: actionParams.groupName,
      productConfigCount: actionParams.productConfig.length,
      userCount: actionParams.users.length,
      testMode: actionParams.testMode
    })

    if (actionParams.testMode) {
      console.log('Test mode enabled - would make the following API call:')
      console.log('Endpoint: Adobe User Management action endpoint')
      console.log('Product Configurations:', actionParams.productConfig)
      console.log('Users:', actionParams.users)
      return {
        statusCode: 200,
        body: {
          success: true,
          testMode: true,
          message: 'Test mode - no changes made',
          productConfig: actionParams.productConfig,
          users: actionParams.users
        }
      }
    }

    // Prepare request body - create a command for each user
    const requestBody = actionParams.users.map(userEmail => ({
      user: userEmail,
      requestID: `batch_${Date.now()}_${userEmail}`,
      do: [{
        add: {
          group: params.productConfig
        }
      }]
    }))

    // Log the exact request we're sending
    console.log('Making request to Adobe User Management API with body:', JSON.stringify(requestBody, null, 2))

    // Make request to Adobe User Management API
    const response = await fetch(`https://usermanagement.adobe.io/v2/usermanagement/action/${actionParams.ims_org}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-api-key': actionParams.api_key,
        'Authorization': `Bearer ${actionParams.ims_token}`
      },
      body: JSON.stringify(requestBody)
    })

    const result = await response.json()

    // Log the response
    console.log('Adobe User Management API response:', JSON.stringify(result, null, 2))

    if (!response.ok) {
      console.error('Adobe User Management API error:', result)
      return {
        statusCode: response.status,
        body: {
          error: 'Adobe User Management API error',
          details: result
        }
      }
    }

    return {
      statusCode: 200,
      body: {
        success: true,
        testMode: false,
        result: result
      }
    }

  } catch (error) {
    console.error('Error in ims-product-config action:', error)
    return {
      statusCode: 500,
      body: {
        error: 'Internal server error',
        details: error.message
      }
    }
  }
}

function resolveAdobeOrgConfig(params) {
  const orgKey = params.environmentKey || params.org
  if (!orgKey) {
    return {}
  }

  try {
    return {
      orgConfig: getOrgConfig(params, orgKey, 'sandboxes')
    }
  } catch (error) {
    if (error instanceof ConfigError) {
      return {
        error: {
          statusCode: 400,
          body: {
            error: error.message
          }
        }
      }
    }
    throw error
  }
}

exports.main = main
