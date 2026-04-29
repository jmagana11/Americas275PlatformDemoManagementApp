const axios = require('axios');

// main function that will be executed by Adobe I/O Runtime
async function main(params) {
  try {
    console.log('🚀 Calling the downloadSchemaDetails action');
    console.log('Available params:', Object.keys(params));
    
    // Handle web action body parsing to get schemaIds
    let schemaIds;
    if (params.__ow_body) {
      const body = Buffer.from(params.__ow_body, 'base64').toString();
      const parsedBody = JSON.parse(body);
      schemaIds = parsedBody.schemaIds;
    } else {
      schemaIds = params.schemaIds;
    }

    console.log('📥 Schema IDs to process:', schemaIds);

    // Validate required parameters
    if (!schemaIds || !Array.isArray(schemaIds) || schemaIds.length === 0) {
      return {
        statusCode: 400,
        body: { error: 'Missing required parameter: schemaIds (array)' }
      };
    }
    
    // Get the bearer token from Authorization header (this comes from the frontend user)
    const authHeader = params.__ow_headers && params.__ow_headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 400,
        body: { error: 'Missing or invalid Authorization header' }
      };
    }
    
    const token = authHeader.substring('Bearer '.length);
    
    // Get sandbox name from headers
    const sandboxName = params.__ow_headers?.sandboxname || 'prod';
    
    // Get IMS org from headers (sent by frontend) or use known workspace value
    const imsOrgId = (params.__ow_headers && params.__ow_headers['x-gw-ims-org-id']) || params.orgId || process.env.AEP_ORG_ID;
    
    // Use stored API key or known workspace value
    const apiKey = params.apiKey || process.env.AEP_API_KEY;
    
    console.log('Using frontend user token with API key and org');
    console.log('Sandbox:', sandboxName);
    
    // Use the frontend token with stored API key and org
    const platformHeaders = {
      'Authorization': 'Bearer ' + token,
      'x-api-key': apiKey,
      'x-gw-ims-org-id': imsOrgId,
      'x-sandbox-name': sandboxName,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.adobe.xed+json'
    };

    // Extract tenant ID from first schema ID
    const tenantIdMatch = schemaIds[0].match(/\/([^\/]+)\/schemas\//);
    const tenantId = tenantIdMatch ? tenantIdMatch[1] : null;
    
    if (!tenantId) {
      console.log('⚠️  Could not extract tenant ID from schema IDs');
      return {
        statusCode: 400,
        body: { error: 'Could not extract tenant ID from schema IDs' }
      };
    }

    console.log('🏢 Tenant ID:', tenantId);
    console.log('📊 Processing', schemaIds.length, 'schemas...');

    // Initialize collections
    const result = {
      create: {
        dataTypes: [],
        mixins: [],
        schemas: [],
        identities: [],
        descriptors: [],
        eventTypes: []
      }
    };

    const processedItems = new Set();

    // Function to fetch and process each schema
    for (const schemaId of schemaIds) {
      try {
        console.log('📋 Processing schema:', schemaId);
        
        // Get the schema details
        const schemaResponse = await axios.get(`https://platform.adobe.io/data/foundation/schemaregistry/tenant/schemas/${encodeURIComponent(schemaId)}`, {
          headers: platformHeaders
        });

        if (schemaResponse.data) {
          const schema = schemaResponse.data;
          const schemaKey = schema.$id || schemaId;
          
          if (!processedItems.has(schemaKey)) {
            result.create.schemas.push(schema);
            processedItems.add(schemaKey);
            console.log('✅ Added schema:', schema.title || schemaKey);
          }
        }
        
      } catch (error) {
        console.error('❌ Error processing schema', schemaId, ':', error.message);
        // Continue processing other schemas
      }
    }

    // Get all data types for the tenant
    try {
      console.log('📦 Fetching data types...');
      const dataTypesResponse = await axios.get(`https://platform.adobe.io/data/foundation/schemaregistry/tenant/datatypes`, {
        headers: platformHeaders
      });
      
      if (dataTypesResponse.data && dataTypesResponse.data.results) {
        result.create.dataTypes = dataTypesResponse.data.results;
        console.log('✅ Added', result.create.dataTypes.length, 'data types');
      }
    } catch (error) {
      console.error('❌ Error fetching data types:', error.message);
    }

    // Get all mixins (field groups) for the tenant
    try {
      console.log('🧩 Fetching field groups...');
      const mixinsResponse = await axios.get(`https://platform.adobe.io/data/foundation/schemaregistry/tenant/mixins`, {
        headers: platformHeaders
      });
      
      if (mixinsResponse.data && mixinsResponse.data.results) {
        result.create.mixins = mixinsResponse.data.results;
        console.log('✅ Added', result.create.mixins.length, 'field groups');
      }
    } catch (error) {
      console.error('❌ Error fetching field groups:', error.message);
    }

    // Create summary
    const summary = {
      schemasProcessed: result.create.schemas.length,
      dataTypesIncluded: result.create.dataTypes.length,
      mixinsIncluded: result.create.mixins.length,
      identitiesIncluded: result.create.identities.length,
      descriptorsIncluded: result.create.descriptors.length,
      eventTypesIncluded: result.create.eventTypes.length,
      exportDate: new Date().toISOString(),
      sandbox: sandboxName,
      tenantId: tenantId
    };

    console.log('📊 Export Summary:', summary);

    // Return the result
    return {
      statusCode: 200,
      body: {
        ...result,
        summary
      }
    };

  } catch (error) {
    console.error('❌ Error in downloadSchemaDetails:', error);
    return {
      statusCode: 500,
      body: { error: error.message }
    };
  }
}

exports.main = main; 