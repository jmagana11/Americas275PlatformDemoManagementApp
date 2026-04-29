const fetch = require('node-fetch')

/**
 * This action shortens URLs using the dsslnk.io API
 * 
 * @param {object} params - The input parameters
 * @param {string|array} params.urls - Single URL string or array of URL objects for batch processing
 * @param {boolean} params.validateUrl - Whether to validate URLs (optional, defaults to true)
 * @param {array} params.tags - Array of tags (optional, defaults to ["americas275"])
 * @param {boolean} params.crawlable - Whether URLs should be crawlable (optional, defaults to true)
 * @param {boolean} params.forwardQuery - Whether to forward query parameters (optional, defaults to true)
 * @param {boolean} params.findIfExists - Whether to find existing short URLs (optional, defaults to true)
 * @param {number} params.shortCodeLength - Length of short code (optional, defaults to 5)
 * @returns {object} Shortened URL(s) with metadata
 */
async function main(params) {
  const startTime = Date.now()
  console.log(`[${new Date().toISOString()}] URL Shortener action started`)
  
  // Handle CORS preflight requests
  if (params.__ow_method === 'options') {
    return {
      statusCode: 200,
      body: {}
    }
  }

  const { 
    urls, 
    validateUrl = true, 
    tags = ["americas275"], 
    crawlable = true, 
    forwardQuery = true, 
    findIfExists = true, 
    shortCodeLength = 5 
  } = params

  if (!urls) {
    return {
      statusCode: 400,
      body: { error: 'urls parameter is required' }
    }
  }

  const API_ENDPOINT = 'https://dsslnk.io/rest/v2/short-urls'
  const API_KEY = '06403e20-8549-48dd-87f6-748418e740d4'

  try {
    const urlsToProcess = Array.isArray(urls) ? urls : [{ longUrl: urls }]
    console.log(`[${new Date().toISOString()}] Processing ${urlsToProcess.length} URLs`)
    
    // Limit batch size to prevent timeouts (max 20 URLs per request for better reliability)
    const MAX_BATCH_SIZE = 20
    if (urlsToProcess.length > MAX_BATCH_SIZE) {
      return {
        statusCode: 400,
        body: { 
          error: `Batch size too large. Maximum ${MAX_BATCH_SIZE} URLs allowed per request. Please split your CSV into smaller files.`,
          maxBatchSize: MAX_BATCH_SIZE,
          currentBatchSize: urlsToProcess.length
        }
      }
    }

    // Create a timeout wrapper for fetch requests
    const fetchWithTimeout = async (url, options, timeoutMs = 30000) => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
      
      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        })
        clearTimeout(timeoutId)
        return response
      } catch (error) {
        clearTimeout(timeoutId)
        if (error.name === 'AbortError') {
          throw new Error(`Request timeout after ${timeoutMs}ms`)
        }
        throw error
      }
    }

    // Process URLs in parallel for much better performance
    const processUrl = async (urlObj, index) => {
      const urlStartTime = Date.now()
      const longUrl = typeof urlObj === 'string' ? urlObj : urlObj.longUrl

      console.log(`[${new Date().toISOString()}] Processing URL ${index + 1}: ${longUrl}`)

      if (!longUrl || typeof longUrl !== 'string') {
        return {
          index,
          longUrl: longUrl,
          error: 'Invalid URL provided',
          shortUrl: null,
          qrCodeUrl: null
        }
      }

      try {
        const requestBody = {
          longUrl,
          validateUrl,
          tags,
          crawlable,
          forwardQuery,
          findIfExists,
          shortCodeLength
        }

        console.log(`[${new Date().toISOString()}] Making API request for URL ${index + 1}`)

        const response = await fetchWithTimeout(API_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': API_KEY
          },
          body: JSON.stringify(requestBody)
        }, 15000) // 15 second timeout per request (reduced from 25 seconds)

        const urlElapsed = Date.now() - urlStartTime
        console.log(`[${new Date().toISOString()}] URL ${index + 1} API response received after ${urlElapsed}ms`)

        if (!response.ok) {
          const errorText = await response.text()
          let errorMessage = `HTTP ${response.status}`
          
          console.log(`[${new Date().toISOString()}] URL ${index + 1} API error: ${response.status} - ${errorText}`)
          
          try {
            const errorData = JSON.parse(errorText)
            // Extract the most relevant error information
            if (errorData.detail) {
              errorMessage = errorData.detail
            } else if (errorData.title) {
              errorMessage = errorData.title
            } else {
              errorMessage = errorData.message || errorData.error || errorText
            }
          } catch (parseError) {
            errorMessage = errorText
          }

          return {
            index,
            longUrl,
            error: errorMessage,
            shortUrl: null,
            qrCodeUrl: null
          }
        }

        const result = await response.json()
        console.log(`[${new Date().toISOString()}] URL ${index + 1} processed successfully in ${urlElapsed}ms`)
        
        return {
          index,
          longUrl: result.longUrl,
          shortUrl: result.shortUrl,
          shortCode: result.shortCode,
          qrCodeUrl: `${result.shortUrl}/qr-code`,
          dateCreated: result.dateCreated,
          visitsCount: result.visitsCount,
          tags: result.tags,
          meta: result.meta,
          domain: result.domain,
          title: result.title,
          crawlable: result.crawlable,
          forwardQuery: result.forwardQuery,
          error: null
        }

      } catch (urlError) {
        const urlElapsed = Date.now() - urlStartTime
        console.error(`[${new Date().toISOString()}] Error processing URL ${index + 1} after ${urlElapsed}ms:`, urlError.message)
        return {
          index,
          longUrl,
          error: `Processing error: ${urlError.message}`,
          shortUrl: null,
          qrCodeUrl: null
        }
      }
    }

    // Process URLs with lower concurrency for better reliability
    const CONCURRENCY_LIMIT = 2 // Process only 2 URLs simultaneously to reduce load
    const results = []
    
    for (let i = 0; i < urlsToProcess.length; i += CONCURRENCY_LIMIT) {
      const batch = urlsToProcess.slice(i, i + CONCURRENCY_LIMIT)
      console.log(`[${new Date().toISOString()}] Processing batch ${Math.floor(i / CONCURRENCY_LIMIT) + 1} with ${batch.length} URLs`)
      
      const batchPromises = batch.map((urlObj, batchIndex) => 
        processUrl(urlObj, i + batchIndex)
      )
      
      try {
        const batchResults = await Promise.all(batchPromises)
        results.push(...batchResults)
        
        console.log(`[${new Date().toISOString()}] Batch ${Math.floor(i / CONCURRENCY_LIMIT) + 1} completed`)
        
        // Longer delay between batches to be more respectful to the API
        if (i + CONCURRENCY_LIMIT < urlsToProcess.length) {
          console.log(`[${new Date().toISOString()}] Waiting 500ms before next batch...`)
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      } catch (error) {
        console.error(`[${new Date().toISOString()}] Error processing batch:`, error)
        // If batch fails, add error results for this batch
        batch.forEach((urlObj, batchIndex) => {
          results.push({
            index: i + batchIndex,
            longUrl: typeof urlObj === 'string' ? urlObj : urlObj.longUrl,
            error: 'Batch processing error',
            shortUrl: null,
            qrCodeUrl: null
          })
        })
      }
    }

    // Sort results by original index to maintain order
    results.sort((a, b) => a.index - b.index)
    
    // Remove index field from final results
    const finalResults = results.map(({ index, ...result }) => result)

    const totalElapsed = Date.now() - startTime
    console.log(`[${new Date().toISOString()}] URL Shortener action completed in ${totalElapsed}ms`)

    return {
      statusCode: 200,
      body: {
        success: true,
        results: Array.isArray(urls) ? finalResults : finalResults[0],
        processedCount: finalResults.length,
        successCount: finalResults.filter(r => !r.error).length,
        errorCount: finalResults.filter(r => r.error).length,
        processingTimeMs: totalElapsed
      }
    }

  } catch (error) {
    const totalElapsed = Date.now() - startTime
    console.error(`[${new Date().toISOString()}] Error in URL shortener action after ${totalElapsed}ms:`, error)
    return {
      statusCode: 500,
      body: { 
        success: false,
        error: 'Internal server error during URL shortening',
        details: error.message,
        processingTimeMs: totalElapsed
      }
    }
  }
}

exports.main = main 