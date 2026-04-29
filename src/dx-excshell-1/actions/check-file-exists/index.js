const { BlobServiceClient } = require('@azure/storage-blob');

async function main(params) {
  const logger = params.__ow_logger || console;

  try {
    // Validate required parameters
    if (!params.filename) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: {
          error: 'Missing required parameter: filename'
        }
      };
    }

    const { filename } = params;
    
    // Add demos folder prefix if not already present
    let blobPath = filename;
    if (!blobPath.startsWith('demos/')) {
      blobPath = `demos/${filename}`;
    }
    
    logger.info(`Checking if file exists in Azure Blob Storage: ${blobPath}`);
    
    // Azure Blob Storage configuration
    const blobUrl = params.AZURE_BLOB_URL;
    const sasToken = params.AZURE_SAS_TOKEN;
    
    if (!blobUrl || !sasToken) {
      throw new Error('Azure Blob Storage configuration not found');
    }
    
    const containerUrl = `${blobUrl}${sasToken}`;
    const blobServiceClient = new BlobServiceClient(containerUrl);
    const containerClient = blobServiceClient.getContainerClient('');
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
    
    // Check if blob exists
    const exists = await blockBlobClient.exists();
    
    if (exists) {
      // Get blob properties to show file details
      const properties = await blockBlobClient.getProperties();
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          exists: true,
          filename: blobPath,
          lastModified: properties.lastModified,
          size: properties.contentLength,
          etag: properties.etag,
          metadata: properties.metadata
        }
      };
    } else {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          exists: false,
          filename: blobPath
        }
      };
    }

  } catch (error) {
    logger.error('Error checking file existence:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: {
        error: 'Failed to check file existence',
        details: error.message
      }
    };
  }
}

module.exports = { main }; 