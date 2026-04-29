const fetch = require('node-fetch')

/**
 * This action analyzes images using Azure Cognitive Services
 * 
 * @param {object} params - The input parameters
 * @param {Array} params.imageUrls - Array of image URLs to analyze
 * @param {string} params.fileName - Name of the uploaded file
 * @returns {object} Analysis results with tags for each image
 */

// Helper function to delay execution
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// Helper function to retry API calls with exponential backoff
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt === maxRetries) {
        throw error
      }
      
      // If it's a rate limit error (429), wait longer
      const isRateLimit = error.message.includes('429') || error.status === 429
      const delayTime = isRateLimit ? baseDelay * Math.pow(1.5, attempt - 1) : baseDelay / 2
      
      console.log(`Attempt ${attempt} failed, retrying in ${delayTime}ms...`, error.message)
      await delay(delayTime)
    }
  }
}

async function main(params) {
  // Handle CORS preflight requests
  if (params.__ow_method === 'options') {
    return {
      statusCode: 200,
      body: {}
    }
  }

  const { imageUrls, fileName } = params

  if (!imageUrls || !Array.isArray(imageUrls)) {
    return {
      statusCode: 400,
      body: { error: 'imageUrls parameter is required and must be an array' }
    }
  }

  const AZURE_VISION_ENDPOINT = params.AZURE_VISION_ENDPOINT || process.env.AZURE_VISION_ENDPOINT
  const AZURE_VISION_KEY = params.AZURE_VISION_KEY || process.env.AZURE_VISION_KEY

  if (!AZURE_VISION_ENDPOINT || !AZURE_VISION_KEY) {
    return {
      statusCode: 500,
      body: { error: 'Azure Vision configuration is missing' }
    }
  }

  const results = []

  try {
    // Limit processing to prevent timeouts - process max 20 images at a time
    const maxImages = Math.min(imageUrls.length, 20)
    const limitedImageUrls = imageUrls.slice(0, maxImages)
    
    if (imageUrls.length > maxImages) {
      console.log(`Processing first ${maxImages} images out of ${imageUrls.length} to prevent timeout`)
    }

    // Process each image URL with delay to avoid rate limiting
    for (let i = 0; i < limitedImageUrls.length; i++) {
      const imageUrl = limitedImageUrls[i]
      
      try {
        // Add delay between requests to avoid rate limiting (except for first request)
        if (i > 0) {
          await delay(300) // Reduced to 300ms delay between requests
        }

        const analysisResult = await retryWithBackoff(async () => {
          const response = await fetch(AZURE_VISION_ENDPOINT, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Ocp-Apim-Subscription-Key': AZURE_VISION_KEY
            },
            body: JSON.stringify({
              url: imageUrl
            })
          })

          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`HTTP ${response.status}: ${errorText}`)
          }

          return await response.json()
        })
        
        results.push({
          imageUrl,
          imageName: `Image ${i + 1}`,
          tags: analysisResult.tags || [],
          metadata: analysisResult.metadata || {},
          requestId: analysisResult.requestId
        })

        console.log(`Successfully analyzed image ${i + 1}/${limitedImageUrls.length}`)

      } catch (error) {
        console.error(`Error analyzing image ${imageUrl}:`, error)
        results.push({
          imageUrl,
          imageName: `Image ${i + 1}`,
          tags: [],
          error: error.message,
          status: error.message.includes('429') ? 'Rate limited - try again later' : 'Analysis failed'
        })
      }
    }

    return {
      statusCode: 200,
      body: {
        fileName,
        results,
        totalImages: imageUrls.length,
        processedImages: limitedImageUrls.length,
        successfulAnalyses: results.filter(r => !r.error).length,
        rateLimitedImages: results.filter(r => r.error && r.error.includes('429')).length,
        ...(imageUrls.length > maxImages && { 
          message: `Processed first ${maxImages} images out of ${imageUrls.length} to prevent timeout. Upload a file with fewer images for complete analysis.` 
        })
      }
    }

  } catch (error) {
    console.error('Error in image analysis action:', error)
    return {
      statusCode: 500,
      body: { error: 'Internal server error during image analysis' }
    }
  }
}

exports.main = main 
