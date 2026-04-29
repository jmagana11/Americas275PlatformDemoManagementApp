import actionWebInvoke from '../utils'
import allActions from '../config.json'
import { getUserEmail } from './accessControl'

function getAccessHeaders(ims) {
  const userEmail = getUserEmail(ims)
  return {
    ...(ims && ims.token ? { authorization: `Bearer ${ims.token}` } : {}),
    ...(ims && ims.org ? { 'x-gw-ims-org-id': ims.org } : {}),
    ...(userEmail ? { 'x-user-email': userEmail } : {}),
    'Content-Type': 'application/json'
  }
}

export async function callAccessManagementAction(ims, action, params = {}) {
  const actionUrl = allActions['access-management']
  if (!actionUrl) {
    throw new Error('access-management action not found in config')
  }

  const response = await actionWebInvoke(actionUrl, getAccessHeaders(ims), {
    action,
    userEmail: getUserEmail(ims),
    ...params
  })

  return response.body || response
}

export async function loadMyAccess(ims) {
  return callAccessManagementAction(ims, 'getMyAccess')
}
