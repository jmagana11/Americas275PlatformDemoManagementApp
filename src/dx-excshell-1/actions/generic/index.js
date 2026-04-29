/*
* <license header>
*/

/**
 * This is a sample action showcasing how to access an external API
 *
 * Note:
 * You might want to disable authentication and authorization checks against Adobe Identity Management System for a generic action. In that case:
 *   - Remove the require-adobe-auth annotation for this action in the manifest.yml of your application
 *   - Remove the Authorization header from the array passed in checkMissingRequestInputs
 *   - The two steps above imply that every client knowing the URL to this deployed action will be able to invoke it without any authentication and authorization checks against Adobe Identity Management System
 *   - Make sure to validate these changes against your security requirements before deploying the action
 */

// Using axios for HTTP requests
const axios = require('axios')

// main function that will be executed by Adobe I/O Runtime
async function main(params) {
  try {
    console.log('Calling the Generic action')
    console.log('Available params:', Object.keys(params))
    
    // Get the bearer token from Authorization header (this comes from the frontend user)
    const authHeader = params.__ow_headers && params.__ow_headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 400,
        body: { error: 'Missing or invalid Authorization header' }
      }
    }
    
    const token = authHeader.substring('Bearer '.length)
    
    // Simple generic endpoint test
    const apiEndpoint = 'https://adobeioruntime.net/api/v1'
    
    console.log('Making request to:', apiEndpoint)
    
    // Make request using axios
    const response = await axios.get(apiEndpoint, {
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    })
    
    console.log('Successfully completed generic action')
    
    return {
      statusCode: 200,
      body: response.data
    }
    
  } catch (error) {
    console.error('Error in generic action:', error.message)
    if (error.response) {
      console.error(`API failed with status: ${error.response.status}`)
      console.error('API error details:', JSON.stringify(error.response.data))
      return {
        statusCode: error.response.status,
        body: { 
          error: `Generic API failed with status: ${error.response.status}`,
          details: error.response.data
        }
      }
    }
    
    return {
      statusCode: 500,
      body: { error: 'Internal server error', details: error.message }
    }
  }
}

exports.main = main
