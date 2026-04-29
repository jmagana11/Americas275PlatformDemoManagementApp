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
async function main(params) {
  const fetch = require('node-fetch')

  try {
    // Validate required parameters
    const requiredParams = ['imsTenant', 'sandbox', 'api_key', 'ims_token', 'ims_org', 'groupName', 'productConfig', 'users']
    const missingParams = requiredParams.filter(p => !params[p])
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
      imsTenant: params.imsTenant,
      sandbox: params.sandbox,
      groupName: params.groupName,
      productConfigCount: params.productConfig.length,
      userCount: params.users.length,
      testMode: params.testMode
    })

    if (params.testMode) {
      console.log('Test mode enabled - would make the following API call:')
      console.log('Endpoint:', `https://usermanagement.adobe.io/v2/usermanagement/action/${params.ims_org}`)
      console.log('Product Configurations:', params.productConfig)
      console.log('Users:', params.users)
      return {
        statusCode: 200,
        body: {
          success: true,
          testMode: true,
          message: 'Test mode - no changes made',
          productConfig: params.productConfig,
          users: params.users
        }
      }
    }

    // Prepare request body - create a command for each user
    const requestBody = params.users.map(userEmail => ({
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
    const response = await fetch(`https://usermanagement.adobe.io/v2/usermanagement/action/${params.ims_org}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-api-key': params.api_key,
        'Authorization': `Bearer ${params.ims_token}`
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

exports.main = main 