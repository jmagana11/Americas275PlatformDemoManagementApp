const { BlobServiceClient } = require('@azure/storage-blob');
const { v4: uuidv4 } = require('uuid');

async function main(params) {
  const logger = params.__ow_logger || console;
  const startTime = Date.now();

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
    if (!params.mode) {
      return {
        statusCode: 400,
        headers,
        body: {
          error: 'Missing required parameter: mode (must be "products" or "orders")'
        }
      };
    }

    if (!params.filename) {
      return {
        statusCode: 400,
        headers,
        body: {
          error: 'Missing required parameter: filename'
        }
      };
    }

    const { mode, filename } = params;

    // Validate mode
    const validModes = ['products', 'orders', 'stock', 'reservation_info', 'resort_summary', 'resort_attributes', 'rewards_member'];
    if (!validModes.includes(mode)) {
      return {
        statusCode: 400,
        headers,
        body: {
          error: `Invalid mode. Must be one of: ${validModes.join(', ')}`
        }
      };
    }

    // Azure Blob Storage configuration
    const blobUrl = params.AZURE_BLOB_URL;
    const sasToken = params.AZURE_SAS_TOKEN;
    const containerUrl = `${blobUrl}${sasToken}`;
    
    logger.info(`Fetching data for mode: ${mode}`);
    
    let responseData;
    
    if (mode === 'products') {
      responseData = await getProductRecommendations(containerUrl, params, logger);
    } else if (mode === 'orders') {
      responseData = await getOrderConfirmations(containerUrl, params, logger);
    } else if (mode === 'stock') {
      responseData = await getStockData(containerUrl, params, logger);
    } else if (mode === 'reservation_info') {
      responseData = await getReservationInfo(containerUrl, params, logger);
    } else if (mode === 'resort_summary') {
      responseData = await getResortSummary(containerUrl, params, logger);
    } else if (mode === 'resort_attributes') {
      responseData = await getResortAttributes(containerUrl, params, logger);
    } else if (mode === 'rewards_member') {
      responseData = await getRewardsMember(containerUrl, params, logger);
    }
    


    // Log the API request
    await logApiRequest(params, {
      mode: params.mode,
      filename: params.filename,
      ...params
    }, responseData, startTime);

    return {
      statusCode: 200,
      headers,
      body: responseData
    };

  } catch (error) {
    logger.error('Error fetching data:', error);
    
    // Log the error
    await logApiRequest(params, {
      mode: params.mode,
      filename: params.filename,
      ...params
    }, {
      success: false,
      error: error.message
    }, startTime);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        error: 'Failed to fetch data',
        details: error.message
      }
    };
  }
}

async function getProductRecommendations(containerUrl, params, logger) {
  const { limit = 5, filename } = params;
  
  // Validate limit
  const numLimit = parseInt(limit);
  if (isNaN(numLimit) || numLimit < 1 || numLimit > 100) {
    throw new Error('Invalid limit. Must be a number between 1 and 100');
  }

  // Download product catalog file using provided filename from demos folder
  const blobServiceClient = new BlobServiceClient(containerUrl);
  const containerClient = blobServiceClient.getContainerClient('');
  const blobPath = `demos/${filename}`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
  
  try {
    const downloadResponse = await blockBlobClient.download(0);
    const csvContent = await streamToString(downloadResponse.readableStreamBody);
    const products = csvToJson(csvContent);
    
    // Return limited number of products
    const limitedProducts = products.slice(0, numLimit);
    
    logger.info(`Returning ${limitedProducts.length} product recommendations`);
    
    return {
      success: true,
      data: limitedProducts
    };
    
  } catch (error) {
    if (error.statusCode === 404) {
      return {
        success: false,
        error: `File '${filename}' not found. Please upload the file first.`
      };
    }
    throw error;
  }
}

async function getOrderConfirmations(containerUrl, params, logger) {
  const { userId, filename } = params;
  
  if (!userId) {
    throw new Error('userId parameter is required for order confirmations');
  }

  // Download order data file using provided filename from demos folder
  const blobServiceClient = new BlobServiceClient(containerUrl);
  const containerClient = blobServiceClient.getContainerClient('');
  const blobPath = `demos/${filename}`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
  
  try {
    const downloadResponse = await blockBlobClient.download(0);
    const csvContent = await streamToString(downloadResponse.readableStreamBody);
    const orders = csvToJson(csvContent);
    
    logger.info(`Processing ${orders.length} total orders for user ID: ${userId}`);
    logger.info(`Available customer IDs in data: ${orders.map(o => o.customer_id).slice(0, 5).join(', ')}...`);
    
    // Filter orders by userId - handle multiple possible field names and case-insensitive matching
    const userOrders = orders.filter(order => {
      // Check multiple possible field names for customer ID
      const customerId = order.customer_id || order.customerId || order.user_id || order.userId || order.id;
      
      if (!customerId) {
        return false;
      }
      
      // Convert both to strings and trim whitespace for comparison
      const orderCustomerId = customerId.toString().trim();
      const searchUserId = userId.toString().trim();
      
      // Case-insensitive comparison
      const matches = orderCustomerId.toLowerCase() === searchUserId.toLowerCase();
      
      if (matches) {
        logger.info(`Found matching order: ${order.order_number} for customer ID: ${orderCustomerId}`);
      }
      
      return matches;
    });
    
    logger.info(`Found ${userOrders.length} orders for user ${userId}`);
    
    return {
      success: true,
      data: userOrders
    };
    
  } catch (error) {
    if (error.statusCode === 404) {
      return {
        success: false,
        error: `File '${filename}' not found. Please upload the file first.`
      };
    }
    throw error;
  }
}

