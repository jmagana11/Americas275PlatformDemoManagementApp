import React, { useState, useEffect } from 'react'
import {
  Provider,
  defaultTheme,
  View,
  Heading,
  Content,
  Text,
  Button,
  TextField,
  NumberField,
  Checkbox,
  CheckboxGroup,
  ActionButton,
  StatusLight,
  ProgressBar,
  Well,
  Flex,
  Grid,
  Tabs,
  TabList,
  TabPanels,
  Item,
  Picker,
  Badge,
  Divider,
  TextArea,
  Switch,
  DialogContainer,
  Dialog,
  ButtonGroup,
  DialogTrigger
} from '@adobe/react-spectrum'
import Delete from '@spectrum-icons/workflow/Delete'
import Key from '@spectrum-icons/workflow/Key'
import UserGroup from '@spectrum-icons/workflow/UserGroup'
import Settings from '@spectrum-icons/workflow/Settings'
import Copy from '@spectrum-icons/workflow/Copy'
import Refresh from '@spectrum-icons/workflow/Refresh'
import { getActionUrlFromRuntime } from '../utils/actionUrls'

const UserManagement = ({ runtime, ims }) => {
  // State management
  const [activeTab, setActiveTab] = useState('config')
  const [notification, setNotification] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Environment Configuration
  const [selectedEnvironment, setSelectedEnvironment] = useState('MA1HOL')
  const [sandboxName, setSandboxName] = useState('')
  
  // Authentication tokens
  const [imsToken, setImsToken] = useState('')
  const [msftToken, setMsftToken] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [imsTokenExpiry, setImsTokenExpiry] = useState(null)
  const [msftTokenExpiry, setMsftTokenExpiry] = useState(null)
  const [msftTimeRemaining, setMsftTimeRemaining] = useState(0)
  
  // Session Management
  const [sessionName, setSessionName] = useState('')
  const [savedSessions, setSavedSessions] = useState([])
  const [autoSaveTimer, setAutoSaveTimer] = useState(null)
  const [sessionRequired, setSessionRequired] = useState(false)
  
  // User Creation
  const [groupName, setGroupName] = useState('')
  const [emailPrefix, setEmailPrefix] = useState('')
  const [userCount, setUserCount] = useState(20)
  const [defaultPassword, setDefaultPassword] = useState('iopjkl!1')
  const [testMode, setTestMode] = useState(true)
  
  // Password Management
  const [labPassword, setLabPassword] = useState('')
  const [showDefaultPassword, setShowDefaultPassword] = useState(false)
  const [showLabPassword, setShowLabPassword] = useState(false)
  const [passwordValid, setPasswordValid] = useState(false)
  
  // Results and Status
  const [operationResults, setOperationResults] = useState(null)
  const [categorizedResults, setCategorizedResults] = useState({
    userCreation: [],
    passwordReset: [],
    labShutdown: []
  })
  const [hasErrors, setHasErrors] = useState(false)
  
  // Refs for cleanup to prevent memory leaks
  const isMountedRef = React.useRef(true)
  const timeoutsRef = React.useRef([])
  
  // Additional state for floating action button and settings modal
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isMicrosoftTokenModalOpen, setIsMicrosoftTokenModalOpen] = useState(false)
  const [microsoftTokenInput, setMicrosoftTokenInput] = useState('')
  
  // Response viewer modal state
  const [isResponseViewerOpen, setIsResponseViewerOpen] = useState(false)
  const [selectedResponse, setSelectedResponse] = useState(null)
  
  // Expired token dialog state
  const [isExpiredTokenDialogOpen, setIsExpiredTokenDialogOpen] = useState(false)
  
  // Environment configurations
  const environments = {
    MA1HOL: {
      environmentKey: 'MA1HOL',
      name: 'MA1HOL',
      tenant: 'adobedemoamericas275',
      emailDomain: 'ma1.aephandsonlabs.com',
      msAppRoleId: 'eacc6a31-fab3-498f-ab86-40691558a214',
      msAppResId: 'cf7a5d82-dc58-43c4-87ab-2d0cc8492f11'
    },
    POT5HOL: {
      environmentKey: 'POT5HOL',
      name: 'POT5HOL',
      tenant: 'adobeamericaspot5',
      emailDomain: 'pot5.aephandsonlabs.com',
      msAppRoleId: 'eacc6a31-fab3-498f-ab86-40691558a214',
      msAppResId: '2078824c-fe4d-494e-a958-8df76a9035ab'
    }
  }

  // Utility functions
  const showNotification = React.useCallback((type, message) => {
    if (!isMountedRef.current) return
    
    setNotification({ type, message })
    const timeoutId = setTimeout(() => {
      if (isMountedRef.current) {
        setNotification(null)
      }
    }, 5000)
    
    // Keep track of timeouts for cleanup
    timeoutsRef.current.push(timeoutId)
  }, [])

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      showNotification('success', 'Copied to clipboard!')
    } catch (error) {
      showNotification('error', 'Failed to copy to clipboard')
    }
  }

  const openResponseViewer = (result) => {
    setSelectedResponse(result)
    setIsResponseViewerOpen(true)
  }

  const refreshAuthenticationStatus = () => {
    const imsValid = imsToken && (!imsTokenExpiry || isTokenValid(imsTokenExpiry))
    const msftValid = msftToken && (!msftTokenExpiry || isTokenValid(msftTokenExpiry))
    const newAuthStatus = imsValid && msftValid
    setIsAuthenticated(newAuthStatus)
    
    // Also initialize the countdown
    initializeMsftCountdown()
    
    console.log('Manual auth refresh:', {
      imsToken: !!imsToken,
      imsTokenExpiry,
      imsValid,
      msftToken: !!msftToken,
      msftTokenExpiry,
      msftValid,
      isAuthenticated: newAuthStatus
    })
  }

  const initializeMsftCountdown = () => {
    if (msftTokenExpiry && isTokenValid(msftTokenExpiry)) {
      const now = new Date()
      const expiry = new Date(msftTokenExpiry)
      const remaining = Math.max(0, Math.floor((expiry - now) / 1000))
      setMsftTimeRemaining(remaining)
      console.log('Initialized MSFT countdown:', remaining, 'seconds remaining')
    } else {
      setMsftTimeRemaining(0)
      console.log('MSFT token expired or invalid, countdown set to 0')
    }
  }

  const validateMsftTokenForOperation = () => {
    const msftValid = msftToken && (!msftTokenExpiry || isTokenValid(msftTokenExpiry))
    
    if (!msftValid) {
      setIsExpiredTokenDialogOpen(true)
      return false
    }
    
    return true
  }

  // Token validation functions
  const isTokenValid = (tokenExpiry) => {
    if (!tokenExpiry) return false
    return new Date() < new Date(tokenExpiry)
  }

  const formatTimeRemaining = (seconds) => {
    if (seconds <= 0) return '00:00:00'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Token expiry countdown for Microsoft token (1 hour)
  React.useEffect(() => {
    let interval = null
    
    if (msftTokenExpiry && isTokenValid(msftTokenExpiry)) {
      interval = setInterval(() => {
        if (!isMountedRef.current) {
          clearInterval(interval)
          return
        }
        
        const now = new Date()
        const expiry = new Date(msftTokenExpiry)
        const remaining = Math.max(0, Math.floor((expiry - now) / 1000))
        
        setMsftTimeRemaining(remaining)
        
        // Alert when token is about to expire
        if (remaining === 300) { // 5 minutes
          showNotification('warning', '⚠️ Microsoft token expires in 5 minutes!')
        } else if (remaining === 60) { // 1 minute
          showNotification('error', '🚨 Microsoft token expires in 1 minute!')
        } else if (remaining === 0) {
          showNotification('error', '❌ Microsoft token has expired! Please re-authenticate.')
          setMsftToken('')
          setMsftTokenExpiry(null)
        }
      }, 1000)
    } else {
      setMsftTimeRemaining(0)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [msftTokenExpiry, showNotification])

  // Authentication status tracking
  React.useEffect(() => {
    const imsValid = imsToken && (!imsTokenExpiry || isTokenValid(imsTokenExpiry))
    const msftValid = msftToken && (!msftTokenExpiry || isTokenValid(msftTokenExpiry))
    const newAuthStatus = imsValid && msftValid
    setIsAuthenticated(newAuthStatus)
    
    // Debug logging
    console.log('Auth status update:', {
      imsToken: !!imsToken,
      imsTokenExpiry,
      imsValid,
      msftToken: !!msftToken,
      msftTokenExpiry,
      msftValid,
      isAuthenticated: newAuthStatus
    })
  }, [imsToken, msftToken, imsTokenExpiry, msftTokenExpiry])

  // Load tokens from localStorage on component mount
  React.useEffect(() => {
    const loadTokens = () => {
      try {
        const storedImsToken = localStorage.getItem('userManagementImsToken')
        const storedImsExpiry = localStorage.getItem('userManagementImsTokenExpiry')
        const storedMsftToken = localStorage.getItem('userManagementMsftToken')
        const storedMsftExpiry = localStorage.getItem('userManagementMsftTokenExpiry')

        console.log('Loading tokens from storage:', {
          hasImsToken: !!storedImsToken,
          hasImsExpiry: !!storedImsExpiry,
          hasMsftToken: !!storedMsftToken,
          hasMsftExpiry: !!storedMsftExpiry
        })

        if (storedImsToken && storedImsExpiry && isTokenValid(storedImsExpiry)) {
          setImsToken(storedImsToken)
          setImsTokenExpiry(storedImsExpiry)
          if (isMountedRef.current) {
            showNotification('info', '✅ Adobe IMS token loaded from storage')
          }
        } else if (storedImsToken && storedImsExpiry) {
          console.log('IMS token expired, clearing from storage')
          localStorage.removeItem('userManagementImsToken')
          localStorage.removeItem('userManagementImsTokenExpiry')
        }

        if (storedMsftToken && storedMsftExpiry && isTokenValid(storedMsftExpiry)) {
          setMsftToken(storedMsftToken)
          setMsftTokenExpiry(storedMsftExpiry)
          if (isMountedRef.current) {
            showNotification('info', '✅ Microsoft token loaded from storage')
          }
        } else if (storedMsftToken && storedMsftExpiry) {
          console.log('Microsoft token expired, clearing from storage')
          localStorage.removeItem('userManagementMsftToken')
          localStorage.removeItem('userManagementMsftTokenExpiry')
        }

        // Force refresh authentication status after loading tokens
        setTimeout(() => {
          if (isMountedRef.current) {
            refreshAuthenticationStatus()
            initializeMsftCountdown()
          }
        }, 100)
      } catch (error) {
        console.error('Error loading tokens:', error)
      }
    }

    // Add a small delay to ensure component is fully mounted
    const timer = setTimeout(loadTokens, 50)
    return () => clearTimeout(timer)
  }, [showNotification])

  // Session Management functions
  const saveCurrentSession = React.useCallback((isAutoSave = true) => {
    if (!sessionName.trim()) return
    
    const sessionData = {
      name: sessionName,
      timestamp: new Date().toISOString(),
      data: {
        selectedEnvironment,
        sandboxName,
        groupName,
        emailPrefix,
        userCount,
        defaultPassword,
        labPassword,
        testMode,
        operationResults,
        categorizedResults,
        hasErrors,
        activeTab
      }
    }

    try {
      const existingSessions = JSON.parse(localStorage.getItem('userManagementSessions') || '[]')
      const existingIndex = existingSessions.findIndex(s => s.name === sessionName)
      
      if (existingIndex >= 0) {
        existingSessions[existingIndex] = sessionData
      } else {
        existingSessions.push(sessionData)
      }
      
      localStorage.setItem('userManagementSessions', JSON.stringify(existingSessions))
      setSavedSessions(existingSessions)
      
      if (!isAutoSave) {
        showNotification('success', '✅ Session saved successfully')
      }
    } catch (error) {
      console.error('Error saving session:', error)
      if (!isAutoSave) {
        showNotification('error', '❌ Failed to save session')
      }
    }
  }, [
    sessionName,
    selectedEnvironment,
    sandboxName,
    groupName,
    emailPrefix,
    userCount,
    defaultPassword,
    labPassword,
    testMode,
    operationResults,
    categorizedResults,
    hasErrors,
    activeTab,
    showNotification
  ])

  // Simplified auto-save
  React.useEffect(() => {
    let timer
    if (sessionName.trim()) {
      timer = setTimeout(() => saveCurrentSession(true), 5000)
    }
    return () => timer && clearTimeout(timer)
  }, [
    sessionName,
    selectedEnvironment,
    sandboxName,
    groupName,
    emailPrefix,
    userCount,
    defaultPassword,
    labPassword,
    testMode,
    operationResults,
    categorizedResults,
    hasErrors,
    activeTab,
    saveCurrentSession
  ])

  const loadSession = React.useCallback((sessionData) => {
    if (!sessionData?.data) return
    
    const data = sessionData.data
    setSelectedEnvironment(data.selectedEnvironment || 'MA1HOL')
    setSandboxName(data.sandboxName || '')
    setGroupName(data.groupName || '')
    setEmailPrefix(data.emailPrefix || '')
    setUserCount(data.userCount || 20)
    setDefaultPassword(data.defaultPassword || '')
    setLabPassword(data.labPassword || '')
    setTestMode(data.testMode ?? true)
    setOperationResults(data.operationResults || null)
    setCategorizedResults(data.categorizedResults || { userCreation: [], passwordReset: [], labShutdown: [] })
    setHasErrors(data.hasErrors || false)
    setActiveTab(data.activeTab || 'config')
    setSessionName(sessionData.name)
    
    showNotification('success', '✅ Session loaded successfully')
  }, [showNotification])

  const deleteSession = React.useCallback((sessionToDelete) => {
    try {
      const sessions = JSON.parse(localStorage.getItem('userManagementSessions') || '[]')
      const filtered = sessions.filter(s => s.name !== sessionToDelete)
      localStorage.setItem('userManagementSessions', JSON.stringify(filtered))
      setSavedSessions(filtered)
      showNotification('success', '✅ Session deleted successfully')
    } catch (error) {
      console.error('Error deleting session:', error)
      showNotification('error', '❌ Failed to delete session')
    }
  }, [showNotification])

  // Load saved sessions on mount only
  React.useEffect(() => {
    const sessions = JSON.parse(localStorage.getItem('userManagementSessions') || '[]')
    setSavedSessions(sessions)
  }, []) // Empty dependency array = only on mount

  // Cleanup effect to prevent memory leaks
  React.useEffect(() => {
    return () => {
      // Mark component as unmounted
      isMountedRef.current = false
      
      // Clear all timeouts
      timeoutsRef.current.forEach(timeoutId => clearTimeout(timeoutId))
      timeoutsRef.current = []
      
      // Clear auto-save timer
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer)
      }
    }
  }, [])

  // Session enforcement check
  const checkSessionRequired = () => {
    if (!sessionName.trim()) {
      setSessionRequired(true)
      showNotification('error', '⚠️ Session name is required before authentication!')
      return false
    }
    setSessionRequired(false)
    return true
  }

  // Authentication functions
  const authenticateAdobe = async () => {
    if (!checkSessionRequired()) return
    
    try {
      const env = environments[selectedEnvironment]
      console.log('Authenticating with environment:', selectedEnvironment)
      
      const response = await fetch(getActionUrlFromRuntime('adobe-auth', runtime), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ims.token}`
        },
        body: JSON.stringify({
          environmentKey: env.environmentKey
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      console.log('Adobe auth response:', result) // Debug log
      
      // Check if we have a token in the response - handle multiple possible structures
      const accessToken = result.body?.access_token || result.access_token || result.body?.token
      const expiresIn = result.body?.expires_in || result.expires_in || 86400 // Default to 24 hours
      
      console.log('Extracted access token:', accessToken ? 'Found' : 'Not found')
      console.log('Expires in:', expiresIn, 'seconds')
      
      if (accessToken) {
        // Calculate expiry time (tokens typically expire in 24 hours)
        const expiry = new Date(Date.now() + (expiresIn * 1000)).toISOString()
        
        setImsToken(accessToken)
        setImsTokenExpiry(expiry)
        
        // Store in localStorage
        localStorage.setItem('userManagementImsToken', accessToken)
        localStorage.setItem('userManagementImsTokenExpiry', expiry)
        
        // Force authentication status update
        setTimeout(() => {
          if (isMountedRef.current) {
            refreshAuthenticationStatus()
            initializeMsftCountdown()
          }
        }, 100)
        
        showNotification('success', '✅ Successfully authenticated with Adobe')
      } else {
        console.error('No access token in response:', result)
        throw new Error('No access token received from Adobe authentication')
      }
    } catch (error) {
      console.error('Adobe authentication error:', error)
      showNotification('error', `Adobe authentication failed: ${error.message}`)
    }
  }

  const authenticateMicrosoft = async () => {
    if (!checkSessionRequired()) return
    setIsMicrosoftTokenModalOpen(true)
  }

  const handleMicrosoftTokenSubmit = () => {
    try {
      if (!microsoftTokenInput.trim()) {
        showNotification('error', 'Please enter a valid Microsoft token')
        return
      }

      // Validate token and get expiration
      const { exp } = validateMicrosoftToken(microsoftTokenInput)
      const expiry = new Date(exp * 1000).toISOString()
      
      setMsftToken(microsoftTokenInput)
      setMsftTokenExpiry(expiry)
      
      // Store in localStorage
      localStorage.setItem('userManagementMsftToken', microsoftTokenInput)
      localStorage.setItem('userManagementMsftTokenExpiry', expiry)
      
      // Force authentication status update
      setTimeout(() => {
        if (isMountedRef.current) {
          refreshAuthenticationStatus()
          initializeMsftCountdown()
        }
      }, 100)
      
      // Clear input and close modal
      setMicrosoftTokenInput('')
      setIsMicrosoftTokenModalOpen(false)
      
      showNotification('success', '✅ Successfully authenticated with Microsoft')
    } catch (error) {
      console.error('Microsoft token processing error:', error)
      showNotification('error', `Microsoft authentication failed: ${error.message}`)
    }
  }

  const validateMicrosoftToken = (token) => {
    try {
      // Get the payload part of the JWT
      const payload = token.split('.')[1]
      // Base64 decode and parse as JSON
      const decoded = JSON.parse(atob(payload))
      return decoded
    } catch (error) {
      throw new Error('Invalid token format')
    }
  }

  // User management functions
  const createLabUsers = async () => {
    if (!checkSessionRequired()) return
    
    if (!groupName || !emailPrefix || !defaultPassword) {
      showNotification('error', 'Please provide group name, email prefix, and default password')
      return
    }

    // Validate Microsoft token before proceeding
    if (!validateMsftTokenForOperation()) {
      return
    }

    setIsProcessing(true)
    try {
      const env = environments[selectedEnvironment]
      const requestData = {
        msft_token: msftToken,
        imsTenant: env.tenant,
        sandbox: sandboxName.toLowerCase(),
        groupName: groupName,
        emailPrefix: emailPrefix,
        users: userCount,
        default_pass: defaultPassword,
        testMode: testMode,
        appResourceId: env.msAppResId,
        appRoleId: env.msAppRoleId
      }
      
      // Call the actual Adobe I/O Runtime endpoint
      const response = await fetch('https://440115-191salmonscallop.adobeioruntime.net/api/v1/web/postmirror/waaduser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      
      const apiResponse = {
        success: true,
        testMode: testMode,
        data: result,
        timestamp: new Date().toISOString()
      }

      setOperationResults(apiResponse)
      setCategorizedResults(prev => ({
        ...prev,
        userCreation: [...(prev.userCreation || []), apiResponse]
      }))
      setHasErrors(false)

      showNotification('success', testMode ? 
        `✅ Test completed: Would create ${result['2_users'] || 'N/A'} users` :
        `✅ Successfully created ${result['2_users'] || 'N/A'} users`
      )

    } catch (error) {
      console.error('User creation error:', error)
      const errorResponse = {
        success: false,
        error: error.message,
        testMode: testMode,
        timestamp: new Date().toISOString()
      }
      setOperationResults(errorResponse)
      setCategorizedResults(prev => ({
        ...prev,
        userCreation: [...(prev.userCreation || []), errorResponse]
      }))
      setHasErrors(true)
      showNotification('error', `User creation failed: ${error.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const resetLabPasswords = async () => {
    if (!checkSessionRequired()) return

    if (!groupName || !labPassword) {
      showNotification('error', 'Please provide group name and password')
      return
    }

    // Validate Microsoft token before proceeding
    if (!validateMsftTokenForOperation()) {
      return
    }

    setIsProcessing(true)
    try {
      const env = environments[selectedEnvironment]
      const requestData = {
        msft_token: msftToken,
        imsTenant: env.tenant,
        sandbox: sandboxName.toLowerCase(),
        groupName: groupName,
        lab_pass: labPassword,
        accountEnabled: true,
        testMode: testMode
      }
      
      // Call the actual Adobe I/O Runtime endpoint
      const response = await fetch('https://440115-191salmonscallop.adobeioruntime.net/api/v1/web/postmirror/waadpass', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      
      const apiResponse = {
        success: true,
        testMode: testMode,
        data: result,
        timestamp: new Date().toISOString()
      }

      setOperationResults(apiResponse)
      setCategorizedResults(prev => ({
        ...prev,
        passwordReset: [...(prev.passwordReset || []), apiResponse]
      }))
      setHasErrors(false)

      showNotification('success', testMode ?
        `✅ Test completed: Would reset passwords for ${result['1_currentUserCount'] || 'N/A'} users` :
        `✅ Successfully reset passwords for ${result['resetIds']?.length || 'N/A'} users`
      )

    } catch (error) {
      console.error('Password reset error:', error)
      const errorResponse = {
        success: false,
        error: error.message,
        testMode: testMode,
        timestamp: new Date().toISOString()
      }
      setOperationResults(errorResponse)
      setCategorizedResults(prev => ({
        ...prev,
        passwordReset: [...(prev.passwordReset || []), errorResponse]
      }))
      setHasErrors(true)
      
      // Check if the error contains the Graph API 403 error
      if (error.message.includes('403')) {
        showNotification('error', 'Password reset failed: Insufficient permissions. The app needs Directory.ReadWrite.All permission in Azure AD.')
      } else {
        showNotification('error', `Password reset failed: ${error.message}`)
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const shutdownLab = async () => {
    if (!groupName) {
      showNotification('error', 'Please provide group name')
      return
    }

    setIsProcessing(true)
    try {
      const env = environments[selectedEnvironment]
      const requestData = {
        msft_token: msftToken,
        imsTenant: env.tenant,
        sandbox: sandboxName.toLowerCase(),
        groupName: groupName,
        default_pass: 'iopjkl!1',
        inactivateUsers: true,
        testMode: testMode
      }

      // Call the actual Adobe I/O Runtime endpoint
      const response = await fetch('https://440115-191salmonscallop.adobeioruntime.net/api/v1/web/postmirror/waadshutdown', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      
      const apiResponse = {
        success: true,
        testMode: testMode,
        data: result,
        timestamp: new Date().toISOString()
      }

      setOperationResults(apiResponse)
      setCategorizedResults(prev => ({
        ...prev,
        labShutdown: [...(prev.labShutdown || []), apiResponse]
      }))
      setHasErrors(false)
      showNotification('success', testMode ?
        `✅ Test completed: Would shutdown lab for group ${groupName}` :
        `✅ Successfully shutdown lab for group ${groupName}`
      )

    } catch (error) {
      console.error('Lab shutdown error:', error)
      const errorResponse = {
        success: false,
        error: error.message,
        testMode: testMode,
        timestamp: new Date().toISOString()
      }
      setOperationResults(errorResponse)
      setCategorizedResults(prev => ({
        ...prev,
        labShutdown: [...(prev.labShutdown || []), errorResponse]
      }))
      setHasErrors(true)
      showNotification('error', `Lab shutdown failed: ${error.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <View padding="size-400" maxWidth="1400px" marginX="auto">
      <Flex justifyContent="space-between" alignItems="center" marginBottom="size-300">
        <View>
          <Heading level={1}>User Management</Heading>
          <Content marginTop="size-100">
            HOL User Administration for Azure AD with Adobe IMS sync
          </Content>
        </View>
        <Flex gap="size-200" alignItems="center">
          <Badge variant={isAuthenticated ? 'positive' : 'neutral'}>
            {isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
          </Badge>
          {msftToken && msftTimeRemaining > 0 && (
            <View>
              <Text 
                UNSAFE_style={{ 
                  fontSize: '12px', 
                  fontWeight: 'bold',
                  color: msftTimeRemaining < 300 ? '#D72222' : '#1473E6',
                  textAlign: 'center'
                }}
              >
                Token expires in: {formatTimeRemaining(msftTimeRemaining)}
              </Text>
            </View>
          )}
        </Flex>
      </Flex>

      {/* Floating Action Button */}
      <View
        position="fixed"
        bottom="size-400"
        right="size-400"
        zIndex={999}
      >
        <ActionButton
          isQuiet
          onPress={() => setIsSettingsOpen(true)}
          UNSAFE_style={{
            backgroundColor: '#1473E6',
            borderRadius: '50%',
            width: '56px',
            height: '56px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
          }}
        >
          <Settings aria-label="Settings" />
        </ActionButton>
      </View>

      {/* Settings Modal */}
      <DialogContainer onDismiss={() => setIsSettingsOpen(false)}>
        {isSettingsOpen && (
          <Dialog>
            <Heading>Settings</Heading>
            <Divider />
            <Content>
              <View marginY="size-200">
                <Heading level={3}>Session Management</Heading>
                <Flex direction="column" gap="size-100" marginTop="size-100">
                  <TextField
                    width="100%"
                    value={sessionName}
                    onChange={setSessionName}
                    placeholder="Enter session name to save/load"
                    label="Session Name"
                  />
                  <Flex gap="size-100" marginTop="size-100">
                    <Button
                      variant="primary"
                      onPress={() => {
                        saveCurrentSession(false)
                        setIsSettingsOpen(false)
                      }}
                      isDisabled={!sessionName.trim()}
                    >
                      Save Session
                    </Button>
                    <Picker
                      selectedKey={sessionName}
                      onSelectionChange={(selected) => {
                        const session = savedSessions.find(s => s.name === selected)
                        if (session) {
                          loadSession(session)
                          setIsSettingsOpen(false)
                        }
                      }}
                      items={savedSessions.map(session => ({
                        key: session.name,
                        name: session.name
                      }))}
                    >
                      {item => <Item key={item.key}>{item.name}</Item>}
                    </Picker>
                  </Flex>
                </Flex>
              </View>

              <Divider size="M" />

              <View marginY="size-200">
                <Heading level={3}>Test Mode</Heading>
                <Flex alignItems="center" gap="size-100" marginTop="size-100">
                  <Switch
                    isSelected={testMode}
                    onChange={setTestMode}
                  >
                    Enable Test Mode
                  </Switch>
                  <Text UNSAFE_style={{ color: '#6B7280', fontSize: '14px' }}>
                    {testMode ? 'Preview changes without executing' : 'Execute operations immediately'}
                  </Text>
                </Flex>
              </View>
            </Content>
            <ButtonGroup>
              <Button variant="secondary" onPress={() => setIsSettingsOpen(false)}>
                Close
              </Button>
            </ButtonGroup>
          </Dialog>
        )}
      </DialogContainer>

      {/* Microsoft Token Modal */}
      <DialogContainer onDismiss={() => setIsMicrosoftTokenModalOpen(false)}>
        {isMicrosoftTokenModalOpen && (
          <Dialog>
            <Heading>Enter Microsoft Token</Heading>
            <Divider />
            <Content>
              <Text marginBottom="size-200">
                Please enter your Microsoft Graph API token. You can obtain this token from the Microsoft Graph Explorer or Azure Portal.
              </Text>
              <TextField
                value={microsoftTokenInput}
                onChange={setMicrosoftTokenInput}
                placeholder="Enter Microsoft token"
                label="Microsoft Token"
                width="100%"
              />
            </Content>
            <ButtonGroup>
              <Button variant="secondary" onPress={() => setIsMicrosoftTokenModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onPress={handleMicrosoftTokenSubmit}>
                Submit
              </Button>
            </ButtonGroup>
          </Dialog>
        )}
      </DialogContainer>

      {/* Response Viewer Modal */}
      <DialogContainer onDismiss={() => setIsResponseViewerOpen(false)}>
        {isResponseViewerOpen && selectedResponse && (
          <Dialog size="L">
            <Heading>Server Response</Heading>
            <Divider />
            <Content>
              <Flex direction="column" gap="size-200">
                <View>
                  <Text fontWeight="bold">Operation Details:</Text>
                  <Text>Timestamp: {new Date(selectedResponse.timestamp).toLocaleString()}</Text>
                  <Text>Status: {selectedResponse.success ? 'Success' : 'Failed'}</Text>
                  <Text>Mode: {selectedResponse.testMode ? 'Test' : 'Production'}</Text>
                </View>
                <Divider />
                <View>
                  <Text fontWeight="bold">Full Response:</Text>
                  <TextArea
                    value={JSON.stringify(selectedResponse, null, 2)}
                    isReadOnly
                    width="100%"
                    height="size-2000"
                    UNSAFE_style={{ fontFamily: 'monospace', fontSize: '12px' }}
                  />
                </View>
              </Flex>
            </Content>
            <ButtonGroup>
              <Button 
                variant="secondary" 
                onPress={() => copyToClipboard(JSON.stringify(selectedResponse, null, 2))}
              >
                Copy to Clipboard
              </Button>
              <Button variant="primary" onPress={() => setIsResponseViewerOpen(false)}>
                Close
              </Button>
            </ButtonGroup>
          </Dialog>
        )}
      </DialogContainer>

      {/* Expired Token Dialog */}
      <DialogContainer onDismiss={() => setIsExpiredTokenDialogOpen(false)}>
        {isExpiredTokenDialogOpen && (
          <Dialog>
            <Heading>⚠️ Microsoft Token Expired</Heading>
            <Divider />
            <Content>
              <Text marginBottom="size-200">
                Your Microsoft token has expired and cannot be used for this operation.
              </Text>
              <Text marginBottom="size-200">
                Please re-authenticate with Microsoft to continue.
              </Text>
            </Content>
            <ButtonGroup>
              <Button 
                variant="secondary" 
                onPress={() => setIsExpiredTokenDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                variant="primary" 
                onPress={() => {
                  setIsExpiredTokenDialogOpen(false)
                  authenticateMicrosoft()
                }}
              >
                Re-authenticate
              </Button>
            </ButtonGroup>
          </Dialog>
        )}
      </DialogContainer>

      {/* Main Tabs */}
      <Tabs selectedKey={activeTab} onSelectionChange={setActiveTab}>
        <TabList>
          <Item key="config">Configuration</Item>
          <Item key="results">Results</Item>
        </TabList>
        <TabPanels>
          <Item key="config">
            {/* Configuration Panel Content */}
            <View padding="size-200">
              {/* Environment Selection */}
              <View marginBottom="size-300">
                <Heading level={3}>Environment</Heading>
                <Flex gap="size-100" alignItems="center">
                  <Picker
                    selectedKey={selectedEnvironment}
                    onSelectionChange={setSelectedEnvironment}
                    width="size-3000"
                    label="Environment"
                  >
                    <Item key="MA1HOL">MA1HOL</Item>
                    <Item key="POT5HOL">POT5HOL</Item>
                  </Picker>
                  <TextField
                    value={sandboxName}
                    onChange={setSandboxName}
                    placeholder="Enter sandbox name"
                    label="Sandbox Name"
                  />
                </Flex>
              </View>

              {/* Authentication */}
              <View marginBottom="size-300">
                <Heading level={3}>Authentication</Heading>
                <Flex gap="size-100">
                  <Button
                    variant="cta"
                    onPress={authenticateAdobe}
                    isDisabled={isProcessing}
                  >
                    Authenticate with Adobe
                  </Button>
                  <Button
                    variant="cta"
                    onPress={authenticateMicrosoft}
                    isDisabled={isProcessing}
                  >
                    Authenticate with Microsoft
                  </Button>
                  <Button
                    variant="secondary"
                    onPress={refreshAuthenticationStatus}
                    size="S"
                  >
                    Refresh Auth Status
                  </Button>
                </Flex>
              </View>

              {/* User Management */}
              <View marginBottom="size-300">
                <Heading level={3}>User Management</Heading>
                <Flex direction="column" gap="size-200">
                  <TextField
                    value={groupName}
                    onChange={setGroupName}
                    placeholder="Enter group name (e.g., MA1HOL11)"
                    label="Group Name"
                    width="size-3000"
                  />
                  <TextField
                    value={emailPrefix}
                    onChange={setEmailPrefix}
                    placeholder="Enter email prefix (e.g., hol11)"
                    label="Email Prefix"
                    width="size-3000"
                    description={emailPrefix ? `Example: ${emailPrefix}u01@${environments[selectedEnvironment]?.emailDomain}` : 'Used to generate user email addresses'}
                  />
                  <NumberField
                    label="Number of Users"
                    value={userCount}
                    onChange={setUserCount}
                    minValue={1}
                    maxValue={50}
                    width="size-3000"
                  />
                  <Flex direction="column" gap="size-100">
                    <TextField
                      value={defaultPassword}
                      onChange={setDefaultPassword}
                      type={showDefaultPassword ? "text" : "password"}
                      placeholder="Enter default password for new users"
                      label="Default Password"
                      width="size-3000"
                      description="This is the default password used for new users"
                    />
                    <Button
                      variant="secondary"
                      width="size-1200"
                      onPress={() => setShowDefaultPassword(!showDefaultPassword)}
                      aria-label="Toggle password visibility"
                    >
                      {showDefaultPassword ? "Hide password" : "Show password"}
                    </Button>
                  </Flex>
                  <Button
                    variant="primary"
                    onPress={createLabUsers}
                    isDisabled={isProcessing || !isAuthenticated || !groupName || !emailPrefix || !defaultPassword}
                  >
                    Create Users
                  </Button>
                  <Flex direction="column" gap="size-100">
                    <TextField
                      value={labPassword}
                      onChange={setLabPassword}
                      type={showLabPassword ? "text" : "password"}
                      placeholder="Enter lab password"
                      label="Lab Password"
                      width="size-3000"
                    />
                    <Button
                      variant="secondary"
                      width="size-1200"
                      onPress={() => setShowLabPassword(!showLabPassword)}
                      aria-label="Toggle password visibility"
                    >
                      {showLabPassword ? "Hide password" : "Show password"}
                    </Button>
                  </Flex>
                  <Button
                    variant="primary"
                    onPress={resetLabPasswords}
                    isDisabled={isProcessing || !isAuthenticated || !emailPrefix}
                  >
                    Reset Lab Passwords
                  </Button>
                </Flex>
              </View>

              {/* Lab Shutdown */}
              <View 
                marginBottom="size-300" 
                borderRadius="medium"
                padding="size-300"
                UNSAFE_style={{
                  border: '2px solid #d93f3f',
                  borderRadius: '8px'
                }}
              >
                <Heading level={3}>Lab Shutdown</Heading>
                <Text marginY="size-200" UNSAFE_style={{ color: '#d93f3f' }}>
                  ⚠️ Warning: This will deactivate all users and remove product configurations
                </Text>
                <Flex direction="column" gap="size-200">
                  <TextField
                    value={groupName}
                    onChange={setGroupName}
                    width="size-3000"
                    label="Group Name"
                    description="Group to be shutdown"
                  />
                  <DialogTrigger>
                    <Button
                      variant="negative"
                      isDisabled={isProcessing || !groupName}
                    >
                      Shutdown Lab
                    </Button>
                    {(close) => (
                      <Dialog>
                        <Heading>⚠️ Confirm Lab Shutdown</Heading>
                        <Divider />
                        <Content>
                          <Text>Are you sure you want to shutdown the lab for group {groupName}?</Text>
                          <Text marginTop="size-200">This will:</Text>
                          <ul>
                            <li>Remove all product configurations</li>
                            <li>Deactivate all users in the group</li>
                            <li>Reset all user passwords to the default: iopjkl!1</li>
                            <li>This action cannot be undone</li>
                          </ul>
                          {testMode && (
                            <Well marginTop="size-200">
                              Test Mode is enabled - no actual changes will be made
                            </Well>
                          )}
                        </Content>
                        <ButtonGroup>
                          <Button variant="secondary" onPress={close}>
                            Cancel
                          </Button>
                          <Button 
                            variant="negative"
                            onPress={() => {
                              shutdownLab()
                              close()
                            }}
                          >
                            Confirm Shutdown
                          </Button>
                        </ButtonGroup>
                      </Dialog>
                    )}
                  </DialogTrigger>
                </Flex>
              </View>
            </View>
          </Item>

          <Item key="results">
            {/* Results Panel Content */}
            <View padding="size-200">
              <Heading level={3}>Operation Results</Heading>
              {categorizedResults?.userCreation?.length > 0 && (
                <View marginBottom="size-300">
                  <Heading level={4}>User Creation Operations</Heading>
                  {categorizedResults.userCreation.map((result, index) => (
                    <Well key={index} marginY="size-100">
                      <Text>Timestamp: {new Date(result.timestamp).toLocaleString()}</Text>
                      <Text>Status: {result.success ? 'Success' : 'Failed'}</Text>
                      {result.success ? (
                        <>
                          <Text>Created Users: {result.data?.['2_users'] || 'N/A'}</Text>
                          <Text>Total Users: {result.data?.['1_currentUserCount'] || 'N/A'}</Text>
                        </>
                      ) : (
                        <Text>Error: {result.error}</Text>
                      )}
                      <Button
                        variant="secondary"
                        size="S"
                        marginTop="size-100"
                        onPress={() => openResponseViewer(result)}
                      >
                        View Response
                      </Button>
                    </Well>
                  ))}
                </View>
              )}

              {categorizedResults?.passwordReset?.length > 0 && (
                <View marginBottom="size-300">
                  <Heading level={4}>Password Reset Operations</Heading>
                  {categorizedResults.passwordReset.map((result, index) => (
                    <Well key={index} marginY="size-100">
                      <Text>Timestamp: {new Date(result.timestamp).toLocaleString()}</Text>
                      <Text>Status: {result.success ? 'Success' : 'Failed'}</Text>
                      {result.success ? (
                        <Text>Users Affected: {result.data?.resetIds?.length || 'N/A'}</Text>
                      ) : (
                        <Text>Error: {result.error}</Text>
                      )}
                      <Button
                        variant="secondary"
                        size="S"
                        marginTop="size-100"
                        onPress={() => openResponseViewer(result)}
                      >
                        View Response
                      </Button>
                    </Well>
                  ))}
                </View>
              )}

              {categorizedResults?.labShutdown?.length > 0 && (
                <View marginBottom="size-300">
                  <Heading level={4}>Lab Shutdown Operations</Heading>
                  {categorizedResults.labShutdown.map((result, index) => (
                    <Well key={index} marginY="size-100">
                      <Text>Timestamp: {new Date(result.timestamp).toLocaleString()}</Text>
                      <Text>Status: {result.success ? 'Success' : 'Failed'}</Text>
                      {result.success ? (
                        <Text>Group: {result.data?.groupName || groupName}</Text>
                      ) : (
                        <Text>Error: {result.error}</Text>
                      )}
                      <Text>Mode: {result.testMode ? 'Test' : 'Production'}</Text>
                      <Button
                        variant="secondary"
                        size="S"
                        marginTop="size-100"
                        onPress={() => openResponseViewer(result)}
                      >
                        View Response
                      </Button>
                    </Well>
                  ))}
                </View>
              )}

              {(!categorizedResults?.userCreation?.length && 
                !categorizedResults?.passwordReset?.length && 
                !categorizedResults?.labShutdown?.length) && (
                <Text>No operations have been performed yet.</Text>
              )}
            </View>
          </Item>
        </TabPanels>
      </Tabs>

      {/* Processing Indicator */}
      {isProcessing && (
        <View
          position="fixed"
          top="0"
          left="0"
          right="0"
          bottom="0"
          backgroundColor="rgba(0, 0, 0, 0.5)"
          zIndex={1000}
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <View
            backgroundColor="white"
            borderRadius="medium"
            padding="size-300"
            maxWidth="400px"
            width="100%"
          >
            <Heading level={3}>Processing...</Heading>
            <ProgressBar
              label="Processing"
              isIndeterminate
              marginTop="size-200"
            />
          </View>
        </View>
      )}

      {/* Notifications */}
      {notification && (
        <View
          position="fixed"
          bottom="size-400"
          right="size-400"
          zIndex={1000}
        >
          <Well
            UNSAFE_style={{
              backgroundColor: notification.type === 'error' ? '#FFF5F5' :
                            notification.type === 'warning' ? '#FFFBF5' :
                            notification.type === 'success' ? '#F5FFF5' : '#F5F5F5',
              borderColor: notification.type === 'error' ? '#FF0000' :
                          notification.type === 'warning' ? '#FFA500' :
                          notification.type === 'success' ? '#00FF00' : '#000000'
            }}
          >
            <Text>{notification.message}</Text>
          </Well>
        </View>
      )}
    </View>
  )
}

export default UserManagement 
