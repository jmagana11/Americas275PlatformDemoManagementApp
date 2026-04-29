const fetch = require('node-fetch')
const { Core } = require('@adobe/aio-sdk')
const { errorResponse, stringParameters, checkMissingRequestInputs } = require('../utils')

// main function that will be executed by Adobe I/O Runtime
async function main (params) {
  // create a Logger
  const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' })

  try {
    // 'info' is the default level if not set
    logger.info('Calling the main action')

    // log parameters, only if params.LOG_LEVEL === 'debug'
    logger.debug(stringParameters(params))

    // check for missing request input parameters and headers
    const requiredParams = ['action']
    const requiredHeaders = []
    const errorMessage = checkMissingRequestInputs(params, requiredParams, requiredHeaders)
    if (errorMessage) {
      // return and log client errors
      return errorResponse(400, errorMessage, logger)
    }

    const { action, ...actionParams } = params
    logger.info(`Action called: ${action} with params:`, JSON.stringify(actionParams, null, 2))

    switch (action) {
      case 'list-templates':
        return await listTemplates(actionParams, logger)
      case 'get-template':
        return await getTemplate(actionParams, logger)
      case 'create-template':
        return await createTemplate(actionParams, logger)
      case 'migrate-templates':
        return await migrateTemplates(actionParams, logger)
      default:
        return errorResponse(400, `Unknown action: ${action}`, logger)
    }
  } catch (error) {
    // log any server errors
    logger.error(error)
    // return with 500
    return errorResponse(500, 'server error', logger)
  }
}

async function listTemplates(params, logger) {
  const { org, sandbox } = params
  
  if (!org || !sandbox) {
    return errorResponse(400, 'Missing required parameters: org, sandbox', logger)
  }

  try {
    // Organization-specific configurations
    const orgConfigs = getContentOrgConfigs(params)

    const orgConfig = orgConfigs[org]
    
    if (!orgConfig) {
      return errorResponse(400, `Invalid organization: ${org}`, logger)
    }

    // Get access token for the specified environment
    const accessToken = await getAccessToken(orgConfig, logger)
    
    // Call Adobe Journey Optimizer Content API to list templates
    const response = await fetch(`https://platform.adobe.io/ajo/content/templates`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-api-key': orgConfig.API_KEY,
        'x-gw-ims-org-id': orgConfig.IMS_ORG,
        'x-sandbox-name': sandbox,
        'Accept': 'application/vnd.adobe.ajo.template-list.v1+json',
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error(`API call failed: ${response.status} ${errorText}`)
      return errorResponse(response.status, `Failed to fetch templates: ${errorText}`, logger)
    }

    const data = await response.json()
    
    // Transform the response to match our expected format
    const templates = data.items?.map(template => ({
      id: template.id,
      name: template.name,
      type: template.templateType || 'content',
      description: template.description || '',
      content: template.content,
      createdAt: template.createdAt,
      updatedAt: template.modifiedAt
    })) || []

    return {
      statusCode: 200,
      body: {
        success: true,
        templates,
        count: templates.length
      }
    }
  } catch (error) {
    logger.error('Error listing templates:', error)
    return errorResponse(500, 'Failed to list templates', logger)
  }
}

