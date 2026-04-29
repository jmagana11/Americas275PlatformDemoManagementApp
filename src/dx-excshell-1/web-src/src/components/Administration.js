import React, { useEffect, useState } from 'react'
import {
  View,
  Heading,
  Text,
  Flex,
  Button,
  ButtonGroup,
  Picker,
  Item,
  TextArea,
  ProgressCircle,
  Well,
  Divider,
  StatusLight
} from '@adobe/react-spectrum'
import SaveFloppy from '@spectrum-icons/workflow/SaveFloppy'
import Refresh from '@spectrum-icons/workflow/Refresh'
import { callAccessManagementAction } from '../utils/accessManagement'
import {
  ACCESS_MODE_ALLOWLIST,
  ACCESS_MODE_PUBLIC,
  ADMINISTRATION_FEATURE_KEY,
  FEATURE_ACCESS_DEFINITIONS
} from '../../../actions/shared/accessPolicy'

function getPolicy(policyDocument, featureKey) {
  return policyDocument?.featurePolicies?.[featureKey] || {
    mode: ACCESS_MODE_PUBLIC,
    allowedEmails: []
  }
}

function getAllowedEmailsValue(policy) {
  if (Array.isArray(policy.allowedEmails)) {
    return policy.allowedEmails.join('\n')
  }

  return policy.allowedEmails || ''
}

function updatePolicy(policyDocument, featureKey, updates) {
  return {
    ...policyDocument,
    featurePolicies: {
      ...(policyDocument.featurePolicies || {}),
      [featureKey]: {
        ...getPolicy(policyDocument, featureKey),
        ...updates
      }
    }
  }
}

const Administration = ({ ims, refreshAccess }) => {
  const [policyDocument, setPolicyDocument] = useState(null)
  const [administratorEmail, setAdministratorEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  const loadPolicies = async () => {
    setLoading(true)
    setError('')
    setStatus('')

    try {
      const result = await callAccessManagementAction(ims, 'getPolicies')
      if (!result.success) {
        throw new Error(result.error || 'Unable to load policies')
      }
      setPolicyDocument(result.policyDocument)
      setAdministratorEmail(result.administratorEmail || '')
    } catch (loadError) {
      setError(loadError.message || 'Unable to load policies')
      setPolicyDocument(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPolicies()
  }, [ims])

  const savePolicies = async () => {
    if (!policyDocument) {
      return
    }

    setSaving(true)
    setError('')
    setStatus('')

    try {
      const result = await callAccessManagementAction(ims, 'savePolicies', {
        policyDocument
      })

      if (!result.success) {
        throw new Error(result.details ? result.details.join(', ') : (result.error || 'Unable to save policies'))
      }

      setPolicyDocument(result.policyDocument)
      setAdministratorEmail(result.administratorEmail || administratorEmail)
      setStatus('Saved')
      if (refreshAccess) {
        await refreshAccess()
      }
    } catch (saveError) {
      setError(saveError.message || 'Unable to save policies')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Flex justifyContent="center" marginTop="size-400">
        <ProgressCircle aria-label="Loading administration" isIndeterminate />
      </Flex>
    )
  }

  return (
    <Flex direction="column" gap="size-300">
      <Flex justifyContent="space-between" alignItems="center" wrap gap="size-200">
        <View>
          <Heading level={2}>Administration</Heading>
          {administratorEmail && (
            <StatusLight variant="positive">Bootstrap admin: {administratorEmail}</StatusLight>
          )}
        </View>
        <ButtonGroup>
          <Button variant="secondary" onPress={loadPolicies} isDisabled={saving}>
            <Refresh />
            <Text>Refresh</Text>
          </Button>
          <Button variant="cta" onPress={savePolicies} isDisabled={saving || !policyDocument}>
            <SaveFloppy />
            <Text>Save</Text>
          </Button>
        </ButtonGroup>
      </Flex>

      {error && (
        <Well UNSAFE_style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' }}>
          <Text>{error}</Text>
        </Well>
      )}

      {status && (
        <Well UNSAFE_style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' }}>
          <Text>{status}</Text>
        </Well>
      )}

      {policyDocument && (
        <Flex direction="column" gap="size-200">
          {FEATURE_ACCESS_DEFINITIONS.map((feature) => {
            const policy = getPolicy(policyDocument, feature.key)
            const isAdministration = feature.key === ADMINISTRATION_FEATURE_KEY

            return (
              <Well key={feature.key}>
                <Flex direction="column" gap="size-150">
                  <Flex justifyContent="space-between" alignItems="center" wrap gap="size-100">
                    <View>
                      <Heading level={4}>{feature.label}</Heading>
                      <Text>{feature.key}</Text>
                    </View>
                    <Picker
                      label="Access"
                      selectedKey={isAdministration ? ACCESS_MODE_ALLOWLIST : policy.mode}
                      isDisabled={isAdministration}
                      onSelectionChange={(mode) => {
                        setPolicyDocument(updatePolicy(policyDocument, feature.key, {
                          mode
                        }))
                      }}
                    >
                      <Item key={ACCESS_MODE_PUBLIC}>Public</Item>
                      <Item key={ACCESS_MODE_ALLOWLIST}>Allowlist</Item>
                    </Picker>
                  </Flex>
                  <Divider size="S" />
                  <TextArea
                    label="Allowed emails"
                    value={getAllowedEmailsValue(policy)}
                    onChange={(allowedEmails) => {
                      setPolicyDocument(updatePolicy(policyDocument, feature.key, {
                        allowedEmails
                      }))
                    }}
                    isDisabled={!isAdministration && policy.mode === ACCESS_MODE_PUBLIC}
                    width="100%"
                  />
                </Flex>
              </Well>
            )
          })}
        </Flex>
      )}
    </Flex>
  )
}

export default Administration
