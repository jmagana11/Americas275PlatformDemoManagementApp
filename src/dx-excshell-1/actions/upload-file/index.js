const { BlobServiceClient } = require('@azure/storage-blob');
const { handleUploadOperation } = require('../shared/customActionStore');

async function main(params) {
  const logger = params.__ow_logger || console;

  const responseHeaders = {
    'Content-Type': 'application/json'
  };

  if (params.__ow_method === 'options') {
    return {
      statusCode: 200,
      headers: responseHeaders
    };
  }

  const operation = (params.operation || '').toString().trim().toLowerCase();
  if (['create', 'list', 'delete', 'replace'].includes(operation)) {
    try {
      const result = await handleUploadOperation(params);
      const statusCode = result.success === false ? 400 : 200;
      return {
        statusCode,
        headers: responseHeaders,
        body: result
      };
    } catch (error) {
      logger.error('Custom action dataset operation failed:', error);
      return {
        statusCode: 400,
        headers: responseHeaders,
        body: {
          success: false,
          error: error.message
        }
      };
    }
  }

  try {
    if (!params.fileData || !params.fileType) {
      return {
        statusCode: 400,
        headers: responseHeaders,
        body: {
          error: 'Missing required parameters: fileData and fileType'
        }
      };
    }

    const { fileData, fileType, customFilename } = params;

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
        headers: responseHeaders,
        body: {
          error: `Invalid fileType. Must be one of: ${validFileTypes.join(', ')}`
        }
      };
    }

    let filename;
    if (params.filename && params.filename.trim()) {
      filename = params.filename.trim();
      if (!filename.toLowerCase().endsWith('.csv')) {
        filename += '.csv';
      }
    } else if (customFilename && customFilename.trim()) {
      filename = customFilename.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      if (!filename.toLowerCase().endsWith('.csv')) {
        filename += '.csv';
      }
    } else {
      const timestamp = new Date().toISOString().split('T')[0];
      const time = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
      const defaultFilenames = {
        order_data: 'order_data.csv',
        product_catalog: 'product_catalog.csv',
        inventory_stock: 'inventory_stock.csv',
        reservation_info: 'reservation_info.csv',
        resort_summary: 'resort_summary.csv',
        resort_attributes: 'resort_attributes.csv',
        rewards_member: 'rewards_member.csv'
      };

      const baseName = defaultFilenames[fileType] || `${fileType}.csv`;
      filename = baseName.replace('.csv', `_${timestamp}_${time}.csv`);
    }

    const blobPath = `demos/${filename}`;

    logger.info(`Uploading file to Azure Blob Storage: ${blobPath}`);

    const csvContent = jsonToCsv(fileData);
    const blobUrl = params.AZURE_BLOB_URL;
    const sasToken = params.AZURE_SAS_TOKEN;

    if (!blobUrl || !sasToken) {
      throw new Error('Azure Blob Storage configuration not found');
    }

    const containerUrl = `${blobUrl}${sasToken}`;
    const blobServiceClient = new BlobServiceClient(containerUrl);
    const containerClient = blobServiceClient.getContainerClient('');
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath);

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
      headers: responseHeaders,
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
      headers: responseHeaders,
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

  const headers = Object.keys(jsonData[0]);
  const csvRows = [];
  csvRows.push(headers.join(','));

  for (const row of jsonData) {
    const values = headers.map((header) => {
      const value = row[header];
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
