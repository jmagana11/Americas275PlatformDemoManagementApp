/*
* <license header>
*/

/**
 * Pure helpers for the Offer Decisioning Studio Request-tab context (XDM) data.
 *
 * Context is optional: a decision request only needs an identity plus decision
 * scopes/surfaces. When the user opts in to sending XDM context and the selected
 * schema declares required fields, those must be filled before sending.
 *
 * Authored as CommonJS (no React, no browser APIs) so the same logic is used by
 * the React component and exercised directly by the Jest suite.
 */

function contextFieldPath (field = {}) {
  return String(field.relativePath || field.path || '').trim()
}

function isFilled (value) {
  if (value === undefined || value === null) return false
  if (typeof value === 'object') return true
  return String(value).trim() !== ''
}

// Return the required schema-field paths that have no matching, non-empty row in
// the current context fields. An empty result means every required field is set.
function getMissingRequiredContextFields (requiredFields = [], xdmFields = []) {
  const rowByPath = new Map()
  xdmFields.forEach((row) => {
    const path = String((row && row.path) || '').trim()
    if (path) {
      rowByPath.set(path, row)
    }
  })

  const missing = []
  requiredFields.forEach((field) => {
    const path = contextFieldPath(field)
    if (!path) {
      return
    }
    const row = rowByPath.get(path)
    if (!row || !isFilled(row.value)) {
      missing.push(path)
    }
  })

  return [...new Set(missing)]
}

module.exports = {
  contextFieldPath,
  getMissingRequiredContextFields
}
