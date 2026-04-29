const fetch = require('node-fetch')

/**
 * This action generates images using Azure OpenAI DALL-E based on text prompts
 * 
 * @param {object} params - The input parameters
 * @param {string} params.prompt - The text prompt for image generation
 * @param {string} params.size - Image size (optional, defaults to 1024x1024)
 * @param {number} params.n - Number of images to generate (optional, defaults to 1)
 * @returns {object} Generated image URL and metadata
 */
async function main(params) {
  // Handle CORS preflight requests
  if (params.__ow_method === 'options') {
    return {
      statusCode: 200,
      body: {}
    }
  }

  const { prompt, size = "1024x1024", n = 1 } = params

  if (!prompt || typeof prompt !== 'string') {
    return {
      statusCode: 400,
      body: { error: 'prompt parameter is required and must be a string' }
    }
  }

  const AZURE_OPENAI_ENDPOINT = params.AZURE_OPENAI_IMAGE_ENDPOINT || process.env.AZURE_OPENAI_IMAGE_ENDPOINT
  const AZURE_OPENAI_KEY = params.AZURE_OPENAI_IMAGE_KEY || process.env.AZURE_OPENAI_IMAGE_KEY

  if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_KEY) {
    return {
      statusCode: 500,
      body: { error: 'Azure OpenAI image generation configuration is missing' }
    }
  }

  try {
    const response = await fetch(AZURE_OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': AZURE_OPENAI_KEY
      },
      body: JSON.stringify({
        prompt: prompt,
        n: n,
        size: size
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      
      // Handle specific error cases
      if (response.status === 400) {
        try {
          const errorData = JSON.parse(errorText)
          
          // Check for content policy violation
          if (errorData.error && errorData.error.code === 'content_policy_violation') {
            return {
              statusCode: 400,
              body: {
                error: 'Content Policy Violation',
                message: 'The generated prompt contains content that violates Azure\'s safety policies. Please try selecting different tags or generating a new prompt.',
                details: errorData.error.message,
                type: 'content_policy_violation'
              }
            }
          }
        } catch (parseError) {
          // If JSON parsing fails, fall through to generic error
        }
      }
      
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const result = await response.json()
    
    return {
      statusCode: 200,
      body: {
        prompt,
        imageUrl: result.data && result.data[0] ? result.data[0].url : null,
        revisedPrompt: result.data && result.data[0] ? result.data[0].revised_prompt : null,
        size,
        created: result.created,
        requestId: response.headers.get('x-request-id')
      }
    }

  } catch (error) {
    console.error('Error in image generation action:', error)
    return {
      statusCode: 500,
      body: { 
        error: 'Internal server error during image generation',
        details: error.message
      }
    }
  }
}

exports.main = main 
