import { getActionUrlFromRuntime } from './actionUrls'

export const FALLBACK_ORGANIZATIONS = Object.freeze([
  {
    key: 'MA1HOL',
    orgKey: 'MA1HOL',
    environmentKey: 'MA1HOL',
    name: 'MA1HOL',
    label: 'MA1HOL',
    segmentRefreshLabel: 'MA1HOL - Americas 275 Demo',
    tenant: 'adobedemoamericas275',
    emailDomain: 'ma1.aephandsonlabs.com',
    msAppRoleId: 'eacc6a31-fab3-498f-ab86-40691558a214',
    msAppResourceId: 'cf7a5d82-dc58-43c4-87ab-2d0cc8492f11',
    msAppResId: 'cf7a5d82-dc58-43c4-87ab-2d0cc8492f11'
  },
  {
    key: 'POT5HOL',
    orgKey: 'POT5HOL',
    environmentKey: 'POT5HOL',
    name: 'POT5HOL',
    label: 'POT5HOL',
    segmentRefreshLabel: 'POT5HOL - Americas POT5',
    tenant: 'adobeamericaspot5',
    emailDomain: 'pot5.aephandsonlabs.com',
    msAppRoleId: 'eacc6a31-fab3-498f-ab86-40691558a214',
    msAppResourceId: '2078824c-fe4d-494e-a958-8df76a9035ab',
    msAppResId: '2078824c-fe4d-494e-a958-8df76a9035ab'
  }
])

function normalizeOrganization(org) {
  const key = org.key || org.orgKey || org.environmentKey
  return {
    ...org,
    key,
    orgKey: org.orgKey || key,
    environmentKey: org.environmentKey || key,
    name: org.name || org.label || key,
    label: org.label || org.name || key,
    segmentRefreshLabel: org.segmentRefreshLabel || org.label || org.name || key,
    msAppResId: org.msAppResId || org.msAppResourceId
  }
}

export function normalizeOrganizations(organizations) {
  const source = Array.isArray(organizations) && organizations.length > 0
    ? organizations
    : FALLBACK_ORGANIZATIONS
  return source.map(normalizeOrganization).filter((org) => org.key)
}

export function organizationsToMap(organizations) {
  return normalizeOrganizations(organizations).reduce((map, org) => {
    map[org.key] = org
    return map
  }, {})
}

function extractOrganizations(result) {
  return result?.body?.organizations ||
    result?.organizations ||
    result?.body?.body?.organizations ||
    []
}

export async function fetchOrganizationMetadata(runtime) {
  try {
    const actionUrl = getActionUrlFromRuntime('get-org-sandboxes', runtime)
    const response = await fetch(actionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'list-orgs'
      })
    })

    if (!response.ok) {
      return normalizeOrganizations()
    }

    const result = await response.json()
    return normalizeOrganizations(extractOrganizations(result))
  } catch (error) {
    console.error('Error loading organization metadata:', error)
    return normalizeOrganizations()
  }
}
