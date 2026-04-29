import React, { useState, useEffect, useRef } from 'react'
import {
  Flex,
  View,
  Heading,
  Text,
  Button,
  Picker,
  Item,
  Well,
  StatusLight,
  ProgressBar,
  Divider,
  ActionButton,
  ButtonGroup,
  Content,
  Header,
  Tabs,
  TabList,
  TabPanels,
  Switch,
  TextField,
  TextArea,
  Badge,
  RadioGroup,
  Radio
} from '@adobe/react-spectrum'
import JsonEditor from './JsonEditor'
import allActions from '../config.json'

function AEPProfileInjectorSimplified({ runtime, ims }) {
  // Session management state
  const [sessionLoaded, setSessionLoaded] = useState(false)
  const [sessionSaving, setSessionSaving] = useState(false)
  // Core workflow state - simplified and focused
  const [currentStep, setCurrentStep] = useState(1)
  const [isProcessing, setIsProcessing] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [error, setError] = useState(null)

  // Step 1: Sandbox Selection
  const [sandboxes, setSandboxes] = useState([])
  const [selectedSandbox, setSelectedSandbox] = useState('')
  const [sandboxLocked, setSandboxLocked] = useState(false)
  const [sandboxLoading, setSandboxLoading] = useState(false)

  // Step 2: Schema Selection (Profile schemas only)
  const [schemas, setSchemas] = useState([])
  const [selectedSchema, setSelectedSchema] = useState('')
  const [schemaLocked, setSchemaLocked] = useState(false)
  const [schemaLoading, setSchemaLoading] = useState(false)
  const [schemaDetails, setSchemaDetails] = useState(null)

  // Step 3: Dataset Selection
  const [datasets, setDatasets] = useState([])
  const [selectedDataset, setSelectedDataset] = useState('')
  const [createdDataset, setCreatedDataset] = useState(null)
  const [datasetLocked, setDatasetLocked] = useState(false)
  const [datasetLoading, setDatasetLoading] = useState(false)
  const [isCreatingDataset, setIsCreatingDataset] = useState(false)

  // Step 4: Connection Flow
  const [connectors, setConnectors] = useState([])
  const [selectedConnector, setSelectedConnector] = useState('')
  const [connectionLocked, setConnectionLocked] = useState(false)
  const [connectionLoading, setConnectionLoading] = useState(false)
  const [isCreatingConnector, setIsCreatingConnector] = useState(false)

  // Step 5: AI Generation Settings
  const [aiSettingsLocked, setAiSettingsLocked] = useState(false)

  // Schema Structure & Pruning
  const [sampleData, setSampleData] = useState(null)
  const [sampleDataLoading, setSampleDataLoading] = useState(false)
  const [prunedFields, setPrunedFields] = useState({})
  const [pruningEnabled, setPruningEnabled] = useState(false)
  const [expandedNodes, setExpandedNodes] = useState({})

  // Generated Profile & Injection
  const [generatedProfile, setGeneratedProfile] = useState(null)
  const [profileCustomization, setProfileCustomization] = useState('')
  const [emailDomain, setEmailDomain] = useState('gmail.svpoc.io')
  const emailDomainOptions = ['gmail.svpoc.io', 'msn.svpoc.io', 'yahoo.svpoc.io', 'other.svpoc.io']
  const [injectionResults, setInjectionResults] = useState(null)
  const [editableProfile, setEditableProfile] = useState(null)
  const [isManualMode, setIsManualMode] = useState(false)

  // Profile Routing Workflow State
  const [showProfileRouting, setShowProfileRouting] = useState(false)
  const [routingDataset, setRoutingDataset] = useState(null)
  const [routingConnector, setRoutingConnector] = useState(null)
  const [isCreatingRoutingDataset, setIsCreatingRoutingDataset] = useState(false)
  const [isCreatingRoutingConnector, setIsCreatingRoutingConnector] = useState(false)
  const [routingStreamingResults, setRoutingStreamingResults] = useState(null)

  // Active tab for results
  const [activeTab, setActiveTab] = useState('overview')

  // Cleanup timeouts to prevent memory leaks
  const timeoutRefs = useRef([])

  const clearAllTimeouts = () => {
    timeoutRefs.current.forEach(timeoutId => clearTimeout(timeoutId))
    timeoutRefs.current = []
  }

  const safeSetTimeout = (callback, delay) => {
    const timeoutId = setTimeout(callback, delay)
    timeoutRefs.current.push(timeoutId)
    return timeoutId
  }

  useEffect(() => {
    return () => clearAllTimeouts()
  }, [])

  // Common headers for API calls
  const getApiHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ims.token}`,
    'x-gw-ims-org-id': ims.org,
    'x-ims-user-id': ims.profile?.userId || ''
  })

  // Helper functions
  const showFeedback = (type, message, duration = 3000) => {
    setFeedback({ type, message })
    safeSetTimeout(() => setFeedback(null), duration)
  }

  const showError = (message) => {
    setError(message)
    safeSetTimeout(() => setError(null), 5000)
  }

  // Session Management Functions
  const getCurrentSession = () => {
    return {
      aepProfileInjector: {
        currentStep,
        activeTab,
        sandboxLocked,
        schemaLocked,
        datasetLocked,
        connectionLocked,
        aiSettingsLocked,
        selectedSandbox,
        selectedSchema,
        selectedDataset,
        selectedConnector,
        createdDataset,
        schemaDetails,
        profileCustomization,
        emailDomain,
        isManualMode,
        pruningEnabled,
        prunedFields,
        expandedNodes,
        showProfileRouting,
        routingDataset,
        routingConnector,
        routingStreamingResults,
        // Add profile data for session persistence
        generatedProfile,
        editableProfile,
        validationResults,
        showValidation,
        // Add sample data for field selection persistence
        sampleData,
        lastUpdated: new Date().toISOString()
      }
    }
  }

  const saveSession = async () => {
    if (!ims?.profile?.userId || sessionSaving) return

    try {
      setSessionSaving(true)
      const sessionData = getCurrentSession()

      console.log('💾 Saving session for user:', ims.profile.userId)
      console.log('Session data:', sessionData)

      const response = await fetch(allActions['session-manager'], {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          action: 'save',
          featureName: 'aepProfileInjector',
          sessionData: sessionData.aepProfileInjector
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to save session: ${response.status}`)
      }

      console.log('✅ Session saved successfully')
    } catch (error) {
      console.warn('⚠️ Failed to save session:', error)
      // Don't show error to user - session saving should be silent
    } finally {
      setSessionSaving(false)
    }
  }

  const loadSession = async () => {
    if (!ims?.profile?.userId || sessionLoaded) return

    try {
      console.log('📥 Loading session for user:', ims.profile.userId)

      const response = await fetch(allActions['session-manager'], {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          action: 'load',
          featureName: 'aepProfileInjector'
        })
      })

      if (!response.ok) {
        if (response.status === 404) {
          console.log('📋 No existing session found - starting fresh')
          setSessionLoaded(true)
          return
        }
        throw new Error(`Failed to load session: ${response.status}`)
      }

      const data = await response.json()
      const responseData = data.body || data
      const session = responseData.data

      if (session) {
        console.log('🔄 Restoring session:', session)

        // Restore state
        setCurrentStep(session.currentStep || 1)
        setActiveTab(session.activeTab || 'overview')
        setSandboxLocked(session.sandboxLocked || false)
        setSchemaLocked(session.schemaLocked || false)
        setDatasetLocked(session.datasetLocked || false)
        setConnectionLocked(session.connectionLocked || false)
        setAiSettingsLocked(session.aiSettingsLocked || false)
        setSelectedSandbox(session.selectedSandbox || '')
        setSelectedSchema(session.selectedSchema || '')
        setSelectedDataset(session.selectedDataset || '')
        setSelectedConnector(session.selectedConnector || '')
        setCreatedDataset(session.createdDataset || null)
        setSchemaDetails(session.schemaDetails || null)
        setProfileCustomization(session.profileCustomization || '')
        setEmailDomain(session.emailDomain || 'gmail.svpoc.io')
        setIsManualMode(session.isManualMode || false)
        setPruningEnabled(session.pruningEnabled || false)
        setPrunedFields(session.prunedFields || {})
        setExpandedNodes(session.expandedNodes || {})

        // Restore Profile Routing state
        setShowProfileRouting(session.showProfileRouting || false)
        setRoutingDataset(session.routingDataset || null)
        setRoutingConnector(session.routingConnector || null)
        setRoutingStreamingResults(session.routingStreamingResults || null)

        // Restore profile data for session persistence
        setGeneratedProfile(session.generatedProfile || null)
        setEditableProfile(session.editableProfile || null)
        setValidationResults(session.validationResults || null)
        setShowValidation(session.showValidation || false)

        // Restore sample data for field selection persistence
        setSampleData(session.sampleData || null)

        console.log('✅ Session restored successfully')
        showFeedback('positive', 'Previous session restored')
      }
    } catch (error) {
      console.warn('⚠️ Failed to load session:', error)
      // Don't show error to user - just start fresh
    } finally {
      setSessionLoaded(true)
    }
  }

  // Step 1: Sandbox Management
  const loadSandboxes = async () => {
    if (sandboxes.length > 0) return // Already loaded

    setSandboxLoading(true)
    try {
      console.log('Loading sandboxes with token:', ims.token ? 'Present' : 'Missing')
      console.log('IMS org:', ims.org)
      console.log('Available actions:', allActions.getsandboxes)

      const response = await fetch(allActions.getsandboxes, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ims.token}`,
          'x-gw-ims-org-id': ims.org
        }
      })

      console.log('Sandbox response status:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Sandbox API error:', errorText)
        throw new Error(`Failed to load sandboxes: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log('Sandbox response data:', data)

      const responseData = data.body || data
      const sandboxList = responseData.sandboxes || []

      setSandboxes(sandboxList)
      console.log(`Successfully loaded ${sandboxList.length} sandboxes:`, sandboxList.map(s => s.name))
    } catch (error) {
      console.error('Error loading sandboxes:', error)
      showError(`Failed to load sandboxes: ${error.message}`)
    } finally {
      setSandboxLoading(false)
    }
  }

  // Load session and sandboxes on component mount
  useEffect(() => {
    if (ims.token && ims.org && ims.profile?.userId) {
      loadSession().then(() => {
        loadSandboxes()
      })
    }
  }, [ims.token, ims.org, ims.profile?.userId])

  // Auto-save session when important state changes (debounced)
  useEffect(() => {
    if (!sessionLoaded) return // Don't save until session is loaded

    const timeoutId = setTimeout(() => {
      saveSession()
    }, 1000) // Debounce for 1 second

    return () => clearTimeout(timeoutId)
  }, [
    sessionLoaded,
    currentStep,
    activeTab,
    sandboxLocked,
    schemaLocked,
    datasetLocked,
    connectionLocked,
    aiSettingsLocked,
    selectedSandbox,
    selectedSchema,
    selectedDataset,
    selectedConnector,
    profileCustomization,
    emailDomain,
    isManualMode,
    pruningEnabled,
    showProfileRouting,
    routingDataset,
    routingConnector,
    routingStreamingResults,
    // Add profile data to auto-save dependencies
    generatedProfile,
    editableProfile,
    validationResults,
    showValidation,
    // Add sample data to auto-save dependencies
    sampleData
  ])

  const lockSandbox = () => {
    if (!selectedSandbox) {
      showError('Please select a sandbox first')
      return
    }
    setSandboxLocked(true)
    setCurrentStep(2)
    showFeedback('positive', `Sandbox "${selectedSandbox}" locked. Loading schemas...`)

    // Automatically load schemas when sandbox is locked
    loadSchemas()
  }

  const unlockSandbox = () => {
    setSandboxLocked(false)
    setSchemaLocked(false)
    setDatasetLocked(false)
    setConnectionLocked(false)
    setAiSettingsLocked(false)
    setSchemas([])
    setDatasets([])
    setConnectors([])
    setSelectedSchema('')
    setSelectedDataset('')
    setSelectedConnector('')
    setCreatedDataset(null)
    setSchemaDetails(null)
    setCurrentStep(1)
    showFeedback('info', 'Sandbox unlocked. All dependent selections cleared.')
  }

  // Step 2: Schema Management (Profile schemas only)
  const loadSchemas = async () => {
    if (!selectedSandbox) return
    if (schemas.length > 0) return // Already loaded

    setSchemaLoading(true)
    try {
      console.log('Loading schemas with headers:', {
        ...getApiHeaders(),
        'sandboxname': selectedSandbox
      })

      const response = await fetch(allActions.getSchemas, {
        headers: {
          ...getApiHeaders(),
          'sandboxname': selectedSandbox // Backend expects lowercase
        }
      })

      console.log('Schema response status:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Schema API error:', errorText)
        throw new Error(`Failed to load schemas: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log('Raw schema response:', data)

      const responseData = data.body || data
      const schemaList = responseData.schemas || []

      console.log('Parsed schema list:', schemaList.length, 'total schemas')
      console.log('Sample schemas for debugging:', schemaList.slice(0, 3).map(s => ({
        id: s.id,
        title: s.title,
        class: s.class,
        type: s.type,
        'meta.class': s.meta?.class,
        'meta.extends': s.meta?.extends
      })))

      // Temporarily use all schemas for debugging (remove filtering)
      const profileSchemas = schemaList // Show all schemas for now

      console.log(`Using ${profileSchemas.length} schemas (filtering temporarily disabled for debugging)`)
      console.log('All schemas:', profileSchemas.map(s => ({ id: s.id, title: s.title, class: s.class })))

      setSchemas(profileSchemas)
      showFeedback('positive', `Loaded ${profileSchemas.length} Profile schemas`)
    } catch (error) {
      console.error('Error loading schemas:', error)
      showError(`Failed to load schemas: ${error.message}`)
    } finally {
      setSchemaLoading(false)
    }
  }

  const loadSchemaDetails = async (schemaId) => {
    if (!schemaId) return

    try {
      const response = await fetch(allActions.getSchemaDetails, {
        headers: {
          ...getApiHeaders(),
          'sandboxname': selectedSandbox,
          'schemaId': schemaId
        }
      })

      if (!response.ok) throw new Error(`Failed to load schema details: ${response.status}`)

      const data = await response.json()
      const responseData = data.body || data
      setSchemaDetails(responseData.schema)
      console.log('Schema details loaded:', responseData.schema?.title)

      // Load sample data after schema details
      await loadSampleData(schemaId)
    } catch (error) {
      console.error('Error loading schema details:', error)
      showError(`Failed to load schema details: ${error.message}`)
    }
  }

  const loadSampleData = async (schemaId) => {
    if (!schemaId) return

    setSampleDataLoading(true)
    try {
      const response = await fetch(allActions.getSampleData, {
        headers: {
          ...getApiHeaders(),
          'schemaid': schemaId,
          'sandboxname': selectedSandbox
        }
      })

      if (!response.ok) throw new Error(`Failed to load sample data: ${response.status}`)

      const data = await response.json()
      const responseData = data.body || data
      setSampleData(responseData.sampleData)
      console.log('Sample data loaded successfully')
    } catch (error) {
      console.error('Error loading sample data:', error)
      // Don't show error for sample data as it's optional
    } finally {
      setSampleDataLoading(false)
    }
  }

  const lockSchema = () => {
    if (!selectedSchema) {
      showError('Please select a schema first')
      return
    }
    setSchemaLocked(true)
    setCurrentStep(3)
    loadSchemaDetails(selectedSchema)
    showFeedback('positive', 'Schema locked. Now select or create a dataset.')
  }

  const unlockSchema = () => {
    setSchemaLocked(false)
    setDatasetLocked(false)
    setConnectionLocked(false)
    setAiSettingsLocked(false)
    setDatasets([])
    setConnectors([])
    setSelectedDataset('')
    setSelectedConnector('')
    setCreatedDataset(null)
    setSchemaDetails(null)
    setCurrentStep(2)
    showFeedback('info', 'Schema unlocked. Dependent selections cleared.')
  }

  // Step 3: Dataset Management
  const loadDatasets = async () => {
    if (!selectedSandbox || !selectedSchema) return
    if (datasets.length > 0) return // Already loaded

    setDatasetLoading(true)
    try {
      const response = await fetch(allActions.getDatasets, {
        headers: {
          ...getApiHeaders(),
          'sandboxname': selectedSandbox
        }
      })

      if (!response.ok) throw new Error(`Failed to load datasets: ${response.status}`)

      const data = await response.json()
      const responseData = data.body || data
      const datasetList = responseData.datasets || []

      // Filter datasets that match the selected schema
      const matchingDatasets = datasetList.filter(dataset =>
        dataset.schemaRef?.id === selectedSchema
      )

      setDatasets(matchingDatasets)
      console.log(`Loaded ${matchingDatasets.length} datasets for schema`)
    } catch (error) {
      console.error('Error loading datasets:', error)
      showError(`Failed to load datasets: ${error.message}`)
    } finally {
      setDatasetLoading(false)
    }
  }

  const createDataset = async () => {
    if (!selectedSchema) {
      showError('No schema selected for dataset creation')
      return
    }

    setIsCreatingDataset(true)
    try {
      const response = await fetch(allActions.createDataset, {
        method: 'POST',
        headers: {
          ...getApiHeaders(),
          'sandboxname': selectedSandbox,
          'schemaId': selectedSchema,
          'datasetName': 'Golden Profile Dataset v0'
        }
      })

      if (!response.ok) throw new Error(`Failed to create dataset: ${response.status}`)

      const data = await response.json()
      const responseData = data.body || data
      const dataset = responseData.dataset

      // Ensure proper schema association
      dataset.schemaId = selectedSchema
      dataset.schemaRef = {
        id: selectedSchema,
        contentType: 'application/vnd.adobe.xed+json;version=1'
      }

      setCreatedDataset(dataset)
      setSelectedDataset(dataset.id)
      showFeedback('positive', `Dataset "${dataset.name}" created successfully`)
      console.log('Dataset created:', dataset)
    } catch (error) {
      console.error('Error creating dataset:', error)
      showError(`Failed to create dataset: ${error.message}`)
    } finally {
      setIsCreatingDataset(false)
    }
  }

  const lockDataset = () => {
    const datasetId = selectedDataset || createdDataset?.id
    if (!datasetId) {
      showError('Please select or create a dataset first')
      return
    }
    setDatasetLocked(true)
    setCurrentStep(4)
    showFeedback('positive', 'Dataset locked. Now configure your connection.')
  }

  const unlockDataset = () => {
    setDatasetLocked(false)
    setConnectionLocked(false)
    setAiSettingsLocked(false)
    setConnectors([])
    setSelectedConnector('')
    // Clear dataset selections to prevent schema mismatches
    setCreatedDataset(null)
    setSelectedDataset('')
    setCurrentStep(3)
    showFeedback('info', 'Dataset unlocked. Connection and AI settings cleared.')
  }

  // Step 4: Connection Management
  const loadConnectors = async () => {
    if (!selectedSandbox) return
    if (connectors.length > 0) return // Already loaded

    setConnectionLoading(true)
    try {
      const response = await fetch(allActions.getStreamingConnectors, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({ sandbox: selectedSandbox })
      })

      if (!response.ok) throw new Error(`Failed to load connectors: ${response.status}`)

      const data = await response.json()
      const responseData = data.body || data
      const connectorList = responseData.connectors || []

      setConnectors(connectorList)
      console.log(`Loaded ${connectorList.length} streaming connectors`)
    } catch (error) {
      console.error('Error loading connectors:', error)
      showError(`Failed to load connectors: ${error.message}`)
    } finally {
      setConnectionLoading(false)
    }
  }

  const createConnector = async () => {
    if (!selectedSandbox) {
      showError('No sandbox selected for connector creation')
      return
    }

    // Validate we have required components for dataflow
    const currentDatasetId = createdDataset?.id || selectedDataset
    if (!currentDatasetId || !selectedSchema) {
      showError('Dataset and schema must be configured before creating connector')
      return
    }

    setIsCreatingConnector(true)
    try {
      console.log('Creating connector and dataflow...', {
        sandbox: selectedSandbox,
        datasetId: currentDatasetId,
        schemaId: selectedSchema
      })

      // Step 1: Create the streaming connector
      showFeedback('info', 'Creating streaming connector...')
      const connectorResponse = await fetch(allActions.createStreamingConnector, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          name: `Golden Profile Connector ${Date.now()}`,
          description: 'Streaming connector for Golden Profile injection',
          sandbox: selectedSandbox
        })
      })

      if (!connectorResponse.ok) throw new Error(`Failed to create connector: ${connectorResponse.status}`)

      const connectorData = await connectorResponse.json()
      const responseData = connectorData.body || connectorData
      const connector = responseData.connector

      console.log('Connector created successfully:', connector.id)

      // Step 2: Create the dataflow to connect the connector to the dataset
      showFeedback('info', 'Creating dataflow to connect connector to dataset...')
      const dataflowResponse = await fetch(allActions.createStreamingDataflow, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          connectorId: connector.id,
          datasetId: currentDatasetId,
          schemaId: selectedSchema,
          sandbox: selectedSandbox
        })
      })

      if (!dataflowResponse.ok) {
        const errorText = await dataflowResponse.text()
        throw new Error(`Failed to create dataflow: ${dataflowResponse.status} - ${errorText}`)
      }

      const dataflowData = await dataflowResponse.json()
      const dataflowResponseData = dataflowData.body || dataflowData

      console.log('Dataflow created successfully:', dataflowResponseData.dataflow?.id)

      // Step 3: Update state and refresh
      setSelectedConnector(connector.id)

      // Refresh connectors list to include the new one
      setConnectors([])
      await loadConnectors()

      showFeedback('positive', `Connector "${connector.name}" and dataflow created successfully! Ready for streaming.`)
      console.log('Connector and dataflow setup complete:', {
        connectorId: connector.id,
        dataflowId: dataflowResponseData.dataflow?.id,
        datasetId: currentDatasetId,
        schemaId: selectedSchema
      })
    } catch (error) {
      console.error('Error creating connector and dataflow:', error)
      showError(`Failed to create connector and dataflow: ${error.message}`)
    } finally {
      setIsCreatingConnector(false)
    }
  }

  const lockConnection = () => {
    if (!selectedConnector) {
      showError('Please select or create a connector first')
      return
    }
    setConnectionLocked(true)
    setCurrentStep(5)
    showFeedback('positive', 'Connection locked. Now configure AI generation settings.')
  }

  const unlockConnection = () => {
    setConnectionLocked(false)
    setAiSettingsLocked(false)
    setCurrentStep(4)
    showFeedback('info', 'Connection unlocked. AI settings cleared.')
  }

  // Step 5: AI Generation Settings Management
  const lockAiSettings = () => {
    if (!emailDomain) {
      showError('Please select an email domain first')
      return
    }
    setAiSettingsLocked(true)
    setCurrentStep(6)
    showFeedback('positive', 'AI generation settings configured! Configuration is now complete.')
  }

  const unlockAiSettings = () => {
    setAiSettingsLocked(false)
    setCurrentStep(5)
    showFeedback('info', 'AI settings unlocked. You can now modify the settings.')
  }

  // Profile Routing Workflow Functions
  const createRoutingDataset = async () => {
    if (!selectedSchema) {
      showError('No schema selected for dataset creation')
      return
    }

    setIsCreatingRoutingDataset(true)
    try {
      const response = await fetch(allActions.createDataset, {
        method: 'POST',
        headers: {
          ...getApiHeaders(),
          'sandboxname': selectedSandbox,
          'schemaId': selectedSchema,
          'datasetName': `Profile Routing Dataset ${Date.now()}`
        }
      })

      if (!response.ok) throw new Error(`Failed to create dataset: ${response.status}`)

      const data = await response.json()
      const responseData = data.body || data
      const dataset = responseData.dataset

      // Ensure proper schema association
      dataset.schemaId = selectedSchema
      dataset.schemaRef = {
        id: selectedSchema,
        contentType: 'application/vnd.adobe.xed+json;version=1'
      }

      setRoutingDataset(dataset)
      showFeedback('positive', `Routing dataset "${dataset.name}" created successfully`)
      console.log('Routing dataset created:', dataset)
    } catch (error) {
      console.error('Error creating routing dataset:', error)
      showError(`Failed to create routing dataset: ${error.message}`)
    } finally {
      setIsCreatingRoutingDataset(false)
    }
  }

  const createRoutingConnector = async () => {
    if (!selectedSandbox) {
      showError('No sandbox selected for connector creation')
      return
    }

    if (!routingDataset) {
      showError('Please create a routing dataset first')
      return
    }

    setIsCreatingRoutingConnector(true)
    try {
      console.log('Creating routing connector and dataflow...', {
        sandbox: selectedSandbox,
        datasetId: routingDataset.id,
        schemaId: selectedSchema
      })

      // Step 1: Create the streaming connector
      showFeedback('info', 'Creating routing streaming connector...')
      const connectorResponse = await fetch(allActions.createStreamingConnector, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          name: `Profile Routing Connector ${Date.now()}`,
          description: 'Streaming connector for Profile Routing injection',
          sandbox: selectedSandbox
        })
      })

      if (!connectorResponse.ok) throw new Error(`Failed to create connector: ${connectorResponse.status}`)

      const connectorData = await connectorResponse.json()
      const responseData = connectorData.body || connectorData
      const connector = responseData.connector

      console.log('Routing connector created successfully:', connector.id)

      // Step 2: Create the dataflow to connect the connector to the dataset
      showFeedback('info', 'Creating routing dataflow...')
      const dataflowResponse = await fetch(allActions.createStreamingDataflow, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          connectorId: connector.id,
          datasetId: routingDataset.id,
          schemaId: selectedSchema,
          sandbox: selectedSandbox
        })
      })

      if (!dataflowResponse.ok) {
        const errorText = await dataflowResponse.text()
        throw new Error(`Failed to create dataflow: ${dataflowResponse.status} - ${errorText}`)
      }

      const dataflowData = await dataflowResponse.json()
      const dataflowResponseData = dataflowData.body || dataflowData

      console.log('Routing dataflow created successfully:', dataflowResponseData.dataflow?.id)

      setRoutingConnector(connector)
      showFeedback('positive', `Routing connector "${connector.name}" and dataflow created successfully! Ready for streaming.`)
      console.log('Routing connector and dataflow setup complete:', {
        connectorId: connector.id,
        dataflowId: dataflowResponseData.dataflow?.id,
        datasetId: routingDataset.id,
        schemaId: selectedSchema
      })
    } catch (error) {
      console.error('Error creating routing connector and dataflow:', error)
      showError(`Failed to create routing connector and dataflow: ${error.message}`)
    } finally {
      setIsCreatingRoutingConnector(false)
    }
  }

  const streamProfileToAEP = async () => {
    try {
      setIsProcessing(true)
      showFeedback('info', 'Streaming profile to AEP via routing configuration...')

      const profileToStream = editableProfile || generatedProfile

      if (!profileToStream) {
        throw new Error('No profile available for streaming. Please generate a profile first.')
      }

      if (!routingConnector) {
        throw new Error('No routing connector configured. Please create a connector first.')
      }

      if (!routingDataset) {
        throw new Error('No routing dataset configured. Please create a dataset first.')
      }

      console.log('Streaming profile with routing configuration:', {
        schemaId: selectedSchema,
        datasetId: routingDataset.id,
        connectorId: routingConnector.id,
        profileType: editableProfile ? 'edited' : 'generated'
      })

      const response = await fetch(allActions.injectProfiles, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          profiles: [profileToStream],
          connectorId: routingConnector.id,
          schemaId: selectedSchema,
          datasetId: routingDataset.id,
          sandboxName: selectedSandbox
        })
      })

      if (response.ok) {
        const data = await response.json()
        const responseData = data.body || data
        setRoutingStreamingResults(responseData.results || responseData)
        setInjectionResults(responseData.results || responseData) // Also set for results tab
        showFeedback('positive', 'Successfully streamed profile to AEP via routing configuration!')
        setActiveTab('results') // Move to results tab
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to stream profile')
      }
    } catch (err) {
      console.error('Profile streaming error:', err)
      showError(`Error streaming profile: ${err.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  // Debug functionality
  const [debugResults, setDebugResults] = useState(null)
  const [isDebugging, setIsDebugging] = useState(false)

  const debugProfileIngestion = async () => {
    try {
      console.log('🔍 debugProfileIngestion called')
      setIsDebugging(true)
      setError('')

      // Get the current dataset ID - prioritize routing dataset if available
      const currentDatasetId = routingDataset?.id || createdDataset?.id || selectedDataset

      console.log('Debug validation:', {
        currentDatasetId,
        selectedSchema,
        selectedSandbox,
        hasDatasetId: !!currentDatasetId,
        hasSchema: !!selectedSchema,
        hasSandbox: !!selectedSandbox,
        usingRoutingDataset: !!routingDataset?.id,
        routingDatasetId: routingDataset?.id
      })

      if (!currentDatasetId || !selectedSchema) {
        const errorMsg = 'Please select or create dataset and select schema before debugging'
        console.log('❌ Debug validation failed:', errorMsg)
        showError(errorMsg)
        return
      }

      const debugPayload = {
        datasetId: currentDatasetId,
        schemaId: selectedSchema,
        sandboxName: selectedSandbox
      }

      // Add routing context to debug info
      if (routingDataset?.id === currentDatasetId) {
        console.log('🔍 Debugging routing dataset:', routingDataset.name)
        showFeedback('info', `Debugging routing dataset: ${routingDataset.name}`)
      }

      console.log('🔍 Sending debug request with payload:', debugPayload)

      const response = await fetch(allActions.debugProfileIngestion, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify(debugPayload)
      })

      console.log('🔍 Debug response status:', response.status)

      if (response.ok) {
        const data = await response.json()
        const responseData = data.body || data
        console.log('✅ Debug response data:', responseData)
        setDebugResults(responseData)
        showFeedback('positive', 'Profile ingestion diagnostics completed')

        // Show recommendations if any
        if (responseData.debug?.recommendations?.length > 0) {
          const highPriorityIssues = responseData.debug.recommendations.filter(r => r.priority === 'HIGH')
          if (highPriorityIssues.length > 0) {
            showError(`Found ${highPriorityIssues.length} high-priority configuration issues. Check debug results for details.`)
          }
        }
      } else {
        const errorData = await response.json()
        console.log('❌ Debug response error:', errorData)
        throw new Error(errorData.error || 'Debug request failed')
      }
    } catch (err) {
      console.error('❌ Debug function error:', err)
      showError(`Debug failed: ${err.message}`)
    } finally {
      setIsDebugging(false)
    }
  }

  // Enhanced Profile Generation & Injection with AI and Manual modes
  const generateProfile = async () => {
    // Enhanced validation for schema details
    if (!schemaDetails) {
      showError('Schema details are not loaded. Please select a schema and wait for analysis to complete.')
      return
    }

    // For AI generation, we need either properties or sample data
    if (!isManualMode && !schemaDetails.properties && !sampleData) {
      showError('No schema structure available for AI generation. Please ensure schema details are loaded or switch to manual mode.')
      return
    }

    setIsProcessing(true)
    try {
      if (isManualMode) {
        // Manual mode: Create template from schema/sample data
        showFeedback('info', 'Creating manual profile template...')
        const template = getTemplateForGeneration()

        if (!template) {
          throw new Error('Unable to create template from schema. Please check schema structure.')
        }

        setEditableProfile(template)
        setGeneratedProfile(template) // Set as generated for consistency

        // Auto-validate the manual template
        const validation = validateProfileAgainstSchema(template)
        setValidationResults(validation)

        if (validation.isValid) {
          showFeedback('positive', 'Manual profile template created and validated! Edit it in the Review tab.')
        } else {
          showFeedback('negative', `Manual template created with ${validation.invalidFields.length} validation issue(s). Review and clean before injection.`)
        }

        setActiveTab('review-inject')
      } else {
        // AI Generation mode
        showFeedback('info', 'Generating AI-powered golden profile based on your template...')

        // Build the request body using pruning-aware template
        const template = getTemplateForGeneration()

        if (!template) {
          throw new Error('Unable to create template from schema structure. Please check schema details.')
        }

        // Enhanced request body with more context
        const requestBody = {
          template: template,
          emailDomain: emailDomain || 'gmail.svpoc.io',
          customization: profileCustomization || '',
          // Additional context for better AI generation
          schemaInfo: {
            title: schemaDetails.title,
            description: schemaDetails.description,
            hasIdentityFields: sampleData ? Object.keys(sampleData).some(key =>
              ['email', 'crmid', 'ecid'].includes(key.toLowerCase())
            ) : false
          }
        }

        console.log('🎯 Enhanced Golden Profile Generation Debug:')
        console.log('- Mode: AI Generation')
        console.log('- Pruning enabled:', pruningEnabled)
        console.log('- Pruned fields count:', Object.keys(prunedFields).filter(key => prunedFields[key] === false).length)
        console.log('- Template structure:', Object.keys(template))
        console.log('- Email domain:', emailDomain)
        console.log('- Customization:', profileCustomization)
        console.log('- Full request body:', requestBody)

        // Create an AbortController for timeout handling
        const controller = new AbortController()
        const timeoutId = setTimeout(() => {
          controller.abort()
        }, 90000) // 90 second timeout

        try {
          const response = await fetch(allActions.generateProfiles, {
            method: 'POST',
            headers: {
              ...getApiHeaders(),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
          })

          clearTimeout(timeoutId)

          console.log('AI Generation response status:', response.status)

          if (response.ok) {
            const data = await response.json()
            console.log('AI Generation response data:', data)

            const responseData = data.body || data
            const profiles = responseData.profiles || []

            if (profiles.length > 0) {
              setGeneratedProfile(profiles[0])
              setEditableProfile(null) // Clear any manual edits to show fresh AI profile

              // Auto-validate the generated profile
              const validation = validateProfileAgainstSchema(profiles[0])
              setValidationResults(validation)

              if (validation.isValid) {
                showFeedback('positive', `Generated AI profile successfully and passed validation! Ready for injection.`)
              } else {
                showFeedback('negative', `Generated AI profile with ${validation.invalidFields.length} validation issue(s). Please review and clean before injection.`)
              }

              setActiveTab('review-inject') // Move to review tab
              console.log('✅ AI profile generated successfully:', profiles[0])
            } else {
              throw new Error('No profiles generated by AI service')
            }
          } else {
            // Enhanced error handling
            const errorText = await response.text()
            console.error('AI Generation API Error:', {
              status: response.status,
              statusText: response.statusText,
              errorText: errorText
            })

            if (response.status === 503) {
              throw new Error('AI service temporarily unavailable. Please try again in a few moments.')
            } else if (response.status === 504) {
              throw new Error('AI generation timeout. Please try again or simplify your template.')
            } else if (response.status === 400) {
              throw new Error(`Invalid template or request: ${errorText}`)
            } else {
              throw new Error(`AI Generation failed (${response.status}): ${errorText}`)
            }
          }
        } catch (fetchError) {
          clearTimeout(timeoutId)

          if (fetchError.name === 'AbortError') {
            throw new Error('Request timeout. AI generation is taking longer than expected. Please try again later.')
          } else {
            throw fetchError
          }
        }
      }
    } catch (err) {
      console.error('Profile generation error:', err)
      showError(`Error ${isManualMode ? 'creating manual template' : 'generating AI profile'}: ${err.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const injectProfile = async () => {
    try {
      setIsProcessing(true)
      showFeedback('info', 'Injecting profile into AEP...')

      // Use edited profile if available, otherwise use generated profile
      const profileToInject = editableProfile || generatedProfile

      if (!profileToInject) {
        throw new Error('No profile available for injection. Please generate a profile first.')
      }

      // Validate we have a connector
      if (!selectedConnector) {
        throw new Error('No connector selected. Please select or create a streaming connector first.')
      }

      // Get the current dataset ID
      const currentDatasetId = createdDataset?.id || selectedDataset

      if (!currentDatasetId) {
        throw new Error('No dataset selected. Please create a new dataset or select an existing one.')
      }

      // Enhanced schema-dataset validation
      console.log('🔍 Validating dataset-schema compatibility...')
      console.log('Dataset validation context:', {
        currentDatasetId,
        selectedSchema,
        createdDataset: createdDataset ? {
          id: createdDataset.id,
          name: createdDataset.name,
          schemaRef: createdDataset.schemaRef,
          schemaId: createdDataset.schemaId
        } : null,
        selectedDataset
      })

      // Check if using created dataset and validate its schema
      if (createdDataset?.id === currentDatasetId) {
        const datasetSchemaId = createdDataset.schemaRef?.id || createdDataset.schemaRef || createdDataset.schemaId
        console.log('Dataset schema validation:', {
          datasetSchemaId,
          selectedSchema,
          matches: datasetSchemaId === selectedSchema
        })

        if (datasetSchemaId && datasetSchemaId !== selectedSchema) {
          throw new Error(
            `Schema mismatch detected! The dataset "${createdDataset.name}" was created with schema ${datasetSchemaId}, ` +
            `but you're trying to inject profiles using schema ${selectedSchema}. ` +
            `Please either:\n` +
            `1. Select the original schema: ${datasetSchemaId}\n` +
            `2. Or create a new dataset with the current schema: ${selectedSchema}`
          )
        }
      }

      // Check if using existing dataset and validate its schema
      if (selectedDataset === currentDatasetId && selectedDataset !== createdDataset?.id) {
        const existingDataset = datasets.find(d => d.id === currentDatasetId)
        if (existingDataset) {
          const datasetSchemaId = existingDataset.schemaRef?.id || existingDataset.schemaRef || existingDataset.schemaId
          console.log('Existing dataset schema validation:', {
            datasetSchemaId,
            selectedSchema,
            matches: datasetSchemaId === selectedSchema
          })

          if (datasetSchemaId && datasetSchemaId !== selectedSchema) {
            throw new Error(
              `Schema mismatch detected! The selected dataset "${existingDataset.name}" uses schema ${datasetSchemaId}, ` +
              `but you're trying to inject profiles using schema ${selectedSchema}. ` +
              `Please either:\n` +
              `1. Select the matching schema: ${datasetSchemaId}\n` +
              `2. Or select a different dataset that matches schema: ${selectedSchema}`
            )
          }
        }
      }

      console.log('✅ Dataset-schema validation passed!')
      console.log('Injecting profile with parameters:', {
        schemaId: selectedSchema,
        datasetId: currentDatasetId,
        profileType: editableProfile ? 'edited' : 'generated'
      })

      const response = await fetch(allActions.injectProfiles, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          profiles: [profileToInject],
          connectorId: selectedConnector,
          schemaId: selectedSchema,
          datasetId: currentDatasetId,
          sandboxName: selectedSandbox
        })
      })

      if (response.ok) {
        const data = await response.json()
        const responseData = data.body || data
        setInjectionResults(responseData.results || responseData)
        showFeedback('positive', 'Successfully injected profile into AEP!')
        setActiveTab('results') // Move to results tab
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to inject profile')
      }
    } catch (err) {
      console.error('Profile injection error:', err)
      showError(`Error injecting profile: ${err.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  // Helper functions from old version - Pruning Tree Components
  const cleanFieldName = (fieldName) => {
    return fieldName
      .replace(/^xdm:/, '')
      .replace(/^_xdm\./, '')
      .replace(/^_experience\./, '')
      .replace(/^_repo\./, '')
  }

  const buildTreeNodesFromSample = (obj, path = '') => {
    if (typeof obj !== 'object' || obj === null) return []
    return Object.entries(obj).map(([key, value]) => {
      const nodePath = path ? `${path}.${key}` : key
      const cleanLabel = cleanFieldName(key)

      const isIdentityField = ['email', 'crmid', 'ecid', 'gaid', 'loyaltyId', 'passportId', 'phoneNumber', 'biometricId', 'emailIdSha256', 'd365', 'stackchatId'].includes(cleanLabel.toLowerCase())

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const children = buildTreeNodesFromSample(value, nodePath)
        return {
          key: nodePath,
          label: cleanLabel,
          type: 'Object',
          isIdentity: isIdentityField,
          children: children
        }
      } else if (Array.isArray(value)) {
        let arrayType = 'Array'
        if (value.length > 0) {
          const firstElement = value[0]
          if (typeof firstElement === 'string') arrayType = 'String[]'
          else if (typeof firstElement === 'number') arrayType = 'Number[]'
          else if (typeof firstElement === 'boolean') arrayType = 'Boolean[]'
          else if (typeof firstElement === 'object' && firstElement !== null) arrayType = 'Object[]'
        }

        const children = value.length > 0 && typeof value[0] === 'object' && value[0] !== null ?
          buildTreeNodesFromSample(value[0], nodePath + '[]') : []
        return {
          key: nodePath,
          label: cleanLabel,
          type: arrayType,
          isIdentity: isIdentityField,
          children: children
        }
      } else {
        let primitiveType = typeof value
        if (primitiveType === 'string') primitiveType = 'String'
        else if (primitiveType === 'number') primitiveType = 'Number'
        else if (primitiveType === 'boolean') primitiveType = 'Boolean'

        return {
          key: nodePath,
          label: cleanLabel,
          type: primitiveType,
          isIdentity: isIdentityField,
          children: []
        }
      }
    })
  }

  const getCheckboxState = (nodePath, children) => {
    const isExplicitlyUnchecked = prunedFields[nodePath] === false
    if (isExplicitlyUnchecked) return { checked: false, indeterminate: false }

    if (!children || children.length === 0) {
      return { checked: prunedFields[nodePath] !== false, indeterminate: false }
    }

    const childStates = children.map(child => getCheckboxState(child.key, child.children))
    const checkedChildren = childStates.filter(state => state.checked).length
    const indeterminateChildren = childStates.filter(state => state.indeterminate).length

    if (checkedChildren === children.length) {
      return { checked: true, indeterminate: false }
    } else if (checkedChildren === 0 && indeterminateChildren === 0) {
      return { checked: false, indeterminate: false }
    } else {
      return { checked: false, indeterminate: true }
    }
  }

  const collectDescendantPaths = (node) => {
    const paths = [node.key]
    if (node.children && node.children.length > 0) {
      node.children.forEach(child => {
        paths.push(...collectDescendantPaths(child))
      })
    }
    return paths
  }

  const handleToggleField = (fieldPath, nodeData) => {
    setPrunedFields(prev => {
      const newState = { ...prev }
      const isCurrentlyChecked = newState[fieldPath] !== false
      const newValue = !isCurrentlyChecked

      newState[fieldPath] = newValue

      if (!newValue && nodeData.children && nodeData.children.length > 0) {
        const descendantPaths = collectDescendantPaths(nodeData)
        descendantPaths.forEach(path => {
          if (path !== fieldPath) {
            newState[path] = false
          }
        })
      }

      if (newValue) {
        const pathParts = fieldPath.split('.')
        for (let i = 1; i < pathParts.length; i++) {
          const ancestorPath = pathParts.slice(0, i).join('.')
          newState[ancestorPath] = true
        }
      }

      return newState
    })
  }

  const handleToggleExpand = (nodeKey) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeKey]: !prev[nodeKey]
    }))
  }

  // Helper function to create template from schema
  const createTemplateFromSchema = (schema) => {
    // Simplified template creation from flattened fields
    const template = {}
    const flattenedFields = schema.flattenedFields || {}

    for (const [fieldPath, fieldInfo] of Object.entries(flattenedFields)) {
      setNestedValue(template, fieldPath, getDefaultValue(fieldInfo.type))
    }

    return template
  }

  const getTemplateForGeneration = () => {
    console.log('🎯 getTemplateForGeneration called:', {
      hasSampleData: !!sampleData,
      hasSchemaProperties: !!schemaDetails?.properties,
      hasSchemaFlattenedFields: !!schemaDetails?.flattenedFields,
      pruningEnabled,
      prunedFieldsCount: Object.keys(prunedFields).length
    })

    // Priority 1: Use sample data if available (most reliable)
    if (sampleData) {
      console.log('Using sample data for template generation')
      if (pruningEnabled && Object.keys(prunedFields).length > 0) {
        const prunedTemplate = getPrunedSampleData(sampleData)
        console.log('Generated pruned template from sample data:', Object.keys(prunedTemplate))
        return prunedTemplate
      } else {
        const emptyTemplate = createEmptyTemplate(sampleData)
        console.log('Generated empty template from sample data:', Object.keys(emptyTemplate))
        return emptyTemplate
      }
    }

    // Priority 2: Use schema flattened fields if available
    if (schemaDetails?.flattenedFields && Object.keys(schemaDetails.flattenedFields).length > 0) {
      console.log('Using schema flattened fields for template generation')
      const template = createTemplateFromFlattenedFields(schemaDetails.flattenedFields)
      console.log('Generated template from flattened fields:', Object.keys(template))
      return template
    }

    // Priority 3: Use schema properties as fallback
    if (schemaDetails?.properties && Object.keys(schemaDetails.properties).length > 0) {
      console.log('Using schema properties for template generation')
      const template = createTemplateFromProperties(schemaDetails.properties)
      console.log('Generated template from schema properties:', Object.keys(template))
      return template
    }

    console.error('No suitable data source found for template generation')
    return null
  }

  // Helper function to create template from flattened fields
  const createTemplateFromFlattenedFields = (flattenedFields) => {
    const template = {}

    for (const [fieldPath, fieldInfo] of Object.entries(flattenedFields)) {
      // Skip pruned fields
      if (pruningEnabled && prunedFields[fieldPath] === false) continue

      const cleanPath = fieldPath.split('.').map(cleanFieldName).join('.')
      setNestedValue(template, cleanPath, getDefaultValueFromType(fieldInfo.type))
    }

    // Ensure testProfile is set
    if (!template.testProfile) {
      template.testProfile = true
    }

    return template
  }

  // Helper function to create template from schema properties  
  const createTemplateFromProperties = (properties) => {
    const template = {}

    const processProperties = (props, path = '') => {
      for (const [key, prop] of Object.entries(props)) {
        const currentPath = path ? `${path}.${key}` : key

        // Skip pruned fields
        if (pruningEnabled && prunedFields[currentPath] === false) continue

        const cleanKey = cleanFieldName(key)

        if (prop.type === 'object' && prop.properties) {
          template[cleanKey] = {}
          processProperties(prop.properties, currentPath)
        } else if (prop.type === 'array' && prop.items?.properties) {
          template[cleanKey] = [{}]
          processProperties(prop.items.properties, `${currentPath}[]`)
        } else {
          template[cleanKey] = getDefaultValueFromType(prop.type)
        }
      }
    }

    processProperties(properties)

    // Ensure testProfile is set
    if (!template.testProfile) {
      template.testProfile = true
    }

    return template
  }

  // Enhanced default value function
  const getDefaultValueFromType = (type) => {
    switch (type?.toLowerCase()) {
      case 'string': return ''
      case 'number':
      case 'integer': return 0
      case 'boolean': return false
      case 'array': return []
      case 'object': return {}
      default: return ''
    }
  }

  const getPrunedSampleData = (obj, path = '') => {
    if (typeof obj !== 'object' || obj === null) return obj
    if (Array.isArray(obj)) {
      return obj.map((item, idx) => getPrunedSampleData(item, path + '[]'))
    }
    const result = {}
    for (const [key, value] of Object.entries(obj)) {
      const nodePath = path ? `${path}.${key}` : key
      if (prunedFields[nodePath] === false) continue

      const cleanKey = cleanFieldName(key)

      if (typeof value === 'object' && value !== null) {
        result[cleanKey] = getPrunedSampleData(value, nodePath)
      } else {
        result[cleanKey] = value
      }
    }
    return result
  }

  const createEmptyTemplate = (obj, path = '') => {
    if (typeof obj !== 'object' || obj === null) {
      if (typeof obj === 'string') return ""
      if (typeof obj === 'number') return 0
      if (typeof obj === 'boolean') return false
      return ""
    }

    if (Array.isArray(obj)) {
      return obj.length > 0 ? [createEmptyTemplate(obj[0], path + '[]')] : []
    }

    const result = {}
    for (const [key, value] of Object.entries(obj)) {
      const nodePath = path ? `${path}.${key}` : key
      if (prunedFields[nodePath] === false) continue

      const cleanKey = cleanFieldName(key)

      if (typeof value === 'object' && value !== null) {
        result[cleanKey] = createEmptyTemplate(value, nodePath)
      } else {
        result[cleanKey] = getEmptyValue(cleanKey, value)
      }
    }

    if (path === '' && !result.testProfile) {
      result.testProfile = true
    }

    return result
  }

  const getEmptyValue = (fieldName, originalValue) => {
    const lowerFieldName = fieldName.toLowerCase()

    if (lowerFieldName === 'testprofile') {
      return true
    }
    if (lowerFieldName.includes('is') || lowerFieldName.includes('has') || lowerFieldName.includes('enabled')) {
      return false
    }

    if (lowerFieldName.includes('age') || lowerFieldName.includes('score') ||
      lowerFieldName.includes('income') || lowerFieldName.includes('count') ||
      lowerFieldName.includes('number') || typeof originalValue === 'number') {
      return 0
    }

    if (lowerFieldName.includes('date') || lowerFieldName.includes('time') ||
      lowerFieldName.includes('birth') || lowerFieldName.includes('created')) {
      return ""
    }

    return ""
  }

  const setNestedValue = (obj, path, value) => {
    const keys = path.split('.')
    let current = obj

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]
      if (!(key in current)) {
        current[key] = {}
      }
      current = current[key]
    }

    current[keys[keys.length - 1]] = value
  }

  const getDefaultValue = (type) => {
    switch (type) {
      case 'string': return ''
      case 'number': return 0
      case 'boolean': return false
      case 'array': return []
      default: return null
    }
  }

  // Tree Rendering Functions
  const getTypeBadgeColor = (type) => {
    if (type === 'String') return '#EEF2FF'
    if (type === 'Number') return '#F0FDF4'
    if (type === 'Boolean') return '#FEF3C7'
    if (type === 'Object') return '#F3E8FF'
    if (type.includes('[]')) return '#FDF2F8'
    return '#F3F4F6'
  }

  const getTypeBadgeTextColor = (type) => {
    if (type === 'String') return '#3730A3'
    if (type === 'Number') return '#166534'
    if (type === 'Boolean') return '#92400E'
    if (type === 'Object') return '#7C3AED'
    if (type.includes('[]')) return '#BE185D'
    return '#6B7280'
  }

  const renderTreeNodes = (nodes, level = 0) => {
    return (
      <div style={{
        fontFamily: 'adobe-clean, "Source Sans Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: '14px'
      }}>
        {nodes.map(node => {
          const isParent = node.children && node.children.length > 0
          const expanded = expandedNodes[node.key] === true
          const isObject = node.type === 'Object' || node.type.includes('[]')

          return (
            <div key={node.key} style={{ marginBottom: '2px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: `${level * 20 + 8}px`,
                  paddingRight: '8px',
                  paddingTop: '4px',
                  paddingBottom: '4px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                  backgroundColor: 'transparent'
                }}
              >
                {isParent ? (
                  <button
                    onClick={() => handleToggleExpand(node.key)}
                    style={{
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      fontSize: '12px',
                      padding: '2px',
                      marginRight: '6px',
                      color: '#6B7280',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '16px',
                      height: '16px',
                      borderRadius: '2px'
                    }}
                  >
                    {expanded ? '▼' : '▶'}
                  </button>
                ) : (
                  <div style={{ width: '22px' }} />
                )}

                {(() => {
                  const checkboxState = getCheckboxState(node.key, node.children)
                  return (
                    <input
                      type="checkbox"
                      checked={checkboxState.checked}
                      ref={checkboxState.indeterminate ? (el) => {
                        if (el) el.indeterminate = true
                      } : null}
                      onChange={() => handleToggleField(node.key, node)}
                      style={{
                        marginRight: '8px',
                        cursor: 'pointer',
                        accentColor: '#1473E6'
                      }}
                    />
                  )
                })()}

                {node.isIdentity && (
                  <span style={{
                    marginRight: '6px',
                    color: '#6B7280',
                    fontSize: '12px'
                  }}>
                    🔒
                  </span>
                )}

                <span style={{
                  fontWeight: isObject ? '600' : '400',
                  color: isObject ? '#1F2937' : '#374151',
                  marginRight: '8px',
                  fontSize: '14px'
                }}>
                  {node.label}
                </span>

                <span style={{
                  backgroundColor: getTypeBadgeColor(node.type),
                  color: getTypeBadgeTextColor(node.type),
                  fontSize: '11px',
                  fontWeight: '500',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.025em'
                }}>
                  {node.type}
                </span>
              </div>

              {isParent && expanded && (
                <div style={{ position: 'relative' }}>
                  {renderTreeNodes(node.children, level + 1)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // ========================================
  // SCHEMA VALIDATION SYSTEM
  // ========================================

  // State for validation
  const [validationResults, setValidationResults] = useState(null)
  const [showValidation, setShowValidation] = useState(false)

  /**
   * Validates a profile object against the schema structure
   * Returns validation results with invalid fields and suggestions
   */
  const validateProfileAgainstSchema = (profile, schema = null) => {
    if (!profile || typeof profile !== 'object') {
      return { isValid: false, invalidFields: [], suggestions: ['Profile must be a valid object'] }
    }

    // Use current schema details if none provided
    const currentSchema = schema || schemaDetails
    if (!currentSchema) {
      return { isValid: true, invalidFields: [], suggestions: ['No schema available for validation'] }
    }

    const invalidFields = []
    const suggestions = []

    // Get the schema properties
    let schemaProperties = null
    if (currentSchema.properties) {
      schemaProperties = currentSchema.properties
    } else if (currentSchema.allOf) {
      // Handle schema with allOf structure
      schemaProperties = {}
      currentSchema.allOf.forEach(item => {
        if (item.properties) {
          Object.assign(schemaProperties, item.properties)
        }
      })
    }

    if (!schemaProperties) {
      return { isValid: true, invalidFields: [], suggestions: ['Schema structure not recognized'] }
    }

    // Validate profile against schema
    validateObjectAgainstProperties(profile, schemaProperties, '', invalidFields, suggestions)

    return {
      isValid: invalidFields.length === 0,
      invalidFields,
      suggestions: suggestions.slice(0, 10) // Limit suggestions
    }
  }

  /**
   * Recursively validates an object against schema properties
   */
  const validateObjectAgainstProperties = (obj, properties, basePath, invalidFields, suggestions) => {
    if (!obj || typeof obj !== 'object' || !properties) return

    // Check each field in the profile
    Object.keys(obj).forEach(key => {
      const fieldPath = basePath ? `${basePath}.${key}` : key
      const fieldValue = obj[key]
      const schemaProperty = properties[key]

      if (!schemaProperty) {
        // Field not in schema
        invalidFields.push({
          path: fieldPath,
          value: fieldValue,
          reason: 'Field not found in schema',
          type: 'unknown_field'
        })
        suggestions.push(`Remove field "${fieldPath}" - not defined in schema`)
        return
      }

      // Validate field type and structure
      validateFieldType(fieldValue, schemaProperty, fieldPath, invalidFields, suggestions)

      // Recursively validate nested objects
      if (fieldValue && typeof fieldValue === 'object' && !Array.isArray(fieldValue)) {
        if (schemaProperty.type === 'object' && schemaProperty.properties) {
          validateObjectAgainstProperties(fieldValue, schemaProperty.properties, fieldPath, invalidFields, suggestions)
        }
      }

      // Validate arrays
      if (Array.isArray(fieldValue)) {
        validateArrayField(fieldValue, schemaProperty, fieldPath, invalidFields, suggestions)
      }
    })
  }

  /**
   * Validates field type against schema definition
   */
  const validateFieldType = (value, schemaProperty, fieldPath, invalidFields, suggestions) => {
    if (!schemaProperty.type) return

    const actualType = getActualType(value)
    const expectedType = schemaProperty.type

    // Handle type mismatches
    if (expectedType === 'string' && actualType !== 'string') {
      if (value !== null && value !== undefined) {
        invalidFields.push({
          path: fieldPath,
          value: value,
          reason: `Expected string, got ${actualType}`,
          type: 'type_mismatch'
        })
        suggestions.push(`Convert "${fieldPath}" to string`)
      }
    } else if (expectedType === 'number' && actualType !== 'number') {
      if (value !== null && value !== undefined) {
        invalidFields.push({
          path: fieldPath,
          value: value,
          reason: `Expected number, got ${actualType}`,
          type: 'type_mismatch'
        })
        suggestions.push(`Convert "${fieldPath}" to number`)
      }
    } else if (expectedType === 'boolean' && actualType !== 'boolean') {
      if (value !== null && value !== undefined) {
        invalidFields.push({
          path: fieldPath,
          value: value,
          reason: `Expected boolean, got ${actualType}`,
          type: 'type_mismatch'
        })
        suggestions.push(`Convert "${fieldPath}" to boolean`)
      }
    } else if (expectedType === 'array' && !Array.isArray(value)) {
      if (value !== null && value !== undefined) {
        invalidFields.push({
          path: fieldPath,
          value: value,
          reason: `Expected array, got ${actualType}`,
          type: 'type_mismatch'
        })
        suggestions.push(`Convert "${fieldPath}" to array`)
      }
    } else if (expectedType === 'object' && (actualType !== 'object' || Array.isArray(value))) {
      if (value !== null && value !== undefined) {
        invalidFields.push({
          path: fieldPath,
          value: value,
          reason: `Expected object, got ${actualType}`,
          type: 'type_mismatch'
        })
        suggestions.push(`Convert "${fieldPath}" to object`)
      }
    }
  }

  /**
   * Validates array fields with their item schemas
   */
  const validateArrayField = (arrayValue, schemaProperty, fieldPath, invalidFields, suggestions) => {
    if (!Array.isArray(arrayValue)) return

    const itemSchema = schemaProperty.items
    if (!itemSchema) return

    arrayValue.forEach((item, index) => {
      const itemPath = `${fieldPath}[${index}]`

      if (itemSchema.type === 'object' && itemSchema.properties) {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          validateObjectAgainstProperties(item, itemSchema.properties, itemPath, invalidFields, suggestions)
        } else {
          invalidFields.push({
            path: itemPath,
            value: item,
            reason: 'Array item must be an object',
            type: 'type_mismatch'
          })
        }
      } else {
        validateFieldType(item, itemSchema, itemPath, invalidFields, suggestions)
      }
    })
  }

  /**
   * Gets the actual JavaScript type of a value
   */
  const getActualType = (value) => {
    if (value === null) return 'null'
    if (value === undefined) return 'undefined'
    if (Array.isArray(value)) return 'array'
    return typeof value
  }

  /**
   * Removes invalid fields from a profile object
   */
  const cleanProfileFromInvalidFields = (profile, invalidFields) => {
    if (!profile || !invalidFields || invalidFields.length === 0) {
      return profile
    }

    // Create a deep copy of the profile
    const cleanedProfile = JSON.parse(JSON.stringify(profile))

    // Sort invalid fields by path depth (deepest first) to avoid issues with nested deletions
    const sortedInvalidFields = [...invalidFields].sort((a, b) => {
      const aDepth = a.path.split('.').length
      const bDepth = b.path.split('.').length
      return bDepth - aDepth
    })

    // Remove each invalid field
    sortedInvalidFields.forEach(invalidField => {
      removeFieldFromObject(cleanedProfile, invalidField.path)
    })

    return cleanedProfile
  }

  /**
   * Removes a field from an object using dot notation path
   */
  const removeFieldFromObject = (obj, path) => {
    if (!obj || !path) return

    const parts = path.split('.')
    let current = obj

    // Navigate to the parent object
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]

      // Handle array indices
      if (part.includes('[') && part.includes(']')) {
        const [arrayName, indexStr] = part.split('[')
        const index = parseInt(indexStr.replace(']', ''))

        if (current[arrayName] && Array.isArray(current[arrayName])) {
          current = current[arrayName][index]
        } else {
          return // Path doesn't exist
        }
      } else {
        if (current[part] === undefined) {
          return // Path doesn't exist
        }
        current = current[part]
      }
    }

    // Remove the final field
    const finalPart = parts[parts.length - 1]
    if (finalPart.includes('[') && finalPart.includes(']')) {
      const [arrayName, indexStr] = finalPart.split('[')
      const index = parseInt(indexStr.replace(']', ''))

      if (current[arrayName] && Array.isArray(current[arrayName])) {
        current[arrayName].splice(index, 1)
      }
    } else {
      delete current[finalPart]
    }
  }

  /**
   * Runs validation on the current profile
   */
  const runProfileValidation = () => {
    const profile = editableProfile || generatedProfile
    if (!profile) {
      showError('No profile available for validation')
      return
    }

    const results = validateProfileAgainstSchema(profile)
    setValidationResults(results)
    setShowValidation(true)

    if (results.isValid) {
      showFeedback('positive', 'Profile validation passed! No issues found.')
    } else {
      showFeedback('negative', `Validation found ${results.invalidFields.length} issue(s)`)
    }
  }

  /**
   * Cleans the profile by removing invalid fields
   */
  const cleanProfile = () => {
    if (!validationResults || !validationResults.invalidFields.length) return

    const profile = editableProfile || generatedProfile
    const cleanedProfile = cleanProfileFromInvalidFields(profile, validationResults.invalidFields)

    setEditableProfile(cleanedProfile)
    if (generatedProfile) {
      setGeneratedProfile(cleanedProfile)
    }

    // Re-run validation
    const newResults = validateProfileAgainstSchema(cleanedProfile)
    setValidationResults(newResults)

    showFeedback('positive', `Removed ${validationResults.invalidFields.length} invalid field(s)`)
  }

  // Reset everything
  const resetAll = () => {
    setSandboxLocked(false)
    setSchemaLocked(false)
    setDatasetLocked(false)
    setConnectionLocked(false)
    setAiSettingsLocked(false)
    setSelectedSandbox('')
    setSelectedSchema('')
    setSelectedDataset('')
    setSelectedConnector('')
    setCreatedDataset(null)
    setSchemaDetails(null)
    setGeneratedProfile(null)
    setInjectionResults(null)
    setDebugResults(null)
    setSchemas([])
    setDatasets([])
    setConnectors([])
    setSampleData(null)
    setPrunedFields({})
    setExpandedNodes({})
    setEditableProfile(null)
    setGeneratedProfile(null) // Also clear generated profile
    setValidationResults(null)
    setShowValidation(false)
    setCurrentStep(1)
    // Clear Profile Routing state
    setShowProfileRouting(false)
    setRoutingDataset(null)
    setRoutingConnector(null)
    setRoutingStreamingResults(null)
    // Reset active tab to overview
    setActiveTab('overview')
    showFeedback('info', 'All settings reset')
  }

  return (
    <View padding="size-300">
      <Flex direction="column" gap="size-300">
        {/* Header */}
        <View>
          <Flex direction="row" justifyContent="space-between" alignItems="center">
            <Flex direction="column">
              <Heading level={1}>AI AEP Profile Injector</Heading>
              <Text>
                Generate a profile record from any schema from your sandbox. If you'd like you can also stream the golden profile.
              </Text>
              <Text>
                Simply: Select sandbox → Choose schema  → Select Fields → Generate & inject profile
              </Text>
            </Flex>
            <Flex gap="size-200" alignItems="center">
              {sessionSaving && (
                <StatusLight variant="info">
                  💾 Saving session...
                </StatusLight>
              )}
              {sessionLoaded && !sessionSaving && (
                <Text size="XS" color="gray-600">
                  💾 Session auto-saved
                </Text>
              )}
              <Button
                variant="secondary"
                onPress={async () => {
                  if (confirm('Are you sure you want to delete your session and start over? This will clear all your configuration and progress.')) {
                    // First try to delete the session from the server
                    if (ims?.profile?.userId) {
                      try {
                        console.log('🗑️ Deleting session for user:', ims.profile.userId)

                        const response = await fetch(allActions['session-manager'], {
                          method: 'POST',
                          headers: getApiHeaders(),
                          body: JSON.stringify({
                            action: 'delete',
                            featureName: 'aepProfileInjector'
                          })
                        })

                        if (response.ok) {
                          console.log('✅ Session deleted successfully')
                          showFeedback('positive', 'Session cleared successfully')
                        } else {
                          console.warn('⚠️ Failed to delete session from server, but continuing with local reset')
                        }
                      } catch (error) {
                        console.warn('⚠️ Error deleting session:', error)
                        // Continue with local reset even if server deletion fails
                      }
                    }

                    // Reset all local state
                    resetAll()
                  }
                }}
                isDisabled={!sessionLoaded}
              >
                🗑️ Clear Session
              </Button>
            </Flex>
          </Flex>
        </View>

        {/* Feedback & Error Messages */}
        {feedback && (
          <Well marginBottom="size-200">
            <Flex alignItems="center" gap="size-100">
              <StatusLight variant={feedback.type === 'positive' ? 'positive' : feedback.type === 'negative' ? 'negative' : 'info'}>
                {feedback.type === 'positive' ? 'Success' : feedback.type === 'negative' ? 'Error' : 'Info'}
              </StatusLight>
              <Text>{feedback.message}</Text>
            </Flex>
          </Well>
        )}

        {error && (
          <Well marginBottom="size-200">
            <Flex alignItems="center" gap="size-100">
              <StatusLight variant="negative">Error</StatusLight>
              <Text>{error}</Text>
            </Flex>
          </Well>
        )}

        {/* Progress Indicator */}
        <Well>
          <Flex alignItems="center" gap="size-200">
            <Text><strong>Current Step:</strong> {currentStep}/5</Text>
            <ProgressBar
              value={currentStep}
              maxValue={5}
              label="Workflow Progress"
              showValueLabel={false}
              width="200px"
            />
          </Flex>
        </Well>

        <Tabs selectedKey={activeTab} onSelectionChange={setActiveTab}>
          <TabList>
            <Item key="overview">Overview</Item>
            <Item key="configuration">Configuration</Item>
            {currentStep >= 5 && <Item key="field-selection">Field Selection {sampleData ? '✅' : '⏳'}</Item>}
            {currentStep >= 5 && <Item key="profile-creation">Profile Creation {(isManualMode || generatedProfile) ? '✅' : ''}</Item>}
            {currentStep >= 5 && <Item key="review-inject">Review & Inject {(editableProfile || generatedProfile) ? '✅' : ''}</Item>}
            {showProfileRouting && <Item key="profile-routing">Profile Routing {(routingDataset && routingConnector) ? "✅" : "⏳"}</Item>}
            {injectionResults && <Item key="results">Results ✅</Item>}
          </TabList>

          <TabPanels>
            <Item key="overview">
              <View marginTop="size-300">
                <Well>
                  <Flex direction="column" gap="size-200">
                    <Heading level={4}>🎯 AEP Profile Injector Overview</Heading>

                    {/* Enhanced Configuration Summary */}
                    <Well backgroundColor="gray-50" padding="size-200">
                      <Flex direction="column" gap="size-150">
                        <Text><strong>📊 Current Configuration:</strong></Text>

                        {/* Sandbox Status */}
                        <div style={{ padding: '8px', backgroundColor: sandboxLocked ? '#f0fff4' : '#fff3cd', borderRadius: '4px', border: `1px solid ${sandboxLocked ? '#22c55e' : '#ffc107'}` }}>
                          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                            Sandbox: {sandboxLocked ? '✅ Configured' : '⚠️ Pending'}
                          </div>
                          {selectedSandbox && (
                            <>
                              <div style={{ fontSize: '12px', color: '#666' }}>
                                {sandboxes.find(s => s.name === selectedSandbox)?.title || selectedSandbox}
                              </div>
                              <div style={{ fontSize: '11px', color: '#666' }}>
                                ID: {selectedSandbox}
                              </div>
                            </>
                          )}
                        </div>

                        {/* Schema Status */}
                        <div style={{ padding: '8px', backgroundColor: schemaLocked ? '#f0fff4' : '#fff3cd', borderRadius: '4px', border: `1px solid ${schemaLocked ? '#22c55e' : '#ffc107'}` }}>
                          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                            Schema: {schemaLocked ? '✅ Configured' : '⚠️ Pending'}
                          </div>
                          {selectedSchema && (
                            <>
                              <div style={{ fontSize: '12px', color: '#666' }}>
                                {schemaDetails?.title || schemas.find(s => s.id === selectedSchema)?.title || 'Unknown Schema'}
                              </div>
                              <div style={{ fontSize: '11px', color: '#666' }}>
                                ID: {selectedSchema.length > 40 ? `${selectedSchema.substring(0, 40)}...` : selectedSchema}
                              </div>
                            </>
                          )}
                        </div>

                        {/* Dataset Status */}
                        <div style={{ padding: '8px', backgroundColor: datasetLocked ? '#f0fff4' : '#fff3cd', borderRadius: '4px', border: `1px solid ${datasetLocked ? '#22c55e' : '#ffc107'}` }}>
                          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                            Dataset: {datasetLocked ? '✅ Configured' : '⚠️ Pending'}
                          </div>
                          {(createdDataset || selectedDataset) && (
                            <>
                              <div style={{ fontSize: '12px', color: '#666' }}>
                                {createdDataset?.name || datasets.find(d => d.id === selectedDataset)?.name || 'Unknown Dataset'}
                              </div>
                              <div style={{ fontSize: '11px', color: '#666' }}>
                                ID: {(createdDataset?.id || selectedDataset)?.length > 40 ? `${(createdDataset?.id || selectedDataset).substring(0, 40)}...` : (createdDataset?.id || selectedDataset)}
                              </div>
                              {createdDataset && (
                                <div style={{ fontSize: '11px', color: '#22c55e' }}>
                                  ✨ Newly Created
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {/* Connection Status */}
                        <div style={{ padding: '8px', backgroundColor: connectionLocked ? '#f0fff4' : '#fff3cd', borderRadius: '4px', border: `1px solid ${connectionLocked ? '#22c55e' : '#ffc107'}` }}>
                          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                            Connection: {connectionLocked ? '✅ Configured' : '⚠️ Pending'}
                          </div>
                          {selectedConnector && (
                            <>
                              <div style={{ fontSize: '12px', color: '#333', fontWeight: '500' }}>
                                {(() => {
                                  const connector = connectors.find(c => c.id === selectedConnector);
                                  const connectorName = connector?.name;
                                  if (connectorName) {
                                    return connectorName;
                                  } else {
                                    return `Connector: ${selectedConnector.length > 30 ? `${selectedConnector.substring(0, 30)}...` : selectedConnector}`;
                                  }
                                })()}
                              </div>
                              {(() => {
                                const connector = connectors.find(c => c.id === selectedConnector);
                                const connectorName = connector?.name;
                                // Only show ID if we have a name (to distinguish from ID-only display)
                                if (connectorName) {
                                  return (
                                    <div style={{ fontSize: '10px', color: '#999' }}>
                                      ID: {selectedConnector.length > 40 ? `${selectedConnector.substring(0, 40)}...` : selectedConnector}
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                              {(() => {
                                const connector = connectors.find(c => c.id === selectedConnector);
                                const inletUrl = connector?.inletUrl ||
                                  connector?.auth?.params?.inletUrl ||
                                  connector?.params?.inletUrl;
                                if (inletUrl) {
                                  return (
                                    <div style={{ fontSize: '11px', color: '#666' }}>
                                      Inlet: {inletUrl.length > 50 ? `${inletUrl.substring(0, 50)}...` : inletUrl}
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </>
                          )}
                        </div>

                        {/* AI Settings Status */}
                        <div style={{ padding: '8px', backgroundColor: aiSettingsLocked ? '#f0fff4' : '#f8f9fa', borderRadius: '4px', border: `1px solid ${aiSettingsLocked ? '#22c55e' : '#e0e0e0'}` }}>
                          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                            AI Settings: {aiSettingsLocked ? '✅ Configured' : '📝 Available'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#666' }}>
                            Email Domain: {emailDomain}
                          </div>
                          {profileCustomization && (
                            <div style={{ fontSize: '11px', color: '#666' }}>
                              Custom Instructions: {profileCustomization.length > 30 ? `${profileCustomization.substring(0, 30)}...` : profileCustomization}
                            </div>
                          )}
                        </div>

                        {/* Progress */}
                        <div style={{ padding: '8px', backgroundColor: '#f0f8ff', borderRadius: '4px', border: '1px solid #2196f3' }}>
                          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                            Progress: Step {currentStep}/7
                          </div>
                          <div style={{ fontSize: '12px', color: '#666' }}>
                            {currentStep >= 7 ? 'Configuration Complete - Ready for Profile Creation' : 'Configuration In Progress'}
                          </div>
                        </div>
                      </Flex>
                    </Well>

                    {/* Session Information (Placeholder for future implementation) */}
                    <Well backgroundColor="blue-50" padding="size-200">
                      <Flex direction="column" gap="size-100">
                        <Text><strong>💾 Session Information:</strong></Text>
                        <Text size="S">Only one session is saved at a time. If you want to start over, press the "Clear Session" button.</Text>
                        <Text size="S">• Auto-save progress</Text>
                      </Flex>
                    </Well>

                    {/* Next Steps */}
                    <Well backgroundColor="green-50" padding="size-200">
                      <Flex direction="column" gap="size-100">
                        <Text><strong>🚀 Next Steps:</strong></Text>
                        {currentStep < 7 ? (
                          <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                            <div>1. Go to <strong>Configuration</strong> tab to set up your AEP connection</div>
                            <div>2. Complete all 6 configuration steps</div>
                            <div>3. Start the golden profile creation workflow</div>
                          </div>
                        ) : (
                          <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                            <div><strong>✅ Configuration Complete!</strong></div>
                            <div>• Use <strong>Field Selection</strong> to choose schema fields</div>
                            <div>• Use <strong>Profile Creation</strong> to generate your profile</div>
                            <div>• Use <strong>Review & Inject</strong> to inject into AEP</div>
                          </div>
                        )}
                      </Flex>
                    </Well>

                    <Flex gap="size-200" marginTop="size-200">
                      {currentStep < 7 ? (
                        <Button variant="cta" onPress={() => setActiveTab('configuration')}>
                          ⚙️ Go to Configuration →
                        </Button>
                      ) : (
                        <Button variant="cta" onPress={() => setActiveTab('field-selection')}>
                          🪓 Continue to Field Selection →
                        </Button>
                      )}
                    </Flex>
                  </Flex>
                </Well>
              </View>
            </Item>

            <Item key="configuration">
              <View marginTop="size-300">
                {/* Step 1: Sandbox Selection */}
                <Well>
                  <Flex direction="column" gap="size-200">
                    <Flex justifyContent="space-between" alignItems="center">
                      <Heading level={3}>
                        <Badge variant={currentStep >= 1 ? 'positive' : 'neutral'}>1</Badge> Sandbox Selection
                      </Heading>
                      {sandboxLocked && (
                        <ActionButton onPress={unlockSandbox} variant="secondary">
                          Unlock
                        </ActionButton>
                      )}
                    </Flex>

                    {/* Show current sandbox if locked */}
                    {sandboxLocked && selectedSandbox && (
                      <Well backgroundColor="positive" padding="size-150" marginBottom="size-200">
                        <Flex direction="row" alignItems="center" justifyContent="space-between">
                          <Flex direction="column">
                            <Text>
                              ✅ Sandbox Configured
                            </Text>
                            <Text size="S">
                              {sandboxes.find(s => s.name === selectedSandbox)?.title || selectedSandbox}
                            </Text>
                            <Text size="S">
                              Name: {selectedSandbox}
                            </Text>
                          </Flex>
                          <ActionButton onPress={unlockSandbox} variant="secondary">
                            Change Sandbox
                          </ActionButton>
                        </Flex>
                      </Well>
                    )}

                    {!sandboxLocked && (
                      <Flex gap="size-200" alignItems="end">
                        <Picker
                          label="Select Sandbox"
                          placeholder="Choose a sandbox..."
                          selectedKey={selectedSandbox}
                          onSelectionChange={setSelectedSandbox}
                          isDisabled={sandboxLocked}
                          width="300px"
                          onOpenChange={(isOpen) => {
                            if (isOpen && sandboxes.length === 0) {
                              loadSandboxes()
                            }
                          }}
                        >
                          {sandboxLoading ? (
                            <Item key="loading">Loading sandboxes...</Item>
                          ) : (
                            sandboxes.map(sandbox => (
                              <Item key={sandbox.name}>{sandbox.name}</Item>
                            ))
                          )}
                        </Picker>

                        <Button
                          variant="cta"
                          onPress={lockSandbox}
                          isDisabled={!selectedSandbox || sandboxLocked}
                        >
                          Lock Sandbox
                        </Button>
                      </Flex>
                    )}
                  </Flex>
                </Well>

                {/* Step 2: Schema Selection */}
                <Well>
                  <Flex direction="column" gap="size-200">
                    <Flex justifyContent="space-between" alignItems="center">
                      <Heading level={3}>
                        <Badge variant={currentStep >= 2 ? 'positive' : 'neutral'}>2</Badge> Schema Selection (Profile Only)
                      </Heading>
                      {schemaLocked && (
                        <ActionButton onPress={unlockSchema} variant="secondary">
                          Unlock
                        </ActionButton>
                      )}
                    </Flex>

                    {/* Show current schema if locked */}
                    {schemaLocked && selectedSchema && (
                      <Well backgroundColor="positive" padding="size-150" marginBottom="size-200">
                        <Flex direction="row" alignItems="center" justifyContent="space-between">
                          <Flex direction="column">
                            <Text>
                              ✅ Schema Configured
                            </Text>
                            <Text size="S">
                              {schemaDetails?.title || schemas.find(s => s.id === selectedSchema)?.title || 'Unknown Schema'}
                            </Text>
                            <Text size="S">
                              ID: {selectedSchema}
                            </Text>
                            {schemaDetails && (
                              <Text size="S">
                                Fields: {Object.keys(schemaDetails.fields || {}).length || 'Loading...'}
                              </Text>
                            )}
                          </Flex>
                          <ActionButton onPress={unlockSchema} variant="secondary">
                            Change Schema
                          </ActionButton>
                        </Flex>
                      </Well>
                    )}

                    {!schemaLocked && (
                      <Flex gap="size-200" alignItems="end">
                        <Picker
                          label="Select Profile Schema"
                          placeholder={schemaLoading ? "Loading schemas..." : (schemas.length === 0 ? "Click to load schemas..." : "Choose a Profile schema...")}
                          selectedKey={selectedSchema}
                          onSelectionChange={setSelectedSchema}
                          isDisabled={!sandboxLocked || schemaLocked || schemaLoading}
                          width="400px"
                          onOpenChange={(isOpen) => {
                            console.log(`🎯 Schema picker interaction:`, {
                              isOpen,
                              sandboxLocked,
                              schemaLocked,
                              schemaCount: schemas.length,
                              schemaLoading
                            })
                            if (isOpen && sandboxLocked && !schemaLocked && schemas.length === 0 && !schemaLoading) {
                              console.log('🔄 Auto-triggering schema load...')
                              loadSchemas()
                            }
                          }}
                        >
                          {schemaLoading ? (
                            <Item key="loading">⏳ Loading Profile schemas...</Item>
                          ) : schemas.length === 0 ? (
                            <Item key="empty">No schemas loaded. Click 'Load Schemas' button.</Item>
                          ) : (
                            schemas.map(schema => (
                              <Item key={schema.id} textValue={schema.title}>
                                {schema.title}
                              </Item>
                            ))
                          )}
                        </Picker>

                        <Button
                          variant="cta"
                          onPress={lockSchema}
                          isDisabled={!selectedSchema || !sandboxLocked || schemaLocked}
                        >
                          Lock Schema
                        </Button>
                      </Flex>
                    )}

                    {schemas.length > 0 && !schemaLoading && (
                      <Well>
                        <Text size="S">
                          ✅ Found {schemas.length} Profile schema{schemas.length === 1 ? '' : 's'} in sandbox "{selectedSandbox}"
                        </Text>
                      </Well>
                    )}
                  </Flex>
                </Well>


                {/* Step 5: AI Generation Settings */}
                <Well>
                  <Flex direction="column" gap="size-200">
                    <Flex justifyContent="space-between" alignItems="center">
                      <Heading level={3}>
                        <Badge variant={currentStep >= 3 ? 'positive' : 'neutral'}>3</Badge> AI Generation Settings
                      </Heading>
                      {aiSettingsLocked && (
                        <ActionButton onPress={unlockAiSettings} variant="secondary">
                          Unlock
                        </ActionButton>
                      )}
                    </Flex>

                    <Flex direction="column" gap="size-200">
                      <Text>Configure settings for AI-powered profile generation.</Text>

                      {/* Email Domain Selection */}
                      <Picker
                        label="Email Domain"
                        selectedKey={emailDomain}
                        onSelectionChange={setEmailDomain}
                        isDisabled={!schemaLocked || aiSettingsLocked}
                        width="300px"
                      >
                        {emailDomainOptions.map((domain) => (
                          <Item key={domain}>{domain}</Item>
                        ))}
                      </Picker>

                      {/* AI Customization Prompt */}
                      <TextArea
                        label="AI Customization Instructions (Optional)"
                        placeholder="Examples:&#10;• Generate female customer aged 25-35&#10;• Create luxury brand preferences&#10;• Focus on high-income demographic&#10;• Include specific product interests"
                        value={profileCustomization}
                        onChange={setProfileCustomization}
                        width="100%"
                        height="100px"
                        isDisabled={!schemaLocked || aiSettingsLocked}
                        description="Provide specific instructions to guide AI profile generation. Keep under 200 characters for best results."
                        validationState={profileCustomization && profileCustomization.length > 200 ? "invalid" : "valid"}
                        errorMessage={profileCustomization && profileCustomization.length > 200 ? "Please keep instructions under 200 characters for best results" : ""}
                      />

                      {profileCustomization && (
                        <Text size="S" color="gray-600">
                          Characters: {profileCustomization.length}/200 • {profileCustomization.length > 0 ? 'Custom instructions will be applied' : 'Using default AI generation'}
                        </Text>
                      )}

                      <Well backgroundColor="blue-100" padding="size-200">
                        <Text size="S">
                          <strong>ℹ️ AI Generation Settings:</strong> These settings will be used when generating AI-powered profiles.
                          The email domain determines the format of generated email addresses, and customization instructions
                          help the AI create profiles that match your specific requirements.
                        </Text>
                      </Well>

                      <Button
                        variant={aiSettingsLocked ? "secondary" : "cta"}
                        onPress={aiSettingsLocked ? unlockAiSettings : lockAiSettings}
                        isDisabled={!schemaLocked || (!emailDomain && !aiSettingsLocked)}
                      >
                        {aiSettingsLocked ? "✓ Settings Configured" : "✅ Save AI Settings & Continue"}
                      </Button>
                    </Flex>
                  </Flex>
                </Well>

                {/* Step 6: Configuration Complete */}
                {aiSettingsLocked && (
                  <Well>
                    <Flex direction="column" gap="size-200">
                      <Heading level={3}>
                        <Badge variant="positive">4</Badge> Configuration Complete
                      </Heading>

                      <Flex direction="column" gap="size-200">
                        <StatusLight variant="positive">
                          🎉 All configuration steps completed successfully!
                        </StatusLight>

                        <Text>
                          Your AEP Profile Injector is now fully configured and ready. Click below to start the golden profile creation workflow.
                        </Text>

                        <Button
                          variant="cta"
                          onPress={() => {
                            setCurrentStep(7)  // Updated to step 7
                            setActiveTab('field-selection')
                            showFeedback('positive', 'Configuration complete! Starting profile creation workflow...')
                          }}
                        >
                          🚀 Start Golden Profile Creation
                        </Button>
                      </Flex>
                    </Flex>
                  </Well>
                )}
              </View>
            </Item>

            <Item key="field-selection">
              <View marginTop="size-300">
                <Flex direction="column" gap="size-200">
                  <Heading level={3}>🪓 Schema Field Selection</Heading>
                  <Text>Review and customize which fields to include in your profile generation. Uncheck fields you don't want to include.</Text>

                  {sampleDataLoading && (
                    <Well>
                      <Text>Loading schema structure...</Text>
                    </Well>
                  )}

                  {sampleData && (
                    <View>
                      <Flex direction="row" justifyContent="space-between" alignItems="center" marginBottom="size-200">
                        <Switch isSelected={pruningEnabled} onChange={setPruningEnabled}>
                          Enable field pruning (recommended)
                        </Switch>
                        <Text size="S" color="gray-600">
                          {Object.keys(prunedFields).filter(key => prunedFields[key] === false).length} fields excluded
                        </Text>
                      </Flex>

                      {pruningEnabled && (
                        <Well backgroundColor="gray-100" padding="size-200">
                          <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                            {renderTreeNodes(buildTreeNodesFromSample(sampleData))}
                          </div>
                        </Well>
                      )}

                      <Flex justifyContent="space-between" marginTop="size-200">
                        <Button variant="secondary" onPress={() => setActiveTab('overview')}>
                          ← Back to Overview
                        </Button>
                        <Button variant="primary" onPress={() => setActiveTab('profile-creation')}>
                          Next: Profile Creation →
                        </Button>
                      </Flex>
                    </View>
                  )}

                  {!sampleData && !sampleDataLoading && (
                    <Well>
                      <Text>No sample data available for this schema. You can still proceed to profile generation.</Text>
                      <Flex justifyContent="space-between" marginTop="size-200">
                        <Button variant="secondary" onPress={() => setActiveTab('overview')}>
                          ← Back to Overview
                        </Button>
                        <Button variant="primary" onPress={() => setActiveTab('profile-creation')}>
                          Next: Profile Creation →
                        </Button>
                      </Flex>
                    </Well>
                  )}
                </Flex>
              </View>
            </Item>

            <Item key="profile-creation">
              <View marginTop="size-300">
                <Flex direction="column" gap="size-200">
                  <Heading level={3}>🎯 Profile Creation</Heading>

                  {/* Enhanced Mode Selection */}
                  <Well>
                    <Flex direction="column" gap="size-200">
                      <Text><strong>Choose Creation Mode:</strong></Text>
                      <RadioGroup
                        value={isManualMode ? 'manual' : 'ai'}
                        onChange={(value) => setIsManualMode(value === 'manual')}
                      >
                        <Radio value="ai">🤖 AI-Powered Generation (Recommended)</Radio>
                        <Radio value="manual">✏️ Manual Template Creation</Radio>
                      </RadioGroup>

                      {!isManualMode && (
                        <View backgroundColor="blue-100" padding="size-100" borderRadius="medium">
                          <Text size="S">
                            <strong>AI Mode:</strong> Automatically generates realistic profile data based on your schema structure and customization preferences.
                          </Text>
                        </View>
                      )}

                      {isManualMode && (
                        <View backgroundColor="orange-100" padding="size-100" borderRadius="medium">
                          <Text size="S">
                            <strong>Manual Mode:</strong> Creates an empty template that you can fill in with your own data using the JSON editor.
                          </Text>
                        </View>
                      )}
                    </Flex>
                  </Well>

                  {!isManualMode && (
                    <Flex direction="column" gap="size-200">
                      <Well backgroundColor="blue-100" padding="size-200">
                        <Text size="S">
                          <strong>✨ AI Generation Ready:</strong> Using email domain "{emailDomain}"
                          {profileCustomization && ` with custom instructions: "${profileCustomization}"`}
                          {!profileCustomization && " with default generation settings"}
                        </Text>
                      </Well>

                      <Button
                        variant="cta"
                        onPress={generateProfile}
                        isDisabled={isProcessing}
                        width="300px"
                      >
                        {isProcessing ? '⏳ Generating AI Profile...' : '🤖 Generate AI Profile'}
                      </Button>

                      {isProcessing && (
                        <Well>
                          <Text size="S">
                            🤖 AI is analyzing your schema and generating realistic profile data... This may take up to 90 seconds.
                          </Text>
                        </Well>
                      )}
                    </Flex>
                  )}

                  {isManualMode && (
                    <Flex direction="column" gap="size-200">
                      <Heading level={4}>✏️ Manual Template Creation</Heading>

                      <Well>
                        <Text>
                          Manual mode creates an empty template based on your schema structure.
                          You'll fill in the values yourself using the interactive JSON editor in the Review tab.
                        </Text>
                      </Well>

                      <Button
                        variant="primary"
                        onPress={() => {
                          console.log('Creating manual template...')
                          const template = getTemplateForGeneration()
                          if (template) {
                            setEditableProfile(template)
                            setGeneratedProfile(template) // Set for consistency

                            // Auto-validate the manual template
                            const validation = validateProfileAgainstSchema(template)
                            setValidationResults(validation)

                            setActiveTab('review-inject')

                            if (validation.isValid) {
                              showFeedback('positive', 'Manual template created and validated! Edit it in the Review tab.')
                            } else {
                              showFeedback('negative', `Manual template created with ${validation.invalidFields.length} validation issue(s). Review and clean before injection.`)
                            }
                          } else {
                            showError('Unable to create template. Please ensure schema is properly loaded.')
                          }
                        }}
                        width="300px"
                      >
                        ✏️ Create Manual Template
                      </Button>
                    </Flex>
                  )}

                  <Flex justifyContent="space-between" marginTop="size-200">
                    <Button variant="secondary" onPress={() => setActiveTab('field-selection')}>
                      ← Back: Field Selection
                    </Button>
                    {(generatedProfile || editableProfile) && (
                      <Button variant="primary" onPress={() => setActiveTab('review-inject')}>
                        Next: Review & Inject →
                      </Button>
                    )}
                  </Flex>
                </Flex>
              </View>
            </Item>

            <Item key="review-inject">
              <View marginTop="size-300">
                <Flex direction="column" gap="size-200">
                  <Heading level={3}>🏆 Review & Inject Profile</Heading>

                  {(generatedProfile || editableProfile) && (
                    <View>
                      {/* Schema Validation Panel */}
                      <Well backgroundColor="blue-50" padding="size-200" marginBottom="size-200">
                        <Flex direction="column" gap="size-200">
                          <Flex justifyContent="space-between" alignItems="center">
                            <Heading level={4}>🔍 Schema Validation</Heading>
                            <Flex gap="size-100">
                              <Button
                                variant="secondary"
                                onPress={runProfileValidation}
                                isDisabled={isProcessing}
                              >
                                🔍 Validate Profile
                              </Button>
                              {validationResults && !validationResults.isValid && (
                                <Button
                                  variant="primary"
                                  onPress={cleanProfile}
                                  isDisabled={isProcessing}
                                >
                                  🧹 Clean Invalid Fields
                                </Button>
                              )}
                            </Flex>
                          </Flex>

                          {validationResults ? (
                            <View>
                              {validationResults.isValid ? (
                                <Well backgroundColor="positive" padding="size-150">
                                  <Flex alignItems="center" gap="size-100">
                                    <StatusLight variant="positive">Valid</StatusLight>
                                    <Text><strong>✅ Profile validation passed!</strong> All fields match the schema structure.</Text>
                                  </Flex>
                                </Well>
                              ) : (
                                <View>
                                  <Well backgroundColor="negative" padding="size-150" marginBottom="size-100">
                                    <Flex alignItems="center" gap="size-100">
                                      <StatusLight variant="negative">Issues Found</StatusLight>
                                      <Text><strong>⚠️ {validationResults.invalidFields.length} validation issue(s) found</strong></Text>
                                    </Flex>
                                  </Well>

                                  {/* Invalid Fields Details */}
                                  <View backgroundColor="gray-100" padding="size-150" borderRadius="medium">
                                    <Heading level={5} marginBottom="size-100">Invalid Fields:</Heading>
                                    <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '12px' }}>
                                      {validationResults.invalidFields.map((field, index) => (
                                        <div key={index} style={{ marginBottom: '8px', padding: '8px', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #e5e5e5' }}>
                                          <div style={{ fontWeight: 'bold', color: '#dc2626' }}>
                                            {field.path}
                                          </div>
                                          <div style={{ color: '#6b7280', marginTop: '2px' }}>
                                            {field.reason}
                                          </div>
                                          <div style={{ color: '#374151', marginTop: '2px', fontFamily: 'monospace' }}>
                                            Value: {JSON.stringify(field.value)}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </View>

                                  {validationResults.suggestions.length > 0 && (
                                    <View backgroundColor="orange-100" padding="size-150" borderRadius="medium" marginTop="size-100">
                                      <Heading level={5} marginBottom="size-100">Suggestions:</Heading>
                                      <div style={{ fontSize: '12px' }}>
                                        {validationResults.suggestions.slice(0, 5).map((suggestion, index) => (
                                          <div key={index} style={{ marginBottom: '4px' }}>
                                            • {suggestion}
                                          </div>
                                        ))}
                                      </div>
                                    </View>
                                  )}
                                </View>
                              )}
                            </View>
                          ) : (
                            <Text size="S">
                              <strong>💡 Recommendation:</strong> Validate your profile against the schema before injection to ensure compatibility with Experience Platform.
                            </Text>
                          )}
                        </Flex>
                      </Well>

                      {/* Profile Editor */}
                      <JsonEditor
                        data={editableProfile || generatedProfile}
                        onChange={(updatedProfile) => {
                          setEditableProfile(updatedProfile)
                          if (generatedProfile) {
                            setGeneratedProfile(updatedProfile)
                          }
                          // Clear validation results when profile is edited
                          if (validationResults) {
                            setValidationResults(null)
                            setShowValidation(false)
                          }
                        }}
                        title="Golden Profile Editor"
                        allowPruning={true}
                      />

                      <Flex direction="row" gap="size-200" justifyContent="center" marginTop="size-200">
                        <Button
                          variant="cta"
                          onPress={() => { const profileToInject = editableProfile || generatedProfile; if (!profileToInject) { showError("No profile available for injection. Please generate a profile first."); return; } const validation = validateProfileAgainstSchema(profileToInject); if (!validation.isValid) { showError(`Profile validation failed. Please resolve ${validation.invalidFields.length} issue(s) before proceeding.`); return; } setShowProfileRouting(true); setActiveTab("profile-routing"); showFeedback("positive", "Profile validated successfully! Now configure routing components for injection."); }}
                          isDisabled={isProcessing || (validationResults && !validationResults.isValid)}
                        >
                          {isProcessing ? '⏳ Injecting...' : '✅ Inject Profile into AEP'}
                        </Button>
                      </Flex>

                      {validationResults && !validationResults.isValid && (
                        <Well backgroundColor="orange-100" padding="size-150" marginTop="size-100">
                          <Text size="S">
                            <strong>⚠️ Injection blocked:</strong> Please resolve validation issues before injecting. Use "Clean Invalid Fields" to automatically remove problematic fields.
                          </Text>
                        </Well>
                      )}
                    </View>
                  )}

                  {!generatedProfile && !editableProfile && (
                    <Well>
                      <Text>No profile ready for review. Please generate or create a profile first.</Text>
                    </Well>
                  )}

                  <Flex justifyContent="space-between" marginTop="size-200">
                    <Button variant="secondary" onPress={() => setActiveTab('profile-creation')}>
                      ← Back: Profile Creation
                    </Button>
                    {injectionResults && (
                      <Button variant="primary" onPress={() => setActiveTab('results')}>
                        View Results →
                      </Button>
                    )}
                  </Flex>
                </Flex>
              </View>
            </Item>

            {injectionResults && (
              <Item key="results">
                <View marginTop="size-300">
                  <Flex direction="column" gap="size-200">
                    <Flex direction="row" justifyContent="space-between" alignItems="center">
                      <Heading level={3}>📊 Injection Results</Heading>
                      <Button
                        variant="primary"
                        onPress={debugProfileIngestion}
                        isDisabled={isDebugging || (!createdDataset && !selectedDataset && !routingDataset) || !selectedSchema}
                      >
                        {isDebugging ? '🔍 Running Debug...' : '🔍 Debug Profile Visibility'}
                      </Button>
                    </Flex>

                    <JsonEditor
                      data={injectionResults}
                      title="AEP Injection Response"
                      onChange={() => { }} // Read-only for review
                    />

                    {/* Debug Analysis Results */}
                    {debugResults && (
                      <View marginTop="size-300">
                        <div style={{ marginTop: '16px' }}>
                          <h4 style={{ margin: '0 0 16px 0', color: '#333' }}>📊 Post-Injection Analysis</h4>

                          {/* Summary Information */}
                          {debugResults.summary && (
                            <div style={{
                              border: '2px solid #22c55e',
                              borderRadius: '6px',
                              padding: '16px',
                              marginBottom: '16px',
                              backgroundColor: '#f0fff4'
                            }}>
                              <h5 style={{ margin: '0 0 8px 0', color: '#333' }}>📈 Configuration Summary</h5>
                              <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
                                <div><strong>Dataset Profile Enabled:</strong> {debugResults.summary.datasetProfileEnabled ? '✅ Yes' : '❌ No'}</div>
                                <div><strong>Schema Profile Enabled:</strong> {debugResults.summary.schemaProfileEnabled ? '✅ Yes' : '❌ No'}</div>
                                <div><strong>Has Identity Fields:</strong> {debugResults.summary.hasIdentityFields ? '✅ Yes' : '❌ No'}</div>
                                <div><strong>Recent Batches:</strong> {debugResults.summary.recentBatches || 0}</div>
                                <div><strong>Recommendations:</strong> {debugResults.summary.recommendationsCount || 0} issues found</div>
                              </div>
                            </div>
                          )}

                          {/* Dataset Information */}
                          <div style={{
                            border: '2px solid #2196f3',
                            borderRadius: '6px',
                            padding: '16px',
                            marginBottom: '16px',
                            backgroundColor: '#f8f9fa'
                          }}>
                            <h5 style={{ margin: '0 0 8px 0', color: '#333' }}>📊 Dataset Information</h5>
                            <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
                              <div><strong>Dataset ID:</strong> {(routingDataset?.id || createdDataset?.id || selectedDataset) || 'N/A'}</div>
                              {routingDataset?.id === (routingDataset?.id || createdDataset?.id || selectedDataset) && (
                                <div style={{ fontSize: '12px', color: '#22c55e', fontWeight: 'bold' }}>
                                  🚀 Using Routing Dataset
                                </div>
                              )}
                              <div><strong>Dataset Name:</strong> {debugResults.debug?.checks?.dataset?.name || 'N/A'}</div>
                              <div><strong>Status:</strong> {debugResults.debug?.checks?.dataset?.state || 'N/A'}</div>
                              <div><strong>Record Count:</strong> {debugResults.debug?.checks?.dataset?.recordCount || 'N/A'}</div>
                              <div><strong>Profile Enabled:</strong> {debugResults.debug?.checks?.dataset?.profileEnabled ? '✅ Yes' : '❌ No'}</div>
                              <div><strong>Identity Enabled:</strong> {debugResults.debug?.checks?.dataset?.identityEnabled ? '✅ Yes' : '❌ No'}</div>
                              <div><strong>Dataset Exists:</strong> {debugResults.debug?.checks?.dataset?.exists ? '✅ Yes' : '❌ No'}</div>
                              <div><strong>Analysis Time:</strong> {new Date().toLocaleString()}</div>
                            </div>
                          </div>

                          {/* Enhanced Recent Batches Information */}
                          {debugResults.debug?.checks?.batches && (
                            <div style={{
                              border: '2px solid #2196f3',
                              borderRadius: '6px',
                              padding: '16px',
                              marginBottom: '16px',
                              backgroundColor: '#f8f9fa'
                            }}>
                              <h5 style={{ margin: '0 0 8px 0', color: '#333' }}>📥 Enhanced Batch Search Results</h5>
                              <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
                                <div><strong>Total Batches Found:</strong> {debugResults.debug.checks.batches.totalFound || 0}</div>

                                {/* Search Methods Summary */}
                                {debugResults.debug.checks.batches.searchMethods && (
                                  <div style={{ marginTop: '8px', marginBottom: '12px' }}>
                                    <strong>Search Methods Used:</strong>
                                    <div style={{ marginLeft: '16px', fontSize: '12px', color: '#666' }}>
                                      • Catalog API (dataset filter): {debugResults.debug.checks.batches.searchMethods.catalog || 0} batches<br />
                                      • Catalog API (all recent): {debugResults.debug.checks.batches.searchMethods.catalogAll || 0} dataset matches<br />
                                      • Data Ingestion API: {debugResults.debug.checks.batches.searchMethods.ingestion || 0} batches<br />
                                      • Streaming Status API: {debugResults.debug.checks.batches.searchMethods.streaming || 0} entries
                                    </div>
                                  </div>
                                )}

                                {debugResults.debug.checks.batches.recent && debugResults.debug.checks.batches.recent.length > 0 ? (
                                  <div style={{ marginTop: '12px' }}>
                                    <strong>Recent Batches Found:</strong>
                                    {debugResults.debug.checks.batches.recent.map((batch, index) => (
                                      <div key={index} style={{
                                        marginTop: '8px',
                                        padding: '8px',
                                        backgroundColor: '#f0f0f0',
                                        borderRadius: '4px',
                                        fontSize: '13px',
                                        border: batch.source === 'catalog' ? '2px solid #22c55e' :
                                          batch.source === 'streaming' ? '2px solid #2196f3' :
                                            '1px solid #e0e0e0'
                                      }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <strong>Batch ID:</strong>
                                          <span style={{ fontSize: '11px', backgroundColor: '#e0e0e0', padding: '2px 6px', borderRadius: '3px' }}>
                                            {batch.source?.toUpperCase()}
                                          </span>
                                        </div>
                                        <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#666', marginBottom: '4px' }}>
                                          {batch.id}
                                        </div>
                                        <div><strong>Status:</strong>
                                          <span style={{
                                            color: batch.status === 'success' ? '#22c55e' :
                                              batch.status === 'loading' || batch.status === 'processing' ? '#ff9800' :
                                                '#ef4444',
                                            marginLeft: '8px',
                                            fontWeight: 'bold'
                                          }}>
                                            {batch.status?.toUpperCase()}
                                          </span>
                                        </div>
                                        <div><strong>Records:</strong> {batch.recordCount || 'unknown'}
                                          {(batch.successfulRecords > 0 || batch.failedRecords > 0) && (
                                            <span style={{ fontSize: '11px', color: '#666', marginLeft: '8px' }}>
                                              (✅{batch.successfulRecords} ❌{batch.failedRecords})
                                            </span>
                                          )}
                                        </div>
                                        <div><strong>Created:</strong> {batch.created !== 'unknown' ? new Date(batch.created).toLocaleString() : 'Unknown'}</div>
                                        {batch.completed && batch.completed !== 'unknown' && (
                                          <div><strong>Completed:</strong> {new Date(batch.completed).toLocaleString()}</div>
                                        )}
                                        {batch.dataSetId && (
                                          <div style={{ fontSize: '11px', color: '#666' }}>
                                            <strong>Dataset ID:</strong> {batch.dataSetId === (createdDataset?.id || selectedDataset) ? '✅ MATCH' : '⚠️ Different'}
                                            ({batch.dataSetId.substring(0, 20)}...)
                                          </div>
                                        )}
                                        {batch.errors && batch.errors.length > 0 && (
                                          <div style={{
                                            backgroundColor: '#fff3cd',
                                            border: '1px solid #ffc107',
                                            borderRadius: '4px',
                                            padding: '8px',
                                            marginTop: '8px'
                                          }}>
                                            <strong>Errors ({batch.errors.length}):</strong>
                                            {batch.errors.slice(0, 3).map((error, errorIndex) => (
                                              <div key={errorIndex} style={{ color: '#856404', fontSize: '12px' }}>
                                                • {typeof error === 'object' ?
                                                  (error.description || error.message || error.code || JSON.stringify(error)) :
                                                  error}
                                              </div>
                                            ))}
                                            {batch.errors.length > 3 && (
                                              <div style={{ fontSize: '11px', color: '#856404', fontStyle: 'italic' }}>
                                                ... and {batch.errors.length - 3} more errors
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div style={{
                                    marginTop: '12px',
                                    padding: '12px',
                                    backgroundColor: '#fff3cd',
                                    border: '2px solid #ffc107',
                                    borderRadius: '4px'
                                  }}>
                                    <strong>⚠️ No Batches Found</strong>
                                    <div style={{ fontSize: '12px', marginTop: '4px', color: '#856404' }}>
                                      Despite searching multiple APIs, no ingestion batches were found for this dataset.
                                      This could indicate:
                                      <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                                        <li>Profile data hasn't reached AEP yet (normal delay: 5-10 minutes)</li>
                                        <li>Streaming connector configuration issues</li>
                                        <li>Data validation failures preventing batch creation</li>
                                        <li>Authentication or permission problems</li>
                                      </ul>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Recommendations */}
                          {debugResults.debug?.recommendations && debugResults.debug.recommendations.length > 0 && (
                            <div style={{
                              border: '2px solid #2196f3',
                              borderRadius: '6px',
                              padding: '16px',
                              marginTop: '16px',
                              backgroundColor: '#f8f9fa'
                            }}>
                              <h5 style={{ margin: '0 0 12px 0', color: '#333' }}>💡 Recommendations</h5>
                              {debugResults.debug.recommendations.map((rec, index) => (
                                <div key={index} style={{
                                  fontSize: '14px',
                                  marginBottom: '12px',
                                  padding: '12px',
                                  backgroundColor: rec.priority === 'HIGH' ? '#fff3cd' : '#f8f9fa',
                                  border: `2px solid ${rec.priority === 'HIGH' ? '#ffc107' : '#e0e0e0'}`,
                                  borderRadius: '4px'
                                }}>
                                  <div style={{
                                    fontWeight: 'bold',
                                    color: rec.priority === 'HIGH' ? '#856404' : '#333',
                                    marginBottom: '4px'
                                  }}>
                                    [{rec.priority}] {rec.issue}
                                  </div>
                                  <div style={{
                                    fontSize: '13px',
                                    color: rec.priority === 'HIGH' ? '#856404' : '#666'
                                  }}>
                                    💡 <strong>Solution:</strong> {rec.solution}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Raw Debug Data (Collapsible) */}
                          <details style={{ marginTop: '16px' }}>
                            <summary style={{
                              cursor: 'pointer',
                              fontSize: '14px',
                              color: '#666',
                              padding: '8px',
                              backgroundColor: '#f0f0f0',
                              borderRadius: '4px'
                            }}>
                              🔍 View Raw Debug Data
                            </summary>
                            <div style={{
                              backgroundColor: '#f8f9fa',
                              border: '1px solid #e0e0e0',
                              borderRadius: '4px',
                              padding: '12px',
                              marginTop: '8px',
                              fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                              fontSize: '11px',
                              maxHeight: '300px',
                              overflow: 'auto'
                            }}>
                              {JSON.stringify(debugResults, null, 2)}
                            </div>
                          </details>
                        </div>
                      </View>
                    )}

                    <Flex justifyContent="start" marginTop="size-200">
                      <Button variant="secondary" onPress={() => setActiveTab('review-inject')}>
                        ← Back: Review & Inject
                      </Button>
                    </Flex>
                  </Flex>
                </View>
              </Item>
            )}
            <Item key="profile-routing">
              <View marginTop="size-300">
                <Flex direction="column" gap="size-200">
                  <Heading level={3}>🚀 Profile Routing Configuration</Heading>
                  <Text>Create new routing components specifically for this profile injection. This ensures clean separation and dedicated routing for your profile data.</Text>

                  {/* Step 1: Create Routing Dataset */}
                  <Well>
                    <Flex direction="column" gap="size-200">
                      <Heading level={4}>📊 Step 1: Create Routing Dataset</Heading>
                      <Text>Create a new dataset specifically for routing this profile to AEP.</Text>

                      {routingDataset ? (
                        <Well backgroundColor="positive" padding="size-150">
                          <Flex direction="row" alignItems="center" justifyContent="space-between">
                            <Flex direction="column">
                              <Text>✅ Routing Dataset Created</Text>
                              <Text size="S">Name: {routingDataset.name}</Text>
                              <Text size="S">ID: {routingDataset.id}</Text>
                            </Flex>
                            <StatusLight variant="positive">Ready</StatusLight>
                          </Flex>
                        </Well>
                      ) : (
                        <Flex gap="size-200" alignItems="end">
                          <Text>Create a new dataset for profile routing:</Text>
                          <Button
                            variant="primary"
                            onPress={createRoutingDataset}
                            isDisabled={isCreatingRoutingDataset}
                          >
                            {isCreatingRoutingDataset ? 'Creating...' : 'Create Routing Dataset'}
                          </Button>
                        </Flex>
                      )}
                    </Flex>
                  </Well>

                  {/* Step 2: Create Routing Connector */}
                  <Well>
                    <Flex direction="column" gap="size-200">
                      <Heading level={4}>🔗 Step 2: Create Routing Connector</Heading>
                      <Text>Create a new streaming connector with dataflow specifically for this profile routing.</Text>

                      {routingConnector ? (
                        <Well backgroundColor="positive" padding="size-150">
                          <Flex direction="row" alignItems="center" justifyContent="space-between">
                            <Flex direction="column">
                              <Text>✅ Routing Connector Created</Text>
                              <Text size="S">Name: {routingConnector.name}</Text>
                              <Text size="S">ID: {routingConnector.id}</Text>
                            </Flex>
                            <StatusLight variant="positive">Ready</StatusLight>
                          </Flex>
                        </Well>
                      ) : (
                        <Flex gap="size-200" alignItems="end">
                          <Text>Create a new connector for profile routing:</Text>
                          <Button
                            variant="primary"
                            onPress={createRoutingConnector}
                            isDisabled={!routingDataset || isCreatingRoutingConnector}
                          >
                            {isCreatingRoutingConnector ? 'Creating Connector & Dataflow...' : 'Create Routing Connector'}
                          </Button>
                        </Flex>
                      )}
                    </Flex>
                  </Well>

                  {/* Step 3: Stream Profile */}
                  <Well>
                    <Flex direction="column" gap="size-200">
                      <Heading level={4}>🚀 Step 3: Stream Profile to AEP</Heading>
                      <Text>Stream the profile from the JSON editor to AEP using the new routing configuration.</Text>

                      {routingStreamingResults ? (
                        <Well backgroundColor="positive" padding="size-150">
                          <Flex direction="row" alignItems="center" justifyContent="space-between">
                            <Flex direction="column">
                              <Text>✅ Profile Successfully Streamed</Text>
                              <Text size="S">Profile injected via routing configuration</Text>
                            </Flex>
                            <StatusLight variant="positive">Complete</StatusLight>
                          </Flex>
                        </Well>
                      ) : (
                        <Flex gap="size-200" alignItems="end">
                          <Text>Stream profile using routing configuration:</Text>
                          <Button
                            variant="cta"
                            onPress={streamProfileToAEP}
                            isDisabled={!routingDataset || !routingConnector || isProcessing}
                          >
                            {isProcessing ? "Streaming..." : "🚀 Stream Profile to AEP"}
                          </Button>
                        </Flex>
                      )}
                    </Flex>
                  </Well>

                  {/* Multiple Streaming Options */}
                  {routingStreamingResults && (
                    <Well backgroundColor="blue-50" padding="size-200">
                      <Flex direction="column" gap="size-200">
                        <Heading level={4}>🔄 Multiple Profile Streaming</Heading>
                        <Text>Your routing configuration is ready! You can now stream multiple profiles using the same dataset and connector.</Text>

                        <Flex gap="size-200" alignItems="center">
                          <Button
                            variant="primary"
                            onPress={() => {
                              setRoutingStreamingResults(null)
                              showFeedback("info", "Ready to stream another profile with the same routing configuration")
                            }}
                            isDisabled={isProcessing}
                          >
                            🔄 Stream Another Profile
                          </Button>

                          <Button
                            variant="secondary"
                            onPress={() => {
                              setActiveTab("review-inject")
                              showFeedback("info", "Returned to profile editor. Modify the profile and return to stream again.")
                            }}
                            isDisabled={isProcessing}
                          >
                            ✏️ Edit Profile & Stream Again
                          </Button>

                          <Button
                            variant="secondary"
                            onPress={() => {
                              setRoutingStreamingResults(null)
                              setShowProfileRouting(false)
                              setActiveTab("profile-creation")
                              showFeedback("info", "Reset for new profile creation. You can create a new profile and use the same routing configuration.")
                            }}
                            isDisabled={isProcessing}
                          >
                            🆕 Create New Profile
                          </Button>
                        </Flex>

                        <Text size="S" color="gray-600">
                          💡 <strong>Tip:</strong> You can modify the profile in the Review & Inject tab and return here to stream the updated profile using the same routing configuration.
                        </Text>
                      </Flex>
                    </Well>
                  )}

                  {/* Navigation */}
                  <Flex justifyContent="space-between" marginTop="size-200">
                    <Button variant="secondary" onPress={() => setActiveTab("review-inject")}>
                      ← Back: Review & Inject
                    </Button>
                    <Flex gap="size-200">
                      {routingStreamingResults && (
                        <Button variant="primary" onPress={() => setActiveTab("results")}>
                          View Results →
                        </Button>
                      )}
                      {routingStreamingResults && (
                        <Button
                          variant="secondary"
                          onPress={() => {
                            setRoutingStreamingResults(null)
                            showFeedback("info", "Ready to stream another profile")
                          }}
                        >
                          Clear Results
                        </Button>
                      )}
                    </Flex>
                  </Flex>
                </Flex>
              </View>
            </Item>
          </TabPanels>            </Tabs>
      </Flex>
    </View>
  )
}

export default AEPProfileInjectorSimplified 
