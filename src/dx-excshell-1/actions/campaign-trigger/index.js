const fetch = require('node-fetch');
const { Core } = require('@adobe/aio-sdk');
const { stringParameters } = require('../utils');
const { ConfigError, getCampaignTriggerConfig } = require('../shared/config');

// main function that will be executed by the runtime
async function main(params) {
    // create a Logger
    const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' });

    try {
        // 'info' is the default level if not set
        logger.info('Calling the main action');

        // log parameters, only if params.LOG_LEVEL === 'debug'
        logger.debug(stringParameters(params));

        // Handle CORS preflight requests
        if (params.__ow_method === 'options') {
            return {
                statusCode: 204,
                headers: { 'Content-Type': 'application/json' }
            };
        }

        // Parse the request body if it's a string
        let requestBody = params;
        if (typeof params === 'string') {
            try {
                requestBody = JSON.parse(params);
            } catch (e) {
                return {
                    statusCode: 400,
                    headers: { 'Content-Type': 'application/json' },
                    body: { error: 'Invalid JSON in request body' }
                };
            }
        }

        // Extract parameters from the request body
        const { campaignId, recipients } = requestBody;

        // Validate required parameters
        if (!campaignId) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: { error: 'Missing required parameter: campaignId' }
            };
        }
        if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: { error: 'Missing or invalid required parameter: recipients' }
            };
        }

        let campaignConfig;
        try {
            campaignConfig = getCampaignTriggerConfig(params);
        } catch (error) {
            if (!(error instanceof ConfigError)) {
                throw error;
            }
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: { error: 'Campaign trigger configuration is missing' }
            };
        }

        const { clientId, clientSecret, scope, imsOrg, sandbox } = campaignConfig;
        
        // Get OAuth token
        const tokenResponse = await fetch('https://ims-na1.adobelogin.com/ims/token/v3', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                'client_id': clientId,
                'client_secret': clientSecret,
                'grant_type': 'client_credentials',
                'scope': scope
            })
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            throw new Error(`Failed to get OAuth token: ${tokenResponse.statusText}. Details: ${errorText}`);
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        // Make the API call to trigger the campaign
        const response = await fetch('https://platform.adobe.io/ajo/im/executions/unitary', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': clientId,
                'x-gw-ims-org-id': imsOrg,
                'x-sandbox-name': sandbox,
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage;
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.title && errorJson.title.includes('Cannot find the Campaign')) {
                    errorMessage = `Campaign ID "${campaignId}" not found. Please verify the campaign ID exists in Adobe Journey Optimizer.`;
                } else {
                    errorMessage = `Campaign trigger failed: ${errorJson.title || response.statusText}. Details: ${errorText}`;
                }
            } catch (e) {
                errorMessage = `Campaign trigger failed: ${response.statusText}. Details: ${errorText}`;
            }
            throw new Error(errorMessage);
        }

        const result = await response.json();

        // return the response
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: result
        };

    } catch (error) {
        // log any server errors
        logger.error(error);
        // return with 500
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: {
                error: `Server error: ${error.message}`
            }
        };
    }
}

exports.main = main; 