async function getStockData(containerUrl, params, logger) {
  const { sku, storeId, filename } = params;
  
  if (!sku) {
    throw new Error('sku parameter is required for stock mode');
  }
  
  if (!storeId) {
    throw new Error('storeId parameter is required for stock mode');
  }

  // Download stock data file using provided filename from demos folder
  const blobServiceClient = new BlobServiceClient(containerUrl);
  const containerClient = blobServiceClient.getContainerClient('');
  const blobPath = `demos/${filename}`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
  
  try {
    const downloadResponse = await blockBlobClient.download(0);
    const csvContent = await streamToString(downloadResponse.readableStreamBody);
    const stockData = csvToJson(csvContent);
    
    logger.info(`Processing ${stockData.length} total stock records for SKU: ${sku}, Store: ${storeId}`);
    logger.info(`Available SKUs in data: ${stockData.map(s => s.sku).slice(0, 5).join(', ')}...`);
    
    // Filter stock data by SKU and Store ID - handle multiple possible field names and case-insensitive matching
    const matchingStock = stockData.filter(item => {
      // Check multiple possible field names for SKU and Store ID
      const itemSku = item.sku || item.SKU || item.product_sku || item.productSku || '';
      const itemStoreId = item.store_id || item.storeId || item.store_id || item.STORE_ID || '';
      
      if (!itemSku || !itemStoreId) {
        return false;
      }
      
      // Convert both to strings and trim whitespace for comparison
      const searchSku = sku.toString().trim();
      const searchStoreId = storeId.toString().trim();
      
      // Case-insensitive comparison
      const skuMatches = itemSku.toLowerCase() === searchSku.toLowerCase();
      const storeMatches = itemStoreId.toLowerCase() === searchStoreId.toLowerCase();
      
      if (skuMatches && storeMatches) {
        logger.info(`Found matching stock: SKU ${itemSku} at Store ${itemStoreId}`);
      }
      
      return skuMatches && storeMatches;
    });
    
    logger.info(`Found ${matchingStock.length} stock records for SKU ${sku} at Store ${storeId}`);
    
    // For stock mode, return single item instead of array
    const singleStockItem = matchingStock.length > 0 ? matchingStock[0] : null;
    logger.info(`Returning single stock item: ${JSON.stringify(singleStockItem)}`);
    
    return {
      success: true,
      data: singleStockItem
    };
    
  } catch (error) {
    if (error.statusCode === 404) {
      return {
        success: false,
        error: `File '${filename}' not found. Please upload the file first.`
      };
    }
    throw error;
  }
}

// Travel & Hospitality API handlers
async function getReservationInfo(containerUrl, params, logger) {
  const { filename, confirmationId } = params;
  
  try {
    logger.info(`Fetching reservation info for confirmation ID: ${confirmationId}`);
    
    const blobServiceClient = new BlobServiceClient(containerUrl);
    const containerClient = blobServiceClient.getContainerClient('');
    const blockBlobClient = containerClient.getBlockBlobClient(filename);
    
    const downloadResponse = await blockBlobClient.download();
    const csvContent = await streamToString(downloadResponse.readableStreamBody);
    const jsonData = csvToJson(csvContent);
    
    // Find reservation by confirmation ID
    const reservation = jsonData.find(item => item.confirmation_id === confirmationId);
    
    if (!reservation) {
      return {
        success: false,
        error: `Reservation with confirmation ID '${confirmationId}' not found.`
      };
    }
    
    logger.info(`Found reservation: ${JSON.stringify(reservation)}`);
    
    return {
      success: true,
      data: reservation
    };
    
  } catch (error) {
    if (error.statusCode === 404) {
      return {
        success: false,
        error: `File '${filename}' not found. Please upload the file first.`
      };
    }
    throw error;
  }
}

