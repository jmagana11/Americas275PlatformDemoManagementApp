/*
* <license header>
*/

import React, { useState, useEffect, useRef } from 'react'
import {
  Flex,
  View,
  Heading,
  Text,
  Button,
  TextField,
  Picker,
  Item,
  ProgressBar,
  TableView,
  TableHeader,
  Column,
  TableBody,
  Row,
  Cell,
  Divider,
  Well,
  ActionButton,
  DialogTrigger,
  Dialog,
  Content,
  Header,
  ButtonGroup,
  TextArea,
  Tabs,
  TabList,
  TabPanels,
  TabPanel,
  Badge,
  Grid,
  Slider,
  Switch
} from '@adobe/react-spectrum'
import Play from '@spectrum-icons/workflow/Play'
import Refresh from '@spectrum-icons/workflow/Refresh'
import Delete from '@spectrum-icons/workflow/Delete'
import Copy from '@spectrum-icons/workflow/Copy'
import Link from '@spectrum-icons/workflow/Link'
import Globe from '@spectrum-icons/workflow/Globe'
import actionWebInvoke from '../utils'
import allActions from '../config.json'

export const ApiMonitor = ({ runtime, ims }) => {
  // Session state
  const [sessionId, setSessionId] = useState('')
  const [sessionActive, setSessionActive] = useState(false)
  const [sessionInfo, setSessionInfo] = useState(null)
  const [activeTab, setActiveTab] = useState('outbound')
  
  // Request state (outbound)
  const [requestUrl, setRequestUrl] = useState('https://jsonplaceholder.typicode.com/posts/1')
  const [requestMethod, setRequestMethod] = useState('GET')
  const [requestHeaders, setRequestHeaders] = useState('{"Content-Type": "application/json"}')
  const [requestBody, setRequestBody] = useState('')
  const [timeout, setTimeout] = useState(30)
  
  // Monitor state
  const [logs, setLogs] = useState([])
  const [webhookLogs, setWebhookLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [selectedLog, setSelectedLog] = useState(null)
  const [selectedWebhookLog, setSelectedWebhookLog] = useState(null)
  const [error, setError] = useState(null)
  const [webhookUrl, setWebhookUrl] = useState('')
  
  // Auto-refresh interval
  const intervalRef = useRef(null)
  
  // Track if component is mounted to prevent state updates on unmounted component
  const isMountedRef = useRef(true)
  
  // Load session from localStorage on mount
  useEffect(() => {
    const savedSessionId = localStorage.getItem('apiMonitorSessionId')
    if (savedSessionId) {
      setSessionId(savedSessionId)
      checkSessionStatus(savedSessionId)
    }
    
    // Cleanup function to mark component as unmounted
    return () => {
      isMountedRef.current = false
    }
  }, [])
  
  // Generate webhook URL when session becomes active
  useEffect(() => {
    if (sessionActive && sessionId) {
      const webhookBaseUrl = allActions['webhook-receiver']
      if (webhookBaseUrl) {
        setWebhookUrl(`${webhookBaseUrl}/${sessionId}`)
      }
    }
  }, [sessionActive, sessionId])
  
  // Handle auto-refresh
  useEffect(() => {
    if (autoRefresh && sessionActive && sessionId) {
      intervalRef.current = setInterval(() => {
        if (activeTab === 'outbound') {
          loadLogs(sessionId, false)
        } else {
          loadWebhookLogs(sessionId, false)
        }
      }, 3000) // Refresh every 3 seconds
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [autoRefresh, sessionActive, sessionId, activeTab])
  
  const checkSessionStatus = async (id) => {
    // Clear current state when switching sessions
    if (isMountedRef.current) {
      setLogs([])
      setWebhookLogs([])
      setSelectedLog(null)
      setSelectedWebhookLog(null)
      setError(null)
    }
    
    try {
      const result = await callApiMonitorAction('getLogs', { sessionId: id, limit: 1 })
      if (result.success) {
        if (isMountedRef.current) {
          setSessionActive(true)
          setSessionInfo(result.session)
          loadLogs(id, false)
          loadWebhookLogs(id, false)
        }
      } else {
        if (isMountedRef.current) {
          setSessionActive(false)
          setSessionInfo(null)
        }
      }
    } catch (err) {
      if (isMountedRef.current) {
        setSessionActive(false)
        setSessionInfo(null)
      }
    }
  }
  
  const callApiMonitorAction = async (action, params = {}) => {
    const actionUrl = allActions['api-monitor']
    if (!actionUrl) {
      throw new Error('api-monitor action not found in config')
    }
    
    const headers = ims ? {
      'authorization': `Bearer ${ims.token}`,
      'x-gw-ims-org-id': ims.org
    } : {}
    
    const response = await actionWebInvoke(actionUrl, headers, { action, ...params })
    return response.body || response
  }
  
  const callWebhookReceiverAction = async (method = 'GET', path = '', body = null, headers = {}) => {
    const actionUrl = allActions['webhook-receiver']
    if (!actionUrl) {
      throw new Error('webhook-receiver action not found in config')
    }
    
    const fullUrl = `${actionUrl}/${sessionId}${path}`
    const actionHeaders = ims ? {
      'authorization': `Bearer ${ims.token}`,
      'x-gw-ims-org-id': ims.org,
      ...headers
    } : headers
    
    const params = body ? { __ow_body: JSON.stringify(body) } : {}
    const response = await actionWebInvoke(fullUrl, actionHeaders, params, { method })
    return response.body || response
  }
  
  const createSession = async () => {
    if (isMountedRef.current) {
      setLoading(true)
      setError(null)
    }
    
    try {
      const result = await callApiMonitorAction('createSession')
      
      if (result.success && isMountedRef.current) {
        setSessionId(result.sessionId)
        setSessionActive(true)
        setSessionInfo({
          id: result.sessionId,
          created: result.created,
          requestCount: 0,
          webhookCount: 0,
          lastActivity: result.created
        })
        setLogs([])
        setWebhookLogs([])
        
        // Save to localStorage
        localStorage.setItem('apiMonitorSessionId', result.sessionId)
      } else if (isMountedRef.current) {
        setError(result.error || 'Failed to create session')
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err.message || 'Failed to create session')
      }
    }
    
    if (isMountedRef.current) {
      setLoading(false)
    }
  }
  
  const makeRequest = async () => {
    if (!sessionId || !sessionActive) {
      if (isMountedRef.current) {
        setError('Please create a session first')
      }
      return
    }
    
    if (isMountedRef.current) {
      setLoading(true)
      setError(null)
    }
    
    try {
      let headers = {}
      if (requestHeaders.trim()) {
        try {
          headers = JSON.parse(requestHeaders)
        } catch (e) {
          if (isMountedRef.current) {
            setError('Invalid JSON in headers')
            setLoading(false)
          }
          return
        }
      }
      
      let body = null
      if (requestBody.trim() && ['POST', 'PUT', 'PATCH'].includes(requestMethod)) {
        // Always send body as string to avoid double JSON encoding
        body = requestBody.trim()
      }
      
      const result = await callApiMonitorAction('proxy', {
        sessionId,
        method: requestMethod,
        url: requestUrl,
        headers,
        body,
        timeout: timeout * 1000
      })
      
      if (result.success && isMountedRef.current) {
        // Refresh logs to show the new request
        await loadLogs(sessionId, false)
      } else if (isMountedRef.current) {
        setError(result.error || 'Request failed')
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err.message || 'Request failed')
      }
    }
    
    if (isMountedRef.current) {
      setLoading(false)
    }
  }
  
  const loadLogs = async (id = sessionId, showLoading = true) => {
    if (!id) return
    
    console.log('=== FRONTEND DEBUG: loadLogs called ===')
    console.log('Session ID:', id)
    console.log('Show loading:', showLoading)
    
    if (showLoading && isMountedRef.current) setLoading(true)
    if (isMountedRef.current) setError(null)
    
    try {
      console.log('Calling getLogs action...')
      const result = await callApiMonitorAction('getLogs', { sessionId: id, limit: 100 })
      
      console.log('getLogs result:', result)
      console.log('Result success:', result.success)
      console.log('Result logs:', result.logs)
      console.log('Logs length:', result.logs ? result.logs.length : 'undefined')
      
      if (result.success && isMountedRef.current) {
        const logsToSet = result.logs || []
        console.log('Setting logs to:', logsToSet)
        console.log('Current logs state before setLogs:', logs)
        setLogs(logsToSet)
        console.log('setLogs called with:', logsToSet)
        setSessionInfo(result.session)
      } else if (!result.success && isMountedRef.current) {
        console.error('getLogs failed:', result.error)
        setError(result.error || 'Failed to load logs')
      }
    } catch (err) {
      console.error('getLogs exception:', err)
      if (isMountedRef.current) {
        setError(err.message || 'Failed to load logs')
      }
    }
    
    if (showLoading && isMountedRef.current) setLoading(false)
  }
  
  const loadWebhookLogs = async (id = sessionId, showLoading = true) => {
    if (!id) return
    
    if (showLoading && isMountedRef.current) setLoading(true)
    if (isMountedRef.current) setError(null)
    
    try {
      const result = await callApiMonitorAction('getWebhookLogs', { sessionId: id, limit: 100 })
      
      if (result.success && isMountedRef.current) {
        setWebhookLogs(result.webhooks || [])
        // Update session info if available
        if (result.session) {
          setSessionInfo(prev => ({ ...prev, ...result.session }))
        }
      } else if (isMountedRef.current) {
        // If the action doesn't support webhook logs yet, just set empty array
        setWebhookLogs([])
      }
    } catch (err) {
      // If webhook functionality isn't available yet, don't show error
      if (isMountedRef.current) {
        setWebhookLogs([])
      }
    }
    
    if (showLoading && isMountedRef.current) setLoading(false)
  }
  
  const clearLogs = async () => {
    if (!sessionId) return
    
    if (isMountedRef.current) {
      setLoading(true)
      setError(null)
    }
    
    try {
      const result = await callApiMonitorAction('clearLogs', { sessionId })
      
      if (result.success && isMountedRef.current) {
        setLogs([])
        setSelectedLog(null)
        await loadLogs(sessionId, false)
      } else if (isMountedRef.current) {
        setError(result.error || 'Failed to clear logs')
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err.message || 'Failed to clear logs')
      }
    }
    
    if (isMountedRef.current) {
      setLoading(false)
    }
  }
  
  const clearWebhookLogs = async () => {
    if (!sessionId) return
    
    if (isMountedRef.current) {
      setLoading(true)
      setError(null)
    }
    
    try {
      const result = await callApiMonitorAction('clearWebhookLogs', { sessionId })
      
      if (result.success && isMountedRef.current) {
        setWebhookLogs([])
        setSelectedWebhookLog(null)
        await loadWebhookLogs(sessionId, false)
      } else if (isMountedRef.current) {
        setError(result.error || 'Failed to clear webhook logs')
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err.message || 'Failed to clear webhook logs')
      }
    }
    
    if (isMountedRef.current) {
      setLoading(false)
    }
  }
  
  const testWebhook = async () => {
    if (!webhookUrl) return
    
    if (isMountedRef.current) {
      setLoading(true)
      setError(null)
    }
    
    try {
      const testPayload = {
        event: 'test',
        message: 'Test webhook from API Monitor',
        timestamp: new Date().toISOString(),
        data: {
          sessionId: sessionId,
          source: 'api-monitor-ui'
        }
      }
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Test-Webhook': 'true'
        },
        body: JSON.stringify(testPayload)
      })
      
      if (response.ok && isMountedRef.current) {
        // Refresh webhook logs to show the test
        await loadWebhookLogs(sessionId, false)
      } else if (isMountedRef.current) {
        setError(`Test webhook failed: ${response.status} ${response.statusText}`)
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(`Test webhook failed: ${err.message}`)
      }
    }
    
    if (isMountedRef.current) {
      setLoading(false)
    }
  }
  
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      console.log('Copied to clipboard')
    })
  }
  
  const formatResponseTime = (time) => {
    if (time < 1000) return `${time}ms`
    return `${(time / 1000).toFixed(2)}s`
  }
  
  const getStatusColor = (status) => {
    if (status >= 200 && status < 300) return 'positive'
    if (status >= 300 && status < 400) return 'notice'
    if (status >= 400) return 'negative'
    return 'neutral'
  }
  
  const renderLogDetails = (log) => {
    if (!log) return null
    
    return (
      <Tabs aria-label="Request details">
        <TabList>
          <Item key="request">Request</Item>
          <Item key="response">Response</Item>
          <Item key="headers">Headers</Item>
          <Item key="curl">cURL</Item>
        </TabList>
        <TabPanels>
          <Item key="request">
            <View padding="size-200">
              <Flex direction="column" gap="size-200">
                <Text><strong>Method:</strong> {log.request.method}</Text>
                <Text><strong>URL:</strong> {log.request.url}</Text>
                {log.request.body && (
                  <View>
                    <Text><strong>Request Body:</strong></Text>
                    <Well>
                      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {typeof log.request.body === 'object' 
                          ? JSON.stringify(log.request.body, null, 2)
                          : log.request.body
                        }
                      </pre>
                    </Well>
                  </View>
                )}
              </Flex>
            </View>
          </Item>
          <Item key="response">
            <View padding="size-200">
              <Flex direction="column" gap="size-200">
                <Flex direction="row" gap="size-200" alignItems="center">
                  <Text><strong>Status:</strong></Text>
                  <Badge variant={getStatusColor(log.response.status)}>
                    {log.response.status} {log.response.statusText}
                  </Badge>
                </Flex>
                <Text><strong>Response Time:</strong> {formatResponseTime(log.responseTime)}</Text>
                <Text><strong>Size:</strong> {log.response.size} bytes</Text>
                {log.error && (
                  <Well UNSAFE_style={{backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b'}}>
                    <Text><strong>Error:</strong> {log.error.message}</Text>
                  </Well>
                )}
                {log.response.body && (
                  <View>
                    <Text><strong>Response Body:</strong></Text>
                    <Well maxHeight="300px" overflow="auto">
                      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {typeof log.response.body === 'object' 
                          ? JSON.stringify(log.response.body, null, 2)
                          : log.response.body
                        }
                      </pre>
                    </Well>
                  </View>
                )}
              </Flex>
            </View>
          </Item>
          <Item key="headers">
            <View padding="size-200">
              <Flex direction="column" gap="size-300">
                <View>
                  <Text><strong>Request Headers:</strong></Text>
                  <Well>
                    <pre>{JSON.stringify(log.request.headers, null, 2)}</pre>
                  </Well>
                </View>
                <View>
                  <Text><strong>Response Headers:</strong></Text>
                  <Well>
                    <pre>{JSON.stringify(log.response.headers, null, 2)}</pre>
                  </Well>
                </View>
              </Flex>
            </View>
          </Item>
          <Item key="curl">
            <View padding="size-200">
              <Flex direction="column" gap="size-200">
                <Text><strong>cURL Command:</strong></Text>
                <Well>
                  <pre style={{ whiteSpace: 'pre-wrap' }}>{log.curlCommand}</pre>
                </Well>
                <ActionButton onPress={() => copyToClipboard(log.curlCommand)}>
                  <Copy />
                  <Text>Copy cURL</Text>
                </ActionButton>
              </Flex>
            </View>
          </Item>
        </TabPanels>
      </Tabs>
    )
  }
  
  const renderWebhookLogDetails = (log) => {
    if (!log) return null
    
    return (
      <Tabs aria-label="Webhook details">
        <TabList>
          <Item key="request">Request</Item>
          <Item key="response">Response</Item>
          <Item key="headers">Headers</Item>
          <Item key="metadata">Metadata</Item>
        </TabList>
        <TabPanels>
          <Item key="request">
            <View padding="size-200">
              <Flex direction="column" gap="size-200">
                <Text><strong>Method:</strong> {log.request.method}</Text>
                <Text><strong>Path:</strong> {log.request.path}</Text>
                <Text><strong>Client IP:</strong> {log.request.clientIP}</Text>
                <Text><strong>User Agent:</strong> {log.request.userAgent}</Text>
                {Object.keys(log.request.query).length > 0 && (
                  <View>
                    <Text><strong>Query Parameters:</strong></Text>
                    <Well>
                      <pre>{JSON.stringify(log.request.query, null, 2)}</pre>
                    </Well>
                  </View>
                )}
                {log.request.body && (
                  <View>
                    <Text><strong>Request Body:</strong></Text>
                    <Well>
                      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {typeof log.request.body === 'object' 
                          ? JSON.stringify(log.request.body, null, 2)
                          : log.request.body
                        }
                      </pre>
                    </Well>
                  </View>
                )}
              </Flex>
            </View>
          </Item>
          <Item key="response">
            <View padding="size-200">
              <Flex direction="column" gap="size-200">
                <Flex direction="row" gap="size-200" alignItems="center">
                  <Text><strong>Status:</strong></Text>
                  <Badge variant={getStatusColor(log.response.status)}>
                    {log.response.status}
                  </Badge>
                </Flex>
                <Text><strong>Webhook ID:</strong> {log.webhookId}</Text>
                {log.response.body && (
                  <View>
                    <Text><strong>Response Body:</strong></Text>
                    <Well maxHeight="300px" overflow="auto">
                      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {typeof log.response.body === 'object' 
                          ? JSON.stringify(log.response.body, null, 2)
                          : log.response.body
                        }
                      </pre>
                    </Well>
                  </View>
                )}
              </Flex>
            </View>
          </Item>
          <Item key="headers">
            <View padding="size-200">
              <Flex direction="column" gap="size-300">
                <View>
                  <Text><strong>Request Headers:</strong></Text>
                  <Well>
                    <pre>{JSON.stringify(log.request.headers, null, 2)}</pre>
                  </Well>
                </View>
                <View>
                  <Text><strong>Response Headers:</strong></Text>
                  <Well>
                    <pre>{JSON.stringify(log.response.headers, null, 2)}</pre>
                  </Well>
                </View>
              </Flex>
            </View>
          </Item>
          <Item key="metadata">
            <View padding="size-200">
              <Flex direction="column" gap="size-200">
                <Text><strong>Timestamp:</strong> {new Date(log.timestamp).toLocaleString()}</Text>
                <Text><strong>Session ID:</strong> {log.sessionId}</Text>
                <Text><strong>Body Size:</strong> {log.request.bodySize} bytes</Text>
              </Flex>
            </View>
          </Item>
        </TabPanels>
      </Tabs>
    )
  }
  
  return (
    <Flex direction="column" gap="size-300" margin="size-200">
      <Heading level={2}>🔍 API Monitor</Heading>
      <Text>Monitor and debug your API requests and webhooks in real-time. Create a session to get started.</Text>
      
      {error && (
        <Well marginBottom="size-200" UNSAFE_style={{backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b'}}>
          <Text><strong>Error:</strong> {error}</Text>
        </Well>
      )}
      
      {/* Session Management */}
      <View>
        <Heading level={3}>Session Management</Heading>
        <Flex direction="row" gap="size-200" alignItems="end" wrap>
          <View flex="1">
            <TextField 
              label="Session ID" 
              value={sessionId} 
              onChange={setSessionId}
              placeholder="Create a new session or enter existing session ID"
            />
          </View>
          <ButtonGroup>
            <Button 
              variant="primary" 
              onPress={createSession}
              isDisabled={loading}
            >
              <Play />
              <Text>New Session</Text>
            </Button>
            {sessionId && (
              <Button 
                variant="secondary" 
                onPress={() => checkSessionStatus(sessionId)}
                isDisabled={loading}
              >
                <Refresh />
                <Text>Connect</Text>
              </Button>
            )}
          </ButtonGroup>
        </Flex>
        
        {sessionActive && sessionInfo && (
          <Well marginTop="size-200">
            <Grid areas={['info actions']} columns={['3fr', '1fr']} gap="size-200">
              <View gridArea="info">
                <Flex direction="column" gap="size-100">
                  <Text><strong>Session Active</strong></Text>
                  <Text>Created: {new Date(sessionInfo.created).toLocaleString()}</Text>
                  <Text>Outbound Requests: {sessionInfo.requestCount || 0}</Text>
                  <Text>Inbound Webhooks: {sessionInfo.webhookCount || 0}</Text>
                  <Text>Last Activity: {new Date(sessionInfo.lastActivity).toLocaleString()}</Text>
                </Flex>
              </View>
              <View gridArea="actions">
                <Flex direction="column" gap="size-100">
                  <Switch isSelected={autoRefresh} onChange={setAutoRefresh} UNSAFE_style={{ display: 'none' }}>
                    Auto Refresh
                  </Switch>
                </Flex>
              </View>
            </Grid>
          </Well>
        )}
      </View>
      
      {/* Main Content Tabs */}
      {sessionActive && (
        <Tabs 
          aria-label="API Monitor Tabs" 
          selectedKey={activeTab} 
          onSelectionChange={setActiveTab}
        >
          <TabList>
            <Item key="outbound">
              <Globe />
              <Text>Outbound API Calls</Text>
            </Item>
            <Item key="inbound">
              <Link />
              <Text>Inbound Webhooks</Text>
            </Item>
            <Item key="help">
              <Text>Help & Documentation</Text>
            </Item>
          </TabList>
          <TabPanels>
            {/* Outbound API Monitoring */}
            <Item key="outbound">
              <Flex direction="column" gap="size-300">
                {/* Request Builder */}
                <View>
                  <Heading level={3}>Make Request</Heading>
                  <Flex direction="column" gap="size-200">
                    <Flex direction="row" gap="size-200" alignItems="end">
                      <Picker 
                        label="Method" 
                        selectedKey={requestMethod} 
                        onSelectionChange={setRequestMethod}
                        width="size-1200"
                      >
                        <Item key="GET">GET</Item>
                        <Item key="POST">POST</Item>
                        <Item key="PUT">PUT</Item>
                        <Item key="PATCH">PATCH</Item>
                        <Item key="DELETE">DELETE</Item>
                        <Item key="HEAD">HEAD</Item>
                        <Item key="OPTIONS">OPTIONS</Item>
                      </Picker>
                      <TextField 
                        label="URL" 
                        value={requestUrl} 
                        onChange={setRequestUrl}
                        flex="1"
                        placeholder="https://api.example.com/endpoint"
                      />
                      <Button 
                        variant="primary" 
                        onPress={makeRequest}
                        isDisabled={loading || !requestUrl}
                      >
                        <Play />
                        <Text>Send</Text>
                      </Button>
                    </Flex>
                    
                    <Flex direction="row" gap="size-200">
                      <View flex="1">
                        <TextArea 
                          label="Headers (JSON)" 
                          value={requestHeaders} 
                          onChange={setRequestHeaders}
                          height="size-1000"
                          placeholder='{"Authorization": "Bearer token", "Content-Type": "application/json"}'
                        />
                      </View>
                      {['POST', 'PUT', 'PATCH'].includes(requestMethod) && (
                        <View flex="1">
                          <TextArea 
                            label="Request Body" 
                            value={requestBody} 
                            onChange={setRequestBody}
                            height="size-1000"
                            placeholder='{"key": "value"}'
                          />
                        </View>
                      )}
                    </Flex>
                    
                    <Flex direction="row" gap="size-200" alignItems="center">
                      <View width="size-2000">
                        <Slider 
                          label="Timeout (seconds)" 
                          value={timeout} 
                          onChange={setTimeout}
                          minValue={5}
                          maxValue={120}
                          step={5}
                        />
                      </View>
                      <Text>{timeout}s</Text>
                    </Flex>
                  </Flex>
                </View>
                
                {/* Request Logs */}
                <View>
                  <Flex direction="row" justifyContent="space-between" alignItems="center">
                    <Heading level={3}>Request History ({logs.length})</Heading>
                    <ButtonGroup>
                      <Button 
                        variant="secondary" 
                        onPress={() => loadLogs(sessionId)}
                        isDisabled={loading}
                      >
                        <Refresh />
                        <Text>Refresh</Text>
                      </Button>
                      <Button 
                        variant="negative" 
                        onPress={clearLogs}
                        isDisabled={loading || logs.length === 0}
                      >
                        <Delete />
                        <Text>Clear</Text>
                      </Button>
                    </ButtonGroup>
                  </Flex>
                  
                  {loading && <ProgressBar label="Loading..." isIndeterminate />}
                  
                  {logs.length > 0 ? (
                    <TableView 
                      aria-label="Request logs" 
                      maxHeight="400px"
                      selectionMode="single"
                      onSelectionChange={(keys) => {
                        const selectedKey = Array.from(keys)[0]
                        if (selectedKey !== undefined) {
                          setSelectedLog(logs[selectedKey])
                        }
                      }}
                    >
                      <TableHeader>
                        <Column key="timestamp" width={120}>Time</Column>
                        <Column key="method" width={80}>Method</Column>
                        <Column key="url">URL</Column>
                        <Column key="status" width={80}>Status</Column>
                        <Column key="responseTime" width={100}>Response Time</Column>
                        <Column key="size" width={80}>Size</Column>
                      </TableHeader>
                      <TableBody>
                        {logs.map((log, index) => (
                          <Row key={index}>
                            <Cell>{new Date(log.timestamp).toLocaleTimeString()}</Cell>
                            <Cell>
                              <Badge variant="neutral">{log.request.method}</Badge>
                            </Cell>
                            <Cell>
                              <Text UNSAFE_style={{ wordBreak: 'break-all' }}>
                                {log.request.url}
                              </Text>
                            </Cell>
                            <Cell>
                              <Badge variant={getStatusColor(log.response.status)}>
                                {log.response.status}
                              </Badge>
                            </Cell>
                            <Cell>{formatResponseTime(log.responseTime)}</Cell>
                            <Cell>{log.response.size}B</Cell>
                          </Row>
                        ))}
                      </TableBody>
                    </TableView>
                  ) : (
                    !loading && (
                      <Well>
                        <Text>No requests yet. Make your first API call above to see it logged here.</Text>
                      </Well>
                    )
                  )}
                </View>
                
                {/* Request Details */}
                {selectedLog && (
                  <View>
                    <Heading level={3}>Request Details</Heading>
                    {renderLogDetails(selectedLog)}
                  </View>
                )}
              </Flex>
            </Item>
            
            {/* Inbound Webhook Monitoring */}
            <Item key="inbound">
              <Flex direction="column" gap="size-300">
                {/* Webhook URL */}
                <View>
                  <Heading level={3}>Webhook Endpoint</Heading>
                  <Text>Use this URL to receive webhook calls from external systems:</Text>
                  <Well marginTop="size-100">
                    <Flex direction="row" gap="size-200" alignItems="center">
                      <Text flex="1" UNSAFE_style={{ wordBreak: 'break-all', fontFamily: 'monospace' }}>
                        {webhookUrl}
                      </Text>
                      <ButtonGroup>
                        <ActionButton 
                          onPress={() => copyToClipboard(webhookUrl)}
                          isQuiet
                        >
                          <Copy />
                          <Text>Copy URL</Text>
                        </ActionButton>
                        <ActionButton 
                          onPress={testWebhook}
                          isDisabled={loading}
                          isQuiet
                        >
                          <Play />
                          <Text>Test</Text>
                        </ActionButton>
                      </ButtonGroup>
                    </Flex>
                  </Well>
                  <Text marginTop="size-100">
                    <strong>Tip:</strong> This endpoint accepts all HTTP methods (GET, POST, PUT, DELETE, etc.) 
                    and will log all incoming requests with full details including headers, body, and client information.
                  </Text>
                </View>
                
                {/* Webhook Logs */}
                <View>
                  <Flex direction="row" justifyContent="space-between" alignItems="center">
                    <Heading level={3}>Webhook History ({webhookLogs.length})</Heading>
                    <ButtonGroup>
                      <Button 
                        variant="secondary" 
                        onPress={() => loadWebhookLogs(sessionId)}
                        isDisabled={loading}
                      >
                        <Refresh />
                        <Text>Refresh</Text>
                      </Button>
                      <Button 
                        variant="negative" 
                        onPress={clearWebhookLogs}
                        isDisabled={loading || webhookLogs.length === 0}
                      >
                        <Delete />
                        <Text>Clear</Text>
                      </Button>
                    </ButtonGroup>
                  </Flex>
                  
                  {loading && <ProgressBar label="Loading..." isIndeterminate />}
                  
                  {webhookLogs.length > 0 ? (
                    <TableView 
                      aria-label="Webhook logs" 
                      maxHeight="400px"
                      selectionMode="single"
                      onSelectionChange={(keys) => {
                        const selectedKey = Array.from(keys)[0]
                        if (selectedKey !== undefined) {
                          setSelectedWebhookLog(webhookLogs[selectedKey])
                        }
                      }}
                    >
                      <TableHeader>
                        <Column key="timestamp" width={120}>Time</Column>
                        <Column key="method" width={80}>Method</Column>
                        <Column key="path">Path</Column>
                        <Column key="clientIP" width={120}>Client IP</Column>
                        <Column key="status" width={80}>Status</Column>
                        <Column key="size" width={80}>Size</Column>
                      </TableHeader>
                      <TableBody>
                        {webhookLogs.map((log, index) => (
                          <Row key={index}>
                            <Cell>{new Date(log.timestamp).toLocaleTimeString()}</Cell>
                            <Cell>
                              <Badge variant="neutral">{log.request.method}</Badge>
                            </Cell>
                            <Cell>
                              <Text UNSAFE_style={{ wordBreak: 'break-all' }}>
                                {log.request.path}
                              </Text>
                            </Cell>
                            <Cell>{log.request.clientIP}</Cell>
                            <Cell>
                              <Badge variant={getStatusColor(log.response.status)}>
                                {log.response.status}
                              </Badge>
                            </Cell>
                            <Cell>{log.request.bodySize}B</Cell>
                          </Row>
                        ))}
                      </TableBody>
                    </TableView>
                  ) : (
                    !loading && (
                      <Well>
                        <Text>No webhooks received yet. Share the webhook URL above with external systems to start monitoring incoming requests.</Text>
                      </Well>
                    )
                  )}
                </View>
                
                {/* Webhook Details */}
                {selectedWebhookLog && (
                  <View>
                    <Heading level={3}>Webhook Details</Heading>
                    {renderWebhookLogDetails(selectedWebhookLog)}
                  </View>
                )}
              </Flex>
            </Item>

            {/* Help & Documentation Tab */}
            <Item key="help">
              <View padding="size-200">
                <Flex direction="column" gap="size-300">
                  <Well>
                    <Heading level={4}>🎯 Overview</Heading>
                    <Text>
                      The API Monitor is a powerful tool for debugging and testing API integrations. It provides real-time monitoring 
                      of both outbound API calls and inbound webhook requests, with detailed logging and inspection capabilities.
                    </Text>
                  </Well>

                  <Well>
                    <Heading level={4}>🚀 Getting Started</Heading>
                    <Text><strong>1. Create a Session:</strong> Click "New Session" to start monitoring. Each session is isolated and has its own logs.</Text>
                    <Text><strong>2. Choose Your Monitoring Type:</strong></Text>
                    <Text>• <strong>Outbound API Calls:</strong> Test and monitor requests you make to external APIs</Text>
                    <Text>• <strong>Inbound Webhooks:</strong> Capture and inspect webhook requests from external systems</Text>
                    <Text><strong>3. Enable Auto Refresh:</strong> Turn on auto-refresh to see new requests in real-time (updates every 3 seconds)</Text>
                  </Well>

                  <Well>
                    <Heading level={4}>📤 Outbound API Monitoring</Heading>
                    <Text><strong>Making Requests:</strong></Text>
                    <Text>• Select HTTP method (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS)</Text>
                    <Text>• Enter the target URL you want to test</Text>
                    <Text>• Add custom headers in JSON format</Text>
                    <Text>• Include request body for POST/PUT/PATCH requests</Text>
                    <Text>• Adjust timeout settings (5-120 seconds)</Text>
                    <br/>
                    <Text><strong>Request History:</strong></Text>
                    <Text>• View all requests with timestamps, methods, URLs, status codes, and response times</Text>
                    <Text>• Click on any request to see detailed information including headers and response body</Text>
                    <Text>• Clear logs when needed to start fresh</Text>
                  </Well>

                  <Well>
                    <Heading level={4}>📥 Inbound Webhook Monitoring</Heading>
                    <Text><strong>Webhook Endpoint:</strong></Text>
                    <Text>• Each session gets a unique webhook URL that accepts all HTTP methods</Text>
                    <Text>• Copy the URL and share it with external systems that need to send webhooks</Text>
                    <Text>• Test the endpoint using the "Test" button to verify it's working</Text>
                    <br/>
                    <Text><strong>Webhook History:</strong></Text>
                    <Text>• Monitor all incoming requests with method, path, client IP, status, and size</Text>
                    <Text>• Click on any webhook to inspect full details including headers and body</Text>
                    <Text>• Perfect for debugging webhook integrations and API callbacks</Text>
                  </Well>

                  <Well>
                    <Heading level={4}>🔧 Advanced Features</Heading>
                    <Text><strong>Session Management:</strong></Text>
                    <Text>• Sessions are persistent - you can reconnect to existing sessions using the Session ID</Text>
                    <Text>• Each session maintains separate logs for outbound and inbound requests</Text>
                    <Text>• Session data includes creation time, request counts, and last activity</Text>
                    <br/>
                    <Text><strong>Auto Refresh:</strong></Text>
                    <Text>• Enable auto-refresh to see new requests appear automatically</Text>
                    <Text>• Refreshes every 3 seconds when enabled</Text>
                    <Text>• Works independently for outbound and inbound tabs</Text>
                  </Well>

                  <Well>
                    <Heading level={4}>💡 Use Cases & Examples</Heading>
                    <Text><strong>API Development & Testing:</strong></Text>
                    <Text>• Test API endpoints during development</Text>
                    <Text>• Debug authentication and header issues</Text>
                    <Text>• Validate request/response formats</Text>
                    <Text>• Monitor API performance and response times</Text>
                    <br/>
                    <Text><strong>Webhook Integration:</strong></Text>
                    <Text>• Debug webhook payloads from third-party services</Text>
                    <Text>• Test webhook endpoints before going live</Text>
                    <Text>• Monitor webhook delivery and inspect failures</Text>
                    <Text>• Validate webhook signatures and authentication</Text>
                    <br/>
                    <Text><strong>API Troubleshooting:</strong></Text>
                    <Text>• Inspect failed requests to identify issues</Text>
                    <Text>• Compare working vs. failing requests</Text>
                    <Text>• Monitor API rate limits and error responses</Text>
                    <Text>• Debug CORS and authentication problems</Text>
                  </Well>

                  <Well>
                    <Heading level={4}>📋 Example Headers</Heading>
                    <Text><strong>Common API Headers:</strong></Text>
                    <TextArea
                      value={`{
  "Content-Type": "application/json",
  "Authorization": "Bearer your-api-token",
  "X-API-Key": "your-api-key",
  "User-Agent": "MyApp/1.0"
}`}
                      isReadOnly
                      height="size-1000"
                      marginTop="size-100"
                    />
                    <br/>
                    <Text><strong>Example Request Body (JSON):</strong></Text>
                    <TextArea
                      value={`{
  "name": "John Doe",
  "email": "john@example.com",
  "data": {
    "preferences": ["api", "webhooks"],
    "timestamp": "2024-01-01T00:00:00Z"
  }
}`}
                      isReadOnly
                      height="size-1200"
                      marginTop="size-100"
                    />
                  </Well>

                  <Well>
                    <Heading level={4}>⚠️ Important Notes</Heading>
                    <Text><strong>Security:</strong></Text>
                    <Text>• Never include sensitive data like passwords or private keys in requests</Text>
                    <Text>• Use environment variables or secure vaults for API tokens</Text>
                    <Text>• Webhook URLs are publicly accessible - use authentication when needed</Text>
                    <br/>
                    <Text><strong>Limitations:</strong></Text>
                    <Text>• Sessions are temporary and may expire after extended inactivity</Text>
                    <Text>• Large response bodies may be truncated for display purposes</Text>
                    <Text>• Maximum timeout is 120 seconds for outbound requests</Text>
                    <br/>
                    <Text><strong>Best Practices:</strong></Text>
                    <Text>• Use descriptive session IDs when reconnecting to existing sessions</Text>
                    <Text>• Clear logs periodically to maintain performance</Text>
                    <Text>• Enable auto-refresh only when actively monitoring</Text>
                    <Text>• Test with small payloads first, then scale up</Text>
                  </Well>

                  <Well>
                    <Heading level={4}>🆘 Troubleshooting</Heading>
                    <Text><strong>Common Issues:</strong></Text>
                    <Text>• <strong>Session not connecting:</strong> Check if the session ID is correct and try creating a new session</Text>
                    <Text>• <strong>Requests timing out:</strong> Increase timeout value or check if the target API is accessible</Text>
                    <Text>• <strong>Webhooks not appearing:</strong> Verify the webhook URL is correct and accessible from external systems</Text>
                    <Text>• <strong>JSON parsing errors:</strong> Ensure headers and request body are valid JSON format</Text>
                    <Text>• <strong>CORS errors:</strong> These are browser-related and don't affect the actual API monitoring</Text>
                    <br/>
                    <Text><strong>Need Help?</strong> Contact the development team if you encounter persistent issues or need additional features.</Text>
                  </Well>
                </Flex>
              </View>
            </Item>
          </TabPanels>
        </Tabs>
      )}
    </Flex>
  )
}

export default ApiMonitor 