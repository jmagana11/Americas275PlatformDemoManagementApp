import React, { useState, useEffect } from 'react'
import {
  View,
  Heading,
  Content,
  IllustratedMessage,
  Button,
  ProgressBar,
  Grid,
  Flex,
  Text,
  StatusLight,
  ActionButton,
  Well,
  Divider,
  CheckboxGroup,
  Checkbox,
  TextArea,
  Tabs,
  TabList,
  TabPanels,
  Item,
  ButtonGroup,
  Badge,
  TextField,
  Picker,
  Image,
  DialogContainer,
  Dialog,
  Heading as DialogHeading,
  Content as DialogContent,
  ButtonGroup as DialogButtonGroup
} from '@adobe/react-spectrum'
import DataUpload from '@spectrum-icons/workflow/DataUpload'
import CheckmarkCircle from '@spectrum-icons/workflow/CheckmarkCircle'
import Alert from '@spectrum-icons/workflow/Alert'
import Refresh from '@spectrum-icons/workflow/Refresh'
import Clock from '@spectrum-icons/workflow/Clock'
import SaveFloppy from '@spectrum-icons/workflow/SaveFloppy'
import FolderOpen from '@spectrum-icons/workflow/FolderOpen'
import Play from '@spectrum-icons/workflow/Play'
import ChevronLeft from '@spectrum-icons/workflow/ChevronLeft'
import ChevronRight from '@spectrum-icons/workflow/ChevronRight'
import ViewGrid from '@spectrum-icons/workflow/ViewGrid'
import ViewSingle from '@spectrum-icons/workflow/ViewSingle'
import Close from '@spectrum-icons/workflow/Close'
import Copy from '@spectrum-icons/workflow/Copy'
import Document from '@spectrum-icons/workflow/Document'
import { getActionUrlFromRuntime } from '../utils/actionUrls'

