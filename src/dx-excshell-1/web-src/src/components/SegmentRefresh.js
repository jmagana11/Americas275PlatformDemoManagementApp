import React, { useState, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import {
    Flex,
    Heading,
    Form,
    ActionButton,
    StatusLight,
    ProgressBar,
    View,
    ListBox,
    Item,
    Text,
    Well,
    Grid,
    Button,
    Badge,
    Tabs,
    TabList,
    TabPanels,
    Item as TabItem,
    Picker,
    Checkbox,
    CheckboxGroup,
    Divider
} from '@adobe/react-spectrum'
import { getActionUrlFromRuntime } from '../utils/actionUrls'

function SegmentRefresh({ runtime, ims }) {
    // Ref to track if component is mounted
    const isMountedRef = useRef(true)
    
    // State for organization and sandbox selection
    const [selectedOrg, setSelectedOrg] = useState('')
    const [selectedOrgId, setSelectedOrgId] = useState('')
    const [selectedSandbox, setSelectedSandbox] = useState('')
    const [sandboxes, setSandboxes] = useState([])
    const [isLoadingSandboxes, setIsLoadingSandboxes] = useState(false)
    
    // State for segments
    const [segments, setSegments] = useState([])
    const [selectedSegmentIds, setSelectedSegmentIds] = useState([])
    const [isLoadingSegments, setIsLoadingSegments] = useState(false)
    
    // State for job management
    const [refreshedSegmentJobItem, setRefreshedSegmentJobItem] = useState(null)
    const [segmentStatusItem, setSegmentStatusItem] = useState(null)
    const [isJobLoading, setIsJobLoading] = useState(false)
    const [isStatusLoading, setIsStatusLoading] = useState(false)
    
    // State for notifications
    const [notification, setNotification] = useState({ type: '', message: '' })

    // Organization options and their corresponding IDs
    const orgOptions = [
        { key: 'MA1HOL', label: 'MA1HOL - Americas 275 Demo', id: 'MA1HOL' },
        { key: 'POT5HOL', label: 'POT5HOL - Americas POT5', id: 'POT5HOL' }
    ]

    // Cleanup effect to prevent memory leaks
    useEffect(() => {
        return () => {
            isMountedRef.current = false
        }
    }, [])

    // Helper function to show notifications
    const showNotification = (type, message) => {
        if (!isMountedRef.current) return
        
        setNotification({ type, message })
        const timeoutId = setTimeout(() => {
            if (isMountedRef.current) {
                setNotification({ type: '', message: '' })
            }
        }, 5000)
        
        // Cleanup timeout if component unmounts
        return () => clearTimeout(timeoutId)
    }

    // Fetch sandboxes for selected organization
    const fetchSandboxes = async (org) => {
        if (!org) {
            showNotification('error', 'Please select an organization')
            return
        }

        setIsLoadingSandboxes(true)
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
            
            const sandboxes = result.body?.sandboxes || result.sandboxes || [];
            setSandboxes(sandboxes);
            showNotification('success', `Found ${sandboxes.length} sandboxes`);
        } catch (error) {
            console.error('Error fetching sandboxes:', error)
            showNotification('error', result.body?.error || result.error || 'Failed to fetch sandboxes');
        } finally {
            setIsLoadingSandboxes(false)
        }
    }

    // Fetch segments for selected sandbox
    const fetchSegments = async () => {
        if (!selectedOrg || !selectedSandbox) {
            showNotification('error', 'Please select both organization and sandbox')
            return
        }

        setIsLoadingSegments(true)
        try {
            const actionUrl = getActionUrlFromRuntime('getSegments', runtime)
            const response = await fetch(actionUrl, {
            method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${ims.token}`,
                    'x-gw-ims-org-id': selectedOrg,
                    'sandboxname': selectedSandbox
                }
            })

            const result = await response.json()
            
            if (result.segments) {
                const refreshableSegments = processSegments(result.segments)
                setSegments(refreshableSegments)
                showNotification('success', `Found ${refreshableSegments.length} batch segments`)
            } else {
                showNotification('error', 'Failed to fetch segments')
            }
        } catch (error) {
            console.error('Error fetching segments:', error)
            showNotification('error', 'Failed to fetch segments')
        } finally {
            setIsLoadingSegments(false)
        }
    }

    // Process segments to filter batch segments
    const processSegments = (segments) => {
        console.log('Raw segments data:', segments)
        return segments.map((segment, index) => {
            console.log(`Segment ${index} - ${segment.name}:`, segment)
            
            // More strict check for batch segments
            const isBatchSegment = segment.type === "SegmentDefinition" && 
                                 (segment.evaluationMethod === "batch" || 
                                  segment.evaluationMethod === "BATCH" ||
                                  segment.evaluationMethod === "Batch" ||
                                  segment.evaluationMethod === undefined ||
                                  segment.evaluationMethod === null);
            
            if (isBatchSegment) {
                console.log(`Found batch segment: ${segment.name} (evaluationMethod: ${segment.evaluationMethod})`)
                return {
                    name: segment.name,
                    id: segment.id,
                    evaluationMethod: segment.evaluationMethod
                }
            }
            console.log(`Skipping non-batch segment: ${segment.name} (evaluationMethod: ${segment.evaluationMethod})`)
            return null
        }).filter(Boolean) // Remove null entries
    }

    // Handle organization selection
    const handleOrgSelection = (org) => {
        setSelectedOrg(org)
        // Find the corresponding org ID
        const orgOption = orgOptions.find(option => option.key === org)
        setSelectedOrgId(orgOption ? orgOption.id : '')
        setSelectedSandbox('')
        setSandboxes([])
        setSegments([])
        setSelectedSegmentIds([])
        setRefreshedSegmentJobItem(null)
        setSegmentStatusItem(null)
        
        if (org) {
            fetchSandboxes(org)
        }
    }

    // Handle sandbox selection
    const handleSandboxSelection = (sandbox) => {
        setSelectedSandbox(sandbox)
        setSegments([])
        setSelectedSegmentIds([])
        setRefreshedSegmentJobItem(null)
        setSegmentStatusItem(null)
    }

    // Handle segment selection
    const handleSegmentSelection = (segmentIds) => {
        setSelectedSegmentIds(segmentIds)
    }

    // Submit refresh job
    const handleSubmit = async (event) => {
        // Only call preventDefault if event exists and has the method
        if (event && typeof event.preventDefault === 'function') {
            event.preventDefault()
        }
        console.log('handleSubmit/selectedSegmentIds', selectedSegmentIds)
        
        if (!selectedSegmentIds.length) {
            showNotification('error', 'No segments selected')
            return
        }

        if (!selectedOrg || !selectedSandbox) {
            showNotification('error', 'Please select both organization and sandbox')
            return
        }

        setIsJobLoading(true)
        try {
            const actionUrl = getActionUrlFromRuntime('refreshSegment', runtime)
            const response = await fetch(actionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${ims.token}`,
                    'x-gw-ims-org-id': selectedOrg,
                    'sandboxname': selectedSandbox,
                    'segmentids': selectedSegmentIds.join(',')
                }
            })

            const result = await response.json()
            
            if (result.id) {
                setRefreshedSegmentJobItem(result.id)
                showNotification('success', 'Segment refresh job created successfully')
            } else {
                showNotification('error', result.error || 'Failed to create refresh job')
            }
        } catch (error) {
            console.error('Error submitting refresh job:', error)
            showNotification('error', 'Failed to create refresh job')
        } finally {
            setIsJobLoading(false)
        }
    }

    // Get job status
    const handleGetJobStatus = async (event) => {
        // Only call preventDefault if event exists and has the method
        if (event && typeof event.preventDefault === 'function') {
            event.preventDefault()
        }
        setIsStatusLoading(true)
        
        try {
            const actionUrl = getActionUrlFromRuntime('getSegmentJobStatus', runtime)
            const response = await fetch(actionUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${ims.token}`,
                    'x-gw-ims-org-id': selectedOrgId,
                    'sandboxName': selectedSandbox,
                    'jobId': refreshedSegmentJobItem
                }
            })

            const result = await response.json()
            
            if (result) {
                setSegmentStatusItem(JSON.parse(result))
                showNotification('success', 'Job status retrieved successfully')
            } else {
                showNotification('error', 'Failed to get job status')
                    }
        } catch (error) {
            console.error('Error getting job status:', error)
            showNotification('error', 'Failed to get job status')
        } finally {
            setIsStatusLoading(false)
        }
    }

    return (
        <View width="size-6000">
            <Heading>Segment Refresh</Heading>
            
            {/* Notification */}
            {notification.message && (
                <Well UNSAFE_style={{ 
                    backgroundColor: notification.type === 'error' ? '#FEE2E2' : '#D1FAE5',
                    border: `1px solid ${notification.type === 'error' ? '#EF4444' : '#10B981'}`
                }}>
                    <Text UNSAFE_style={{ 
                        color: notification.type === 'error' ? '#991B1B' : '#065F46',
                        fontWeight: '500'
                    }}>
                        {notification.message}
                    </Text>
                </Well>
            )}

            <Tabs aria-label="Segment Refresh Tabs">
                <TabList>
                    <TabItem key="setup">Setup</TabItem>
                    <TabItem key="segments">Segments</TabItem>
                    <TabItem key="job">Job Management</TabItem>
                </TabList>
                
                <TabPanels>
                    {/* Setup Tab */}
                    <TabItem key="setup">
                        <Flex direction="column" gap="size-300">
                            <Well>
                                <Flex direction="column" gap="size-200">
                                    <Heading level={3}>Environment Setup</Heading>
                                    
                                    <Grid columns={['1fr', '1fr']} gap="size-200">
                                        <Flex direction="column" gap="size-100">
                                            <Text UNSAFE_style={{ fontWeight: '600', color: '#6B7280' }}>
                                                Organization
                                            </Text>
                                            <Picker
                                                selectedKey={selectedOrg}
                                                onSelectionChange={handleOrgSelection}
                                                isDisabled={isLoadingSandboxes}
                                            >
                                                <Item key="">Select Organization</Item>
                                                {orgOptions.map(org => (
                                                    <Item key={org.key}>{org.label}</Item>
                                                ))}
                                            </Picker>
                                        </Flex>
                                        
                                        <Flex direction="column" gap="size-100">
                                            <Text UNSAFE_style={{ fontWeight: '600', color: '#6B7280' }}>
                                                Sandbox
                                            </Text>
                                            <Picker
                                                selectedKey={selectedSandbox}
                                                onSelectionChange={handleSandboxSelection}
                                                isDisabled={!selectedOrg || isLoadingSandboxes}
                                            >
                                                <Item key="">Select Sandbox</Item>
                                                {sandboxes.map(sandbox => (
                                                    <Item key={sandbox.name}>{sandbox.name}</Item>
                                                ))}
                                            </Picker>
                                        </Flex>
                                    </Grid>
                                    
                                    {isLoadingSandboxes && (
                                        <Flex alignItems="center" gap="size-100">
                                            <ProgressBar size="S" isIndeterminate />
                                            <Text>Loading sandboxes...</Text>
                                        </Flex>
                                    )}
                                </Flex>
                            </Well>
                        </Flex>
                    </TabItem>

                    {/* Segments Tab */}
                    <TabItem key="segments">
                        <Flex direction="column" gap="size-300">
                            <Well>
                                <Flex direction="column" gap="size-200">
                                    <Heading level={3}>Batch Segments</Heading>
                                    
                                    {!selectedOrg || !selectedSandbox ? (
                                        <Text>Please select organization and sandbox first</Text>
                                    ) : (
                                        <>
                                            <Flex direction="column" gap="size-200">
                                                <Button
                                                    variant="secondary"
                                                    onPress={fetchSegments}
                                                    isDisabled={isLoadingSegments}
                                                >
                                                    {isLoadingSegments ? (
                                                        <Flex alignItems="center" gap="size-100">
                                                            <ProgressBar size="S" isIndeterminate />
                                                            <Text>Loading Segments...</Text>
                                                        </Flex>
                                                    ) : (
                                                        <Text>Load Segments</Text>
                                                    )}
                                                </Button>
                                                
                                                {segments.length > 0 && (
                                                    <Flex direction="column" gap="size-100">
                                                        <Text UNSAFE_style={{ fontWeight: '600', color: '#6B7280' }}>
                                                            Available Batch Segments ({segments.length})
                                                        </Text>
                                                        <CheckboxGroup
                                                            value={selectedSegmentIds}
                                                            onChange={handleSegmentSelection}
                                                            isDisabled={isLoadingSegments}
                                                        >
                                                            {segments.map(segment => (
                                                                <Checkbox key={segment.id} value={segment.id}>
                                                                    {segment.name}
                                                                </Checkbox>
                                                            ))}
                                                        </CheckboxGroup>
                </Flex>
                                                )}
                                            
                                                {segments.length > 0 && (
                                                    <Button
                                                        variant="cta"
                                                        onPress={handleSubmit}
                                                        isDisabled={isJobLoading || selectedSegmentIds.length === 0}
                                                    >
                                                        {isJobLoading ? (
                                                            <Flex alignItems="center" gap="size-100">
                                                                <ProgressBar size="S" isIndeterminate />
                                                                <Text>Creating Refresh Job...</Text>
                                                            </Flex>
                                                        ) : (
                                                            <Text>Create Refresh Job</Text>
                                                        )}
                                                    </Button>
                                                )}
                                            </Flex>
                                        </>
                                    )}
                                </Flex>
                            </Well>
                        </Flex>
                    </TabItem>

                    {/* Job Management Tab */}
                    <TabItem key="job">
                        <Flex direction="column" gap="size-300">
                            {!refreshedSegmentJobItem ? (
                                <Well>
                                    <Flex direction="column" gap="size-200">
                                        <Heading level={3}>Job Management</Heading>
                                        <Text>No active job. Create a refresh job from the Segments tab.</Text>
                                    </Flex>
                                </Well>
                            ) : (
                                <Well>
                                    <Flex direction="column" gap="size-200">
                                        <Heading level={3}>Job Status</Heading>
                                        
                                        <Flex direction="column" gap="size-100">
                                            <Text UNSAFE_style={{ fontWeight: '600', color: '#6B7280' }}>
                                                Job ID
                                            </Text>
                                            <Badge variant="info">{refreshedSegmentJobItem}</Badge>
                                        </Flex>
                                        
                                        <Button
                                            variant="secondary"
                                            onPress={handleGetJobStatus}
                                            isDisabled={isStatusLoading}
                                        >
                                            {isStatusLoading ? (
                                                <Flex alignItems="center" gap="size-100">
                                                    <ProgressBar size="S" isIndeterminate />
                                                    <Text>Checking Status...</Text>
                                                </Flex>
                                            ) : (
                                                <Text>Check Job Status</Text>
            )}
                                        </Button>
                                        
            {segmentStatusItem && (
                                            <Flex direction="column" gap="size-100">
                                                <Text UNSAFE_style={{ fontWeight: '600', color: '#6B7280' }}>
                                                    Status
                                                </Text>
                                                <StatusLight variant="positive">
                                                    {segmentStatusItem.status}
                                                </StatusLight>
                                                
                                                {segmentStatusItem.progress && (
                                                    <Flex direction="column" gap="size-50">
                                                        <Text UNSAFE_style={{ fontWeight: '600', color: '#6B7280' }}>
                                                            Progress
                                                        </Text>
                                                        <ProgressBar 
                                                            value={segmentStatusItem.progress} 
                                                            showValueLabel 
                                                        />
                                                    </Flex>
                                                )}
                                            </Flex>
                                        )}
                                    </Flex>
                                </Well>
            )}
                        </Flex>
                    </TabItem>
                </TabPanels>
            </Tabs>
        </View>
    )
}

SegmentRefresh.propTypes = {
    runtime: PropTypes.any,
    ims: PropTypes.any
}

export default SegmentRefresh