async function getTemplate(params, logger) {
  logger.info('getTemplate called with params:', JSON.stringify(params, null, 2))
  const { org, sandbox, templateId } = params
  
  if (!org || !sandbox || !templateId) {
    logger.error(`Missing parameters - org: ${org}, sandbox: ${sandbox}, templateId: ${templateId}`)
    return errorResponse(400, 'Missing required parameters: org, sandbox, templateId', logger)
  }

  try {
    // Organization-specific configurations
    const orgConfigs = getContentOrgConfigs(params)

    const orgConfig = orgConfigs[org]
    
    if (!orgConfig) {
      return errorResponse(400, `Invalid organization: ${org}`, logger)
    }

    // Get access token for the specified environment
    const accessToken = await getAccessToken(orgConfig, logger)
    
    // Call Adobe Journey Optimizer Content API to get template details
    const response = await fetch(`https://platform.adobe.io/ajo/content/templates/${templateId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-api-key': orgConfig.API_KEY,
        'x-gw-ims-org-id': orgConfig.IMS_ORG,
        'x-sandbox-name': sandbox,
        'Accept': 'application/json, application/vnd.adobe.ajo.template.v1+json',
        'Content-Type': 'application/json'
      }
    })

    logger.info(`API call to: https://platform.adobe.io/ajo/content/templates/${templateId}`)
    logger.info(`Response status: ${response.status}`)
    logger.info(`Response headers:`, Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      const errorText = await response.text()
      logger.error(`API call failed: ${response.status} ${errorText}`)
      return errorResponse(response.status, `Failed to fetch template: ${errorText}`, logger)
    }

    const templateData = await response.json()
    logger.info('Raw template data received:', JSON.stringify(templateData, null, 2))
    logger.info('Template type:', templateData.templateType)
    logger.info('Channels:', templateData.channels)
    logger.info('Template structure:', JSON.stringify(templateData.template, null, 2))
    
    // Debug the extraction
    // Return the complete template structure for proper handling in the frontend
    return {
      statusCode: 200,
      body: {
        success: true,
        template: {
          id: templateData.id,
          name: templateData.name,
          description: templateData.description || '',
          templateType: templateData.templateType || 'content',
          createdAt: templateData.createdAt,
          createdBy: templateData.createdBy,
          modifiedAt: templateData.modifiedAt,
          modifiedBy: templateData.modifiedBy,
          channels: templateData.channels || [],
          source: templateData.source || {},
          template: templateData.template || {},
          labels: templateData.labels || [],
          referencedFragments: templateData.referencedFragments || []
        }
      }
    }
  } catch (error) {
    logger.error('Error getting template:', error)
    return errorResponse(500, 'Failed to get template', logger)
  }
}

async function createTemplate(params, logger) {
  const { targetOrg, targetSandbox, templateData } = params
  
  if (!targetOrg || !targetSandbox || !templateData) {
    return errorResponse(400, 'Missing required parameters: targetOrg, targetSandbox, templateData', logger)
  }

  try {
    // Organization-specific configurations
    const orgConfigs = getContentOrgConfigs(params)

    const targetOrgConfig = orgConfigs[targetOrg]
    
    if (!targetOrgConfig) {
      return errorResponse(400, `Invalid target organization: ${targetOrg}`, logger)
    }

    // Get access token for the target environment
    const targetAccessToken = await getAccessToken(targetOrgConfig, logger)
    
    // Create the template using the cached data
    logger.info('Template data for creation:', JSON.stringify(templateData, null, 2))
    
    const createPayload = {
      name: templateData.name,
      description: templateData.description,
      templateType: templateData.templateType || 'content',
      channels: templateData.channels || ['email'],
      source: {
        origin: 'ajo',
        metadata: {}
      },
      template: createTemplateContent(templateData)
    }
    
    // Only add subType if it's a code channel template
    if (templateData.channels && templateData.channels.includes('code')) {
      createPayload.subType = templateData.subType || 'HTML'
    }
    
    // Ensure channels is an array
    if (typeof createPayload.channels === 'string') {
      createPayload.channels = [createPayload.channels]
    }
    
    logger.info(`Creating template with payload:`, JSON.stringify(createPayload, null, 2))
    
    const response = await fetch(`https://platform.adobe.io/ajo/content/templates`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${targetAccessToken}`,
        'x-api-key': targetOrgConfig.API_KEY,
        'x-gw-ims-org-id': targetOrgConfig.IMS_ORG,
        'x-sandbox-name': targetSandbox,
        'Accept': 'application/vnd.adobe.ajo.template.v1+json',
        'Content-Type': 'application/vnd.adobe.ajo.template.v1+json'
      },
      body: JSON.stringify(createPayload)
    })

    logger.info(`Response status: ${response.status}`)
    logger.info(`Response headers:`, Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      const errorText = await response.text()
      logger.error(`Failed to create template: ${response.status} ${errorText}`)
      return errorResponse(response.status, `Failed to create template: ${errorText}`, logger)
    }

    // Check if response has content before parsing JSON
    const responseText = await response.text()
    logger.info(`Response body: ${responseText}`)
    
    let createdTemplate
    if (responseText.trim()) {
      try {
        createdTemplate = JSON.parse(responseText)
        logger.info(`Successfully created template:`, JSON.stringify(createdTemplate, null, 2))
      } catch (parseError) {
        logger.error(`Failed to parse response JSON: ${parseError.message}`)
        return errorResponse(500, `Failed to parse response: ${parseError.message}`, logger)
      }
    } else {
      logger.warn(`Empty response body received`)
      createdTemplate = { id: 'unknown', name: createPayload.name }
    }
    
    return {
      statusCode: 200,
      body: {
        success: true,
        templateId: createdTemplate.id,
        templateName: createdTemplate.name
      }
    }
  } catch (error) {
    logger.error('Error creating template:', error)
    return errorResponse(500, 'Failed to create template', logger)
  }
}

async function migrateTemplates(params, logger) {
  logger.info('migrateTemplates called with params:', JSON.stringify(params, null, 2))
  const { 
    sourceOrg, 
    sourceSandbox, 
    targetOrg, 
    targetSandbox, 
    templates
  } = params

  if (!sourceOrg || !sourceSandbox || !targetOrg || !targetSandbox || !templates) {
    logger.error(`Missing parameters - sourceOrg: ${sourceOrg}, sourceSandbox: ${sourceSandbox}, targetOrg: ${targetOrg}, targetSandbox: ${targetSandbox}, templates: ${templates}`)
    return errorResponse(400, 'Missing required parameters for migration', logger)
  }

  try {
    // Organization-specific configurations
    const orgConfigs = getContentOrgConfigs(params)

    const sourceOrgConfig = orgConfigs[sourceOrg]
    const targetOrgConfig = orgConfigs[targetOrg]
    
    if (!sourceOrgConfig) {
      return errorResponse(400, `Invalid source organization: ${sourceOrg}`, logger)
    }
    
    if (!targetOrgConfig) {
      return errorResponse(400, `Invalid target organization: ${targetOrg}`, logger)
    }

    // Get access tokens for both environments
    const sourceAccessToken = await getAccessToken(sourceOrgConfig, logger)
    const targetAccessToken = await getAccessToken(targetOrgConfig, logger)
    
    const results = []
    
    // Migrate each template
    for (const templateId of templates) {
      try {
        // Get template details from source
        const sourceResponse = await fetch(`https://platform.adobe.io/ajo/content/templates/${templateId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${sourceAccessToken}`,
            'x-api-key': sourceOrgConfig.API_KEY,
            'x-gw-ims-org-id': sourceOrgConfig.IMS_ORG,
            'x-sandbox-name': sourceSandbox,
            'Accept': 'application/vnd.adobe.ajo.template.v1+json',
            'Content-Type': 'application/json'
          }
        })

        if (!sourceResponse.ok) {
          results.push({
            templateId,
            templateName: templateId,
            success: false,
            error: `Failed to fetch template from source: ${sourceResponse.status}`
          })
          continue
        }

        const templateData = await sourceResponse.json()
        logger.info(`Template data fetched from source:`, JSON.stringify(templateData, null, 2))
        
        // Create template in target using the correct payload format
        const createPayload = {
          name: templateData.name,
          description: templateData.description,
          templateType: templateData.templateType || 'html',
          channels: templateData.channels || ['email'],
          source: {
            origin: 'ajo',
            metadata: {}
          },
          template: createTemplateContent(templateData)
        }
        
        // Only add subType if it's a code channel template
        if (templateData.channels && templateData.channels.includes('code')) {
          createPayload.subType = templateData.subType || 'HTML'
        }
        
        // Ensure channels is an array
        if (typeof createPayload.channels === 'string') {
          createPayload.channels = [createPayload.channels]
        }
        
        logger.info(`Creating template with payload:`, JSON.stringify(createPayload, null, 2))
        
        const targetResponse = await fetch(`https://platform.adobe.io/ajo/content/templates`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${targetAccessToken}`,
            'x-api-key': targetOrgConfig.API_KEY,
            'x-gw-ims-org-id': targetOrgConfig.IMS_ORG,
            'x-sandbox-name': targetSandbox,
            'Accept': 'application/vnd.adobe.ajo.template.v1+json',
            'Content-Type': 'application/vnd.adobe.ajo.template.v1+json'
          },
          body: JSON.stringify(createPayload)
        })

        if (!targetResponse.ok) {
          const errorText = await targetResponse.text()
          results.push({
            templateId,
            templateName: templateData.name,
            success: false,
            error: `Failed to create template in target: ${targetResponse.status} ${errorText}`
          })
        } else {
          // Check if response has content before parsing JSON
          const responseText = await targetResponse.text()
          let createdTemplate
          if (responseText.trim()) {
            try {
              createdTemplate = JSON.parse(responseText)
            } catch (parseError) {
              logger.error(`Failed to parse response JSON: ${parseError.message}`)
              results.push({
                templateId,
                templateName: templateData.name,
                success: false,
                error: `Failed to parse response: ${parseError.message}`
              })
              continue
            }
          } else {
            logger.warn(`Empty response body received for template ${templateId}`)
            createdTemplate = { id: 'unknown', name: templateData.name }
          }
          
          results.push({
            templateId,
            templateName: templateData.name,
            success: true,
            newTemplateId: createdTemplate.id
          })
        }
      } catch (error) {
        logger.error(`Error migrating template ${templateId}:`, error)
        results.push({
          templateId,
          templateName: templateId,
          success: false,
          error: error.message
        })
      }
    }

    return {
      statusCode: 200,
      body: {
        success: true,
        results,
        summary: {
          total: results.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length
        }
      }
    }
  } catch (error) {
    logger.error('Error during migration:', error)
    return errorResponse(500, 'Failed to migrate templates', logger)
  }
}

async function getAccessToken(orgConfig, logger) {
  try {
    // Use client credentials flow to get access token
    const params = new URLSearchParams({
      client_id: orgConfig.API_KEY,
      client_secret: orgConfig.CLIENT_SECRET,
      grant_type: 'client_credentials',
      scope: orgConfig.META_SCOPE
    })

    const tokenResponse = await fetch(`https://${orgConfig.IMS}/ims/token/?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      logger.error(`Token request failed: ${tokenResponse.status} ${errorText}`)
      throw new Error(`Failed to get access token: ${tokenResponse.status}`)
    }

    const tokenData = await tokenResponse.json()
    return tokenData.access_token
  } catch (error) {
    logger.error('Error getting access token:', error)
    throw error
  }
}

