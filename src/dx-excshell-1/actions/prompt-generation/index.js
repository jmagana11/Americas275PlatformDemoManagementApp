const fetch = require('node-fetch')
const { ConfigError, getAzureOpenAIConfig } = require('../shared/config')

/**
 * This action generates prompts using Azure OpenAI based on image analysis results
 * 
 * @param {object} params - The input parameters
 * @param {string} params.imageName - Name of the selected image
 * @param {Array} params.selectedTags - Array of selected tags for the image
 * @param {string} params.promptType - Type of prompt to generate (optional)
 * @returns {object} Generated prompt response
 */
async function main(params) {
  // Handle CORS preflight requests
  if (params.__ow_method === 'options') {
    return {
      statusCode: 200,
      body: {}
    }
  }

  const { imageName, selectedTags, promptType = 'marketing SMS' } = params

  if (!imageName || !selectedTags || !Array.isArray(selectedTags)) {
    return {
      statusCode: 400,
      body: { error: 'imageName and selectedTags parameters are required' }
    }
  }

  let azureOpenAIConfig
  try {
    azureOpenAIConfig = getAzureOpenAIConfig(params, 'text')
  } catch (error) {
    if (!(error instanceof ConfigError)) {
      throw error
    }
    return {
      statusCode: 500,
      body: { error: 'Azure OpenAI configuration is missing' }
    }
  }

  try {
    // Create a descriptive prompt based on the selected tags
    const tagsText = selectedTags.map(tag => 
      typeof tag === 'object' ? tag.name : tag
    ).join(', ')

    const userPrompt = `Create a detailed image generation prompt for an AI image generator (like DALL-E, Midjourney, or Stable Diffusion) based on the following visual elements: ${tagsText}. 

The prompt should:
- Focus on visual composition and elements
- Include artistic style and lighting details
- Be specific about colors, textures, and positioning
- Use descriptive adjectives for image quality (high resolution, detailed, photorealistic, etc.)
- Be optimized for generating a new image that contains these elements

Generate a concise but descriptive prompt that would create a similar image containing these elements: ${tagsText}.`

    const response = await fetch(azureOpenAIConfig.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': azureOpenAIConfig.apiKey
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: "You are an AI image generation specialist. Create detailed, descriptive prompts optimized for AI image generators that will produce high-quality images based on the provided visual elements."
          },
          {
            role: "user",
            content: userPrompt
          }
        ],
        max_tokens: 150,
        temperature: 0.7
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    
    const generatedPrompt = result.choices && result.choices[0] && result.choices[0].message
      ? result.choices[0].message.content
      : 'No prompt generated'

    return {
      statusCode: 200,
      body: {
        imageName,
        selectedTags,
        promptType,
        generatedPrompt: generatedPrompt.trim(),
        usage: result.usage || {},
        requestId: result.id
      }
    }

  } catch (error) {
    console.error('Error in prompt generation action:', error)
    return {
      statusCode: 500,
      body: { error: 'Internal server error during prompt generation' }
    }
  }
}

exports.main = main 
