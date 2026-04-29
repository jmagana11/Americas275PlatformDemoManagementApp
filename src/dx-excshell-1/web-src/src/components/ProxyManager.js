import React, { useState, useEffect, useRef } from 'react'
import {
  Heading,
  View,
  Tabs,
  TabList,
  TabPanels,
  Item,
  Button,
  ButtonGroup,
  Flex,
  Text,
  StatusLight,
  ActionButton,
  Dialog,
  DialogTrigger,
  Content,
  Divider,
  Form,
  TextField,
  Picker,
  TextArea,
  Switch,
  Badge,
  TableView,
  TableHeader,
  TableBody,
  Column,
  Row,
  Cell,
  ProgressCircle,
  AlertDialog,
  Well,
  Link,
  ListBox,
  Section,
  Header,
  Tooltip,
  TooltipTrigger
} from '@adobe/react-spectrum'
import Add from '@spectrum-icons/workflow/Add'
import Edit from '@spectrum-icons/workflow/Edit'
import Delete from '@spectrum-icons/workflow/Delete'
import Copy from '@spectrum-icons/workflow/Copy'
import Refresh from '@spectrum-icons/workflow/Refresh'
import Settings from '@spectrum-icons/workflow/Settings'
import Info from '@spectrum-icons/workflow/Info'
import actionWebInvoke from '../utils'
import allActions from '../config.json'