async function getResortSummary(containerUrl, params, logger) {
  const { filename, hotelId } = params;
  
  try {
    logger.info(`Fetching resort summary for hotel ID: ${hotelId}`);
    
    const blobServiceClient = new BlobServiceClient(containerUrl);
    const containerClient = blobServiceClient.getContainerClient('');
    const blockBlobClient = containerClient.getBlockBlobClient(filename);
    
    const downloadResponse = await blockBlobClient.download();
    const csvContent = await streamToString(downloadResponse.readableStreamBody);
    const jsonData = csvToJson(csvContent);
    
    // Find resort by hotel ID
    const resort = jsonData.find(item => item.hotel_id === hotelId);
    
    if (!resort) {
      return {
        success: false,
        error: `Resort with hotel ID '${hotelId}' not found.`
      };
    }
    
    logger.info(`Found resort: ${JSON.stringify(resort)}`);
    
    return {
      success: true,
      data: resort
    };
    
  } catch (error) {
    if (error.statusCode === 404) {
      return {
        success: false,
        error: `File '${filename}' not found. Please upload the file first.`
      };
    }
    throw error;
  }
}

async function getResortAttributes(containerUrl, params, logger) {
  const { filename, hotelId, roomId } = params;
  
  try {
    logger.info(`Fetching resort attributes for hotel ID: ${hotelId}, room ID: ${roomId}`);
    
    const blobServiceClient = new BlobServiceClient(containerUrl);
    const containerClient = blobServiceClient.getContainerClient('');
    const blockBlobClient = containerClient.getBlockBlobClient(filename);
    
    const downloadResponse = await blockBlobClient.download();
    const csvContent = await streamToString(downloadResponse.readableStreamBody);
    const jsonData = csvToJson(csvContent);
    
    // Find room attributes by hotel ID and room ID
    const roomAttributes = jsonData.find(item => 
      item.hotel_id === hotelId && item.room_id === roomId
    );
    
    if (!roomAttributes) {
      return {
        success: false,
        error: `Room attributes for hotel ID '${hotelId}' and room ID '${roomId}' not found.`
      };
    }
    
    logger.info(`Found room attributes: ${JSON.stringify(roomAttributes)}`);
    
    return {
      success: true,
      data: roomAttributes
    };
    
  } catch (error) {
    if (error.statusCode === 404) {
      return {
        success: false,
        error: `File '${filename}' not found. Please upload the file first.`
      };
    }
    throw error;
  }
}

async function getRewardsMember(containerUrl, params, logger) {
  const { filename, memberId } = params;
  
  try {
    logger.info(`Fetching rewards member for member ID: ${memberId}`);
    
    const blobServiceClient = new BlobServiceClient(containerUrl);
    const containerClient = blobServiceClient.getContainerClient('');
    const blockBlobClient = containerClient.getBlockBlobClient(filename);
    
    const downloadResponse = await blockBlobClient.download();
    const csvContent = await streamToString(downloadResponse.readableStreamBody);
    const jsonData = csvToJson(csvContent);
    
    // Find member by member ID
    const member = jsonData.find(item => item.member_id === memberId);
    
    if (!member) {
      return {
        success: false,
        error: `Rewards member with member ID '${memberId}' not found.`
      };
    }
    
    logger.info(`Found rewards member: ${JSON.stringify(member)}`);
    
    return {
      success: true,
      data: member
    };
    
  } catch (error) {
    if (error.statusCode === 404) {
      return {
        success: false,
        error: `File '${filename}' not found. Please upload the file first.`
      };
    }
    throw error;
  }
}

function csvToJson(csvContent) {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(',').map(header => header.trim());
  const result = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === headers.length) {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = values[index];
      });
      result.push(obj);
    }
  }
  
  return result;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
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

// Logging functions for API requests
async function logApiRequest(params, requestData, responseData, startTime) {
  try {
    const blobServiceClient = getBlobServiceClient(params);
    const logEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      request: requestData,
      response: responseData,
      responseTime: Date.now() - startTime,
      user: getUserIdentifier(params.__ow_headers || {})
    };
    
    // Append to existing logs
    const blobPath = 'logs/data-api-logs.json';
    let existingLogs = [];
    
    try {
      const containerClient = blobServiceClient.getContainerClient('');
      const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
      const downloadResponse = await blockBlobClient.download(0);
      const existingContent = await streamToString(downloadResponse.readableStreamBody);
      existingLogs = JSON.parse(existingContent);
    } catch (error) {
      // File doesn't exist or is empty, start with empty array
      existingLogs = [];
    }
    
    // Add new log entry
    existingLogs.push(logEntry);
    
    // Keep only last 1000 entries to prevent file from growing too large
    if (existingLogs.length > 1000) {
      existingLogs = existingLogs.slice(-1000);
    }
    
    // Write back to blob storage
    const containerClient = blobServiceClient.getContainerClient('');
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
    await blockBlobClient.upload(JSON.stringify(existingLogs, null, 2), JSON.stringify(existingLogs, null, 2).length);
    
  } catch (error) {
    console.error('Error logging API request:', error);
  }
}

function getBlobServiceClient(params) {
  const blobUrl = params.AZURE_BLOB_URL;
  const sasToken = params.AZURE_SAS_TOKEN;
  const containerUrl = `${blobUrl}${sasToken}`;
  return new BlobServiceClient(containerUrl);
}

function getUserIdentifier(headers) {
  return headers['x-ims-user-id'] || headers['x-gw-ims-user-id'] || 'anonymous';
}

exports.main = main; 