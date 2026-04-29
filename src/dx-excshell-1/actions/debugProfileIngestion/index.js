/*
* <license header>
*/

const axios = require('axios')

// main function that will be executed by Adobe I/O Runtime
async function main (params) {
  try {
    console.log('Debugging profile ingestion issues')
    
    // Get required parameters
    const datasetId = params.datasetId
    const schemaId = params.schemaId
    const sandboxName = params.sandboxName || 'prod'
    
    if (!datasetId) {
      return {
        statusCode: 400,
        body: { error: 'Missing required parameter: datasetId' }
      }
    }
    
    if (!schemaId) {
      return {
        statusCode: 400,
        body: { error: 'Missing required parameter: schemaId' }
      }
    }
    
    // Get authentication details
    const authHeader = params.__ow_headers && params.__ow_headers.authorization
    const token = authHeader ? authHeader.substring('Bearer '.length) : null
    const imsOrgId = (params.__ow_headers && params.__ow_headers['x-gw-ims-org-id']) || params.orgId || process.env.AEP_ORG_ID
    const apiKey = params.apiKey || process.env.AEP_API_KEY
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'x-api-key': apiKey,
      'x-gw-ims-org-id': imsOrgId,
      'x-sandbox-name': sandboxName,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
    
    const debugInfo = {
      timestamp: new Date().toISOString(),
      datasetId: datasetId,
      schemaId: schemaId,
      sandboxName: sandboxName,
      checks: {}
    }
    
    // 1. Check if dataset exists and is profile-enabled
    try {
      console.log('Checking dataset configuration...')
      const datasetResponse = await axios.get(`https://platform.adobe.io/data/foundation/catalog/dataSets/${datasetId}`, {
        headers: headers
      })
      
      const dataset = datasetResponse.data?.[datasetId]
      if (!dataset) {
        throw new Error(`Dataset ${datasetId} not found in response`)
      }
      
      // Check profile enabled status - handle different tag formats
      let profileEnabled = false
      let identityEnabled = false
      
      if (dataset.tags) {
        // Check for array format: ["enabled:true"]
        if (Array.isArray(dataset.tags['unifiedProfile'])) {
          profileEnabled = dataset.tags['unifiedProfile'].some(tag => 
            tag.includes('enabled:true') || tag === 'enabled'
          )
        }
        
        if (Array.isArray(dataset.tags['unifiedIdentity'])) {
          identityEnabled = dataset.tags['unifiedIdentity'].some(tag => 
            tag.includes('enabled:true') || tag === 'enabled'
          )
        }
        
        // Also check granular flags
        if (Array.isArray(dataset.tags['acp_granular_plugin_validation_flags'])) {
          const flags = dataset.tags['acp_granular_plugin_validation_flags']
          profileEnabled = profileEnabled || flags.includes('profile:enabled')
          identityEnabled = identityEnabled || flags.includes('identity:enabled')
        }
      }
      
      debugInfo.checks.dataset = {
        exists: true,
        name: dataset.name || 'Unknown',
        state: dataset.state || 'Unknown',
        profileEnabled: profileEnabled,
        identityEnabled: identityEnabled,
        tags: dataset.tags || {},
        schemaRef: dataset.schemaRef || {}
      }
      
      console.log('Dataset info:', debugInfo.checks.dataset)
      
    } catch (error) {
      console.error('Error checking dataset:', error.message)
      debugInfo.checks.dataset = {
        exists: false,
        error: error.message
      }
    }
    
    // 2. Check schema configuration
    try {
      console.log('Checking schema configuration...')
      // Try different schema endpoints - the schemaId might be a full URL
      let schemaUrl
      if (schemaId.startsWith('https://')) {
        // If schemaId is already a full URL, use it directly
        schemaUrl = schemaId
      } else {
        // Otherwise, construct the tenant endpoint
        schemaUrl = `https://platform.adobe.io/data/foundation/schemaregistry/tenant/schemas/${schemaId}`
      }
      
      console.log('Schema URL:', schemaUrl)
      const schemaResponse = await axios.get(schemaUrl, {
        headers: {
          ...headers,
          'Accept': 'application/vnd.adobe.xed+json'
        }
      })
      
      const schema = schemaResponse.data || {}
      debugInfo.checks.schema = {
        exists: true,
        title: schema.title || 'Unknown',
        type: schema.type || 'Unknown',
        profileEnabled: schema.meta && schema.meta['xdm:tags'] && Array.isArray(schema.meta['xdm:tags']) && schema.meta['xdm:tags'].includes('unifiedProfile'),
        identityFields: [],
        primaryIdentity: null
      }
      
      // Look for identity fields
      if (schema.properties && typeof schema.properties === 'object') {
        const findIdentities = (obj, path = '') => {
          try {
            for (const key in obj) {
              if (!obj.hasOwnProperty(key)) continue
              
              const currentPath = path ? `${path}.${key}` : key
              const prop = obj[key]
              
              if (prop && typeof prop === 'object' && prop['meta:xdmField']) {
                if (prop['meta:xdmType'] === 'string' && prop['meta:enum']) {
                  // This might be an identity field
                  if (key.includes('email') || key.includes('id') || key.includes('ID')) {
                    debugInfo.checks.schema.identityFields.push({
                      path: currentPath,
                      field: prop['meta:xdmField'],
                      type: prop['meta:xdmType']
                    })
                  }
                }
              }
              
              if (prop && typeof prop === 'object' && prop.properties) {
                findIdentities(prop.properties, currentPath)
              }
            }
          } catch (innerError) {
            console.error('Error in findIdentities:', innerError.message)
          }
        }
        
        findIdentities(schema.properties)
      }
      
      console.log('Schema info:', debugInfo.checks.schema)
      
    } catch (error) {
      console.error('Error checking schema:', error.message)
      debugInfo.checks.schema = {
        exists: false,
        error: error.message
      }
    }
    
    // 3. Check recent ingestion batches - ENHANCED VERSION
    try {
      console.log('Checking recent ingestion batches from multiple sources...')
      
      // Method 1: Standard Catalog API with dataset filter
      let catalogBatches = []
      try {
        console.log('Checking Catalog API for batches...')
        const batchesResponse = await axios.get(`https://platform.adobe.io/data/foundation/catalog/batches?dataSet=${datasetId}&limit=20&orderBy=desc:created`, {
          headers: headers
        })
        
        const responseData = batchesResponse.data || {}
        catalogBatches = Array.isArray(responseData) ? responseData : Object.values(responseData)
        console.log(`Found ${catalogBatches.length} batches in Catalog API`)
      } catch (catalogError) {
        console.error('Catalog API error:', catalogError.message)
      }
      
      // Method 2: All recent batches (broader search)
      let allRecentBatches = []
      try {
        console.log('Checking all recent batches...')
        const allBatchesResponse = await axios.get(`https://platform.adobe.io/data/foundation/catalog/batches?limit=50&orderBy=desc:created`, {
          headers: headers
        })
        
        const allResponseData = allBatchesResponse.data || {}
        const allBatches = Array.isArray(allResponseData) ? allResponseData : Object.values(allResponseData)
        
        // Filter for our dataset
        allRecentBatches = allBatches.filter(batch => 
          batch.dataSetId === datasetId || 
          (batch.dataSets && batch.dataSets.includes(datasetId))
        )
        console.log(`Found ${allRecentBatches.length} dataset-specific batches from ${allBatches.length} total recent batches`)
      } catch (allBatchesError) {
        console.error('All batches API error:', allBatchesError.message)
      }
      
      // Method 3: Data Ingestion API endpoint
      let ingestionBatches = []
      try {
        console.log('Checking Data Ingestion API...')
        const ingestionResponse = await axios.get(`https://platform.adobe.io/data/foundation/import/batches?limit=20&orderBy=desc:created`, {
          headers: headers
        })
        
        const ingestionData = ingestionResponse.data || {}
        const ingestionBatchList = Array.isArray(ingestionData) ? ingestionData : Object.values(ingestionData)
        
        // Filter for our dataset
        ingestionBatches = ingestionBatchList.filter(batch => 
          batch.dataSetId === datasetId || 
          (batch.dataSets && batch.dataSets.includes(datasetId))
        )
        console.log(`Found ${ingestionBatches.length} ingestion batches`)
      } catch (ingestionError) {
        console.error('Ingestion API error:', ingestionError.message)
      }
      
      // Method 4: Check streaming status endpoint for dataset
      let streamingBatches = []
      try {
        console.log('Checking streaming ingestion status...')
        const streamingResponse = await axios.get(`https://platform.adobe.io/data/foundation/streaming/status?dataSetId=${datasetId}`, {
          headers: headers
        })
        
        if (streamingResponse.data && streamingResponse.data.length > 0) {
          streamingBatches = streamingResponse.data
          console.log(`Found ${streamingBatches.length} streaming status entries`)
        }
      } catch (streamingError) {
        console.error('Streaming status error:', streamingError.message)
      }
      
      // Combine all batches and deduplicate
      const allFoundBatches = [
        ...catalogBatches.map(b => ({ ...b, source: 'catalog' })),
        ...allRecentBatches.map(b => ({ ...b, source: 'catalog-all' })),
        ...ingestionBatches.map(b => ({ ...b, source: 'ingestion' })),
        ...streamingBatches.map(b => ({ ...b, source: 'streaming' }))
      ]
      
      // Remove duplicates by ID
      const uniqueBatches = allFoundBatches.reduce((acc, batch) => {
        const id = batch.id || batch.batchId
        if (id && !acc.find(b => (b.id || b.batchId) === id)) {
          acc.push(batch)
        }
        return acc
      }, [])
      
      // Sort by creation date (most recent first)
      uniqueBatches.sort((a, b) => {
        const aDate = new Date(a.created || a.createdAt || 0)
        const bDate = new Date(b.created || b.createdAt || 0)
        return bDate - aDate
      })
      
      debugInfo.checks.batches = {
        totalFound: uniqueBatches.length,
        searchMethods: {
          catalog: catalogBatches.length,
          catalogAll: allRecentBatches.length,
          ingestion: ingestionBatches.length,
          streaming: streamingBatches.length
        },
        recent: uniqueBatches.slice(0, 10).map(batch => ({
          id: batch.id || batch.batchId || 'unknown',
          status: batch.status || 'unknown',
          recordCount: batch.metrics?.inputRecordCount || batch.recordCount || 'unknown',
          created: batch.created || batch.createdAt || 'unknown',
          completed: batch.completed || batch.completedAt || 'unknown',
          errors: batch.errors || [],
          source: batch.source || 'unknown',
          dataSetId: batch.dataSetId || batch.datasetId,
          // Enhanced error details
          failedRecords: batch.metrics?.failedRecordCount || 0,
          successfulRecords: batch.metrics?.successfulRecordCount || 0,
          invalidRecords: batch.metrics?.invalidRecordCount || 0
        }))
      }
      
      console.log('Enhanced batch search results:', debugInfo.checks.batches)
      
    } catch (error) {
      console.error('Error checking batches:', error.message)
      debugInfo.checks.batches = {
        totalFound: 0,
        recent: [],
        error: error.message
      }
    }
    
    // 4. Enhanced streaming ingestion status check
    try {
      console.log('Checking comprehensive streaming ingestion status...')
      
      const streamingChecks = {}
      
      // Check general streaming status
      try {
        const generalResponse = await axios.get(`https://platform.adobe.io/data/foundation/streaming/status`, {
          headers: headers
        })
        streamingChecks.general = generalResponse.data
      } catch (generalError) {
        streamingChecks.general = { error: generalError.message }
      }
      
      // Check streaming endpoint health
      try {
        const healthResponse = await axios.get(`https://platform.adobe.io/data/foundation/streaming/health`, {
          headers: headers
        })
        streamingChecks.health = healthResponse.data
      } catch (healthError) {
        streamingChecks.health = { error: healthError.message }
      }
      
      // Check specific dataset streaming status
      try {
        const datasetStreamingResponse = await axios.get(`https://platform.adobe.io/data/foundation/streaming/status?dataSetId=${datasetId}`, {
          headers: headers
        })
        streamingChecks.dataset = datasetStreamingResponse.data
      } catch (datasetError) {
        streamingChecks.dataset = { error: datasetError.message }
      }
      
      // Check recent streaming ingestion messages (if available)
      try {
        const messagesResponse = await axios.get(`https://platform.adobe.io/data/foundation/streaming/messages?limit=10`, {
          headers: headers
        })
        streamingChecks.recentMessages = messagesResponse.data
      } catch (messagesError) {
        streamingChecks.recentMessages = { error: messagesError.message }
      }
      
      debugInfo.checks.streaming = {
        ...streamingChecks,
        summary: {
          generalStatus: streamingChecks.general?.error ? 'ERROR' : 'OK',
          healthStatus: streamingChecks.health?.error ? 'ERROR' : 'OK',
          datasetStatus: streamingChecks.dataset?.error ? 'ERROR' : 'OK',
          messagesAvailable: !streamingChecks.recentMessages?.error
        }
      }
      
    } catch (error) {
      debugInfo.checks.streaming = {
        error: error.message,
        summary: { generalStatus: 'ERROR' }
      }
    }
    
    // 5. Check Data Ingestion Monitoring API for real-time status
    try {
      console.log('Checking Data Ingestion Monitoring API...')
      
      const ingestionMonitoring = {}
      
      // Check ingestion overview
      try {
        const overviewResponse = await axios.get(`https://platform.adobe.io/data/foundation/ingestion/overview`, {
          headers: headers
        })
        ingestionMonitoring.overview = overviewResponse.data
      } catch (overviewError) {
        ingestionMonitoring.overview = { error: overviewError.message }
      }
      
      // Check recent ingestion runs
      try {
        const runsResponse = await axios.get(`https://platform.adobe.io/data/foundation/ingestion/runs?limit=20&orderBy=desc:created`, {
          headers: headers
        })
        
        const runs = runsResponse.data || []
        // Filter for our dataset if possible
        const datasetRuns = runs.filter(run => 
          run.datasetId === datasetId || 
          run.targetDatasetId === datasetId ||
          (run.targets && run.targets.some(target => target.datasetId === datasetId))
        )
        
        ingestionMonitoring.runs = {
          total: runs.length,
          datasetSpecific: datasetRuns.length,
          recent: datasetRuns.slice(0, 5).map(run => ({
            id: run.id,
            status: run.status,
            created: run.created,
            updated: run.updated,
            recordsProcessed: run.recordsProcessed || 0,
            recordsFailed: run.recordsFailed || 0
          }))
        }
      } catch (runsError) {
        ingestionMonitoring.runs = { error: runsError.message }
      }
      
      debugInfo.checks.ingestionMonitoring = ingestionMonitoring
      
    } catch (error) {
      debugInfo.checks.ingestionMonitoring = { error: error.message }
    }
    
    // 6. Generate enhanced recommendations
    const recommendations = []
    
    if (debugInfo.checks.dataset && !debugInfo.checks.dataset.profileEnabled) {
      recommendations.push({
        issue: 'Dataset not profile-enabled',
        solution: 'Enable the dataset for Real-Time Customer Profile in the AEP UI: Datasets > Select Dataset > Profile toggle',
        priority: 'HIGH'
      })
    }
    
    if (debugInfo.checks.schema && !debugInfo.checks.schema.profileEnabled) {
      recommendations.push({
        issue: 'Schema not profile-enabled',
        solution: 'Enable the schema for Real-Time Customer Profile in the AEP UI: Schemas > Select Schema > Profile toggle',
        priority: 'HIGH'
      })
    }
    
    if (debugInfo.checks.schema && debugInfo.checks.schema.identityFields && debugInfo.checks.schema.identityFields.length === 0) {
      recommendations.push({
        issue: 'No identity fields found in schema',
        solution: 'Add identity fields to your schema (email, customer ID, etc.) and mark one as primary identity',
        priority: 'HIGH'
      })
    }
    
    if (debugInfo.checks.batches && debugInfo.checks.batches.recent && debugInfo.checks.batches.recent.length === 0) {
      const totalSearched = debugInfo.checks.batches.searchMethods ? 
        Object.values(debugInfo.checks.batches.searchMethods).reduce((sum, count) => sum + count, 0) : 0
      
      recommendations.push({
        issue: 'No recent ingestion batches found',
        solution: `No batches found despite searching ${totalSearched} recent batches across multiple APIs. This suggests either: 1) Data isn't reaching AEP, 2) Streaming connector issues, 3) Data validation failures, or 4) Normal delay (wait 5-10 minutes)`,
        priority: 'HIGH'
      })
    }
    
    if (debugInfo.checks.streaming?.summary?.generalStatus === 'ERROR') {
      recommendations.push({
        issue: 'Streaming ingestion service issues detected',
        solution: 'Check AEP platform status and streaming connector configuration. Verify authentication and endpoint URLs.',
        priority: 'HIGH'
      })
    }
    
    if (debugInfo.checks.ingestionMonitoring?.runs?.datasetSpecific === 0) {
      recommendations.push({
        issue: 'No ingestion runs found for this dataset',
        solution: 'Verify streaming connector is correctly configured and pointing to this dataset. Check connector status and test the inlet URL.',
        priority: 'MEDIUM'
      })
    }
    
    debugInfo.recommendations = recommendations
    
    return {
      statusCode: 200,
      body: {
        debug: debugInfo,
        summary: {
          datasetProfileEnabled: debugInfo.checks.dataset?.profileEnabled || false,
          schemaProfileEnabled: debugInfo.checks.schema?.profileEnabled || false,
          hasIdentityFields: (debugInfo.checks.schema?.identityFields?.length || 0) > 0,
          recentBatches: debugInfo.checks.batches?.totalFound || 0,
          batchSearchMethods: debugInfo.checks.batches?.searchMethods || {},
          streamingStatus: debugInfo.checks.streaming?.summary?.generalStatus || 'UNKNOWN',
          ingestionRuns: debugInfo.checks.ingestionMonitoring?.runs?.datasetSpecific || 0,
          totalIngestionRuns: debugInfo.checks.ingestionMonitoring?.runs?.total || 0,
          recommendationsCount: recommendations.length,
          searchTimestamp: debugInfo.timestamp,
          // Quick diagnostic summary
          likelyIssues: recommendations.filter(r => r.priority === 'HIGH').map(r => r.issue)
        }
      }
    }
    
  } catch (error) {
    console.error('Error in debugProfileIngestion action:', error.message)
    
    return {
      statusCode: 500,
      body: { error: 'Internal server error', details: error.message }
    }
  }
}

exports.main = main 