import React, { useState, useEffect } from 'react'
import {
  Flex,
  View,
  Heading,
  Text,
  ProgressBar,
  Content,
  Well,
  StatusLight,
  Badge,
  Grid,
  repeat,
  Divider,
  Button,
  Tabs,
  TabList,
  TabPanels,
  Item,
  Checkbox,
  CheckboxGroup,
  ActionButton,
  Dialog,
  DialogTrigger,
  Header,
  ActionMenu,
  MenuTrigger,
  Menu,
  TableView,
  TableHeader,
  TableBody,
  Column,
  Row,
  Cell,
  SearchField
} from '@adobe/react-spectrum'
import SandboxPicker from './SandboxPicker'
import allActions from '../config.json'

function AEPOverview({ runtime, ims }) {
  const [selectedSandbox, setSelectedSandbox] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [dashboardData, setDashboardData] = useState({
    schemas: 0,
    datasets: 0,
    segments: 0,
    profiles: 0,
    sandboxes: []
  })
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  // Schema-specific state
  const [schemasList, setSchemasList] = useState([])
  const [selectedSchemas, setSelectedSchemas] = useState([])
  const [schemasLoading, setSchemasLoading] = useState(false)
  const [downloadLoading, setDownloadLoading] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [previewData, setPreviewData] = useState(null)
  const [schemaSearchTerm, setSchemaSearchTerm] = useState('')

  const actionHeaders = {
    'Content-Type': 'application/json'
  }

  const fetchConfig = {
    headers: actionHeaders
  }

  if (window.location.hostname === 'localhost') {
    actionHeaders['x-ow-extra-logging'] = 'on'
  }

  // Set the authorization header and org from the ims props object
  if (ims.token && !actionHeaders.authorization) {
    actionHeaders.authorization = `Bearer ${ims.token}`
  }
  if (ims.org && !actionHeaders['x-gw-ims-org-id']) {
    actionHeaders['x-gw-ims-org-id'] = ims.org
  }

  const handleSandboxSelection = (sandboxName) => {
    console.log(`[AEP Overview] Sandbox selected: ${sandboxName}`)
    setSelectedSandbox(sandboxName)
    setError(null)
    setSelectedSchemas([])
    setSchemasList([])
  }

  // Fetch dashboard data for overview tab
  const fetchDashboardData = async () => {
    if (!selectedSandbox) return

    setIsLoading(true)
    setError(null)
    console.log(`[AEP Overview] Fetching dashboard data for sandbox: ${selectedSandbox}`)

    try {
      const results = await Promise.allSettled([
        fetchSchemas(),
        fetchDatasets(),
        fetchSegments(),
        fetchProfiles(),
        fetchSandboxes()
      ])

      const [schemasResult, datasetsResult, segmentsResult, profilesResult, sandboxesResult] = results

      const newData = {
        schemas: schemasResult.status === 'fulfilled' ? schemasResult.value : 0,
        datasets: datasetsResult.status === 'fulfilled' ? datasetsResult.value : 0,
        segments: segmentsResult.status === 'fulfilled' ? segmentsResult.value : 0,
        profiles: profilesResult.status === 'fulfilled' ? profilesResult.value : 0,
        sandboxes: sandboxesResult.status === 'fulfilled' ? sandboxesResult.value : []
      }

      setDashboardData(newData)
      setLastUpdated(new Date())
      
      // Log the results
      console.log(`[AEP Overview] Dashboard data fetched successfully:`, newData)
      
      // Log any failed requests
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const resourceNames = ['schemas', 'datasets', 'segments', 'profiles', 'sandboxes']
          console.error(`[AEP Overview] Failed to fetch ${resourceNames[index]}:`, result.reason)
          
          // Show specific guidance for profile count issues
          if (resourceNames[index] === 'profiles') {
            console.warn('[AEP Overview] Profile count API failed - this may be due to:')
            console.warn('1. New action not fully deployed yet')
            console.warn('2. Adobe Platform Profile API permissions required')
            console.warn('3. Different API endpoint needed')
          }
        }
      })

    } catch (error) {
      console.error('[AEP Overview] Error fetching dashboard data:', error)
      setError('Failed to fetch dashboard data. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch detailed schemas list for schemas tab
  const fetchDetailedSchemas = async () => {
    if (!selectedSandbox) return

    setSchemasLoading(true)
    setError(null)
    console.log(`[AEP Overview] Fetching detailed schemas for sandbox: ${selectedSandbox}`)

    try {
      const schemaHeaders = {
        ...actionHeaders,
        'sandboxName': selectedSandbox
      }
      
      const response = await fetch(allActions.getSchemas, {
        headers: schemaHeaders
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch schemas: ${response.status}`)
      }
      
      const data = await response.json()
      const responseData = data.body || data
      const schemas = responseData?.schemas || responseData?.results || []
      
      // Filter out system schemas but keep all user-created schemas (Profile + Experience Event)
      const userSchemas = schemas.filter(schema => {
        // Filter out system/internal schemas
        const isSystemSchema = schema.id?.includes('_experience/') || 
                               schema.id?.includes('/_system/') ||
                               schema.title?.includes('AJO ') ||
                               schema.title?.includes('Journey ') ||
                               schema.title?.includes('Adobe ') ||
                               schema.id?.includes('/adobe/') ||
                               schema.id?.includes('/experience/') ||
                               schema.namespace === 'adobe' ||
                               schema.namespace === 'experience'
        return !isSystemSchema
      })
      
      console.log(`[AEP Overview] Found ${userSchemas.length} user-created schemas (Profile + Experience Event)`)
      setSchemasList(userSchemas)
      
    } catch (error) {
      console.error('[AEP Overview] Error fetching detailed schemas:', error)
      setError('Failed to fetch schemas. Please try again.')
    } finally {
      setSchemasLoading(false)
    }
  }

  // Handle tab changes
  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey)
    
    if (tabKey === 'schemas' && selectedSandbox && schemasList.length === 0) {
      fetchDetailedSchemas()
    }
  }

  // Handle schema selection
  const handleSchemaSelection = (schemaIds) => {
    setSelectedSchemas(schemaIds)
    console.log(`[AEP Overview] Selected schemas:`, schemaIds)
  }

  // Download schemas with all dependencies
  const downloadSchemaDetails = async () => {
    if (selectedSchemas.length === 0) {
      setError('Please select at least one schema to download.')
      return
    }

    setDownloadLoading(true)
    setError(null)
    console.log(`[AEP Overview] Starting download for ${selectedSchemas.length} schemas`)

    try {
      const downloadHeaders = {
        ...actionHeaders,
        'sandboxName': selectedSandbox
      }

      const response = await fetch(allActions.downloadSchemaDetails || `${allActions.getSchemas.replace('/getSchemas', '/downloadSchemaDetails')}`, {
        method: 'POST',
        headers: downloadHeaders,
        body: JSON.stringify({
          schemaIds: selectedSchemas
        })
      })

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`)
      }

      const data = await response.json()
      const responseData = data.body || data

      // Create and download the JSON file
      const jsonContent = JSON.stringify(responseData.export, null, 2)
      const blob = new Blob([jsonContent], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = url
      link.download = `aep-schemas-export-${selectedSandbox}-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      console.log(`[AEP Overview] Download completed:`, responseData.summary)
      
      // Show success message
      setError(null)
      alert(`✅ Download completed!\n\nExported:\n• ${responseData.summary.schemasProcessed} schemas\n• ${responseData.summary.dataTypesIncluded} data types\n• ${responseData.summary.mixinsIncluded} field groups\n• ${responseData.summary.datasetsIncluded} datasets\n• ${responseData.summary.identitiesIncluded} identities\n• ${responseData.summary.descriptorsIncluded} descriptors\n• ${responseData.summary.eventTypesIncluded} event types`)

    } catch (error) {
      console.error('[AEP Overview] Download error:', error)
      setError(`Download failed: ${error.message}`)
    } finally {
      setDownloadLoading(false)
    }
  }

  // Preview final template
  const previewSchemaDetails = async () => {
    if (selectedSchemas.length === 0) {
      setError('Please select at least one schema to preview.')
      return
    }

    setDownloadLoading(true)
    console.log(`[AEP Overview] Generating preview for ${selectedSchemas.length} schemas`)

    try {
      const previewHeaders = {
        ...actionHeaders,
        'sandboxName': selectedSandbox
      }

      const response = await fetch(allActions.downloadSchemaDetails || `${allActions.getSchemas.replace('/getSchemas', '/downloadSchemaDetails')}`, {
        method: 'POST',
        headers: previewHeaders,
        body: JSON.stringify({
          schemaIds: selectedSchemas
        })
      })

      if (!response.ok) {
        throw new Error(`Preview failed: ${response.status}`)
      }

      const data = await response.json()
      const responseData = data.body || data

      setPreviewData(responseData)
      setShowPreviewModal(true)

    } catch (error) {
      console.error('[AEP Overview] Preview error:', error)
      setError(`Preview failed: ${error.message}`)
    } finally {
      setDownloadLoading(false)
    }
  }

  // Filter schemas based on search term (system schemas already filtered out)
  const filteredSchemas = schemasList.filter(schema => 
    schema.title?.toLowerCase().includes(schemaSearchTerm.toLowerCase()) ||
    schema.description?.toLowerCase().includes(schemaSearchTerm.toLowerCase()) ||
    schema.id?.toLowerCase().includes(schemaSearchTerm.toLowerCase())
  )

  // Original fetch functions (simplified for counts)
  const fetchSchemas = async () => {
    const schemaHeaders = {
      ...actionHeaders,
      'sandboxName': selectedSandbox
    }
    
    const response = await fetch(allActions.getSchemas, {
      headers: schemaHeaders
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch schemas: ${response.status}`)
    }
    
    const data = await response.json()
    const responseData = data.body || data
    const schemaCount = responseData?.results?.length || responseData?.schemas?.length || 0
    return schemaCount
  }

  const fetchDatasets = async () => {
    const datasetHeaders = {
      ...actionHeaders,
      'sandboxName': selectedSandbox
    }
    
    const response = await fetch(allActions.getDatasets, {
      headers: datasetHeaders
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch datasets: ${response.status}`)
    }
    
    const data = await response.json()
    const responseData = data.body || data
    const datasetCount = responseData?.children?.length || responseData?.datasets?.length || 0
    return datasetCount
  }

  const fetchSegments = async () => {
    const segmentHeaders = {
      ...actionHeaders,
      'sandboxName': selectedSandbox
    }
    
    const response = await fetch(allActions.getSegments, {
      headers: segmentHeaders
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch segments: ${response.status}`)
    }
    
    const data = await response.json()
    const responseData = data.body || data
    const segmentCount = responseData?.segments?.length || 0
    return segmentCount
  }

  const fetchProfiles = async () => {
    const profileHeaders = {
      ...actionHeaders,
      'sandboxName': selectedSandbox
    }
    
    const response = await fetch(allActions.getProfileCount, {
      headers: profileHeaders
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch profile count: ${response.status}`)
    }
    
    const data = await response.json()
    const responseData = data.body || data
    const profileCount = responseData?.profileCount || 0
    return profileCount
  }

  const fetchSandboxes = async () => {
    const response = await fetch(allActions.getsandboxes, fetchConfig)
    if (!response.ok) {
      throw new Error(`Failed to fetch sandboxes: ${response.status}`)
    }
    const data = await response.json()
    const responseData = data.body || data
    return responseData?.sandboxes || []
  }

  useEffect(() => {
    if (selectedSandbox && activeTab === 'overview') {
      fetchDashboardData()
    }
  }, [selectedSandbox, activeTab])

  const StatCard = ({ title, count, status = 'positive', icon }) => (
    <Well marginBottom="size-200">
      <Flex direction="column" gap="size-100">
        <Flex justifyContent="space-between" alignItems="center">
          <Text>{title}</Text>
          <StatusLight variant={status}>{icon}</StatusLight>
        </Flex>
        <Heading level={2} margin={0}>
          {isLoading ? '...' : count.toLocaleString()}
        </Heading>
      </Flex>
    </Well>
  )

  return (
    <View padding="size-300">
      <Flex direction="column" gap="size-300">
        <View>
          <Heading level={1} marginBottom="size-200">
            Adobe Experience Platform Overview
          </Heading>
          <Text>
            Monitor key AEP resources and download comprehensive schema packages with all dependencies. 
            Select a sandbox below to get started.
          </Text>
        </View>

        <Divider />

        <View>
          <Heading level={3} marginBottom="size-200">
            Sandbox Selection
          </Heading>
          <SandboxPicker 
            ims={ims}
            parentCallback={handleSandboxSelection}
            width="size-3600"
            contextualHelp={{
              heading: "Sandbox Selection",
              body: "Choose a sandbox to view AEP resource metrics and download schema packages. All data displayed will be specific to the selected sandbox."
            }}
          />
        </View>

        {selectedSandbox && (
          <>
            <Divider />
            
            <Tabs 
              aria-label="AEP Resources"
              selectedKey={activeTab}
              onSelectionChange={handleTabChange}
            >
              <TabList>
                <Item key="overview">📊 Overview</Item>
                <Item key="schemas">🏗️ Schemas</Item>
                <Item key="datasets">🗃️ Datasets</Item>
                <Item key="segments">🎯 Segments</Item>
                <Item key="journeys">🛤️ Journeys</Item>
                <Item key="messages">💬 Messages</Item>
                <Item key="offers">🎁 Offers</Item>
              </TabList>

              <TabPanels>
                {/* Overview Tab */}
                <Item key="overview">
                  <View marginTop="size-300">
                    <Flex justifyContent="space-between" alignItems="center" marginBottom="size-200">
                      <Heading level={3}>
                        Dashboard - {selectedSandbox}
                      </Heading>
                      <Flex alignItems="center" gap="size-100">
                        {lastUpdated && (
                          <Text slot="label">
                            Last updated: {lastUpdated.toLocaleTimeString()}
                          </Text>
                        )}
                        <Button 
                          variant="secondary" 
                          onPress={fetchDashboardData}
                          isDisabled={isLoading}
                        >
                          Refresh
                        </Button>
                      </Flex>
                    </Flex>

                    {isLoading && (
                      <View marginBottom="size-300">
                        <ProgressBar label="Loading dashboard data..." isIndeterminate />
                      </View>
                    )}

                    {error && (
                      <Well marginBottom="size-300">
                        <StatusLight variant="negative">Error</StatusLight>
                        <Text marginStart="size-100">{error}</Text>
                      </Well>
                    )}

                    <Grid
                      areas={[
                        'schemas datasets',
                        'segments profiles'
                      ]}
                      columns={[repeat('auto-fit', 'minmax(250px, 1fr)')]}
                      gap="size-200"
                    >
                      <View gridArea="schemas">
                        <StatCard 
                          title="Total Schemas" 
                          count={dashboardData.schemas}
                          status="positive"
                          icon="📊"
                        />
                      </View>
                      
                      <View gridArea="datasets">
                        <StatCard 
                          title="Total Datasets" 
                          count={dashboardData.datasets}
                          status="positive"
                          icon="🗃️"
                        />
                      </View>
                      
                      <View gridArea="segments">
                        <StatCard 
                          title="Total Segments" 
                          count={dashboardData.segments}
                          status="positive"
                          icon="🎯"
                        />
                      </View>
                      
                      <View gridArea="profiles">
                        <StatCard 
                          title="Total Profiles" 
                          count={dashboardData.profiles}
                          status="neutral"
                          icon="👥"
                        />
                        <Text marginTop="size-100" UNSAFE_style={{ fontSize: '12px', color: '#6B6B6B' }}>
                          Count requires API preview ID
                        </Text>
                      </View>
                    </Grid>

                    {dashboardData.sandboxes.length > 0 && (
                      <View marginTop="size-400">
                        <Heading level={4} marginBottom="size-200">
                          Available Sandboxes ({dashboardData.sandboxes.length})
                        </Heading>
                        <Flex wrap gap="size-100">
                          {dashboardData.sandboxes.map((sandbox, index) => (
                            <Badge 
                              key={index}
                              variant={sandbox.name === selectedSandbox ? 'positive' : 'neutral'}
                            >
                              {sandbox.name}
                            </Badge>
                          ))}
                        </Flex>
                      </View>
                    )}
                  </View>
                </Item>

                {/* Schemas Tab */}
                <Item key="schemas">
                  <View marginTop="size-300">
                    <Flex direction="column" gap="size-300">
                      <Heading level={3}>Schema Download Manager</Heading>
                      
                      <Text>
                        Select one or more schemas to download a comprehensive package including all dependencies: 
                        data types, field groups, datasets, identity descriptors, and event types.
                      </Text>

                      {schemasLoading && (
                        <ProgressBar label="Loading schemas..." isIndeterminate />
                      )}

                      {error && (
                        <Well>
                          <StatusLight variant="negative">Error</StatusLight>
                          <Text marginStart="size-100">{error}</Text>
                        </Well>
                      )}

                      {schemasList.length > 0 && (
                        <View>
                          <Flex direction="row" justifyContent="space-between" alignItems="center" marginBottom="size-200">
                            <Text>
                              <strong>{filteredSchemas.length}</strong> user schemas available (system schemas filtered out)
                            </Text>
                            <SearchField
                              placeholder="Search schemas..."
                              value={schemaSearchTerm}
                              onChange={setSchemaSearchTerm}
                              width="size-3000"
                            />
                          </Flex>

                          <CheckboxGroup
                            value={selectedSchemas}
                            onChange={handleSchemaSelection}
                            aria-label="Select schemas"
                          >
                            <View UNSAFE_style={{ maxHeight: '400px', overflow: 'auto', border: '1px solid #D3D3D3', borderRadius: '4px', padding: '16px' }}>
                              {filteredSchemas.map((schema) => (
                                <View key={schema.id} marginBottom="size-100">
                                  <Checkbox value={schema.id}>
                                    <Flex direction="column" gap="size-50">
                                      <Text><strong>{schema.title}</strong></Text>
                                      <Text UNSAFE_style={{ fontSize: '12px', color: '#6B6B6B' }}>
                                        {schema.description || 'No description'}
                                      </Text>
                                      <Text UNSAFE_style={{ fontSize: '11px', color: '#999', fontFamily: 'monospace' }}>
                                        {schema.id}
                                      </Text>
                                    </Flex>
                                  </Checkbox>
                                </View>
                              ))}
                            </View>
                          </CheckboxGroup>

                          <Flex direction="row" gap="size-200" justifyContent="end" marginTop="size-300">
                            <Button
                              variant="secondary"
                              onPress={previewSchemaDetails}
                              isDisabled={selectedSchemas.length === 0 || downloadLoading}
                            >
                              📋 Preview Final Template
                            </Button>
                            <Button
                              variant="cta"
                              onPress={downloadSchemaDetails}
                              isDisabled={selectedSchemas.length === 0 || downloadLoading}
                            >
                              {downloadLoading ? '⏳ Preparing Download...' : '⬇️ Download Details'}
                            </Button>
                          </Flex>

                          {selectedSchemas.length > 0 && (
                            <Well marginTop="size-200">
                              <Text>
                                <strong>Selected:</strong> {selectedSchemas.length} schema{selectedSchemas.length !== 1 ? 's' : ''} 
                                will be exported with all dependencies (data types, field groups, datasets, identities, descriptors, event types).
                              </Text>
                            </Well>
                          )}
                        </View>
                      )}

                      {!schemasLoading && schemasList.length === 0 && selectedSandbox && (
                        <Well>
                          <Flex direction="column" alignItems="center" gap="size-200">
                            <Text>🏗️</Text>
                            <Heading level={4}>No Profile Schemas Found</Heading>
                            <Text>
                              No Profile class schemas were found in this sandbox, or they haven't loaded yet.
                            </Text>
                            <Button variant="secondary" onPress={fetchDetailedSchemas}>
                              Refresh Schemas
                            </Button>
                          </Flex>
                        </Well>
                      )}
                    </Flex>
                  </View>
                </Item>

                {/* Placeholder tabs for future implementation */}
                <Item key="datasets">
                  <View marginTop="size-300">
                    <Well>
                      <Flex direction="column" alignItems="center" gap="size-200">
                        <Text>🗃️</Text>
                        <Heading level={4}>Datasets Tab</Heading>
                        <Text>Dataset download functionality will be implemented here.</Text>
                      </Flex>
                    </Well>
                  </View>
                </Item>

                <Item key="segments">
                  <View marginTop="size-300">
                    <Well>
                      <Flex direction="column" alignItems="center" gap="size-200">
                        <Text>🎯</Text>
                        <Heading level={4}>Segments Tab</Heading>
                        <Text>Segment export functionality will be implemented here.</Text>
                      </Flex>
                    </Well>
                  </View>
                </Item>

                <Item key="journeys">
                  <View marginTop="size-300">
                    <Well>
                      <Flex direction="column" alignItems="center" gap="size-200">
                        <Text>🛤️</Text>
                        <Heading level={4}>Journeys Tab</Heading>
                        <Text>Journey export functionality will be implemented here.</Text>
                      </Flex>
                    </Well>
                  </View>
                </Item>

                <Item key="messages">
                  <View marginTop="size-300">
                    <Well>
                      <Flex direction="column" alignItems="center" gap="size-200">
                        <Text>💬</Text>
                        <Heading level={4}>Messages Tab</Heading>
                        <Text>Message template export functionality will be implemented here.</Text>
                      </Flex>
                    </Well>
                  </View>
                </Item>

                <Item key="offers">
                  <View marginTop="size-300">
                    <Well>
                      <Flex direction="column" alignItems="center" gap="size-200">
                        <Text>🎁</Text>
                        <Heading level={4}>Offers Tab</Heading>
                        <Text>Offer export functionality will be implemented here.</Text>
                      </Flex>
                    </Well>
                  </View>
                </Item>
              </TabPanels>
            </Tabs>
          </>
        )}

        {!selectedSandbox && (
          <Well>
            <Flex direction="column" alignItems="center" gap="size-200">
              <Text>📊</Text>
              <Heading level={4}>Select a Sandbox</Heading>
              <Text>
                Choose a sandbox from the dropdown above to view your AEP resource overview and access schema download functionality.
              </Text>
            </Flex>
          </Well>
        )}
      </Flex>

      {/* Preview Modal */}
      {showPreviewModal && previewData && (
        <DialogTrigger isOpen={showPreviewModal} onOpenChange={setShowPreviewModal}>
          <ActionButton>Preview</ActionButton>
          <Dialog size="L">
            <Header>
              <Heading level={2}>📋 Schema Export Preview</Heading>
            </Header>
            <Divider />
            <Content>
              <View padding="size-300">
                <Flex direction="column" gap="size-200">
                  <Heading level={3}>Export Summary</Heading>
                  <Grid columns={['1fr', '1fr']} gap="size-200">
                    <View>
                      <Text><strong>Schemas:</strong> {previewData.summary?.schemasProcessed || 0}</Text>
                      <Text><strong>Data Types:</strong> {previewData.summary?.dataTypesIncluded || 0}</Text>
                      <Text><strong>Field Groups:</strong> {previewData.summary?.mixinsIncluded || 0}</Text>
                    </View>
                    <View>
                      <Text><strong>Datasets:</strong> {previewData.summary?.datasetsIncluded || 0}</Text>
                      <Text><strong>Identities:</strong> {previewData.summary?.identitiesIncluded || 0}</Text>
                      <Text><strong>Descriptors:</strong> {previewData.summary?.descriptorsIncluded || 0}</Text>
                    </View>
                  </Grid>
                  
                  <Divider />
                  
                  <Heading level={4}>JSON Structure Preview</Heading>
                  <View UNSAFE_style={{ 
                    backgroundColor: '#F5F5F5', 
                    padding: '16px', 
                    borderRadius: '4px', 
                    maxHeight: '300px', 
                    overflow: 'auto',
                    fontSize: '12px',
                    fontFamily: 'monospace'
                  }}>
                    <pre>{JSON.stringify(previewData.export, null, 2).substring(0, 2000)}...</pre>
                  </View>
                  
                  <Text UNSAFE_style={{ fontSize: '12px', color: '#6B6B6B' }}>
                    This is a truncated preview. The full export will contain all dependencies.
                  </Text>
                </Flex>
              </View>
            </Content>
          </Dialog>
        </DialogTrigger>
      )}
    </View>
  )
}

export default AEPOverview 