function getContentOrgConfigs(params) {
  return {
    MA1HOL: {
      CLIENT_SECRET: params.MA1HOL_CLIENT_SECRET,
      API_KEY: params.MA1HOL_API_KEY,
      IMS_ORG: params.MA1HOL_IMS_ORG,
      TENANT: params.MA1HOL_TENANT,
      META_SCOPE: 'additional_info.job_function,openid,session,user_management_sdk,cjm.suppression_service.client.delete,AdobeID,target_sdk,read_organizations,additional_info.roles,cjm.suppression_service.client.all,additional_info.projectedProductContext',
      IMS: 'ims-na1.adobelogin.com'
    },
    POT5HOL: {
      CLIENT_SECRET: params.POT5HOL_CONTENT_CLIENT_SECRET || params.POT5HOL_CLIENT_SECRET,
      API_KEY: params.POT5HOL_CONTENT_API_KEY || params.POT5HOL_API_KEY,
      IMS_ORG: params.POT5HOL_IMS_ORG,
      TENANT: params.POT5HOL_TENANT,
      META_SCOPE: 'cjm.suppression_service.client.delete, cjm.suppression_service.client.all, openid, session, AdobeID, read_organizations, additional_info.projectedProductContext, read_pc.acp, read_pc, read_pc.dma_tartan, additional_info, target_sdk, additional_info.roles, additional_info.job_function, user_management_sdk',
      IMS: 'ims-na1.adobelogin.com'
    }
  }
}

