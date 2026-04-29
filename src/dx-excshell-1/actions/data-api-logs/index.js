const { BlobServiceClient } = require('@azure/storage-blob');

async function main(params) {
  const logger = params.__ow_logger || console;

  try {
    // Let Adobe I/O Runtime handle CORS automatically
    const headers = {
      'Content-Type': 'application/json'
    };

    // Handle preflight requests
    if (params.__ow_method === 'options') {
      return {
        statusCode: 200,
        headers
      };
    }

    // Get query parameters
    const { startDate, endDate, mode, limit = 100 } = params;

    // Azure Blob Storage configuration
    const blobUrl = params.AZURE_BLOB_URL;
    const sasToken = params.AZURE_SAS_TOKEN;
    const containerUrl = `${blobUrl}${sasToken}`;
    
    const blobServiceClient = new BlobServiceClient(containerUrl);
    const containerClient = blobServiceClient.getContainerClient('');
    const blobPath = 'logs/data-api-logs.json';
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
    
    try {
      const downloadResponse = await blockBlobClient.download(0);
      const content = await streamToString(downloadResponse.readableStreamBody);
      let logs = JSON.parse(content);
      
      // Filter by date range if provided
      if (startDate || endDate) {
        logs = logs.filter(log => {
          const logDate = new Date(log.timestamp);
          const start = startDate ? new Date(startDate) : null;
          const end = endDate ? new Date(endDate) : null;
          
          if (start && logDate < start) return false;
          if (end && logDate > end) return false;
          return true;
        });
      }
      
      // Filter by mode if provided
      if (mode) {
        logs = logs.filter(log => log.request.mode === mode);
      }
      
      // Sort by timestamp (newest first)
      logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      // Apply limit
      logs = logs.slice(0, parseInt(limit));
      
      return {
        statusCode: 200,
        headers,
        body: {
          success: true,
          logs: logs,
          total: logs.length
        }
      };
      
    } catch (error) {
      if (error.statusCode === 404) {
        // No logs file exists yet
        return {
          statusCode: 200,
          headers,
          body: {
            success: true,
            logs: [],
            total: 0
          }
        };
      }
      throw error;
    }

  } catch (error) {
    logger.error('Error fetching logs:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        error: 'Failed to fetch logs',
        details: error.message
      }
    };
  }
}

async function streamToString(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on('data', (data) => {
      chunks.push(data.toString());
    });
    readableStream.on('end', () => {
      resolve(chunks.join(''));
    });
    readableStream.on('error', reject);
  });
}

exports.main = main; 