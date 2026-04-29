const { BlobServiceClient } = require('@azure/storage-blob');

function normalizePath(path) {
  if (!path) return '/';
  if (!path.startsWith('/')) path = '/' + path;
  return path.replace(/\/+$/, ''); // remove trailing slash
}

async function main(params) {
  const method = params.__ow_method || 'GET';
  const rawPath = params.__ow_path || '/';
  const path = normalizePath(rawPath);
  const headers = params.__ow_headers || {};

  // List sessions (no sessionId required)
  if (path === '/sessions' && method === 'GET') {
    return await listSessions(params);
  }

  // Create session (no sessionId required)
  if (path === '/sessions' && method === 'POST') {
    return await createSession(params);
  }

  // Session ID is optional now - we use actual filenames
  const sessionId = headers['x-session-id'] || params.sessionId;

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

    // Validate required parameters
    if (!params.fileData || !params.fileType) {
      return {
        statusCode: 400,
        headers,
        body: {
          error: 'Missing required parameters: fileData and fileType'
        }
      };
    }

    const { fileData, fileType, customFilename } = params;
    
    // Validate file type
    const validFileTypes = [
      'order_data', 
      'product_catalog', 
      'inventory_stock',
      'reservation_info',
      'resort_summary', 
      'resort_attributes',
      'rewards_member'
    ];
    
    if (!validFileTypes.includes(fileType)) {
      return {
        statusCode: 400,
        headers,
        body: {
          error: `Invalid fileType. Must be one of: ${validFileTypes.join(', ')}`
        }
      };
    }

    // Determine filename - use provided filename if available, otherwise use default
    let filename;
    if (params.filename && params.filename.trim()) {
      // Use the provided filename (from user's file)
      filename = params.filename.trim();
      // Ensure it ends with .csv
      if (!filename.toLowerCase().endsWith('.csv')) {
        filename += '.csv';
      }
    } else if (customFilename && customFilename.trim()) {
      // Fallback to custom filename if provided
      filename = customFilename.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      // Ensure it ends with .csv
      if (!filename.toLowerCase().endsWith('.csv')) {
        filename += '.csv';
      }
    } else {
      // Use default filenames with timestamp to avoid conflicts
      const timestamp = new Date().toISOString().split('T')[0]
      const time = new Date().toTimeString().split(' ')[0].replace(/:/g, '-')
      const defaultFilenames = {
        'order_data': 'order_data.csv',
        'product_catalog': 'product_catalog.csv',
        'inventory_stock': 'inventory_stock.csv',
        'reservation_info': 'reservation_info.csv',
        'resort_summary': 'resort_summary.csv',
        'resort_attributes': 'resort_attributes.csv',
        'rewards_member': 'rewards_member.csv'
      };
      
      const baseName = defaultFilenames[fileType] || `${fileType}.csv`
      filename = baseName.replace('.csv', `_${timestamp}_${time}.csv`)
    }
    
    // Add demos folder prefix
    const blobPath = `demos/${filename}`;
    
    logger.info(`Uploading file to Azure Blob Storage: ${blobPath}`);
    
    // Convert JSON data back to CSV format
    const csvContent = jsonToCsv(fileData);
    
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
    
    // Upload to Azure Blob Storage
    await blockBlobClient.upload(csvContent, csvContent.length, {
      blobHTTPHeaders: {
        blobContentType: 'text/csv'
      },
      metadata: {
        uploadedAt: new Date().toISOString(),
        fileType: fileType
      }
    });
    
    logger.info(`File uploaded successfully: ${blobPath}, Size: ${csvContent.length} bytes`);

    return {
      statusCode: 200,
      headers,
      body: {
        success: true,
        message: `File ${blobPath} uploaded successfully`,
        filename: blobPath,
        uploadedAt: new Date().toISOString(),
        size: csvContent.length
      }
    };

  } catch (error) {
    logger.error('Error uploading file:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        error: 'Failed to upload file',
        details: error.message
      }
    };
  }
}

function jsonToCsv(jsonData) {
  if (!jsonData || jsonData.length === 0) {
    return '';
  }
  
  // Get headers from first object
  const headers = Object.keys(jsonData[0]);
  
  // Create CSV content
  const csvRows = [];
  csvRows.push(headers.join(','));
  
  for (const row of jsonData) {
    const values = headers.map(header => {
      const value = row[header];
      // Handle values that contain commas or quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value || '';
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}

exports.main = main; 