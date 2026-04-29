/* 
* <license header>
*/

import React, { useState } from 'react'
import PropTypes from 'prop-types'
import {
  Flex,
  Heading,
  Form,
  TextField,
  NumberField,
  ActionButton,
  StatusLight,
  ProgressCircle,
  Item,
  Text,
  View,
  Well,
  Divider,
  Content
} from '@adobe/react-spectrum'
import Function from '@spectrum-icons/workflow/Function'
import User from '@spectrum-icons/workflow/User'
import Gift from '@spectrum-icons/workflow/Gift'

import allActions from '../config.json'
import actionWebInvoke from '../utils'

// remove the deprecated key
const actions = Object.keys(allActions).reduce((obj, key) => {
  if (key.lastIndexOf('/') > -1) {
    obj[key] = allActions[key]
  }
  return obj
}, {})

const OfferSimulator = (props) => {
  const [state, setState] = useState({
    profileId: '',
    itemCount: 3,
    profileData: null,
    offerData: null,
    profileLoading: false,
    offerLoading: false,
    profileError: null,
    offerError: null
  })

  const handleProfileLookup = async () => {
    if (!state.profileId.trim()) {
      setState(prev => ({ ...prev, profileError: 'Profile ID is required' }))
      return
    }

    setState(prev => ({ 
      ...prev, 
      profileLoading: true, 
      profileError: null,
      profileData: null 
    }))

    try {
      const actionUrl = actions['dx-excshell-1/offer-simulator']
      if (!actionUrl) {
        throw new Error('Offer Simulator action URL not found')
      }

      const headers = props.ims ? {
        'authorization': `Bearer ${props.ims.token}`,
        'x-gw-ims-org-id': props.ims.org
      } : {}

      const response = await actionWebInvoke(
        actionUrl,
        headers,
        {
          operation: 'lookupProfile',
          profileId: state.profileId.trim()
        }
      )

      if (response.success) {
        setState(prev => ({ 
          ...prev, 
          profileData: response.data,
          profileLoading: false 
        }))
      } else {
        setState(prev => ({ 
          ...prev, 
          profileError: response.error || 'Profile lookup failed',
          profileLoading: false 
        }))
      }
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        profileError: error.message,
        profileLoading: false 
      }))
    }
  }

  const handleGetOffers = async () => {
    if (!state.profileId.trim()) {
      setState(prev => ({ ...prev, offerError: 'Profile ID is required' }))
      return
    }

    setState(prev => ({ 
      ...prev, 
      offerLoading: true, 
      offerError: null,
      offerData: null 
    }))

    try {
      const actionUrl = actions['dx-excshell-1/offer-simulator']
      if (!actionUrl) {
        throw new Error('Offer Simulator action URL not found')
      }

      const headers = props.ims ? {
        'authorization': `Bearer ${props.ims.token}`,
        'x-gw-ims-org-id': props.ims.org
      } : {}

      const response = await actionWebInvoke(
        actionUrl,
        headers,
        {
          operation: 'getOffers',
          profileId: state.profileId.trim(),
          itemCount: state.itemCount
        }
      )

      if (response.success) {
        setState(prev => ({ 
          ...prev, 
          offerData: response.data,
          offerLoading: false 
        }))
      } else {
        setState(prev => ({ 
          ...prev, 
          offerError: response.error || 'Offer decisioning failed',
          offerLoading: false 
        }))
      }
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        offerError: error.message,
        offerLoading: false 
      }))
    }
  }

  const renderProfileData = () => {
    if (!state.profileData) return null

    const profile = state.profileData.entities?.[0]?.entity
    if (!profile) return null

    return (
      <Well>
        <Heading level={4}>Profile Data</Heading>
        <View marginTop="size-200">
          <Text><strong>Profile ID:</strong> {state.profileId}</Text>
          {profile._adobedemoamericas275 && (
            <View marginTop="size-100">
              <Text><strong>CRM ID:</strong> {profile._adobedemoamericas275.crmid}</Text>
              {profile._adobedemoamericas275.individualScore && (
                <View marginTop="size-100">
                  <Text><strong>Individual Scores:</strong></Text>
                  {profile._adobedemoamericas275.individualScore.map((score, index) => (
                    <View key={index} marginStart="size-200" marginTop="size-50">
                      <Text>• {score.core.category}: {score.core.propensityScore}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      </Well>
    )
  }

  const renderOfferData = () => {
    if (!state.offerData) return null

    const propositions = state.offerData['xdm:propositions'] || []
    
    return (
      <Well>
        <Heading level={4}>Offer Decisions</Heading>
        <View marginTop="size-200">
          <Text><strong>Proposition ID:</strong> {state.offerData['xdm:propositionId']}</Text>
          <Text marginTop="size-100"><strong>Number of Propositions:</strong> {propositions.length}</Text>
          
          {propositions.map((proposition, index) => (
            <Well key={index} marginTop="size-200">
              <Heading level={5}>Proposition {index + 1}</Heading>
              <View marginTop="size-200">
                <Text><strong>Activity ID:</strong> {proposition['xdm:activity']?.['xdm:id']}</Text>
                <Text><strong>Placement ID:</strong> {proposition['xdm:placement']?.['xdm:id']}</Text>
                
                {proposition['xdm:options'] && proposition['xdm:options'].length > 0 && (
                  <View marginTop="size-100">
                    <Text><strong>Options:</strong></Text>
                    {proposition['xdm:options'].map((option, optIndex) => {
                      // Extract category from the option ID (remove numbers)
                      const optionId = option['xdm:id'] || ''
                      const categoryMatch = optionId.match(/personalized-option:([a-zA-Z]+)/)
                      const category = categoryMatch ? categoryMatch[1] : 'Unknown'
                      const categoryName = category.charAt(0).toUpperCase() + category.slice(1)
                      
                      return (
                        <View key={optIndex} marginStart="size-200" marginTop="size-50">
                          <Text>• Option {optIndex + 1} - {categoryName}</Text>
                          {option['xdm:content'] && (
                            <View marginStart="size-100" marginTop="size-50">
                              <div 
                                style={{ 
                                  marginTop: '8px'
                                }}
                                dangerouslySetInnerHTML={{ __html: option['xdm:content'] }}
                              />
                            </View>
                          )}
                        </View>
                      )
                    })}
                  </View>
                )}
                
                {proposition['xdm:fallback'] && (
                  <View marginTop="size-100">
                    <Text><strong>Fallback Offer:</strong> {proposition['xdm:fallback']['xdm:id']}</Text>
                    {proposition['xdm:fallback']['xdm:content'] && (
                      <Text marginStart="size-100">Content: {proposition['xdm:fallback']['xdm:content']}</Text>
                    )}
                  </View>
                )}
              </View>
            </Well>
          ))}
        </View>
      </Well>
    )
  }

  return (
    <View width="size-8000">
      <Flex direction="column" gap="size-200">
        <Heading level={1}>
          <Function size="L" />
          <Text>Offer Simulator</Text>
        </Heading>
        
        <Text>
          Simulate offer decisions using Adobe Journey Optimizer's Decisioning API. 
          First lookup a profile, then retrieve personalized offers.
        </Text>

        <Divider size="M" />

        {/* Profile Lookup Section */}
        <Well>
          <Heading level={3}>
            <User size="M" />
            <Text>Step 1: Profile Lookup</Text>
          </Heading>
          
          <Form>
            <Flex direction="column" gap="size-200" marginTop="size-200">
              <TextField
                label="Profile ID (CRMID)"
                value={state.profileId}
                onChange={(value) => setState(prev => ({ ...prev, profileId: value }))}
                placeholder="Enter CRMID (e.g., CRM001)"
                width="size-3000"
              />
              
              <ActionButton
                onPress={handleProfileLookup}
                isDisabled={state.profileLoading}
                variant="primary"
              >
                {state.profileLoading ? (
                  <ProgressCircle size="S" />
                ) : (
                  <User size="S" />
                )}
                <Text>Lookup Profile</Text>
              </ActionButton>
              
              {state.profileError && (
                <StatusLight variant="negative">
                  <Text>{state.profileError}</Text>
                </StatusLight>
              )}
            </Flex>
          </Form>
          
          {renderProfileData()}
        </Well>

        <Divider size="M" />

        {/* Offer Decisioning Section */}
        <Well>
          <Heading level={3}>
            <Gift size="M" />
            <Text>Step 2: Get Offers</Text>
          </Heading>
          
          <Form>
            <Flex direction="column" gap="size-200" marginTop="size-200">
              <NumberField
                label="Number of Offers"
                value={state.itemCount}
                onChange={(value) => setState(prev => ({ ...prev, itemCount: value }))}
                minValue={1}
                maxValue={30}
                width="size-2000"
              />
              
              <ActionButton
                onPress={handleGetOffers}
                isDisabled={state.offerLoading || !state.profileId.trim()}
                variant="primary"
              >
                {state.offerLoading ? (
                  <ProgressCircle size="S" />
                ) : (
                  <Gift size="S" />
                )}
                <Text>Get Offers</Text>
              </ActionButton>
              
              {state.offerError && (
                <StatusLight variant="negative">
                  <Text>{state.offerError}</Text>
                </StatusLight>
              )}
            </Flex>
          </Form>
          
          {renderOfferData()}
        </Well>
      </Flex>
    </View>
  )
}

OfferSimulator.propTypes = {
  ims: PropTypes.any
}

export default OfferSimulator
