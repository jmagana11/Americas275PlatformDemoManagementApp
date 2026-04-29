/*
* <license header>
*/

const {
  readJsonBlob,
  writeJsonBlob
} = require('./blobStore')
const {
  createDefaultPolicyDocument,
  normalizePolicyDocument
} = require('./accessPolicy')

const ACCESS_POLICY_BLOB_PATH = 'access-control/policies.json'
const ACCESS_POLICY_METADATA = Object.freeze({
  purpose: 'access-control-policies'
})

async function readAccessPolicyDocument(blobServiceClient, options = {}) {
  const document = await readJsonBlob(blobServiceClient, ACCESS_POLICY_BLOB_PATH, options)

  if (!document) {
    return createDefaultPolicyDocument(options)
  }

  return normalizePolicyDocument(document, options)
}

async function writeAccessPolicyDocument(blobServiceClient, document, options = {}) {
  const normalizedDocument = normalizePolicyDocument(document, {
    ...options,
    timestamp: options.timestamp || new Date().toISOString()
  })

  await writeJsonBlob(blobServiceClient, ACCESS_POLICY_BLOB_PATH, normalizedDocument, {
    ...options,
    metadata: {
      ...ACCESS_POLICY_METADATA,
      ...(options.metadata || {})
    }
  })

  return normalizedDocument
}

module.exports = {
  ACCESS_POLICY_BLOB_PATH,
  readAccessPolicyDocument,
  writeAccessPolicyDocument
}
