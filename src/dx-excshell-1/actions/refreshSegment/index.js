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

const fetch = require('node-fetch')
const { Core } = require('@adobe/aio-sdk')
const { errorResponse, stringParameters, checkMissingRequestInputs } = require('../utils')

// main function that will be executed by Adobe I/O Runtime
async function main(params) {
    const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' })

    try {
        logger.info('Calling the main action')
        logger.debug('Full params:', stringParameters(params))

        // Log all headers received
        const headers = params.__ow_headers || {}
        logger.info('Headers received:', headers)

        // Get segment IDs and sandbox name from headers or body
        let segmentIds, sandboxName
        
        if (params.__ow_method === 'POST' && params.body) {
            // Parse body for POST requests
            const body = typeof params.body === 'string' ? JSON.parse(params.body) : params.body
            segmentIds = body.segmentids || headers.segmentids
            sandboxName = body.sandboxname || headers.sandboxname
        } else {
            // Use headers for GET requests
            segmentIds = headers.segmentids
            sandboxName = headers.sandboxname
        }

        logger.info('Raw segment IDs:', segmentIds)
        
        if (!segmentIds || !sandboxName) {
            return errorResponse(400, 'Missing required headers: segmentids or sandboxname', logger)
        }

        // Process segment IDs
        const processedSegmentIds = segmentIds.split(',').map(id => id.trim())
        logger.info('Processed segment IDs:', processedSegmentIds)

        if (!processedSegmentIds.length) {
            throw new Error('No segment IDs provided')
        }

        logger.info('Processing refresh for segments:', processedSegmentIds.join(', '))

        // Use the user's token directly
        const userToken = headers.authorization?.replace('Bearer ', '') || 
                         headers.Authorization?.replace('Bearer ', '')
        
        if (!userToken) {
            return errorResponse(400, 'No authorization token provided', logger)
        }
        
        // Prepare request to Adobe API
        const apiUrl = 'https://platform.adobe.io/data/core/ups/segment/jobs'
        
        // Format request body according to Adobe API specifications for batch evaluation
        const requestBody = {
            name: `Batch Segment Refresh Job - ${new Date().toISOString()}`,
            segments: processedSegmentIds.map(id => ({
                segmentId: id
            })),
            operation: "refresh",
            evaluationInfo: {
                batch: {
                    enabled: true
                }
            }
        }

        // Set up headers for the Adobe API request
        const apiHeaders = {
            'Authorization': `Bearer ${userToken}`,
            'x-api-key': params.apiKey,
            'x-gw-ims-org-id': params.orgId,
            'x-sandbox-name': sandboxName,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
        
        logger.info('Request body:', JSON.stringify(requestBody, null, 2))
        logger.info('Request headers:', apiHeaders)

        // Make the request to Adobe API
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: apiHeaders,
            body: JSON.stringify(requestBody)
        })

        if (!response.ok) {
            const errorText = await response.text()
            logger.error('Adobe API error:', errorText)
            throw new Error(`Adobe API request failed with status ${response.status}: ${errorText}`)
        }

        const responseData = await response.json()
        logger.info('Adobe API response:', responseData)

        return {
            statusCode: 200,
            body: responseData
        }

    } catch (error) {
        logger.error(error)
        return errorResponse(500, error.message)
    }
}

exports.main = main