function extractHtmlContent(templateData) {
  const template = templateData.template
  const templateType = templateData.templateType
  const channels = templateData.channels
  
  console.log('Extracting HTML for:', {
    templateType,
    channels,
    hasTemplate: !!template,
    templateKeys: template ? Object.keys(template) : []
  })
  
  // Helper function to safely get string content
  const getStringContent = (content) => {
    if (typeof content === 'string') {
      return content
    } else if (content && typeof content === 'object') {
      // If it's an object, try to stringify it
      return JSON.stringify(content)
    }
    return ''
  }
  
  // Helper function to safely log content
  const safeLog = (content, label) => {
    const stringContent = getStringContent(content)
    const preview = stringContent.length > 100 ? stringContent.substring(0, 100) + '...' : stringContent
    console.log(`${label} - extracted:`, preview)
    return stringContent
  }
  
  // Handle different template structures based on type and channels
  if (templateType === 'html') {
    // HTML template type - direct html property
    const html = getStringContent(template?.html)
    return safeLog(html, 'HTML template')
  } else if (templateType === 'content') {
    // Content template type - nested structure
    if (channels === 'email' || (Array.isArray(channels) && channels.includes('email'))) {
      // Email content template - can have direct html property or nested body.html
      const html = getStringContent(template?.html?.body || template?.html || template?.body?.html)
      return safeLog(html, 'Email content template')
    } else if (channels === 'sms' || (Array.isArray(channels) && channels.includes('sms'))) {
      // SMS content template
      const text = getStringContent(template?.text)
      return safeLog(text, 'SMS content template')
    } else if (channels === 'inapp' || (Array.isArray(channels) && channels.includes('inapp'))) {
      // InApp content template
      const html = getStringContent(template?.body?.html)
      return safeLog(html, 'InApp content template')
    } else if (channels === 'push' || (Array.isArray(channels) && channels.includes('push'))) {
      // Push notification content template
      const title = getStringContent(template?.title)
      const body = getStringContent(template?.message || template?.body?.body || template?.body)
      const content = title + (title && body ? '\n' : '') + body
      return safeLog(content, 'Push content template')
    } else {
      // Other content types
      const content = getStringContent(template?.body?.html || template?.body?.text || template?.html || template?.text)
      return safeLog(content, 'Other content template')
    }
  } else if (templateType === 'condition') {
    // Condition template - extract PQL and human readable description
    const pql = getStringContent(template?.condition?.pql)
    const humanReadable = getStringContent(template?.condition?.humanReadable)
    const content = `PQL: ${pql}\n\nHuman Readable: ${humanReadable}`
    return safeLog(content, 'Condition template')
  } else {
    // Fallback for other template types
    const content = getStringContent(template?.html || template?.text || template?.body?.html || template?.body?.text)
    return safeLog(content, 'Fallback template')
  }
}

