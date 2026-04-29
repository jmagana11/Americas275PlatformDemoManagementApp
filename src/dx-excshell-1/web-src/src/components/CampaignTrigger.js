import React, { useState, useEffect } from 'react'
import {
  View,
  Flex,
  Heading,
  Text,
  TextField,
  Button,
  Well,
  StatusLight,
  Content,
  Divider,
  ActionButton,
  Dialog,
  DialogTrigger,
  Header,
  ActionMenu,
  MenuTrigger,
  Menu,
  Item,
  Switch,
  TextArea
} from '@adobe/react-spectrum'
import actionWebInvoke from '../utils'
import allActions from '../config.json'

const CampaignTrigger = ({ runtime, ims }) => {
  const [email, setEmail] = useState('')
  const [campaignId, setCampaignId] = useState('')
  const [keyValuePairs, setKeyValuePairs] = useState([])
  const [advancedMode, setAdvancedMode] = useState(false)
  const [jsonEditor, setJsonEditor] = useState('')
  const [jsonError, setJsonError] = useState('')
  const [status, setStatus] = useState({ message: '', isError: false, show: false })
  const [requestPayload, setRequestPayload] = useState('')
  const [responseData, setResponseData] = useState(null)
  const [responseStatus, setResponseStatus] = useState('')
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [currentPayload, setCurrentPayload] = useState(null)
  const [savedConfigs, setSavedConfigs] = useState({})
  const [configName, setConfigName] = useState('')

  // Load saved configurations on mount
  useEffect(() => {
    const saved = localStorage.getItem('campaignConfigs')
    if (saved) {
      setSavedConfigs(JSON.parse(saved))
    }
  }, [])

  const showStatus = (message, isError = false) => {
    setStatus({ message, isError, show: true })
    setTimeout(() => {
      setStatus({ message: '', isError: false, show: false })
    }, 5000)
  }

  const addKeyValuePair = () => {
    setKeyValuePairs([...keyValuePairs, { key: '', value: '' }])
  }

  const removeKeyValuePair = (index) => {
    setKeyValuePairs(keyValuePairs.filter((_, i) => i !== index))
  }

  const updateKeyValuePair = (index, field, value) => {
    const newPairs = [...keyValuePairs]
    newPairs[index][field] = value
    setKeyValuePairs(newPairs)
  }

  const validateJsonInput = () => {
    if (!jsonEditor.trim()) {
      setJsonError('')
      return true
    }

    try {
      JSON.parse(jsonEditor)
      setJsonError('')
      return true
    } catch (e) {
      setJsonError(`Invalid JSON: ${e.message}`)
      return false
    }
  }

  const getContextData = () => {
    if (advancedMode) {
      if (!jsonEditor.trim()) {
        return {}
      }
      if (!validateJsonInput()) {
        throw new Error('Invalid JSON format')
      }
      return JSON.parse(jsonEditor)
    } else {
      const context = {}
      keyValuePairs.forEach(pair => {
        if (pair.key && pair.value) {
          context[pair.key] = pair.value
        }
      })
      return context
    }
  }

  const generatePayload = () => {
    const requestId = crypto.randomUUID()
    const userId = crypto.randomUUID()
    const context = getContextData()

    return {
      requestId: requestId,
      campaignId: campaignId,
      recipients: [
        {
          type: "aep",
          userId: userId,
          namespace: "Email",
          channelData: {
            emailAddress: email
          },
          context: context
        }
      ]
    }
  }

  const submitPayload = async () => {
    if (!currentPayload) return

    try {
      console.log('Sending payload:', JSON.stringify(currentPayload, null, 2))
      
      setShowPreviewModal(false)
      setRequestPayload(JSON.stringify(currentPayload, null, 2))
      
      const response = await fetch(allActions['campaign-trigger'], {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'omit',
        mode: 'cors',
        body: JSON.stringify(currentPayload)
      })

      let responseData
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json()
      } else {
        responseData = await response.text()
      }

      console.log('Response:', responseData)

      if (response.ok) {
        showStatus('Campaign triggered successfully!')
        setResponseStatus('Success Response')
        setResponseData(JSON.stringify(responseData, null, 2))
        // Reset form
        setEmail('')
        setCampaignId('')
        setKeyValuePairs([])
        setJsonEditor('')
      } else {
        const errorMessage = typeof responseData === 'object' ? 
          responseData.error || response.statusText : 
          responseData
        showStatus(`Error: ${errorMessage}`, true)
        setResponseStatus('Error Response')
        setResponseData(JSON.stringify(responseData, null, 2))
      }
    } catch (error) {
      console.error('Error:', error)
      const errorMessage = error.message || 'Error triggering campaign. Please try again.'
      showStatus(errorMessage, true)
      setResponseStatus('Error Response')
      setResponseData(JSON.stringify({
        error: errorMessage,
        details: error.toString()
      }, null, 2))
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    
    if (advancedMode) {
      if (!validateJsonInput()) {
        showStatus('Please fix the JSON format errors before submitting', true)
        return
      }
    }
    
    const payload = generatePayload()
    setCurrentPayload(payload)
    setShowPreviewModal(true)
  }

  const saveCurrentConfig = () => {
    if (!configName.trim()) {
      showStatus('Please enter a configuration name', true)
      return
    }

    if (!email.trim() || !campaignId.trim()) {
      showStatus('Please fill in all required fields before saving', true)
      return
    }

    const context = getContextData()
    const config = {
      name: configName,
      email: email,
      campaignId: campaignId,
      context: context,
      timestamp: new Date().toISOString()
    }

    const newSavedConfigs = { ...savedConfigs, [configName]: config }
    setSavedConfigs(newSavedConfigs)
    localStorage.setItem('campaignConfigs', JSON.stringify(newSavedConfigs))

    showStatus('Configuration saved successfully!')
    setConfigName('')
  }

  const loadConfig = (configName) => {
    const config = savedConfigs[configName]
    
    if (config) {
      setEmail(config.email || '')
      setCampaignId(config.campaignId || '')
      
      const context = config.context || {}
      const isComplex = typeof context === 'object' && 
        (Array.isArray(context) || Object.values(context).some(v => typeof v === 'object'))
      
      setAdvancedMode(isComplex)
      
      if (isComplex) {
        setJsonEditor(JSON.stringify(context, null, 2))
      } else {
        const pairs = Object.entries(context).map(([key, value]) => ({ key, value }))
        setKeyValuePairs(pairs)
      }

      showStatus('Configuration loaded successfully!')
    }
  }

  const deleteConfig = (configName) => {
    if (confirm(`Are you sure you want to delete the configuration "${configName}"?`)) {
      const newSavedConfigs = { ...savedConfigs }
      delete newSavedConfigs[configName]
      setSavedConfigs(newSavedConfigs)
      localStorage.setItem('campaignConfigs', JSON.stringify(newSavedConfigs))
      showStatus('Configuration deleted successfully!')
    }
  }

  return (
    <View padding="size-400">
      <Flex direction="row" gap="size-300" height="100vh">
        {/* Left column: Form */}
        <View flex="3" minWidth="0" maxWidth="1000px">
          <Flex direction="column" gap="size-300">
            {/* Header */}
            <Well>
              <Flex alignItems="center" gap="size-200">
                <img 
                  src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20xmlns%3Axlink%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxlink%22%20width%3D%22300%22%20height%3D%2271%22%20viewBox%3D%220%200%20300%2071%22%3E%3Cdefs%3E%3Cpath%20id%3D%22a%22%20d%3D%22M0%200h123.265v69.975H0z%22%2F%3E%3Cpath%20id%3D%22c%22%20d%3D%22M0%200h162.086v61.839H0z%22%2F%3E%3Cpath%20id%3D%22e%22%20d%3D%22M0%200h34.047v33.264H0z%22%2F%3E%3C%2Fdefs%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20transform%3D%22translate(.018%20.164)%22%3E%3Cmask%20id%3D%22b%22%20fill%3D%22%23fff%22%3E%3Cuse%20xlink%3Ahref%3D%22%23a%22%2F%3E%3C%2Fmask%3E%3Cpath%20fill%3D%22%230A0B09%22%20d%3D%22M35.583%2061.673c6.4%2011.059%2016.872%2011.059%2023.273%200l3.58-6.186L30.396%200H-.019zM103.057%2037.97c-2.338%204.031-7.843%204.027-10.176-.008L70.932%200H40.53l35.635%2061.693c6.4%2011.06%2016.85%2011.06%2023.25%200l23.851-41.318L111.528%200h-30.39z%22%20mask%3D%22url(%23b)%22%2F%3E%3C%2Fg%3E%3Cpath%20fill%3D%22%23000%22%20d%3D%22M143.887%2032.786h6.235l.053-.195c3.846-14.27%205.424-20.364%206.065-24.14.624%203.765%202.122%209.946%205.8%2024.137l.051.198h6.37L177.33.164h-5.802l-.051.197c-3.855%2014.81-5.325%2020.809-5.99%2024.628-.774-4.106-2.445-10.88-6.053-24.629l-.052-.196h-6.061l-.05.198c-3.753%2014.665-5.325%2020.944-5.997%2025.022-.735-3.973-2.388-10.56-6.135-25.023l-.052-.197h-6.023l8.77%2032.427zM186.827%2013.032c3.433%200%206.041%202.195%206.307%205.259h-12.737c.39-3.065%203.047-5.26%206.43-5.26m.356%2020.206c4.712%200%209.173-2.57%2010.956-6.395l-4.302-2.188-.092-.01-.08.169c-.522%201.083-2.432%203.602-6.438%203.602-3.638%200-6.406-2.315-6.83-5.665h18.528l.006-.257c.114-4.572-1.128-8.323-3.59-10.848-2.136-2.189-5.08-3.346-8.514-3.346-3.39%200-6.48%201.277-8.699%203.596-2.196%202.296-3.406%205.463-3.406%208.918%200%207.315%205.124%2012.424%2012.46%2012.424M210.644%2033.238c6.066%200%209.835-2.82%209.835-7.36%200-5.383-4.894-6.654-8.826-7.674-2.717-.705-5.063-1.315-5.063-3.04%200-1.389%201.466-2.359%203.565-2.359%202.295%200%203.884%201.212%204.145%203.162l.162.987.108-.018%204.823-.89c0-4.523-4.002-7.7-9.194-7.7-5.344%200-9.077%202.952-9.077%207.18%200%205.107%204.748%206.378%208.564%207.4%202.761.74%205.146%201.378%205.146%203.177%200%201.567-1.536%202.54-4.01%202.54-2.972%200-4.97-1.383-5.213-3.608l-.044-.365-5.11.97c0%204.951%205.545%207.598%2010.19%207.598M224.795%2028.346c0%202.7%201.71%204.891%204.54%204.891%203.51%200%204.542-.451%204.542-.451v-4.548s-1.053.173-2.334.173c-.828%200-1.41-.499-1.41-1.255V13.393h3.706l-.052-4.595h-3.654V1.972l-5.338%201.337v5.489h-2.786l-.015%204.595h2.801zM266.636%2011.832V8.798h-4.699v23.988h5.648l-.046-14.67c.073-1.476.568-2.607%201.472-3.36%201.186-.99%203.033-1.328%205.486-1.003l.295.039.05-5.006-.23-.031c-3.384-.462-6.446.572-7.976%203.077%22%2F%3E%3Cg%20transform%3D%22translate(137.638%208.3)%22%3E%3Cmask%20id%3D%22d%22%20fill%3D%22%23fff%22%3E%3Cuse%20xlink%3Ahref%3D%22%23c%22%2F%3E%3C%2Fmask%3E%3Cpath%20fill%3D%22%230A0B09%22%20d%3D%22M152.52%200c-3.395%200-6.576%201.353-8.151%203.924V.498h-4.888v23.988h5.69V11.61c0-4.137%202.165-6.607%205.79-6.607%202.48%200%205.436%201.083%205.436%206.246v13.237h5.69V10.48c0-7.727-4.941-10.48-9.567-10.48M20.477%2047.896c0%205.544-2.626%208.596-7.393%208.596-4.739%200-7.348-3.052-7.348-8.596V28.782H0V47.76c0%208.827%204.891%2014.096%2013.084%2014.096s13.084-5.27%2013.084-14.096V28.782h-5.691z%22%20mask%3D%22url(%23d)%22%2F%3E%3C%2Fg%3E%3Cpath%20fill%3D%22%23000%22%20d%3D%22M180.238%2045.219c-3.395%200-6.576%201.353-8.151%203.923v-3.426h-4.889v23.989h5.692V56.829c0-4.137%202.164-6.607%205.79-6.607%202.479%200%205.434%201.083%205.434%206.245v13.238h5.69V55.699c0-7.727-4.941-10.48-9.566-10.48M193.331%2069.705h5.647V45.716h-5.647z%22%2F%3E%3Cg%20transform%3D%22translate(192.886%2036.875)%22%3E%3Cmask%20id%3D%22f%22%20fill%3D%22%23fff%22%3E%3Cuse%20xlink%3Ahref%3D%22%23e%22%2F%3E%3C%2Fmask%3E%3Cpath%20fill%3D%22%230A0B09%22%20d%3D%22M3.29%200C1.446%200%200%201.422%200%203.237%200%204.997%201.476%206.43%203.29%206.43c1.79%200%203.247-1.432%203.247-3.193A3.245%203.245%200%200%200%203.29%200M21.364%2028.098c-4.062%200-7.126-3.132-7.126-7.285s3.064-7.286%207.126-7.286c4.113%200%207.215%203.132%207.215%207.286%200%204.153-3.102%207.285-7.215%207.285m0-19.754c-3.513%200-6.724%201.261-9.043%203.55-2.32%202.29-3.596%205.457-3.596%208.919%200%207.225%205.316%2012.469%2012.639%2012.469%207.35%200%2012.683-5.244%2012.683-12.47%200-3.463-1.278-6.63-3.6-8.917-2.326-2.29-5.551-3.551-9.083-3.551%22%20mask%3D%22url(%23f)%22%2F%3E%3C%2Fg%3E%3Cpath%20fill%3D%22%23000%22%20d%3D%22M242.608%2045.219c-3.395%200-6.576%201.353-8.15%203.923v-3.426h-4.889v23.989h5.69V56.829c0-4.137%202.165-6.607%205.791-6.607%202.48%200%205.435%201.083%205.435%206.245v13.238h5.69V55.699c0-7.727-4.942-10.48-9.567-10.48M240.968%2018.29c.39-3.064%203.047-5.258%206.43-5.258%203.433%200%206.04%202.195%206.306%205.259zm6.43-9.99c-3.391%200-6.48%201.277-8.7%203.596-2.196%202.296-3.406%205.463-3.406%208.918%200%207.315%205.125%2012.424%2012.461%2012.424%204.713%200%209.173-2.57%2010.957-6.395l-4.303-2.188-.091-.01-.081.169c-.522%201.083-2.431%203.602-6.437%203.602-3.639%200-6.407-2.315-6.83-5.665h18.527l.007-.257c.113-4.572-1.129-8.323-3.591-10.848-2.135-2.189-5.08-3.346-8.514-3.346%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E" 
                  alt="Western Union Logo" 
                  style={{ maxWidth: '200px', height: 'auto' }}
                />
                <Heading level={1}>Campaign Trigger Form</Heading>
              </Flex>
            </Well>

            {/* Configuration Management */}
            <Well>
              <Heading level={3}>Saved Configurations</Heading>
              <Flex gap="size-200" alignItems="center" marginBottom="size-200">
                <TextField
                  value={configName}
                  onChange={setConfigName}
                  placeholder="Enter configuration name"
                  width="size-3000"
                />
                <Button variant="primary" onPress={saveCurrentConfig}>
                  Save Current Configuration
                </Button>
              </Flex>
              
              {Object.keys(savedConfigs).length > 0 ? (
                <Flex direction="column" gap="size-100">
                  {Object.entries(savedConfigs).map(([name, config]) => {
                    const contextKeys = config.context ? Object.keys(config.context) : []
                    return (
                      <Well key={name}>
                        <Flex justifyContent="space-between" alignItems="center">
                          <View>
                            <Text UNSAFE_style={{ fontWeight: 'bold' }}>{name}</Text>
                            <Text UNSAFE_style={{ fontSize: '12px', color: '#666' }}>
                              Campaign ID: {config.campaignId || 'N/A'}<br/>
                              Email: {config.email || 'N/A'}<br/>
                              Context Keys: {contextKeys.length > 0 ? contextKeys.join(', ') : 'None'}
                            </Text>
                          </View>
                          <Flex gap="size-100">
                            <Button variant="secondary" onPress={() => loadConfig(name)}>
                              Load
                            </Button>
                            <Button variant="negative" onPress={() => deleteConfig(name)}>
                              Delete
                            </Button>
                          </Flex>
                        </Flex>
                      </Well>
                    )
                  })}
                </Flex>
              ) : (
                <Text UNSAFE_style={{ textAlign: 'center', fontStyle: 'italic', color: '#666' }}>
                  No saved configurations yet
                </Text>
              )}
            </Well>

            {/* Form */}
            <Well>
              {status.show && (
                <Well 
                  marginBottom="size-200"
                  UNSAFE_style={{ 
                    backgroundColor: status.isError ? '#fce8e6' : '#e6f4ea',
                    color: status.isError ? '#d93025' : '#1e8e3e',
                    border: `1px solid ${status.isError ? '#d93025' : '#1e8e3e'}`
                  }}
                >
                  <Text>{status.message}</Text>
                </Well>
              )}

              <form onSubmit={handleSubmit}>
                <Flex direction="column" gap="size-300">
                  <TextField
                    label="Email Address *"
                    value={email}
                    onChange={setEmail}
                    type="email"
                    isRequired
                  />
                  
                  <TextField
                    label="Campaign ID *"
                    value={campaignId}
                    onChange={setCampaignId}
                    isRequired
                  />
                  
                  <Divider size="S" />
                  
                  <Heading level={3}>Context Data</Heading>
                  
                  <Flex alignItems="center" gap="size-200">
                    <Switch isSelected={advancedMode} onChange={setAdvancedMode} />
                    <Text>Advanced Mode (JSON Editor)</Text>
                  </Flex>
                  
                  {!advancedMode ? (
                    <View>
                      <Flex direction="column" gap="size-200">
                        {keyValuePairs.map((pair, index) => (
                          <Flex key={index} gap="size-200" alignItems="center">
                            <TextField
                              value={pair.key}
                              onChange={(value) => updateKeyValuePair(index, 'key', value)}
                              placeholder="Key"
                              flex="1"
                            />
                            <TextField
                              value={pair.value}
                              onChange={(value) => updateKeyValuePair(index, 'value', value)}
                              placeholder="Value"
                              flex="1"
                            />
                            <Button 
                              variant="negative" 
                              onPress={() => removeKeyValuePair(index)}
                            >
                              Remove
                            </Button>
                          </Flex>
                        ))}
                      </Flex>
                      <Button variant="secondary" onPress={addKeyValuePair} marginTop="size-200">
                        Add Key-Value Pair
                      </Button>
                    </View>
                  ) : (
                    <View>
                      <TextArea
                        value={jsonEditor}
                        onChange={setJsonEditor}
                        placeholder="Enter your JSON context here..."
                        height="size-2000"
                        UNSAFE_style={{ fontFamily: 'monospace' }}
                      />
                      {jsonError && (
                        <Well 
                          marginTop="size-200"
                          UNSAFE_style={{ 
                            backgroundColor: '#fce8e6',
                            color: '#d93025',
                            border: '1px solid #d93025'
                          }}
                        >
                          <Text>{jsonError}</Text>
                        </Well>
                      )}
                    </View>
                  )}
                  
                  <Button type="submit" variant="primary" marginTop="size-300">
                    Submit
                  </Button>
                </Flex>
              </form>
            </Well>
          </Flex>
        </View>

        {/* Right column: Request/Response */}
        <View flex="1.5" minWidth="0">
          {(requestPayload || responseData) && (
            <Well UNSAFE_style={{ position: 'sticky', top: '20px' }}>
              <Flex direction="column" gap="size-300">
                {requestPayload && (
                  <View>
                    <Heading level={3}>Request Payload</Heading>
                    <Well>
                      <Text UNSAFE_style={{ fontFamily: 'monospace', fontSize: '13px', whiteSpace: 'pre-wrap' }}>
                        {requestPayload}
                      </Text>
                    </Well>
                  </View>
                )}
                
                {responseData && (
                  <View>
                    <Heading level={3}>API Response</Heading>
                    <StatusLight 
                      variant={responseStatus.includes('Success') ? 'positive' : 'negative'}
                      marginBottom="size-200"
                    >
                      {responseStatus}
                    </StatusLight>
                    <Well>
                      <Text UNSAFE_style={{ fontFamily: 'monospace', fontSize: '13px', whiteSpace: 'pre-wrap' }}>
                        {responseData}
                      </Text>
                    </Well>
                  </View>
                )}
              </Flex>
            </Well>
          )}
        </View>
      </Flex>

      {/* Preview Modal */}
      <DialogTrigger isOpen={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <div />
        <Dialog>
          <Header>
            <Heading level={2}>Preview Payload</Heading>
          </Header>
          <Content>
            <Flex direction="column" gap="size-300">
              <Text>Please review the payload before submitting:</Text>
              <Well>
                <Text UNSAFE_style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: '400px', overflow: 'auto' }}>
                  {currentPayload ? JSON.stringify(currentPayload, null, 2) : ''}
                </Text>
              </Well>
              <Flex gap="size-200" justifyContent="end" marginTop="size-300">
                <Button variant="secondary" onPress={() => setShowPreviewModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onPress={submitPayload}>
                  Confirm & Submit
                </Button>
              </Flex>
            </Flex>
          </Content>
        </Dialog>
      </DialogTrigger>
    </View>
  )
}

export default CampaignTrigger 