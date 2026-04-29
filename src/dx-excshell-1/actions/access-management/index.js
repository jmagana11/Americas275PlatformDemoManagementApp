/*
* <license header>
*/

const { createBlobServiceClient } = require('../shared/blobStore')
const {
  createPermissionMap,
  getConfiguredAdministratorEmail,
  getRequestUserEmail,
  isAdministrator,
  normalizePolicyDocument,
  validatePolicyDocumentUpdate
} = require('../shared/accessPolicy')
const {
  readAccessPolicyDocument,
  writeAccessPolicyDocument
} = require('../shared/accessPolicyStore')

function response(statusCode, body) {
  return {
    statusCode,
    body
  }
}

function forbidden() {
  return response(403, {
    success: false,
    error: 'Administrator access required'
  })
}

async function loadPolicyDocument(params, blobServiceClient) {
  return readAccessPolicyDocument(blobServiceClient, {
    source: params
  })
}

function buildMyAccessBody(policyDocument, userEmail, params) {
  const isAdmin = isAdministrator(policyDocument, userEmail, { source: params })

  return {
    success: true,
    userEmail,
    isAdmin,
    administratorEmail: isAdmin ? getConfiguredAdministratorEmail(params) : undefined,
    permissions: createPermissionMap(policyDocument, userEmail, { source: params }),
    policiesLoaded: true
  }
}

async function getMyAccess(params, blobServiceClient) {
  const userEmail = getRequestUserEmail(params)
  const policyDocument = await loadPolicyDocument(params, blobServiceClient)

  return response(200, buildMyAccessBody(policyDocument, userEmail, params))
}

async function getPolicies(params, blobServiceClient) {
  const userEmail = getRequestUserEmail(params)
  const policyDocument = await loadPolicyDocument(params, blobServiceClient)

  if (!isAdministrator(policyDocument, userEmail, { source: params })) {
    return forbidden()
  }

  return response(200, {
    success: true,
    userEmail,
    isAdmin: true,
    administratorEmail: getConfiguredAdministratorEmail(params),
    policyDocument
  })
}

async function savePolicies(params, blobServiceClient) {
  const userEmail = getRequestUserEmail(params)
  const existingPolicyDocument = await loadPolicyDocument(params, blobServiceClient)

  if (!isAdministrator(existingPolicyDocument, userEmail, { source: params })) {
    return forbidden()
  }

  const policyDocument = params.policyDocument || params.policies
  const validation = validatePolicyDocumentUpdate(policyDocument, { source: params })

  if (!validation.valid) {
    return response(400, {
      success: false,
      error: 'Invalid access policy document',
      details: validation.errors
    })
  }

  const normalizedPolicyDocument = normalizePolicyDocument(policyDocument, {
    source: params,
    timestamp: new Date().toISOString()
  })
  normalizedPolicyDocument.updatedBy = userEmail || 'unknown'

  const savedPolicyDocument = await writeAccessPolicyDocument(blobServiceClient, normalizedPolicyDocument, {
    source: params,
    updatedBy: userEmail || 'unknown'
  })

  return response(200, {
    success: true,
    userEmail,
    isAdmin: true,
    administratorEmail: getConfiguredAdministratorEmail(params),
    policyDocument: savedPolicyDocument
  })
}

async function main(params = {}) {
  try {
    const action = params.action || 'getMyAccess'
    const blobServiceClient = createBlobServiceClient(params)

    switch (action) {
      case 'getMyAccess':
        return await getMyAccess(params, blobServiceClient)
      case 'getPolicies':
        return await getPolicies(params, blobServiceClient)
      case 'savePolicies':
        return await savePolicies(params, blobServiceClient)
      default:
        return response(400, {
          success: false,
          error: 'Invalid action. Use: getMyAccess, getPolicies, or savePolicies'
        })
    }
  } catch (error) {
    console.error('Access management error:', error)
    return response(500, {
      success: false,
      error: 'Access management failed',
      details: error.message
    })
  }
}

exports.main = main