function createTemplateContent(templateData) {
  const template = templateData.template
  const templateType = templateData.type || templateData.templateType
  const channels = templateData.channels
  
  console.log('createTemplateContent called with:', {
    templateType,
    channels,
    hasTemplate: !!template,
    templateKeys: template ? Object.keys(template) : []
  })
  
  if (templateType === 'html') {
    // HTML template type
    return {
      html: templateData.html || '',
      editorContext: {}
    }
  } else if (templateType === 'content') {
    // Content template type
    if (channels === 'email' || (Array.isArray(channels) && channels.includes('email'))) {
      // Email content template - preserve the original structure
      return {
        subject: template?.subject || '',
        html: template?.html || {},
        editorContext: template?.editorContext || {}
      }
    } else if (channels === 'sms' || (Array.isArray(channels) && channels.includes('sms'))) {
      // SMS content template - preserve the original structure
      return {
        text: template?.text || '',
        messageType: template?.messageType || 'sms'
      }
    } else if (channels === 'inapp' || (Array.isArray(channels) && channels.includes('inapp'))) {
      // InApp content template - preserve the original structure
      console.log('Creating InApp template with:', {
        editorContext: template?.editorContext,
        mobileParameters: template?.mobileParameters,
        body: template?.body
      })
      
      // For InApp templates, we need to structure it properly
      const inAppTemplate = {
        editorContext: template?.editorContext || {},
        mobileParameters: template?.mobileParameters || {},
        body: template?.body || {}
      }
      
      console.log('Final InApp template structure:', JSON.stringify(inAppTemplate, null, 2))
      return inAppTemplate
    } else if (channels === 'push' || (Array.isArray(channels) && channels.includes('push'))) {
      // Push notification content template - preserve the original structure
      return {
        pushType: template?.pushType || 'message',
        title: template?.title || '',
        message: template?.message || '',
        ios: template?.ios || {},
        android: template?.android || {}
      }
    } else {
      // Other content types
      return {
        body: {
          html: templateData.html || ''
        },
        editorContext: {}
      }
    }
  } else if (templateType === 'condition') {
    // Condition template - preserve the original structure
    return {
      condition: template?.condition || {}
    }
  } else {
    // Fallback
    return {
      html: templateData.html || '',
      editorContext: {}
    }
  }
}

exports.main = main 