const ContentTemplateMigrator = ({ runtime, ims }) => {
  // Environment and sandbox states
  const [selectedSourceOrg, setSelectedSourceOrg] = useState('')
  const [selectedSourceSandbox, setSelectedSourceSandbox] = useState('')
  const [selectedTargetOrg, setSelectedTargetOrg] = useState('')
  const [selectedTargetSandbox, setSelectedTargetSandbox] = useState('')
  
  // Sandbox data states
  const [sourceSandboxes, setSourceSandboxes] = useState([])
  const [targetSandboxes, setTargetSandboxes] = useState([])
  const [isLoadingSourceSandboxes, setIsLoadingSourceSandboxes] = useState(false)
  const [isLoadingTargetSandboxes, setIsLoadingTargetSandboxes] = useState(false)
  
  // Template states
  const [templates, setTemplates] = useState([])
  const [selectedTemplates, setSelectedTemplates] = useState([])
  const [templateDataCache, setTemplateDataCache] = useState({}) // Cache for full template data
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)
  const [isMigrating, setIsMigrating] = useState(false)
  
  // UI states
  const [activeTab, setActiveTab] = useState('source')
  const [notification, setNotification] = useState(null)
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'list'
  const [selectedTemplateForPreview, setSelectedTemplateForPreview] = useState(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isLoadingTemplateDetails, setIsLoadingTemplateDetails] = useState(false)
  
  // Migration results
  const [migrationResults, setMigrationResults] = useState([])
  const [migrationStatus, setMigrationStatus] = useState('idle') // 'idle', 'in-progress', 'completed', 'error'
  
  // Fetch sandboxes when org changes
  useEffect(() => {
    setSelectedSourceSandbox('')
    if (selectedSourceOrg && environments[selectedSourceOrg]) {
      fetchSandboxes(selectedSourceOrg, environments[selectedSourceOrg], setSourceSandboxes, setIsLoadingSourceSandboxes)
    } else {
      setSourceSandboxes([])
    }
  }, [selectedSourceOrg])
  
  useEffect(() => {
    setSelectedTargetSandbox('')
    if (selectedTargetOrg && environments[selectedTargetOrg]) {
      fetchSandboxes(selectedTargetOrg, environments[selectedTargetOrg], setTargetSandboxes, setIsLoadingTargetSandboxes)
    } else {
      setTargetSandboxes([])
    }
  }, [selectedTargetOrg])
  
  // Environment configurations (similar to UserManagement.js)
  const environments = {
    MA1HOL: {
      environmentKey: 'MA1HOL',
      name: 'MA1HOL',
      tenant: 'adobedemoamericas275',
      emailDomain: 'ma1.aephandsonlabs.com'
    },
    POT5HOL: {
      environmentKey: 'POT5HOL',
      name: 'POT5HOL',
      tenant: 'adobeamericaspot5',
      emailDomain: 'pot5.aephandsonlabs.com'
    }
  }

  // Utility functions
  const showNotification = (type, message) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 5000)
  }

  const fetchSandboxes = async (org, environment, setSandboxes, setIsLoading) => {
    if (!org || !environment) return
    
    setIsLoading(true)
    try {
      const actionUrl = getActionUrlFromRuntime('get-org-sandboxes', runtime)
      const response = await fetch(actionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          org: org
        })
      })

      const result = await response.json()
      console.log('Sandbox API response:', result)
      
      // Handle different possible response structures
      let sandboxData = []
      if (result.body && result.body.sandboxes) {
        sandboxData = result.body.sandboxes
      } else if (result.body && result.body.data) {
        sandboxData = result.body.data
      } else if (result.body && Array.isArray(result.body)) {
        sandboxData = result.body
      } else if (result.sandboxes) {
        sandboxData = result.sandboxes
      } else if (Array.isArray(result)) {
        sandboxData = result
      } else if (result.data) {
        sandboxData = result.data
      }
      
      console.log('Parsed sandbox data:', sandboxData)
      if (sandboxData && sandboxData.length > 0) {
        const sandboxList = sandboxData.map(sandbox => ({
          key: sandbox.name,
          label: sandbox.title || sandbox.name,
          description: sandbox.description || ''
        }))
        console.log('Processed sandbox list:', sandboxList)
        setSandboxes(sandboxList)
        showNotification('success', `Found ${sandboxList.length} sandboxes for ${org}`)
      } else {
        console.log('No sandbox data found in response')
        showNotification('error', 'No sandboxes found for this organization')
        setSandboxes([])
      }
    } catch (error) {
      console.error('Error fetching sandboxes:', error)
      showNotification('error', 'Failed to fetch sandboxes')
      setSandboxes([])
    } finally {
      setIsLoading(false)
    }
  }

  const fetchTemplates = async () => {
    if (!selectedSourceOrg || !selectedSourceSandbox) {
      showNotification('error', 'Please select both source organization and sandbox')
      return
    }

    setIsLoadingTemplates(true)
    try {
      const actionUrl = getActionUrlFromRuntime('content-templates', runtime)
      const response = await fetch(actionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'list-templates',
          org: selectedSourceOrg,
          sandbox: selectedSourceSandbox
        })
      })

      const result = await response.json()
      
      if (result.success) {
        setTemplates(result.templates || [])
        showNotification('success', `Found ${result.templates?.length || 0} templates`)
      } else {
        showNotification('error', result.error || 'Failed to fetch templates')
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
      showNotification('error', 'Failed to fetch templates')
    } finally {
      setIsLoadingTemplates(false)
    }
  }

  const migrateTemplates = async () => {
    if (selectedTemplates.length === 0) {
      showNotification('error', 'Please select at least one template to migrate')
      return
    }

    if (!selectedTargetOrg || !selectedTargetSandbox) {
      showNotification('error', 'Please select both target organization and sandbox')
      return
    }

    // Check if we have all template data cached
    const missingTemplates = selectedTemplates.filter(id => !templateDataCache[id])
    
    if (missingTemplates.length > 0) {
      showNotification('error', `Missing template data for ${missingTemplates.length} templates. Please reselect them.`)
      return
    }

    setIsMigrating(true)
    setMigrationStatus('in-progress')
    setMigrationResults([])

    const results = []
    
    // Migrate each template individually using cached data
    for (const templateId of selectedTemplates) {
      try {
        const templateData = templateDataCache[templateId]
        console.log(`Migrating template ${templateId}:`, templateData)
        
        const actionUrl = getActionUrlFromRuntime('content-templates', runtime)
        const requestBody = {
          action: 'create-template',
          targetOrg: selectedTargetOrg,
          targetSandbox: selectedTargetSandbox,
          templateData: templateData
        }
        console.log(`Sending create-template request for ${templateId}:`, requestBody)
        
        const response = await fetch(actionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        })

        const result = await response.json()
        
        if (result.success) {
          results.push({
            templateId,
            templateName: templateData.name,
            success: true,
            newTemplateId: result.templateId
          })
          console.log(`Successfully migrated template ${templateId}`)
        } else {
          results.push({
            templateId,
            templateName: templateData.name,
            success: false,
            error: result.error || 'Failed to create template'
          })
          console.error(`Failed to migrate template ${templateId}:`, result.error)
        }
      } catch (error) {
        console.error(`Error migrating template ${templateId}:`, error)
        results.push({
          templateId,
          templateName: templateDataCache[templateId]?.name || templateId,
          success: false,
          error: error.message
        })
      }
    }

    setMigrationResults(results)
    setMigrationStatus('completed')
    
    const successfulCount = results.filter(r => r.success).length
    const failedCount = results.filter(r => !r.success).length
    
    if (failedCount === 0) {
      showNotification('success', `Successfully migrated all ${successfulCount} templates`)
    } else {
      showNotification('error', `Migrated ${successfulCount} templates, ${failedCount} failed`)
    }
    
    setIsMigrating(false)
  }

  const handleTemplateSelection = async (templateId, isSelected) => {
    if (isSelected) {
      // Add to selected templates
      setSelectedTemplates(prev => [...prev, templateId])
      
      // Fetch and cache template data if not already cached
      if (!templateDataCache[templateId]) {
        try {
          const actionUrl = getActionUrlFromRuntime('content-templates', runtime)
          const requestBody = {
            action: 'get-template',
            org: selectedSourceOrg,
            sandbox: selectedSourceSandbox,
            templateId: templateId
          }
          
          const response = await fetch(actionUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
          })

          const result = await response.json()
          
          if (result.success) {
            setTemplateDataCache(prev => ({
              ...prev,
              [templateId]: result.template
            }))
            console.log(`Cached template data for ${templateId}:`, result.template)
          } else {
            console.error(`Failed to fetch template data for ${templateId}:`, result.error)
          }
        } catch (error) {
          console.error(`Error fetching template data for ${templateId}:`, error)
        }
      }
    } else {
      // Remove from selected templates
      setSelectedTemplates(prev => prev.filter(id => id !== templateId))
      
      // Optionally remove from cache to save memory
      setTemplateDataCache(prev => {
        const newCache = { ...prev }
        delete newCache[templateId]
        return newCache
      })
    }
  }

  const handleSelectAll = async () => {
    const allTemplateIds = templates.map(t => t.id)
    setSelectedTemplates(allTemplateIds)
    
    // Fetch and cache template data for all templates
    for (const templateId of allTemplateIds) {
      if (!templateDataCache[templateId]) {
        try {
          const actionUrl = getActionUrlFromRuntime('content-templates', runtime)
          const requestBody = {
            action: 'get-template',
            org: selectedSourceOrg,
            sandbox: selectedSourceSandbox,
            templateId: templateId
          }
          
          const response = await fetch(actionUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
          })

          const result = await response.json()
          
          if (result.success) {
            setTemplateDataCache(prev => ({
              ...prev,
              [templateId]: result.template
            }))
            console.log(`Cached template data for ${templateId}:`, result.template)
          } else {
            console.error(`Failed to fetch template data for ${templateId}:`, result.error)
          }
        } catch (error) {
          console.error(`Error fetching template data for ${templateId}:`, error)
        }
      }
    }
  }

  const handleDeselectAll = () => {
    setSelectedTemplates([])
  }

  const openTemplatePreview = async (template) => {
    setIsLoadingTemplateDetails(true)
    setIsPreviewOpen(true)
    
    // Check if we have cached data first
    if (templateDataCache[template.id]) {
      console.log('Using cached template data for preview:', templateDataCache[template.id])
      setSelectedTemplateForPreview(templateDataCache[template.id])
      setIsLoadingTemplateDetails(false)
      return
    }
    
    // If not cached, fetch it
    try {
      const actionUrl = getActionUrlFromRuntime('content-templates', runtime)
      const requestBody = {
        action: 'get-template',
        org: selectedSourceOrg,
        sandbox: selectedSourceSandbox,
        templateId: template.id
      }
      console.log('Sending request with body:', requestBody)
      
      const response = await fetch(actionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      const result = await response.json()
      console.log('Template details response:', result)
      
      if (result.success) {
        console.log('Template data:', result.template)
        // Cache the full template data for later use in migration
        setTemplateDataCache(prev => ({
          ...prev,
          [template.id]: result.template
        }))
        setSelectedTemplateForPreview(result.template)
      } else {
        showNotification('error', result.error || 'Failed to fetch template details')
        setIsPreviewOpen(false)
      }
    } catch (error) {
      console.error('Error fetching template details:', error)
      showNotification('error', 'Failed to fetch template details')
      setIsPreviewOpen(false)
    } finally {
      setIsLoadingTemplateDetails(false)
    }
  }

  // Helper function to determine template type
  const getTemplateType = (template) => {
    // For templates from the list API, check the 'type' field first
    if (template.type) {
      if (template.type === 'condition') {
        return 'condition'
      }
      // For content templates, the type might be 'content' but we need to check channels
      // If we don't have channels info, return the type as is
      if (template.type === 'content' && !template.channels) {
        return 'content'
      }
    }
    
    // Check templateType for full template data
    if (template.templateType === 'condition') {
      return 'condition'
    }
    
    // Then check channels for content templates
    if (template.channels && template.channels.includes('push')) {
      return 'push'
    } else if (template.channels && template.channels.includes('email')) {
      return 'email'
    } else if (template.channels && template.channels.includes('sms')) {
      return 'sms'
    } else if (template.channels && template.channels.includes('inapp')) {
      return 'inapp'
    }
    
    // If we have a type field but no channels, return the type
    if (template.type) {
      return template.type
    }
    
    return 'unknown'
  }

  // Helper function to get display description
  const getDisplayDescription = (template) => {
    if (template.templateType === 'condition' && template.template?.condition?.humanReadable) {
      return template.template.condition.humanReadable
    }
    return template.description || 'No description available'
  }

  // Helper function to render push template details
  const renderPushTemplateDetails = (template) => {
    const pushTemplate = template.template
    return (
      <Flex direction="column" gap="size-200">
        <Well>
          <Flex direction="column" gap="size-100">
            <Text UNSAFE_style={{ fontWeight: '600', marginBottom: '8px' }}>
              Push Notification Details
            </Text>
            
            <Grid columns={['1fr', '1fr']} gap="size-200">
              <Flex direction="column" gap="size-100">
                <Text UNSAFE_style={{ fontWeight: '500', fontSize: '12px', color: '#6B7280' }}>
                  Push Type
                </Text>
                <Badge variant="info">{pushTemplate.pushType || 'N/A'}</Badge>
              </Flex>
              
              <Flex direction="column" gap="size-100">
                <Text UNSAFE_style={{ fontWeight: '500', fontSize: '12px', color: '#6B7280' }}>
                  Title
                </Text>
                <Text UNSAFE_style={{ fontSize: '14px' }}>
                  {pushTemplate.title || 'No title'}
                </Text>
              </Flex>
            </Grid>
            
            <Flex direction="column" gap="size-100">
              <Text UNSAFE_style={{ fontWeight: '500', fontSize: '12px', color: '#6B7280' }}>
                Message
              </Text>
              <Text UNSAFE_style={{ fontSize: '14px' }}>
                {pushTemplate.message || 'No message'}
              </Text>
            </Flex>
          </Flex>
        </Well>

        {/* iOS Configuration */}
        {pushTemplate.ios && (
          <Well>
            <Flex direction="column" gap="size-100">
              <Text UNSAFE_style={{ fontWeight: '600', marginBottom: '8px' }}>
                iOS Configuration
              </Text>
              
              <Grid columns={['1fr', '1fr']} gap="size-200">
                <Flex direction="column" gap="size-100">
                  <Text UNSAFE_style={{ fontWeight: '500', fontSize: '12px', color: '#6B7280' }}>
                    Mutable Content
                  </Text>
                  <Badge variant={pushTemplate.ios.mutableContent ? 'positive' : 'negative'}>
                    {pushTemplate.ios.mutableContent ? 'Yes' : 'No'}
                  </Badge>
                </Flex>
                
                <Flex direction="column" gap="size-100">
                  <Text UNSAFE_style={{ fontWeight: '500', fontSize: '12px', color: '#6B7280' }}>
                    Content Available
                  </Text>
                  <Badge variant={pushTemplate.ios.contentAvailable ? 'positive' : 'negative'}>
                    {pushTemplate.ios.contentAvailable ? 'Yes' : 'No'}
                  </Badge>
                </Flex>
              </Grid>
              
              {pushTemplate.ios.interaction && (
                <Flex direction="column" gap="size-100">
                  <Text UNSAFE_style={{ fontWeight: '500', fontSize: '12px', color: '#6B7280' }}>
                    Interaction Type
                  </Text>
                  <Badge variant="info">{pushTemplate.ios.interaction.type}</Badge>
                </Flex>
              )}
              
              {pushTemplate.ios.media && pushTemplate.ios.media.uri && (
                <Flex direction="column" gap="size-100">
                  <Text UNSAFE_style={{ fontWeight: '500', fontSize: '12px', color: '#6B7280' }}>
                    Media URI
                  </Text>
                  <Text UNSAFE_style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                    {pushTemplate.ios.media.uri}
                  </Text>
                </Flex>
              )}
            </Flex>
          </Well>
        )}

        {/* Android Configuration */}
        {pushTemplate.android && (
          <Well>
            <Flex direction="column" gap="size-100">
              <Text UNSAFE_style={{ fontWeight: '600', marginBottom: '8px' }}>
                Android Configuration
              </Text>
              
              <Grid columns={['1fr', '1fr']} gap="size-200">
                <Flex direction="column" gap="size-100">
                  <Text UNSAFE_style={{ fontWeight: '500', fontSize: '12px', color: '#6B7280' }}>
                    Visibility
                  </Text>
                  <Badge variant="info">{pushTemplate.android.visibility || 'N/A'}</Badge>
                </Flex>
                
                <Flex direction="column" gap="size-100">
                  <Text UNSAFE_style={{ fontWeight: '500', fontSize: '12px', color: '#6B7280' }}>
                    Delivery Priority
                  </Text>
                  <Badge variant="info">{pushTemplate.android.deliveryPriority || 'N/A'}</Badge>
                </Flex>
              </Grid>
              
              <Flex direction="column" gap="size-100">
                <Text UNSAFE_style={{ fontWeight: '500', fontSize: '12px', color: '#6B7280' }}>
                  Notification Priority
                </Text>
                <Badge variant="info">{pushTemplate.android.notificationPriority || 'N/A'}</Badge>
              </Flex>
              
              {pushTemplate.android.interaction && (
                <Flex direction="column" gap="size-100">
                  <Text UNSAFE_style={{ fontWeight: '500', fontSize: '12px', color: '#6B7280' }}>
                    Interaction Type
                  </Text>
                  <Badge variant="info">{pushTemplate.android.interaction.type}</Badge>
                </Flex>
              )}
            </Flex>
          </Well>
        )}
      </Flex>
    )
  }

  // Helper function to render email template details
  const renderEmailTemplateDetails = (template) => {
    const emailTemplate = template.template
    return (
      <Flex direction="column" gap="size-200">
        <Well>
          <Flex direction="column" gap="size-100">
            <Text UNSAFE_style={{ fontWeight: '600', marginBottom: '8px' }}>
              Email Template Details
            </Text>
            
            <Flex direction="column" gap="size-100">
              <Text UNSAFE_style={{ fontWeight: '500', fontSize: '12px', color: '#6B7280' }}>
                Subject
              </Text>
              <Text UNSAFE_style={{ fontSize: '14px' }}>
                {emailTemplate.subject || 'No subject'}
              </Text>
            </Flex>
          </Flex>
        </Well>

        {/* HTML Content */}
        {emailTemplate.html && emailTemplate.html.body && (
          <Well>
            <Flex direction="column" gap="size-100">
              <Text UNSAFE_style={{ fontWeight: '600', marginBottom: '8px' }}>
                HTML Content Preview
              </Text>
              <div
                dangerouslySetInnerHTML={{ __html: emailTemplate.html.body }}
                style={{
                  border: '1px solid var(--spectrum-gray-300)',
                  borderRadius: '4px',
                  padding: '16px',
                  backgroundColor: 'white',
                  maxHeight: '400px',
                  overflow: 'auto',
                  fontSize: '12px'
                }}
              />
            </Flex>
          </Well>
        )}

        {/* Editor Context */}
        {emailTemplate.editorContext && (
          <Well>
            <Flex direction="column" gap="size-100">
              <Text UNSAFE_style={{ fontWeight: '600', marginBottom: '8px' }}>
                Editor Context
              </Text>
              <TextArea
                value={JSON.stringify(emailTemplate.editorContext, null, 2)}
                isReadOnly
                UNSAFE_style={{ fontFamily: 'monospace', fontSize: '12px' }}
                height="150px"
              />
            </Flex>
          </Well>
        )}
      </Flex>
    )
  }

  // Helper function to render SMS template details
  const renderSmsTemplateDetails = (template) => {
    const smsTemplate = template.template
    return (
      <Flex direction="column" gap="size-200">
        <Well>
          <Flex direction="column" gap="size-100">
            <Text UNSAFE_style={{ fontWeight: '600', marginBottom: '8px' }}>
              SMS Template Details
            </Text>
            
            <Grid columns={['1fr', '1fr']} gap="size-200">
              <Flex direction="column" gap="size-100">
                <Text UNSAFE_style={{ fontWeight: '500', fontSize: '12px', color: '#6B7280' }}>
                  Message Type
                </Text>
                <Badge variant="info">{smsTemplate.messageType || 'sms'}</Badge>
              </Flex>
              
              <Flex direction="column" gap="size-100">
                <Text UNSAFE_style={{ fontWeight: '500', fontSize: '12px', color: '#6B7280' }}>
                  Text Length
                </Text>
                <Text UNSAFE_style={{ fontSize: '14px' }}>
                  {smsTemplate.text ? smsTemplate.text.length : 0} characters
                </Text>
              </Flex>
            </Grid>
            
            <Flex direction="column" gap="size-100">
              <Text UNSAFE_style={{ fontWeight: '500', fontSize: '12px', color: '#6B7280' }}>
                Message Text
              </Text>
              <Well UNSAFE_style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                <Text UNSAFE_style={{ fontSize: '14px', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                  {smsTemplate.text || 'No message text'}
                </Text>
              </Well>
            </Flex>
          </Flex>
        </Well>
      </Flex>
    )
  }

  // Helper function to render condition template details
  const renderConditionTemplateDetails = (template) => {
    const conditionTemplate = template.template
    return (
      <Flex direction="column" gap="size-200">
        <Well>
          <Flex direction="column" gap="size-100">
            <Text UNSAFE_style={{ fontWeight: '600', marginBottom: '8px' }}>
              Condition Template Details
            </Text>
            
            <Grid columns={['1fr', '1fr']} gap="size-200">
              <Flex direction="column" gap="size-100">
                <Text UNSAFE_style={{ fontWeight: '500', fontSize: '12px', color: '#6B7280' }}>
                  Template Type
                </Text>
                <Badge variant="info">{template.templateType}</Badge>
              </Flex>
              
              <Flex direction="column" gap="size-100">
                <Text UNSAFE_style={{ fontWeight: '500', fontSize: '12px', color: '#6B7280' }}>
                  Channels
                </Text>
                <Badge variant="info">{template.channels?.join(', ') || 'None'}</Badge>
              </Flex>
            </Grid>
          </Flex>
        </Well>

        {/* PQL Condition */}
        {conditionTemplate.condition && (
          <Well>
            <Flex direction="column" gap="size-100">
              <Text UNSAFE_style={{ fontWeight: '600', marginBottom: '8px' }}>
                PQL Condition
              </Text>
              
              <Flex direction="column" gap="size-100">
                <Text UNSAFE_style={{ fontWeight: '500', fontSize: '12px', color: '#6B7280' }}>
                  Human Readable
                </Text>
                <Text UNSAFE_style={{ fontSize: '14px' }}>
                  {conditionTemplate.condition.humanReadable || 'No description'}
                </Text>
              </Flex>
              
              <Flex direction="column" gap="size-100">
                <Text UNSAFE_style={{ fontWeight: '500', fontSize: '12px', color: '#6B7280' }}>
                  PQL Expression
                </Text>
                <Well UNSAFE_style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                  <Text UNSAFE_style={{ fontSize: '14px', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                    {conditionTemplate.condition.pql || 'No PQL expression'}
                  </Text>
                </Well>
              </Flex>
            </Flex>
          </Well>
        )}

        {/* Condition JSON */}
        {conditionTemplate.condition?.json && (
          <Well>
            <Flex direction="column" gap="size-100">
              <Text UNSAFE_style={{ fontWeight: '600', marginBottom: '8px' }}>
                Condition JSON Structure
              </Text>
              <TextArea
                value={JSON.stringify(conditionTemplate.condition.json, null, 2)}
                isReadOnly
                UNSAFE_style={{ fontFamily: 'monospace', fontSize: '12px' }}
                height="200px"
              />
            </Flex>
          </Well>
        )}
      </Flex>
    )
  }

  // Helper function to render InApp template details
  const renderInAppTemplateDetails = (template) => {
    const inAppTemplate = template.template
    return (
      <Flex direction="column" gap="size-200">
        <Well>
          <Flex direction="column" gap="size-100">
            <Text UNSAFE_style={{ fontWeight: '600', marginBottom: '8px' }}>
              InApp Template Details
            </Text>
            
            <Grid columns={['1fr', '1fr']} gap="size-200">
              <Flex direction="column" gap="size-100">
                <Text UNSAFE_style={{ fontWeight: '500', fontSize: '12px', color: '#6B7280' }}>
                  Layout
                </Text>
                <Badge variant="info">{inAppTemplate.editorContext?.layout || 'N/A'}</Badge>
              </Flex>
              
              <Flex direction="column" gap="size-100">
                <Text UNSAFE_style={{ fontWeight: '500', fontSize: '12px', color: '#6B7280' }}>
                  Preview Mode
                </Text>
                <Badge variant="info">{inAppTemplate.editorContext?.previewMode || 'N/A'}</Badge>
              </Flex>
            </Grid>
            
            <Grid columns={['1fr', '1fr']} gap="size-200">
              <Flex direction="column" gap="size-100">
                <Text UNSAFE_style={{ fontWeight: '500', fontSize: '12px', color: '#6B7280' }}>
                  Width
                </Text>
                <Text UNSAFE_style={{ fontSize: '14px' }}>
                  {inAppTemplate.mobileParameters?.width || 'N/A'}%
                </Text>
              </Flex>
              
              <Flex direction="column" gap="size-100">
                <Text UNSAFE_style={{ fontWeight: '500', fontSize: '12px', color: '#6B7280' }}>
                  Height
                </Text>
                <Text UNSAFE_style={{ fontSize: '14px' }}>
                  {inAppTemplate.mobileParameters?.height || 'N/A'}%
                </Text>
              </Flex>
            </Grid>
            
            <Grid columns={['1fr', '1fr']} gap="size-200">
              <Flex direction="column" gap="size-100">
                <Text UNSAFE_style={{ fontWeight: '500', fontSize: '12px', color: '#6B7280' }}>
                  Display Animation
                </Text>
                <Badge variant="info">{inAppTemplate.mobileParameters?.displayAnimation || 'N/A'}</Badge>
              </Flex>
              
              <Flex direction="column" gap="size-100">
                <Text UNSAFE_style={{ fontWeight: '500', fontSize: '12px', color: '#6B7280' }}>
                  Dismiss Animation
                </Text>
                <Badge variant="info">{inAppTemplate.mobileParameters?.dismissAnimation || 'N/A'}</Badge>
              </Flex>
            </Grid>
            
            <Grid columns={['1fr', '1fr']} gap="size-200">
              <Flex direction="column" gap="size-100">
                <Text UNSAFE_style={{ fontWeight: '500', fontSize: '12px', color: '#6B7280' }}>
                  Vertical Align
                </Text>
                <Badge variant="info">{inAppTemplate.mobileParameters?.verticalAlign || 'N/A'}</Badge>
              </Flex>
              
              <Flex direction="column" gap="size-100">
                <Text UNSAFE_style={{ fontWeight: '500', fontSize: '12px', color: '#6B7280' }}>
                  Horizontal Align
                </Text>
                <Badge variant="info">{inAppTemplate.mobileParameters?.horizontalAlign || 'N/A'}</Badge>
              </Flex>
            </Grid>
            
            <Grid columns={['1fr', '1fr']} gap="size-200">
              <Flex direction="column" gap="size-100">
                <Text UNSAFE_style={{ fontWeight: '500', fontSize: '12px', color: '#6B7280' }}>
                  UI Takeover
                </Text>
                <Badge variant={inAppTemplate.mobileParameters?.uiTakeover ? 'positive' : 'negative'}>
                  {inAppTemplate.mobileParameters?.uiTakeover ? 'Yes' : 'No'}
                </Badge>
              </Flex>
              
              <Flex direction="column" gap="size-100">
                <Text UNSAFE_style={{ fontWeight: '500', fontSize: '12px', color: '#6B7280' }}>
                  Corner Radius
                </Text>
                <Text UNSAFE_style={{ fontSize: '14px' }}>
                  {inAppTemplate.mobileParameters?.cornerRadius || 'N/A'}px
                </Text>
              </Flex>
            </Grid>
            
            <Grid columns={['1fr', '1fr']} gap="size-200">
              <Flex direction="column" gap="size-100">
                <Text UNSAFE_style={{ fontWeight: '500', fontSize: '12px', color: '#6B7280' }}>
                  Backdrop Opacity
                </Text>
                <Text UNSAFE_style={{ fontSize: '14px' }}>
                  {inAppTemplate.mobileParameters?.backdropOpacity || 'N/A'}
                </Text>
              </Flex>
              
              <Flex direction="column" gap="size-100">
                <Text UNSAFE_style={{ fontWeight: '500', fontSize: '12px', color: '#6B7280' }}>
                  Backdrop Color
                </Text>
                <Text UNSAFE_style={{ fontSize: '14px' }}>
                  {inAppTemplate.mobileParameters?.backdropColor || 'N/A'}
                </Text>
              </Flex>
            </Grid>
          </Flex>
        </Well>

        {/* HTML Content */}
        {inAppTemplate.body && inAppTemplate.body.html && (
          <Well>
            <Flex direction="column" gap="size-100">
              <Text UNSAFE_style={{ fontWeight: '600', marginBottom: '8px' }}>
                HTML Content Preview
              </Text>
              <div
                dangerouslySetInnerHTML={{ __html: inAppTemplate.body.html }}
                style={{
                  border: '1px solid var(--spectrum-gray-300)',
                  borderRadius: '4px',
                  padding: '16px',
                  backgroundColor: 'white',
                  maxHeight: '400px',
                  overflow: 'auto',
                  fontSize: '12px'
                }}
              />
            </Flex>
          </Well>
        )}

        {/* Web Parameters */}
        {inAppTemplate.mobileParameters?.webParameters && (
          <Well>
            <Flex direction="column" gap="size-100">
              <Text UNSAFE_style={{ fontWeight: '600', marginBottom: '8px' }}>
                Web Parameters
              </Text>
              <TextArea
                value={JSON.stringify(inAppTemplate.mobileParameters.webParameters, null, 2)}
                isReadOnly
                UNSAFE_style={{ fontFamily: 'monospace', fontSize: '12px' }}
                height="200px"
              />
            </Flex>
          </Well>
        )}

        {/* Editor Context */}
        {inAppTemplate.editorContext && (
          <Well>
            <Flex direction="column" gap="size-100">
              <Text UNSAFE_style={{ fontWeight: '600', marginBottom: '8px' }}>
                Editor Context
              </Text>
              <TextArea
                value={JSON.stringify(inAppTemplate.editorContext, null, 2)}
                isReadOnly
                UNSAFE_style={{ fontFamily: 'monospace', fontSize: '12px' }}
                height="150px"
              />
            </Flex>
          </Well>
        )}

        {/* Mobile Parameters */}
        {inAppTemplate.mobileParameters && (
          <Well>
            <Flex direction="column" gap="size-100">
              <Text UNSAFE_style={{ fontWeight: '600', marginBottom: '8px' }}>
                Mobile Parameters
              </Text>
              <TextArea
                value={JSON.stringify(inAppTemplate.mobileParameters, null, 2)}
                isReadOnly
                UNSAFE_style={{ fontFamily: 'monospace', fontSize: '12px' }}
                height="200px"
              />
            </Flex>
          </Well>
        )}
      </Flex>
    )
  }

  const TemplateCard = ({ template, isSelected, onSelect, onPreview }) => (
    <Well
      UNSAFE_style={{
        cursor: 'pointer',
        border: isSelected ? '2px solid var(--spectrum-blue-600)' : '1px solid var(--spectrum-gray-300)',
        transition: 'all 0.2s ease',
        backgroundColor: isSelected ? 'var(--spectrum-blue-50)' : 'white'
      }}
      onPress={() => onSelect(template.id, !isSelected)}
    >
      <Flex direction="column" gap="size-100" padding="size-200">
        <Flex alignItems="center" justifyContent="space-between">
          <Flex alignItems="center" gap="size-100">
            <Document size="S" />
            <Text UNSAFE_style={{ fontWeight: '600', fontSize: '14px' }}>
              {template.name}
            </Text>
          </Flex>
          <Badge variant="info" UNSAFE_style={{ fontSize: '11px' }}>
            {template.channels && template.channels.length > 0 ? template.channels[0] : template.type || 'unknown'}
          </Badge>
        </Flex>
        
        <Text UNSAFE_style={{ fontSize: '12px', color: '#6B7280' }}>
          {getDisplayDescription(template)}
        </Text>
        
        <Flex alignItems="center" justifyContent="space-between">
          <Text UNSAFE_style={{ fontSize: '11px', color: '#9CA3AF' }}>
            ID: {template.id}
          </Text>
          <ButtonGroup>
            <ActionButton
              isQuiet
              onPress={() => onPreview(template)}
              UNSAFE_style={{ fontSize: '11px' }}
            >
              Preview
            </ActionButton>
            <ActionButton
              isQuiet
              onPress={() => onSelect(template.id, !isSelected)}
              UNSAFE_style={{ fontSize: '11px' }}
            >
              {isSelected ? 'Deselect' : 'Select'}
            </ActionButton>
          </ButtonGroup>
        </Flex>
      </Flex>
    </Well>
  )

  const TemplatePreviewDialog = () => (
    <DialogContainer onDismiss={() => setIsPreviewOpen(false)} isDismissable>
      <Dialog size="L">
        <DialogHeading>Template Preview</DialogHeading>
        <DialogContent>
          {isLoadingTemplateDetails ? (
            <Flex alignItems="center" justifyContent="center" height="200px">
              <Flex direction="column" alignItems="center" gap="size-200">
                <ProgressBar size="L" isIndeterminate />
                <Text>Loading template details...</Text>
              </Flex>
            </Flex>
          ) : selectedTemplateForPreview ? (
            <Flex direction="column" gap="size-200">
              {/* Template Header */}
              <Well>
                <Flex direction="column" gap="size-100">
                  <Text UNSAFE_style={{ fontWeight: '600' }}>
                    {selectedTemplateForPreview.name}
                  </Text>
                  <Badge variant="info">{getTemplateType(selectedTemplateForPreview)}</Badge>
                  <Text UNSAFE_style={{ fontSize: '14px', color: '#6B7280' }}>
                    {getDisplayDescription(selectedTemplateForPreview)}
                  </Text>
                  <Text UNSAFE_style={{ fontSize: '12px', color: '#9CA3AF' }}>
                    ID: {selectedTemplateForPreview.id}
                  </Text>
                </Flex>
              </Well>
              
              {/* Template Type Specific Details */}
              {getTemplateType(selectedTemplateForPreview) === 'push' && 
                renderPushTemplateDetails(selectedTemplateForPreview)}
              
              {getTemplateType(selectedTemplateForPreview) === 'email' && 
                renderEmailTemplateDetails(selectedTemplateForPreview)}
              
              {getTemplateType(selectedTemplateForPreview) === 'sms' && 
                renderSmsTemplateDetails(selectedTemplateForPreview)}
              
              {getTemplateType(selectedTemplateForPreview) === 'condition' && 
                renderConditionTemplateDetails(selectedTemplateForPreview)}
              
              {getTemplateType(selectedTemplateForPreview) === 'inapp' && 
                renderInAppTemplateDetails(selectedTemplateForPreview)}
              
              {/* Raw JSON Data */}
              <Well>
                <Flex direction="column" gap="size-100">
                  <Text UNSAFE_style={{ fontWeight: '600', marginBottom: '8px' }}>
                    Raw Template Data
                  </Text>
                  <TextArea
                    value={JSON.stringify(selectedTemplateForPreview, null, 2)}
                    isReadOnly
                    UNSAFE_style={{ fontFamily: 'monospace', fontSize: '12px' }}
                    height="200px"
                  />
                </Flex>
              </Well>
            </Flex>
          ) : (
            <Text>No template selected</Text>
          )}
        </DialogContent>
        <DialogButtonGroup>
          <Button variant="secondary" onPress={() => setIsPreviewOpen(false)}>
            Close
          </Button>
        </DialogButtonGroup>
      </Dialog>
    </DialogContainer>
  )

  return (
    <View padding="size-400">
      <Flex direction="column" gap="size-400">
        {/* Header */}
        <Flex direction="column" gap="size-200">
          <Heading level={1}>Content Template Migrator</Heading>
          <Text UNSAFE_style={{ color: '#6B7280' }}>
            Migrate content templates between Adobe Journey Optimizer sandboxes
          </Text>
        </Flex>

        {/* Notification */}
        {notification && (
          <StatusLight
            variant={notification.type === 'success' ? 'positive' : 'negative'}
            UNSAFE_style={{ marginBottom: '16px' }}
          >
            {notification.message}
          </StatusLight>
        )}

        {/* Main Content */}
        <Tabs selectedKey={activeTab} onSelectionChange={setActiveTab}>
          <TabList>
            <Item key="source">Source Configuration</Item>
            <Item key="target">Target Configuration</Item>
            <Item key="migration">Migration</Item>
            <Item key="results">Results</Item>
          </TabList>
          
          <TabPanels>
            {/* Source Configuration Tab */}
            <Item key="source">
              <Flex direction="column" gap="size-300">
                <Well>
                  <Flex direction="column" gap="size-200">
                    <Heading level={3}>Source Environment</Heading>
                    
                    <Grid columns={['1fr', '1fr']} gap="size-200">
                      <Flex direction="column" gap="size-100">
                        <Text UNSAFE_style={{ fontWeight: '600' }}>Organization</Text>
                        <Picker
                          selectedKey={selectedSourceOrg}
                          onSelectionChange={setSelectedSourceOrg}
                          placeholder="Select Organization"
                          items={Object.keys(environments).map(key => ({ key, label: key }))}
                        >
                          {(item) => <Item key={item.key}>{item.label}</Item>}
                        </Picker>
                      </Flex>
                      
                      <Flex direction="column" gap="size-100">
                        <Text UNSAFE_style={{ fontWeight: '600' }}>Sandbox</Text>
                        <Picker
                          selectedKey={selectedSourceSandbox}
                          onSelectionChange={setSelectedSourceSandbox}
                          placeholder="Select Sandbox"
                          items={sourceSandboxes}
                          isDisabled={isLoadingSourceSandboxes}
                        >
                          {(item) => <Item key={item.key}>{item.label}</Item>}
                        </Picker>
                        {isLoadingSourceSandboxes && (
                          <Flex alignItems="center" gap="size-100">
                            <ProgressBar size="S" isIndeterminate />
                            <Text UNSAFE_style={{ fontSize: '12px', color: '#6B7280' }}>
                              Loading sandboxes...
                            </Text>
                          </Flex>
                        )}
                        {selectedSourceOrg && !isLoadingSourceSandboxes && sourceSandboxes.length === 0 && (
                          <Text UNSAFE_style={{ fontSize: '12px', color: '#EF4444' }}>
                            No sandboxes found for this organization
                          </Text>
                        )}
                      </Flex>
                    </Grid>
                    
                    <Button
                      variant="cta"
                      onPress={fetchTemplates}
                      isDisabled={!selectedSourceOrg || !selectedSourceSandbox || isLoadingTemplates}
                    >
                      {isLoadingTemplates ? (
                        <Flex alignItems="center" gap="size-100">
                          <ProgressBar size="S" isIndeterminate />
                          <Text>Loading Templates...</Text>
                        </Flex>
                      ) : (
                        <Flex alignItems="center" gap="size-100">
                          <Refresh size="S" />
                          <Text>Load Templates</Text>
                        </Flex>
                      )}
                    </Button>
                  </Flex>
                </Well>

                {/* Templates Display */}
                {templates.length > 0 && (
                  <Well>
                    <Flex direction="column" gap="size-200">
                      <Flex alignItems="center" justifyContent="space-between">
                        <Heading level={3}>
                          Templates ({templates.length})
                        </Heading>
                        <Flex gap="size-100">
                          <ButtonGroup>
                            <ActionButton
                              isQuiet
                              onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                            >
                              {viewMode === 'grid' ? <ViewSingle size="S" /> : <ViewGrid size="S" />}
                            </ActionButton>
                          </ButtonGroup>
                          <ButtonGroup>
                            <Button variant="secondary" onPress={handleSelectAll}>
                              Select All
                            </Button>
                            <Button variant="secondary" onPress={handleDeselectAll}>
                              Deselect All
                            </Button>
                          </ButtonGroup>
                        </Flex>
                      </Flex>

                      {viewMode === 'grid' ? (
                        <Grid columns={['1fr', '1fr', '1fr']} gap="size-200">
                          {templates.map((template) => (
                            <TemplateCard
                              key={template.id}
                              template={template}
                              isSelected={selectedTemplates.includes(template.id)}
                              onSelect={handleTemplateSelection}
                              onPreview={openTemplatePreview}
                            />
                          ))}
                        </Grid>
                      ) : (
                        <Flex direction="column" gap="size-100">
                          {templates.map((template) => (
                            <TemplateCard
                              key={template.id}
                              template={template}
                              isSelected={selectedTemplates.includes(template.id)}
                              onSelect={handleTemplateSelection}
                              onPreview={openTemplatePreview}
                            />
                          ))}
                        </Flex>
                      )}
                    </Flex>
                  </Well>
                )}
              </Flex>
            </Item>

            {/* Target Configuration Tab */}
            <Item key="target">
              <Flex direction="column" gap="size-300">
                <Well>
                  <Flex direction="column" gap="size-200">
                    <Heading level={3}>Target Environment</Heading>
                    
                    <Grid columns={['1fr', '1fr']} gap="size-200">
                      <Flex direction="column" gap="size-100">
                        <Text UNSAFE_style={{ fontWeight: '600' }}>Organization</Text>
                        <Picker
                          selectedKey={selectedTargetOrg}
                          onSelectionChange={setSelectedTargetOrg}
                          placeholder="Select Organization"
                          items={Object.keys(environments).map(key => ({ key, label: key }))}
                        >
                          {(item) => <Item key={item.key}>{item.label}</Item>}
                        </Picker>
                      </Flex>
                      
                      <Flex direction="column" gap="size-100">
                        <Text UNSAFE_style={{ fontWeight: '600' }}>Sandbox</Text>
                        <Picker
                          selectedKey={selectedTargetSandbox}
                          onSelectionChange={setSelectedTargetSandbox}
                          items={targetSandboxes}
                          isDisabled={isLoadingTargetSandboxes}
                        >
                          {(item) => <Item key={item.key}>{item.label}</Item>}
                        </Picker>
                        {isLoadingTargetSandboxes && (
                          <Flex alignItems="center" gap="size-100">
                            <ProgressBar size="S" isIndeterminate />
                            <Text UNSAFE_style={{ fontSize: '12px', color: '#6B7280' }}>
                              Loading sandboxes...
                            </Text>
                          </Flex>
                        )}
                        {selectedTargetOrg && !isLoadingTargetSandboxes && targetSandboxes.length === 0 && (
                          <Text UNSAFE_style={{ fontSize: '12px', color: '#EF4444' }}>
                            No sandboxes found for this organization
                          </Text>
                        )}
                      </Flex>
                    </Grid>
                  </Flex>
                </Well>

                {/* Selected Templates Summary */}
                {selectedTemplates.length > 0 && (
                  <Well>
                    <Flex direction="column" gap="size-200">
                      <Heading level={3}>
                        Selected Templates ({selectedTemplates.length})
                      </Heading>
                      
                      <Grid columns={['2fr', '1fr']} gap="size-200">
                        {/* Template List */}
                        <Flex direction="column" gap="size-100">
                          {templates
                            .filter(t => selectedTemplates.includes(t.id))
                            .map(template => (
                              <Flex key={template.id} alignItems="center" justifyContent="space-between">
                                <Flex alignItems="center" gap="size-100">
                                  <Document size="S" />
                                  <Flex direction="column" gap="size-50">
                                    <Text UNSAFE_style={{ fontWeight: '500' }}>
                                      {template.name}
                                    </Text>
                                    {template.templateType === 'condition' && template.template?.condition?.humanReadable && (
                                      <Text UNSAFE_style={{ fontSize: '11px', color: '#6B7280' }}>
                                        {getDisplayDescription(template)}
                                      </Text>
                                    )}
                                  </Flex>
                                  <Badge variant="info" UNSAFE_style={{ fontSize: '11px' }}>
                                    {getTemplateType(template)}
                                  </Badge>
                                </Flex>
                                <ActionButton
                                  isQuiet
                                  onPress={() => handleTemplateSelection(template.id, false)}
                                >
                                  <Close size="S" />
                                </ActionButton>
                              </Flex>
                            ))}
                        </Flex>
                        
                        {/* Template Type Summary */}
                        <Well UNSAFE_style={{ backgroundColor: '#F9FAFB' }}>
                          <Flex direction="column" gap="size-100">
                            <Text UNSAFE_style={{ fontWeight: '600', fontSize: '14px' }}>
                              Template Summary
                            </Text>
                            {(() => {
                              const selectedTemplateData = templates.filter(t => selectedTemplates.includes(t.id))
                              const typeCounts = {}
                              
                              selectedTemplateData.forEach(template => {
                                const type = getTemplateType(template)
                                typeCounts[type] = (typeCounts[type] || 0) + 1
                              })
                              
                              return (
                                <Flex direction="column" gap="size-50">
                                  {Object.entries(typeCounts).map(([type, count]) => (
                                    <Flex key={type} alignItems="center" justifyContent="space-between">
                                      <Badge variant="info" UNSAFE_style={{ fontSize: '11px' }}>
                                        {type}
                                      </Badge>
                                      <Text UNSAFE_style={{ fontSize: '12px', fontWeight: '500' }}>
                                        {count}
                                      </Text>
                                    </Flex>
                                  ))}
                                </Flex>
                              )
                            })()}
                          </Flex>
                        </Well>
                      </Grid>
                    </Flex>
                  </Well>
                )}
              </Flex>
            </Item>

            {/* Migration Tab */}
            <Item key="migration">
              <Flex direction="column" gap="size-300">
                <Well>
                  <Flex direction="column" gap="size-200">
                    <Heading level={3}>Migration Summary</Heading>
                    
                    <Grid columns={['1fr', '1fr']} gap="size-200">
                      <Well>
                        <Flex direction="column" gap="size-100">
                          <Text UNSAFE_style={{ fontWeight: '600', color: '#6B7280' }}>
                            Source
                          </Text>
                          <Text UNSAFE_style={{ fontWeight: '500' }}>
                            {selectedSourceOrg} / {selectedSourceSandbox}
                          </Text>
                        </Flex>
                      </Well>
                      
                      <Well>
                        <Flex direction="column" gap="size-100">
                          <Text UNSAFE_style={{ fontWeight: '600', color: '#6B7280' }}>
                            Target
                          </Text>
                          <Text UNSAFE_style={{ fontWeight: '500' }}>
                            {selectedTargetOrg} / {selectedTargetSandbox}
                          </Text>
                        </Flex>
                      </Well>
                    </Grid>
                    
                    <Well>
                      <Flex direction="column" gap="size-100">
                        <Text UNSAFE_style={{ fontWeight: '600', color: '#6B7280' }}>
                          Templates to Migrate
                        </Text>
                        <Text UNSAFE_style={{ fontWeight: '500' }}>
                          {selectedTemplates.length} templates selected
                        </Text>
                      </Flex>
                    </Well>
                    
                    <Button
                      variant="cta"
                      onPress={migrateTemplates}
                      isDisabled={
                        selectedTemplates.length === 0 ||
                        !selectedTargetOrg ||
                        !selectedTargetSandbox ||
                        isMigrating
                      }
                    >
                      {isMigrating ? (
                        <Flex alignItems="center" gap="size-100">
                          <ProgressBar size="S" isIndeterminate />
                          <Text>Migrating Templates...</Text>
                        </Flex>
                      ) : (
                        <Flex alignItems="center" gap="size-100">
                          <Copy size="S" />
                          <Text>Start Migration</Text>
                        </Flex>
                      )}
                    </Button>
                  </Flex>
                </Well>
              </Flex>
            </Item>

            {/* Results Tab */}
            <Item key="results">
              <Flex direction="column" gap="size-300">
                {migrationStatus === 'idle' && (
                  <IllustratedMessage>
                    <Text>No migration results yet. Start a migration to see results here.</Text>
                  </IllustratedMessage>
                )}
                
                {migrationStatus === 'in-progress' && (
                  <Well>
                    <Flex direction="column" gap="size-200">
                      <Heading level={3}>Migration in Progress</Heading>
                      <ProgressBar size="L" isIndeterminate />
                      <Text>Migrating templates to target environment...</Text>
                    </Flex>
                  </Well>
                )}
                
                {migrationStatus === 'completed' && migrationResults.length > 0 && (
                  <Well>
                    <Flex direction="column" gap="size-200">
                      <Heading level={3}>Migration Results</Heading>
                      
                      <Flex direction="column" gap="size-100">
                        {migrationResults.map((result, index) => (
                          <Flex key={index} alignItems="center" justifyContent="space-between">
                            <Flex alignItems="center" gap="size-100">
                              {result.success ? (
                                <CheckmarkCircle size="S" UNSAFE_style={{ color: '#10B981' }} />
                              ) : (
                                <Alert size="S" UNSAFE_style={{ color: '#EF4444' }} />
                              )}
                              <Text UNSAFE_style={{ fontWeight: '500' }}>
                                {result.templateName}
                              </Text>
                            </Flex>
                            <StatusLight
                              variant={result.success ? 'positive' : 'negative'}
                            >
                              {result.success ? 'Success' : result.error || 'Failed'}
                            </StatusLight>
                          </Flex>
                        ))}
                      </Flex>
                    </Flex>
                  </Well>
                )}
                
                {migrationStatus === 'error' && (
                  <Well>
                    <Flex direction="column" gap="size-200">
                      <Heading level={3}>Migration Failed</Heading>
                      <StatusLight variant="negative">
                        An error occurred during migration. Please check the configuration and try again.
                      </StatusLight>
                    </Flex>
                  </Well>
                )}
              </Flex>
            </Item>
          </TabPanels>
        </Tabs>
      </Flex>

      {/* Template Preview Dialog */}
      {isPreviewOpen && <TemplatePreviewDialog />}
    </View>
  )
}

export default ContentTemplateMigrator 
