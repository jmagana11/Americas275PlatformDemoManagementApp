/**
 * Utility functions for getting action URLs
 */

// This function will help get the correct action URL based on the environment
export const getActionUrl = (actionName) => {
  // In development, you might want to use localhost
  // In production, this will be your deployed action URL
  
  // Check if we're in development mode
  if (process.env.NODE_ENV === 'development') {
    // For local development, you might want to use a different URL
    // or mock the actions
    return `http://localhost:3233/api/v1/web/dx-excshell-1/${actionName}`
  }
  
  // For production, construct the URL based on your namespace
  const namespace = process.env.AIO_RUNTIME_NAMESPACE || '440115-377linenhornet-stage'
  return `https://${namespace}.adobeioruntime.net/api/v1/web/dx-excshell-1/${actionName}`
}

// Alternative function that tries to extract namespace from runtime
export const getActionUrlFromRuntime = (actionName, runtime) => {
  // Try to get namespace from runtime configuration if available
  if (runtime && runtime.namespace) {
    return `https://${runtime.namespace}.adobeioruntime.net/api/v1/web/dx-excshell-1/${actionName}`
  }
  
  // Fallback to environment variable or default
  return getActionUrl(actionName)
} 