const ProxyManager = ({ runtime, ims }) => {
  const [sessionId, setSessionId] = useState('')
  const [availableSessions, setAvailableSessions] = useState([])
  const [proxyConfig, setProxyConfig] = useState(null)
  const [proxyLogs, setProxyLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedTab, setSelectedTab] = useState('config')
  const [sessionStats, setSessionStats] = useState(null)
  
  // Dialog states
  const [showConfigDialog, setShowConfigDialog] = useState(false)
  const [showSessionDialog, setShowSessionDialog] = useState(false)
  const [showLogDetailDialog, setShowLogDetailDialog] = useState(false)
  const [selectedLogDetail, setSelectedLogDetail] = useState(null)
  
  // Form states
  const [formData, setFormData] = useState({
    name: '',
    targetUrl: '',
    pathPattern: '/*',
    method: 'ALL',
    headers: '{}',
    transformations: '{}',
    enabled: true
  })
  const [sessionFormData, setSessionFormData] = useState({
    sessionId: '',
    loadExisting: false
  })

  const isMounted = useRef(true)

  useEffect(() => {
    const initializeComponent = async () => {
      if (!isMounted.current) return;
      
      await loadAvailableSessions();
      const savedSessionId = localStorage.getItem('proxySessionId');
      if (savedSessionId && isMounted.current) {
        setSessionId(savedSessionId);
        await loadProxyConfig(savedSessionId);
        await loadProxyLogs(savedSessionId);
      } else if (isMounted.current) {
        setShowSessionDialog(true);
      }
    };
    
    initializeComponent();
    
    return () => {
      isMounted.current = false;
    };
  }, [])

  // Load logs when tab changes to logs
  useEffect(() => {
    if (selectedTab === 'logs' && sessionId && isMounted.current) {
      loadProxyLogs().then(() => {
        if (!isMounted.current) return;
      });
    }
  }, [selectedTab, sessionId])

  // Ensure configuration is loaded when session ID changes
  useEffect(() => {
    if (sessionId && isMounted.current) {
      console.log('Session ID changed, loading configuration for:', sessionId);
      loadProxyConfig(sessionId).then(() => {
        if (!isMounted.current) return;
      });
      loadProxyLogs(sessionId).then(() => {
        if (!isMounted.current) return;
      });
      loadSessionStats(sessionId).then(() => {
        if (!isMounted.current) return;
      });
    } else if (isMounted.current) {
      setProxyConfig(null);
      setProxyLogs([]);
      setSessionStats(null);
    }
  }, [sessionId])

  // Cleanup effect to set mounted ref to false when component unmounts
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const callApiProxyAction = async (path, params = {}, options = { method: 'POST' }) => {
    let actionUrl = allActions['api-proxy']
    if (!actionUrl) {
      throw new Error('api-proxy action not found in config')
    }
    // Ensure path is appended correctly (avoid double slashes)
    if (path && path[0] === '/' && actionUrl.endsWith('/')) {
      actionUrl = actionUrl.slice(0, -1)
    }
    actionUrl = actionUrl + path
    const headers = ims ? {
      'authorization': `Bearer ${ims.token}`,
      'x-gw-ims-org-id': ims.org,
      'x-ims-user-id': ims.profile.userId,
      'Content-Type': 'application/json'
    } : {
      'Content-Type': 'application/json'
    }
    
    // For POST requests, send params as JSON body
    if (options.method === 'POST') {
      const response = await actionWebInvoke(actionUrl, headers, params, options)
      return response.body || response
    } else {
      // For GET requests, send params as query parameters
      const response = await actionWebInvoke(actionUrl, headers, { ...params }, options)
      return response.body || response
    }
  }

  const loadAvailableSessions = async () => {
    try {
      if (isMounted.current) setLoading(true)
      const response = await callApiProxyAction('/sessions', {}, { method: 'GET' })
      
      if (isMounted.current) {
        if (response.success) {
          setAvailableSessions(response.sessions || [])
        } else {
          console.error('Failed to load sessions:', response.error)
          setAvailableSessions([])
        }
      }
    } catch (error) {
      console.error('Error loading sessions:', error)
      if (isMounted.current) {
        setAvailableSessions([])
      }
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }

  const saveSessionToLocalStorage = (sessionId, name) => {
    const sessions = JSON.parse(localStorage.getItem('proxySessions') || '[]')
    const existingIndex = sessions.findIndex(s => s.id === sessionId)
    
    const sessionData = {
      id: sessionId,
      name: name || `Session ${sessionId.substring(0, 8)}`,
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString()
    }
    
    if (existingIndex >= 0) {
      sessions[existingIndex] = { ...sessions[existingIndex], ...sessionData }
    } else {
      sessions.push(sessionData)
    }
    
    localStorage.setItem('proxySessions', JSON.stringify(sessions))
    localStorage.setItem('proxySessionId', sessionId)
    loadAvailableSessions()
  }

  const createNewSession = async (name) => {
    try {
      if (isMounted.current) setLoading(true)
      const response = await callApiProxyAction('/sessions', { name })
      
      if (isMounted.current && response.success) {
        const newSessionId = response.sessionId
        setSessionId(newSessionId)
        saveSessionToLocalStorage(newSessionId, name)
        await loadProxyConfig(newSessionId)
        await loadProxyLogs(newSessionId)
        alert(`Session "${name}" created successfully!`)
      }
    } catch (error) {
      console.error('Error creating session:', error)
      if (isMounted.current) {
        alert(`Error creating session: ${error.message || error}`)
      }
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }

  const loadExistingSession = async (sessionId) => {
    try {
      if (isMounted.current) setLoading(true)
      console.log('=== LOADING EXISTING SESSION ===')
      console.log('Previous sessionId:', sessionId)
      console.log('New sessionId:', sessionId)
      
      if (isMounted.current) {
        setSessionId(sessionId)
        localStorage.setItem('proxySessionId', sessionId)
      }
      
      console.log('Session ID set to:', sessionId)
      console.log('LocalStorage updated with sessionId:', sessionId)
      
      // Load configuration and logs for the session
      console.log('Loading proxy config for session:', sessionId)
      await loadProxyConfig(sessionId)
      console.log('Loading proxy logs for session:', sessionId)
      await loadProxyLogs(sessionId)
      
      // Update session data in localStorage
      const sessions = JSON.parse(localStorage.getItem('proxySessions') || '[]')
      const existingSession = sessions.find(s => s.id === sessionId)
      if (existingSession) {
        existingSession.lastUsed = new Date().toISOString()
        localStorage.setItem('proxySessions', JSON.stringify(sessions))
        console.log('Updated session lastUsed timestamp for:', sessionId)
      }
      
      if (isMounted.current) {
        alert(`Session loaded successfully!`)
      }
      
    } catch (error) {
      console.error('Error loading session:', error)
      if (isMounted.current) {
        alert(`Error loading session: ${error.message || error}`)
      }
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }

  const loadProxyConfig = async (sessionId) => {
    if (!sessionId) {
      console.warn('No session ID provided for loading proxy config')
      if (isMounted.current) setProxyConfig(null)
      return
    }
    
    try {
      if (isMounted.current) setLoading(true)
      console.log('=== LOADING PROXY CONFIG ===')
      console.log('Session ID:', sessionId)
      console.log('Current sessionId state:', sessionId)
      console.log('Calling API with sessionId:', sessionId)
      
      const response = await callApiProxyAction('/config', { sessionId }, { method: 'GET' })
      
      console.log('=== PROXY CONFIG RESPONSE ===')
      console.log('Full response:', response)
      console.log('Response success:', response.success)
      console.log('Response config:', response.config)
      console.log('Response sessionId:', response.sessionId)
      
      if (isMounted.current) {
        if (response.success) {
          const config = response.config || null
          console.log('Setting proxy config to:', config)
          setProxyConfig(config)
          console.log('Proxy config loaded successfully for session:', sessionId)
        } else {
          console.log('No proxy config found for session:', sessionId)
          console.log('Response error:', response.error)
          setProxyConfig(null)
        }
      }
    } catch (error) {
      console.error('=== ERROR LOADING PROXY CONFIG ===')
      console.error('Session ID:', sessionId)
      console.error('Error:', error)
      if (isMounted.current) {
        setProxyConfig(null)
        // Don't show alert for missing config as it's expected for new sessions
        if (!error.message?.includes('No matching proxy configuration found')) {
          alert(`Error loading proxy config: ${error.message || error}`)
        }
      }
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }

  const loadProxyLogs = async (targetSessionId = null) => {
    const sessionToUse = targetSessionId || sessionId
    if (!sessionToUse) return
    
    try {
      if (!loading && isMounted.current) {
        setLoading(true)
      }
      console.log('Loading proxy logs for session:', sessionToUse)
      const response = await callApiProxyAction('/logs', { sessionId: sessionToUse }, { method: 'GET' })
      
      console.log('Proxy logs response:', response)
      if (isMounted.current) {
        if (response.success) {
          const logs = response.logs || []
          console.log('Setting proxy logs:', logs.length, 'logs found')
          setProxyLogs(logs)
        } else {
          console.log('No logs found')
          setProxyLogs([])
        }
      }
    } catch (error) {
      console.error('Error loading proxy logs:', error)
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }

  const saveProxyConfig = async () => {
    if (!sessionId) {
      alert('No session ID available. Please select or create a session first.')
      return
    }
    
    try {
      if (isMounted.current) setLoading(true)
      
      let headers = {}
      let transformations = {}
      
      try {
        headers = JSON.parse(formData.headers || '{}')
      } catch (e) {
        alert('Invalid JSON in headers field')
        return
      }
      
      try {
        transformations = JSON.parse(formData.transformations || '{}')
      } catch (e) {
        alert('Invalid JSON in transformations field')
        return
      }

      const params = {
        sessionId: sessionId, // Ensure sessionId is explicitly set
        name: formData.name,
        targetUrl: formData.targetUrl,
        pathPattern: formData.pathPattern,
        method: formData.method,
        headers,
        transformations,
        enabled: formData.enabled
      }

      if (proxyConfig) {
        params.configId = proxyConfig.id
        console.log('Updating existing proxy config:', params)
      } else {
        console.log('Creating new proxy config:', params)
      }

      const response = await callApiProxyAction('/config', params)
      
      console.log('Save proxy config response:', response)
      
      if (isMounted.current && response.success) {
        resetForm()
        setShowConfigDialog(false)
        await loadProxyConfig(sessionId) // Reload the config to ensure UI is updated
        alert('Proxy configuration saved successfully!')
      } else if (isMounted.current) {
        alert(response.error || 'Failed to save proxy configuration')
      }
    } catch (error) {
      console.error('Error saving proxy config:', error)
      if (isMounted.current) {
        alert(`Error saving proxy configuration: ${error.message || error}`)
      }
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }

  const deleteProxyConfig = async () => {
    if (!confirm('Are you sure you want to delete this proxy configuration?')) {
      return
    }

    try {
      if (isMounted.current) setLoading(true)
      const response = await callApiProxyAction('/config', {
        sessionId,
        configId: proxyConfig.id
      })
      
      if (isMounted.current && response.success) {
        setProxyConfig(null)
      } else if (isMounted.current) {
        alert(response.error || 'Failed to delete proxy configuration')
      }
    } catch (error) {
      console.error('Error deleting proxy config:', error)
      if (isMounted.current) {
        alert('Error deleting proxy configuration')
      }
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      targetUrl: '',
      pathPattern: '/*',
      method: 'ALL',
      headers: '{}',
      transformations: '{}',
      enabled: true
    })
  }

  const openConfigDialog = () => {
    if (proxyConfig) {
      setFormData({
        name: proxyConfig.name,
        targetUrl: proxyConfig.targetUrl,
        pathPattern: proxyConfig.pathPattern || '/*',
        method: proxyConfig.method || 'ALL',
        headers: JSON.stringify(proxyConfig.headers || {}, null, 2),
        transformations: JSON.stringify(proxyConfig.transformations || {}, null, 2),
        enabled: proxyConfig.enabled !== false
      })
    } else {
      resetForm()
    }
    setShowConfigDialog(true)
  }

  const copyProxyUrl = () => {
    const proxyUrl = `${allActions['api-proxy']}?sessionId=${sessionId}`
    navigator.clipboard.writeText(proxyUrl)
    alert('Proxy URL copied to clipboard!')
  }

  const refreshLogs = async () => {
    if (!sessionId) return
    try {
      console.log('Refreshing proxy logs for session:', sessionId)
      const response = await callApiProxyAction('/logs', { sessionId }, { method: 'GET' })
      
      console.log('Refresh logs response:', response)
      if (response.success) {
        const logs = response.logs || []
        console.log('Refreshed proxy logs:', logs.length, 'logs found')
        setProxyLogs(logs)
      }
    } catch (error) {
      console.error('Error refreshing proxy logs:', error)
    }
  }

  const clearLogs = async () => {
    if (!sessionId) return
    if (!confirm('Are you sure you want to clear all logs for this session? This action cannot be undone.')) {
      return
    }
    
    try {
      console.log('Clearing proxy logs for session:', sessionId)
      const response = await callApiProxyAction('/logs', { sessionId }, { method: 'DELETE' })
      
      console.log('Clear logs response:', response)
      if (response.success) {
        console.log(`Cleared ${response.clearedCount} logs`)
        setProxyLogs([])
        alert(`Successfully cleared ${response.clearedCount} logs`)
      } else {
        alert(response.error || 'Failed to clear logs')
      }
    } catch (error) {
      console.error('Error clearing proxy logs:', error)
      alert('Error clearing logs: ' + error.message)
    }
  }

  const loadSessionStats = async (targetSessionId = null) => {
    const sessionToUse = targetSessionId || sessionId
    if (!sessionToUse) return
    
    try {
      console.log('Loading session stats for session:', sessionToUse)
      const response = await callApiProxyAction('/stats', { sessionId: sessionToUse }, { method: 'GET' })
      
      console.log('Session stats response:', response)
      if (isMounted.current) {
        if (response.success) {
          setSessionStats(response.stats)
        } else {
          console.log('No stats found')
          setSessionStats(null)
        }
      }
    } catch (error) {
      console.error('Error loading session stats:', error)
      if (isMounted.current) {
        setSessionStats(null)
      }
    }
  }

  const handleSessionSubmit = () => {
    if (sessionFormData.loadExisting && sessionFormData.sessionId) {
      console.log('Loading existing session:', sessionFormData.sessionId)
      loadExistingSession(sessionFormData.sessionId)
    } else if (!sessionFormData.loadExisting) {
      const sessionName = sessionFormData.sessionId || `Session ${Date.now()}`
      console.log('Creating new session:', sessionName)
      createNewSession(sessionName)
    } else {
      alert('Please select a session to load or enter a name for a new session.')
    }
  }

  const showLogDetail = (log) => {
    setSelectedLogDetail(log)
    setShowLogDetailDialog(true)
  }

  const getStatusColor = (enabled) => {
    return enabled ? 'positive' : 'negative'
  }

  const getMethodBadge = (method) => {
    const colors = {
      'GET': 'positive',
      'POST': 'informative',
      'PUT': 'notice',
      'DELETE': 'negative',
      'PATCH': 'notice',
      'ALL': 'neutral'
    }
    return colors[method] || 'neutral'
  }

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString()
  }

  const formatResponseTime = (ms) => {
    return `${ms}ms`
  }

  const resetSessionForm = () => {
    setSessionFormData({
      sessionId: '',
      loadExisting: false
    })
  }

  const openSessionDialog = () => {
    resetSessionForm()
    setShowSessionDialog(true)
  }

  const clearAllConfigurations = async () => {
    if (!confirm('This will delete ALL proxy configurations for ALL sessions. Are you sure?')) {
      return
    }

    try {
      setLoading(true)
      console.log('Clearing all proxy configurations...')
      
      // Get all available sessions
      const sessionsResponse = await callApiProxyAction('/sessions', {}, { method: 'GET' })
      
      if (sessionsResponse.success && sessionsResponse.sessions) {
        for (const session of sessionsResponse.sessions) {
          try {
            console.log(`Clearing config for session: ${session.id}`)
            const response = await callApiProxyAction('/config', {
              sessionId: session.id,
              action: 'clearAll'
            })
            console.log(`Clear result for ${session.id}:`, response)
          } catch (error) {
            console.error(`Error clearing config for session ${session.id}:`, error)
          }
        }
      }
      
      // Clear current session config
      setProxyConfig(null)
      alert('All proxy configurations have been cleared!')
      
    } catch (error) {
      console.error('Error clearing all configurations:', error)
      alert(`Error clearing configurations: ${error.message || error}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View padding="size-400">
      <Flex direction="column" gap="size-300">
        <Flex justifyContent="space-between" alignItems="center">
          <Heading level={1}>🔄 API Proxy Manager</Heading>
          <ButtonGroup>
            <Button 
              variant="secondary" 
              onPress={openSessionDialog}
              isDisabled={loading}
            >
              <Add />
              <Text>Sessions</Text>
            </Button>
            <Button 
              variant="secondary" 
              onPress={() => loadProxyConfig(sessionId)}
              isDisabled={loading || !sessionId}
            >
              <Refresh />
              <Text>Refresh</Text>
            </Button>
            <Button 
              variant="negative" 
              onPress={clearAllConfigurations}
              isDisabled={loading}
            >
              <Delete />
              <Text>Clear All Configs</Text>
            </Button>
          </ButtonGroup>
        </Flex>

        {sessionId && (
          <Well>
            <Flex direction="column" gap="size-100">
              <Flex justifyContent="space-between" alignItems="center">
                <Text><strong>Session:</strong> {availableSessions.find(s => s.id === sessionId)?.name || sessionId.substring(0, 8)}</Text>
                <ButtonGroup>
                  <ActionButton onPress={copyProxyUrl} isQuiet>
                    <Copy />
                    <Text>Copy URL</Text>
                  </ActionButton>
                </ButtonGroup>
              </Flex>
              <Text><strong>Proxy Endpoint:</strong> 
                <Link>
                  <a href={`${allActions['api-proxy']}?sessionId=${sessionId}`} target="_blank" rel="noopener noreferrer">
                    {allActions['api-proxy']}?sessionId={sessionId}
                  </a>
                </Link>
              </Text>
              {proxyConfig && (
                <Text><strong>Status:</strong> 
                  <StatusLight variant={getStatusColor(proxyConfig.enabled)}>
                    {proxyConfig.enabled ? 'Active' : 'Disabled'}
                  </StatusLight>
                  <Text> | Requests: {proxyConfig.requestCount || 0}</Text>
                </Text>
              )}
            </Flex>
          </Well>
        )}

        <Tabs selectedKey={selectedTab} onSelectionChange={setSelectedTab}>
          <TabList>
            <Item key="config">
              Configuration
            </Item>
            <Item key="logs">
              Request Logs ({proxyLogs.length})
            </Item>
            <Item key="help">
              Help & Documentation
            </Item>
          </TabList>
          
          <TabPanels>
            {/* Configuration Tab */}
            <Item key="config">
              <View padding="size-200">
                <Flex justifyContent="space-between" alignItems="center" marginBottom="size-300">
                  <Heading level={3}>Proxy Configuration</Heading>
                  <ActionButton onPress={openConfigDialog}>
                    {proxyConfig ? <Edit /> : <Add />}
                    <Text>{proxyConfig ? 'Edit Configuration' : 'Create Configuration'}</Text>
                  </ActionButton>
                </Flex>

                {loading ? (
                  <Flex justifyContent="center" marginTop="size-400">
                    <ProgressCircle aria-label="Loading..." isIndeterminate />
                  </Flex>
                ) : proxyConfig ? (
                  <View>
                    <Well>
                      <Flex direction="column" gap="size-200">
                        <Flex justifyContent="space-between" alignItems="center">
                          <Heading level={4}>{proxyConfig.name}</Heading>
                          <Flex gap="size-100">
                            <ActionButton onPress={openConfigDialog} isQuiet>
                              <Edit />
                            </ActionButton>
                            <ActionButton onPress={deleteProxyConfig} isQuiet>
                              <Delete />
                            </ActionButton>
                          </Flex>
                        </Flex>
                        
                        <Flex direction="column" gap="size-100">
                          <Text><strong>Target URL:</strong> {proxyConfig.targetUrl}</Text>
                          <Text><strong>Path Pattern:</strong> {proxyConfig.pathPattern}</Text>
                          <Flex gap="size-200">
                            <Badge variant={getMethodBadge(proxyConfig.method)}>
                              {proxyConfig.method}
                            </Badge>
                            <StatusLight variant={getStatusColor(proxyConfig.enabled)}>
                              {proxyConfig.enabled ? 'Enabled' : 'Disabled'}
                            </StatusLight>
                          </Flex>
                          
                          {proxyConfig.headers && Object.keys(proxyConfig.headers).length > 0 && (
                            <Text><strong>Custom Headers:</strong> {Object.keys(proxyConfig.headers).join(', ')}</Text>
                          )}
                          
                          {proxyConfig.transformations && Object.keys(proxyConfig.transformations).length > 0 && (
                            <Text><strong>Transformations:</strong> Configured</Text>
                          )}
                        </Flex>
                      </Flex>
                    </Well>

                    {/* Session Statistics */}
                    {sessionStats && (
                      <View marginTop="size-300">
                        <Well>
                          <Heading level={4}>📊 Session Statistics</Heading>
                          <Flex direction="column" gap="size-200">
                            <Flex gap="size-400">
                              <View>
                                <Text><strong>Total Requests:</strong></Text>
                                <Text fontSize="size-400">{sessionStats.totalRequests}</Text>
                              </View>
                              <View>
                                <Text><strong>Successful:</strong></Text>
                                <Text fontSize="size-400" color="positive">{sessionStats.successfulRequests}</Text>
                              </View>
                              <View>
                                <Text><strong>Failed:</strong></Text>
                                <Text fontSize="size-400" color="negative">{sessionStats.failedRequests}</Text>
                              </View>
                              <View>
                                <Text><strong>Errors:</strong></Text>
                                <Text fontSize="size-400" color="negative">{sessionStats.errorRequests}</Text>
                              </View>
                              <View>
                                <Text><strong>Avg Response Time:</strong></Text>
                                <Text fontSize="size-400">{sessionStats.averageResponseTime}ms</Text>
                              </View>
                            </Flex>
                            
                            {sessionStats.lastRequestTime && (
                              <Text><strong>Last Request:</strong> {formatTimestamp(sessionStats.lastRequestTime)}</Text>
                            )}
                            
                            {sessionStats.statusCodeDistribution && Object.keys(sessionStats.statusCodeDistribution).length > 0 && (
                              <View>
                                <Text><strong>Status Code Distribution:</strong></Text>
                                <Flex gap="size-100" marginTop="size-100">
                                  {Object.entries(sessionStats.statusCodeDistribution).map(([status, count]) => (
                                    <Badge key={status} variant={status >= 200 && status < 300 ? 'positive' : 'negative'}>
                                      {status}: {count}
                                    </Badge>
                                  ))}
                                </Flex>
                              </View>
                            )}
                          </Flex>
                        </Well>
                      </View>
                    )}
                  </View>
                ) : (
                  <Well>
                    <Flex direction="column" alignItems="center" gap="size-200">
                      <Text>No proxy configuration found for this session.</Text>
                      <Button variant="cta" onPress={openConfigDialog}>
                        <Add />
                        <Text>Create Configuration</Text>
                      </Button>
                    </Flex>
                  </Well>
                )}
              </View>
            </Item>

            {/* Request Logs Tab */}
            <Item key="logs">
              <View padding="size-200">
                <Flex justifyContent="space-between" alignItems="center" marginBottom="size-300">
                  <Heading level={3}>Request Logs</Heading>
                  <ButtonGroup>
                    <Button 
                      variant="secondary" 
                      onPress={refreshLogs}
                      isDisabled={!sessionId}
                    >
                      <Refresh />
                      <Text>Refresh Logs</Text>
                    </Button>
                    <Button 
                      variant="secondary" 
                      onPress={clearLogs}
                      isDisabled={!sessionId}
                    >
                      <Delete />
                      <Text>Clear Logs</Text>
                    </Button>
                  </ButtonGroup>
                </Flex>

                {loading ? (
                  <Flex justifyContent="center" marginTop="size-400">
                    <ProgressCircle aria-label="Loading..." isIndeterminate />
                  </Flex>
                ) : (
                  <TableView aria-label="Proxy request logs" selectionMode="none">
                    <TableHeader>
                      <Column key="time" width="15%">Time</Column>
                      <Column key="method" width="8%">Method</Column>
                      <Column key="path" width="20%">Path</Column>
                      <Column key="target" width="25%">Target URL</Column>
                      <Column key="status" width="8%">Status</Column>
                      <Column key="responseTime" width="10%">Response Time</Column>
                      <Column key="actions" width="14%">Actions</Column>
                    </TableHeader>
                    <TableBody>
                      {proxyLogs.map((log, index) => (
                        <Row key={index}>
                          <Cell>
                            <Text>{formatTimestamp(log.timestamp)}</Text>
                          </Cell>
                          <Cell>
                            <Badge variant={getMethodBadge(log.originalRequest?.method || log.method || 'GET')}>
                              {log.originalRequest?.method || log.method || 'GET'}
                            </Badge>
                          </Cell>
                          <Cell>
                            <Text>{log.originalRequest?.path || log.originalPath || '/'}</Text>
                          </Cell>
                          <Cell>
                            <Text>{log.targetRequest?.url || log.targetUrl}</Text>
                          </Cell>
                          <Cell>
                            {log.response?.status && log.response.status !== 0 ? (
                              <Badge variant={log.response.status >= 200 && log.response.status < 300 ? 'positive' : 'negative'}>
                                {log.response.status}
                              </Badge>
                            ) : log.error ? (
                              <Badge variant="negative">
                                Error
                              </Badge>
                            ) : (
                              <Badge variant="neutral">
                                Unknown
                              </Badge>
                            )}
                          </Cell>
                          <Cell>
                            <Text>{formatResponseTime(log.responseTime)}</Text>
                          </Cell>
                          <Cell>
                            <ActionButton 
                              isQuiet 
                              onPress={() => showLogDetail(log)}
                              aria-label="View details"
                            >
                              <Info />
                              <Text>Details</Text>
                            </ActionButton>
                          </Cell>
                        </Row>
                      ))}
                    </TableBody>
                  </TableView>
                )}
              </View>
            </Item>

            {/* Help & Documentation Tab */}
            <Item key="help">
              <View padding="size-200">
                <Flex direction="column" gap="size-300">
                  <Well>
                    <Heading level={4}>🎯 Overview</Heading>
                    <Text>
                      The API Proxy allows you to forward requests from external systems to target APIs while adding headers, 
                      transforming data, and monitoring all requests. Each session has one configuration.
                    </Text>
                  </Well>

                  <Well>
                    <Heading level={4}>🔧 Configuration</Heading>
                    <Text><strong>Target URL:</strong> The destination API endpoint (e.g., https://api.example.com)</Text>
                    <Text><strong>Path Pattern:</strong> URL pattern matching:</Text>
                    <Text>• /* - Match all paths</Text>
                    <Text>• /api/* - Match paths starting with /api/</Text>
                    <Text>• /specific/path - Match exact path</Text>
                    <Text><strong>HTTP Method:</strong> ALL or specific method (GET, POST, etc.)</Text>
                  </Well>

                  <Well>
                    <Heading level={4}>📝 Headers (JSON)</Heading>
                    <Text>Add custom headers to forwarded requests:</Text>
                    <TextArea
                      value={`{
  "Authorization": "Bearer your-token",
  "Content-Type": "application/json",
  "X-API-Key": "your-api-key"
}`}
                      isReadOnly
                      height="size-1000"
                    />
                  </Well>

                  <Well>
                    <Heading level={4}>🔄 Transformations (JSON)</Heading>
                    <Text>Transform request body data:</Text>
                    <TextArea
                      value={`{
  "jsonTransform": true,
  "fieldMappings": {
    "oldFieldName": "newFieldName",
    "user_id": "userId",
    "email_address": "email"
  }
}`}
                      isReadOnly
                      height="size-1000"
                    />
                  </Well>

                  <Well>
                    <Heading level={4}>🚀 Usage</Heading>
                    <Text>1. Create a session and configuration</Text>
                    <Text>2. Copy the proxy URL</Text>
                    <Text>3. Send requests to: [proxy-url]/your-path</Text>
                    <Text>4. Monitor requests in the Logs tab</Text>
                    <Text><strong>Note:</strong> Runtime-to-runtime calls are not supported due to CloudFront restrictions.</Text>
                  </Well>
                </Flex>
              </View>
            </Item>
          </TabPanels>
        </Tabs>

        {/* Session Management Dialog */}
        <DialogTrigger isOpen={showSessionDialog} onOpenChange={setShowSessionDialog}>
          <ActionButton isHidden>Sessions</ActionButton>
          {(close) => (
            <Dialog>
              <Heading>Session Management</Heading>
              <Divider />
              <Content>
                <Form>
                  <Switch
                    isSelected={sessionFormData.loadExisting}
                    onChange={(value) => setSessionFormData({...sessionFormData, loadExisting: value})}
                  >
                    Load Existing Session
                  </Switch>
                  
                  {sessionFormData.loadExisting ? (
                    <Picker
                      label="Select Session"
                      selectedKey={sessionFormData.sessionId}
                      onSelectionChange={(value) => setSessionFormData({...sessionFormData, sessionId: value})}
                      placeholder="Choose a session..."
                    >
                      {availableSessions.map((session) => (
                        <Item key={session.id}>
                          {session.name} ({session.id.substring(0, 8)})
                        </Item>
                      ))}
                    </Picker>
                  ) : (
                    <TextField
                      label="Session Name"
                      value={sessionFormData.sessionId}
                      onChange={(value) => setSessionFormData({...sessionFormData, sessionId: value})}
                      placeholder="My API Proxy Session"
                    />
                  )}
                </Form>
              </Content>
              <ButtonGroup>
                <Button variant="secondary" onPress={close}>Cancel</Button>
                <Button 
                  variant="cta" 
                  onPress={() => {
                    handleSessionSubmit()
                    close()
                  }}
                  isDisabled={loading || (sessionFormData.loadExisting && !sessionFormData.sessionId)}
                >
                  {sessionFormData.loadExisting ? 'Load Session' : 'Create Session'}
                </Button>
              </ButtonGroup>
            </Dialog>
          )}
        </DialogTrigger>

        {/* Configuration Dialog */}
        <DialogTrigger isOpen={showConfigDialog} onOpenChange={setShowConfigDialog}>
          <ActionButton isHidden>Config</ActionButton>
          {(close) => (
            <Dialog>
              <Heading>{proxyConfig ? 'Edit' : 'Create'} Proxy Configuration</Heading>
              <Divider />
              <Content>
                <Form>
                  <TooltipTrigger>
                    <TextField
                      label="Configuration Name"
                      value={formData.name}
                      onChange={(value) => setFormData({...formData, name: value})}
                      isRequired
                    />
                    <Tooltip UNSAFE_style={{ maxWidth: '400px', width: '400px' }}>
                      <Text>
                        <strong>Configuration Name</strong><br/>
                        A friendly name to identify this proxy configuration. This helps you distinguish between multiple proxy setups.
                        <br/><br/>
                        <em>Example: "Production API", "Test Environment", "External Service"</em>
                      </Text>
                    </Tooltip>
                  </TooltipTrigger>

                  <TooltipTrigger>
                    <TextField
                      label="Target URL"
                      value={formData.targetUrl}
                      onChange={(value) => setFormData({...formData, targetUrl: value})}
                      placeholder="https://api.example.com"
                      isRequired
                    />
                    <Tooltip UNSAFE_style={{ maxWidth: '400px', width: '400px' }}>
                      <Text>
                        <strong>Target URL</strong><br/>
                        The base URL of the external API where requests will be forwarded. Must be a complete URL with protocol (http/https).
                        <br/><br/>
                        <em>Examples:</em><br/>
                        • https://api.github.com<br/>
                        • https://jsonplaceholder.typicode.com<br/>
                        • https://webhook.site/your-unique-id
                        <br/><br/>
                        <strong>Note:</strong> Adobe I/O Runtime actions are not supported due to CloudFront restrictions.
                      </Text>
                    </Tooltip>
                  </TooltipTrigger>

                  <TooltipTrigger>
                    <TextField
                      label="Path Pattern"
                      value={formData.pathPattern}
                      onChange={(value) => setFormData({...formData, pathPattern: value})}
                      placeholder="/* or /api/* or /specific/path"
                    />
                    <Tooltip UNSAFE_style={{ maxWidth: '400px', width: '400px' }}>
                      <Text>
                        <strong>Path Pattern</strong><br/>
                        Defines which request paths this configuration should handle. Supports wildcards and exact matches.
                        <br/><br/>
                        <em>Pattern Examples:</em><br/>
                        • <strong>/*</strong> - Match all paths (forwards entire path)<br/>
                        • <strong>/api/*</strong> - Match paths starting with /api/<br/>
                        • <strong>/users</strong> - Match exact path only<br/>
                        • <strong>/v1/data</strong> - Match specific endpoint
                        <br/><br/>
                        <strong>How it works:</strong> If your proxy URL is called with /api/users and pattern is /api/*, it forwards to targetUrl/users
                      </Text>
                    </Tooltip>
                  </TooltipTrigger>

                  <View>
                    <Flex alignItems="center" marginBottom="size-75">
                      <Text><strong>HTTP Method</strong></Text>
                                              <TooltipTrigger placement="top">
                          <ActionButton 
                            isQuiet 
                            UNSAFE_style={{
                              minWidth: 'auto',
                              padding: '2px 6px',
                              marginLeft: '8px',
                              fontSize: '11px',
                              color: '#6B7280'
                            }}
                          >
                            <Info />
                          </ActionButton>
                          <Tooltip UNSAFE_style={{ maxWidth: '400px', width: '400px' }}>
                            <Text>
                              <strong>HTTP Method</strong><br/>
                              Specifies which HTTP methods this configuration will handle.
                              <br/><br/>
                              <em>Options:</em><br/>
                              • <strong>ALL</strong> - Handle all HTTP methods (GET, POST, PUT, DELETE, etc.)<br/>
                              • <strong>GET</strong> - Only handle GET requests (data retrieval)<br/>
                              • <strong>POST</strong> - Only handle POST requests (create data)<br/>
                              • <strong>PUT</strong> - Only handle PUT requests (update data)<br/>
                              • <strong>DELETE</strong> - Only handle DELETE requests (remove data)<br/>
                              • <strong>PATCH</strong> - Only handle PATCH requests (partial updates)
                              <br/><br/>
                              <strong>Recommendation:</strong> Use "ALL" for maximum flexibility unless you need method-specific routing.
                            </Text>
                          </Tooltip>
                        </TooltipTrigger>
                    </Flex>
                    <Picker
                      selectedKey={formData.method}
                      onSelectionChange={(value) => setFormData({...formData, method: value})}
                    >
                      <Item key="ALL">ALL</Item>
                      <Item key="GET">GET</Item>
                      <Item key="POST">POST</Item>
                      <Item key="PUT">PUT</Item>
                      <Item key="DELETE">DELETE</Item>
                      <Item key="PATCH">PATCH</Item>
                    </Picker>
                  </View>

                  {proxyConfig && (
                    <View>
                      <Flex alignItems="center" marginBottom="size-75">
                        <Text><strong>Status</strong></Text>
                        <TooltipTrigger placement="top">
                          <ActionButton 
                            isQuiet 
                            UNSAFE_style={{
                              minWidth: 'auto',
                              padding: '2px 6px',
                              marginLeft: '8px',
                              fontSize: '11px',
                              color: '#6B7280'
                            }}
                          >
                            <Info />
                          </ActionButton>
                          <Tooltip UNSAFE_style={{ maxWidth: '400px', width: '400px' }}>
                            <Text>
                              <strong>Enabled/Disabled</strong><br/>
                              Controls whether this proxy configuration is active and will process requests.
                              <br/><br/>
                              • <strong>Enabled:</strong> Proxy will forward matching requests<br/>
                              • <strong>Disabled:</strong> Proxy will reject requests with an error
                              <br/><br/>
                              <em>Use this to temporarily disable a proxy without deleting the configuration.</em>
                            </Text>
                          </Tooltip>
                        </TooltipTrigger>
                      </Flex>
                      <Switch
                        isSelected={formData.enabled}
                        onChange={(value) => setFormData({...formData, enabled: value})}
                      >
                        Enabled
                      </Switch>
                    </View>
                  )}

                  <TooltipTrigger>
                    <TextArea
                      label="Headers (JSON)"
                      value={formData.headers}
                      onChange={(value) => setFormData({...formData, headers: value})}
                      placeholder='{"Authorization": "Bearer token", "Content-Type": "application/json"}'
                      height="size-1200"
                    />
                    <Tooltip UNSAFE_style={{ maxWidth: '400px', width: '400px' }}>
                      <Text>
                        <strong>Headers (JSON)</strong><br/>
                        Additional HTTP headers to include with forwarded requests. Must be valid JSON format.
                        <br/><br/>
                        <em>Common Examples:</em><br/>
                        <strong>API Authentication:</strong><br/>
                        {`{"Authorization": "Bearer your-token-here"}`}<br/>
                        <strong>Content Type:</strong><br/>
                        {`{"Content-Type": "application/json"}`}<br/>
                        <strong>Custom Headers:</strong><br/>
                        {`{"X-API-Key": "key123", "User-Agent": "MyApp/1.0"}`}
                        <br/><br/>
                        <strong>Note:</strong> These headers are added to every forwarded request. Original request headers are preserved unless overridden.
                      </Text>
                    </Tooltip>
                  </TooltipTrigger>

                  <TooltipTrigger>
                    <TextArea
                      label="Transformations (JSON)"
                      value={formData.transformations}
                      onChange={(value) => setFormData({...formData, transformations: value})}
                      placeholder='{"jsonTransform": true, "fieldMappings": {"oldField": "newField"}}'
                      height="size-1200"
                    />
                    <Tooltip UNSAFE_style={{ maxWidth: '400px', width: '400px' }}>
                      <Text>
                        <strong>Transformations (JSON)</strong><br/>
                        Advanced feature to transform request data before forwarding. Must be valid JSON format.
                        <br/><br/>
                        <em>Available Options:</em><br/>
                        <strong>Field Mapping:</strong><br/>
                        {`{"jsonTransform": true, "fieldMappings": {"oldName": "newName"}}`}
                        <br/><br/>
                        <strong>Example:</strong> Transform {`{"user": "john"}`} to {`{"username": "john"}`}<br/>
                        {`{"jsonTransform": true, "fieldMappings": {"user": "username"}}`}
                        <br/><br/>
                        <strong>Note:</strong> Leave empty {`{}`} if no transformations are needed. Only works with JSON request bodies.
                      </Text>
                    </Tooltip>
                  </TooltipTrigger>
                </Form>
              </Content>
              <ButtonGroup>
                <Button variant="secondary" onPress={close}>Cancel</Button>
                <Button 
                  variant="cta" 
                  onPress={() => {
                    saveProxyConfig()
                    close()
                  }}
                  isDisabled={loading || !formData.name || !formData.targetUrl}
                >
                  {proxyConfig ? 'Update' : 'Create'}
                </Button>
              </ButtonGroup>
            </Dialog>
          )}
        </DialogTrigger>

        {/* Log Detail Dialog */}
        <DialogTrigger isOpen={showLogDetailDialog} onOpenChange={setShowLogDetailDialog}>
          <ActionButton isHidden>Log Detail</ActionButton>
          {(close) => (
            <Dialog size="L">
              <Heading>Request Details</Heading>
              <Divider />
              <Content>
                {selectedLogDetail && (
                  <Flex direction="column" gap="size-300">
                    {/* Request Information */}
                    <Well>
                      <Heading level={4}>📤 Request Information</Heading>
                      <Flex direction="column" gap="size-100">
                        <Text><strong>Method:</strong> <Badge variant={getMethodBadge(selectedLogDetail.originalRequest?.method || selectedLogDetail.method || 'GET')}>{selectedLogDetail.originalRequest?.method || selectedLogDetail.method || 'GET'}</Badge></Text>
                        <Text><strong>Path:</strong> {selectedLogDetail.originalRequest?.path || selectedLogDetail.originalPath || '/'}</Text>
                        <Text><strong>Target URL:</strong> {selectedLogDetail.targetRequest?.url || selectedLogDetail.targetUrl}</Text>
                        <Text><strong>Timestamp:</strong> {formatTimestamp(selectedLogDetail.timestamp)}</Text>
                        <Text><strong>Response Time:</strong> {formatResponseTime(selectedLogDetail.responseTime)}</Text>
                      </Flex>
                      
                      {selectedLogDetail.originalRequest?.headers && Object.keys(selectedLogDetail.originalRequest.headers).length > 0 && (
                        <View marginTop="size-200">
                          <Text><strong>Request Headers:</strong></Text>
                          <TextArea
                            value={JSON.stringify(selectedLogDetail.originalRequest.headers, null, 2)}
                            isReadOnly
                            height="size-1000"
                            marginTop="size-100"
                          />
                        </View>
                      )}
                      
                      {selectedLogDetail.originalRequest?.body && (
                        <View marginTop="size-200">
                          <Text><strong>Request Body:</strong></Text>
                          <TextArea
                            value={typeof selectedLogDetail.originalRequest.body === 'string' ? selectedLogDetail.originalRequest.body : JSON.stringify(selectedLogDetail.originalRequest.body, null, 2)}
                            isReadOnly
                            height="size-1200"
                            marginTop="size-100"
                          />
                        </View>
                      )}
                    </Well>
                    
                    {/* Target Request Information */}
                    {selectedLogDetail.targetRequest && (
                      <View marginTop="size-200">
                        <Text><strong>Target Request Headers:</strong></Text>
                        <TextArea
                          value={JSON.stringify(selectedLogDetail.targetRequest.headers, null, 2)}
                          isReadOnly
                          height="size-1000"
                          marginTop="size-100"
                        />
                      </View>
                    )}
                    
                    {selectedLogDetail.targetRequest?.body && (
                      <View marginTop="size-200">
                        <Text><strong>Target Request Body:</strong></Text>
                        <TextArea
                          value={typeof selectedLogDetail.targetRequest.body === 'string' ? selectedLogDetail.targetRequest.body : JSON.stringify(selectedLogDetail.targetRequest.body, null, 2)}
                          isReadOnly
                          height="size-1200"
                          marginTop="size-100"
                        />
                      </View>
                    )}
                    
                    {/* Response Information */}
                    {selectedLogDetail.response?.status && selectedLogDetail.response.status !== 0 ? (
                      <Well>
                        <Heading level={4}>📥 Response Information</Heading>
                        <Flex direction="column" gap="size-100">
                          <Text><strong>Status Code:</strong> <Badge variant={selectedLogDetail.response.status >= 200 && selectedLogDetail.response.status < 300 ? 'positive' : 'negative'}>{selectedLogDetail.response.status}</Badge></Text>
                        </Flex>
                        
                        {selectedLogDetail.response?.headers && Object.keys(selectedLogDetail.response.headers).length > 0 && (
                          <View marginTop="size-200">
                            <Text><strong>Response Headers:</strong></Text>
                            <TextArea
                              value={JSON.stringify(selectedLogDetail.response.headers, null, 2)}
                              isReadOnly
                              height="size-1000"
                              marginTop="size-100"
                            />
                          </View>
                        )}
                        
                        {selectedLogDetail.response?.body && (
                          <View marginTop="size-200">
                            <Text><strong>Response Body:</strong></Text>
                            <TextArea
                              value={typeof selectedLogDetail.response.body === 'string' ? selectedLogDetail.response.body : JSON.stringify(selectedLogDetail.response.body, null, 2)}
                              isReadOnly
                              height="size-2000"
                              marginTop="size-100"
                            />
                          </View>
                        )}
                      </Well>
                    ) : selectedLogDetail.error ? (
                      <Well>
                        <Heading level={4}>❌ Error Information</Heading>
                        <Text><strong>Error:</strong> {selectedLogDetail.error}</Text>
                        {selectedLogDetail.errorDetails && (
                          <View marginTop="size-200">
                            <Text><strong>Error Details:</strong></Text>
                            <TextArea
                              value={typeof selectedLogDetail.errorDetails === 'string' ? selectedLogDetail.errorDetails : JSON.stringify(selectedLogDetail.errorDetails, null, 2)}
                              isReadOnly
                              height="size-1200"
                              marginTop="size-100"
                            />
                          </View>
                        )}
                      </Well>
                    ) : (
                      <Well>
                        <Heading level={4}>⚠️ No Response Data</Heading>
                        <Text>No response or error information available for this request.</Text>
                      </Well>
                    )}
                    
                    {/* Debug Information */}
                    <Well>
                      <Heading level={4}>🔍 Debug Information</Heading>
                      <TextArea
                        label="Full Log Data (JSON)"
                        value={JSON.stringify(selectedLogDetail, null, 2)}
                        isReadOnly
                        height="size-1600"
                      />
                    </Well>
                  </Flex>
                )}
              </Content>
              <ButtonGroup>
                <Button variant="secondary" onPress={close}>Close</Button>
              </ButtonGroup>
            </Dialog>
          )}
        </DialogTrigger>


      </Flex>
    </View>
  )
}

export default ProxyManager 