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
  TextField
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
import * as XLSX from 'xlsx'
import { getActionUrlFromRuntime } from '../utils/actionUrls'

// Add CSS for tag button hover effects
const tagButtonStyles = `
  .tag-button:hover {
    background-color: var(--spectrum-red-100) !important;
    border-color: var(--spectrum-red-400) !important;
    transform: scale(0.95);
  }
  .tag-button:hover .spectrum-Icon {
    color: var(--spectrum-red-700) !important;
  }
`

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style')
  styleSheet.textContent = tagButtonStyles
  document.head.appendChild(styleSheet)
}

const AIPromptGeneratorEnhanced = ({ runtime, ims }) => {
  // File and processing states
  const [file, setFile] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [analysisResults, setAnalysisResults] = useState(null)
  
  // Image and tag selection states
  const [selectedTags, setSelectedTags] = useState({}) // Per image tag selections
  const [imagePrompts, setImagePrompts] = useState({}) // Generated prompts per image
  const [imageGenerations, setImageGenerations] = useState({}) // Generated images per image
  
  // Processing states
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState({})
  const [isGeneratingImages, setIsGeneratingImages] = useState({})
  const [batchGenerating, setBatchGenerating] = useState(false)
  
  // UI states
  const [activeTab, setActiveTab] = useState('upload')
  const [notification, setNotification] = useState(null)
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'carousel'
  
  // Save/Load states
  const [sessionName, setSessionName] = useState('')
  const [savedSessions, setSavedSessions] = useState([])
  const [showLoadDialog, setShowLoadDialog] = useState(false)

  // Load saved sessions on mount
  useEffect(() => {
    loadSavedSessions()
  }, [])

  // Auto-save functionality - runs every 5 seconds
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      // Only auto-save if there's meaningful data and a session name
      if (sessionName.trim() && analysisResults && 
          (Object.keys(selectedTags).length > 0 || 
           Object.keys(imagePrompts).length > 0 || 
           Object.keys(imageGenerations).length > 0)) {
        
        autoSaveSession()
      }
    }, 5000) // 5 seconds

    return () => clearInterval(autoSaveInterval)
  }, [sessionName, analysisResults, selectedTags, imagePrompts, imageGenerations])

  const autoSaveSession = () => {
    try {
      const sessionData = {
        id: Date.now(),
        name: sessionName,
        timestamp: new Date().toISOString(),
        analysisResults,
        selectedTags,
        imagePrompts,
        imageGenerations,
        fileName: file?.name
      }

      const sessions = JSON.parse(localStorage.getItem('aiPromptSessions') || '[]')
      const existingIndex = sessions.findIndex(s => s.name === sessionName)
      
      if (existingIndex !== -1) {
        sessions[existingIndex] = sessionData
      } else {
        sessions.push(sessionData)
      }

      localStorage.setItem('aiPromptSessions', JSON.stringify(sessions))
      setSavedSessions(sessions)
      console.log(`🔄 Auto-saved session "${sessionName}" at ${new Date().toLocaleTimeString()}`)
    } catch (error) {
      console.error('Error during auto-save:', error)
    }
  }

  const loadSavedSessions = () => {
    try {
      const sessions = JSON.parse(localStorage.getItem('aiPromptSessions') || '[]')
      setSavedSessions(sessions)
    } catch (error) {
      console.error('Error loading saved sessions:', error)
    }
  }

  const saveSession = () => {
    if (!sessionName.trim()) {
      showNotification('error', 'Please enter a session name')
      return
    }

    try {
      const sessionData = {
        id: Date.now(),
        name: sessionName,
        timestamp: new Date().toISOString(),
        analysisResults,
        selectedTags,
        imagePrompts,
        imageGenerations,
        fileName: file?.name
      }

      const sessions = JSON.parse(localStorage.getItem('aiPromptSessions') || '[]')
      const existingIndex = sessions.findIndex(s => s.name === sessionName)
      
      if (existingIndex !== -1) {
        sessions[existingIndex] = sessionData
      } else {
        sessions.push(sessionData)
      }

      localStorage.setItem('aiPromptSessions', JSON.stringify(sessions))
      setSavedSessions(sessions)
      setSessionName('')
      showNotification('success', `Session "${sessionData.name}" saved successfully!`)
    } catch (error) {
      console.error('Error saving session:', error)
      showNotification('error', 'Error saving session')
    }
  }

  const loadSession = (session) => {
    try {
      setAnalysisResults(session.analysisResults)
      setSelectedTags(session.selectedTags || {})
      setImagePrompts(session.imagePrompts || {})
      setImageGenerations(session.imageGenerations || {})
      
      // Create a mock file object if we have the fileName
      if (session.fileName) {
        setFile({ name: session.fileName })
      }
      
      // Populate session name field for continued saving
      setSessionName(session.name)
      
      // Navigate to appropriate tab based on session content
      if (Object.keys(session.imageGenerations || {}).length > 0) {
        setActiveTab('gallery')
      } else if (Object.keys(session.imagePrompts || {}).length > 0) {
        setActiveTab('prompts')
      } else {
        setActiveTab('analysis')
      }
      
      setShowLoadDialog(false)
      showNotification('success', `Session "${session.name}" loaded successfully!`)
    } catch (error) {
      console.error('Error loading session:', error)
      showNotification('error', 'Error loading session')
    }
  }

  const deleteSession = (sessionId) => {
    try {
      const sessions = savedSessions.filter(s => s.id !== sessionId)
      localStorage.setItem('aiPromptSessions', JSON.stringify(sessions))
      setSavedSessions(sessions)
      showNotification('success', 'Session deleted successfully!')
    } catch (error) {
      console.error('Error deleting session:', error)
      showNotification('error', 'Error deleting session')
    }
  }

  const handleFileDrop = async (e) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer?.files?.[0]
    if (droppedFile) {
      setFile(droppedFile)
      await processExcelFile(droppedFile)
    }
  }

  const handleFileUpload = async (event) => {
    const uploadedFile = event.target.files[0]
    if (uploadedFile) {
      setFile(uploadedFile)
      await processExcelFile(uploadedFile)
    }
  }

  const processExcelFile = async (excelFile) => {
    setIsProcessing(true)
    try {
      const arrayBuffer = await excelFile.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      
      const imageRefSheet = workbook.Sheets['ImageRef']
      if (!imageRefSheet) {
        showNotification('error', 'Could not find "ImageRef" sheet in the uploaded file')
        return
      }

      const jsonData = XLSX.utils.sheet_to_json(imageRefSheet)
      const imageUrls = jsonData
        .map(row => row.imageLocation)
        .filter(url => url && typeof url === 'string' && url.trim() !== '')

      if (imageUrls.length === 0) {
        showNotification('error', 'No valid image URLs found in the imageLocation column')
        return
      }

      await analyzeImages(imageUrls, excelFile.name)

    } catch (error) {
      console.error('Error processing Excel file:', error)
      showNotification('error', 'Error processing the Excel file. Please make sure it has the correct format.')
    } finally {
      setIsProcessing(false)
    }
  }

  const analyzeImages = async (imageUrls, fileName) => {
    try {
      const requestData = { imageUrls, fileName }

      const response = await fetch(getActionUrlFromRuntime('image-analysis', runtime), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      const resultData = result.body || result
      setAnalysisResults(resultData)
      setActiveTab('analysis')

    } catch (error) {
      console.error('Error analyzing images:', error)
      showNotification('error', 'Error analyzing images. Please try again.')
    }
  }

  const handleTagSelection = (imageIndex, tagNames) => {
    setSelectedTags(prev => ({
      ...prev,
      [imageIndex]: tagNames
    }))
  }

  const removeTagFromImage = (imageIndex, tagToRemove) => {
    setSelectedTags(prev => ({
      ...prev,
      [imageIndex]: prev[imageIndex]?.filter(tag => tag !== tagToRemove) || []
    }))
    
    // If there was a prompt for this image, suggest regenerating it
    if (imagePrompts[imageIndex]) {
      showNotification('success', `Tag "${tagToRemove}" removed. Consider regenerating the prompt to reflect the changes.`)
    } else {
      showNotification('success', `Tag "${tagToRemove}" removed from image`)
    }
  }

  const generatePromptForImage = async (imageIndex) => {
    const imageResult = analysisResults.results[imageIndex]
    const imageTags = selectedTags[imageIndex]
    
    if (!imageTags || imageTags.length === 0) {
      showNotification('error', `Please select tags for ${imageResult.imageName}`)
      return
    }

    setIsGeneratingPrompts(prev => ({ ...prev, [imageIndex]: true }))
    
    try {
      const requestData = {
        imageName: imageResult.imageName,
        selectedTags: imageTags
      }

      const response = await fetch(getActionUrlFromRuntime('prompt-generation', runtime), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      const resultBody = result.body || result
      
      setImagePrompts(prev => ({
        ...prev,
        [imageIndex]: resultBody.generatedPrompt || 'No prompt generated'
      }))

    } catch (error) {
      console.error('Error generating prompt:', error)
      showNotification('error', `Error generating prompt for ${imageResult.imageName}`)
    } finally {
      setIsGeneratingPrompts(prev => ({ ...prev, [imageIndex]: false }))
    }
  }

  const generateImageForPrompt = async (imageIndex) => {
    const prompt = imagePrompts[imageIndex]
    const imageResult = analysisResults.results[imageIndex]
    
    if (!prompt || prompt.trim() === '') {
      showNotification('error', `Please generate a prompt for ${imageResult.imageName} first`)
      return
    }

    // Validate prompt length (DALL-E has limits)
    if (prompt.length > 4000) {
      showNotification('error', `Prompt too long for ${imageResult.imageName}. Please regenerate a shorter prompt.`)
      return
    }

    setIsGeneratingImages(prev => ({ ...prev, [imageIndex]: true }))

    try {
      const requestData = { prompt }

      const response = await fetch(getActionUrlFromRuntime('image-generation', runtime), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('API response error:', errorText)
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
      }

      const result = await response.json()
      const resultBody = result.body || result
      
      // Check for API-specific errors
      if (resultBody.error) {
        throw new Error(resultBody.error)
      }
      
      if (resultBody.type === 'content_policy_violation') {
        showNotification('error', `Content policy violation for ${imageResult.imageName}: ${resultBody.message}`)
        return
      }

      setImageGenerations(prev => ({
        ...prev,
        [imageIndex]: resultBody
      }))

      showNotification('success', `🖼️ Image generated for ${imageResult.imageName}! Check the Gallery tab to view it.`)

    } catch (error) {
      console.error('Error generating image:', error)
      console.error('Full error details:', error.message)
      
      // More specific error messages
      let errorMessage = `Error generating image for ${imageResult.imageName}`
      if (error.message.includes('429')) {
        errorMessage += ': Rate limit exceeded. Please wait and try again.'
      } else if (error.message.includes('400')) {
        errorMessage += ': Invalid prompt. Try regenerating the prompt first.'
      } else if (error.message.includes('500')) {
        errorMessage += ': Server error. Please try again later.'
      } else {
        errorMessage += `: ${error.message}`
      }
      
      showNotification('error', errorMessage)
    } finally {
      setIsGeneratingImages(prev => ({ ...prev, [imageIndex]: false }))
    }
  }

  const generateAllPrompts = async () => {
    setBatchGenerating(true)
    const imagesWithTags = analysisResults.results
      .map((result, index) => ({ result, index, tags: selectedTags[index] }))
      .filter(({ tags }) => tags && tags.length > 0)

    if (imagesWithTags.length === 0) {
      showNotification('error', 'Please select tags for at least one image')
      setBatchGenerating(false)
      return
    }

    for (const { index } of imagesWithTags) {
      if (!imagePrompts[index]) {
        await generatePromptForImage(index)
        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    setBatchGenerating(false)
    showNotification('success', `Generated prompts for ${imagesWithTags.length} images`)
  }



  const resetAnalysis = () => {
    setFile(null)
    setAnalysisResults(null)
    setSelectedTags({})
    setImagePrompts({})
    setImageGenerations({})
    setActiveTab('upload')
  }

  const showNotification = (type, message) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 5000)
  }

  const downloadTemplate = () => {
    try {
      const templateData = [
        {
          imageLocation: 'https://example.com/sample-image-1.jpg',
          description: 'Sample image 1 (replace with your image URL)'
        },
        {
          imageLocation: 'https://example.com/sample-image-2.jpg', 
          description: 'Sample image 2 (replace with your image URL)'
        }
      ]

      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.json_to_sheet(templateData)
      worksheet['!cols'] = [{ wch: 50 }, { wch: 40 }]
      XLSX.utils.book_append_sheet(workbook, worksheet, 'ImageRef')
      
      const fileName = 'AI_Prompt_Generator_Template.xlsx'
      XLSX.writeFile(workbook, fileName)
      
      showNotification('success', 'Template downloaded successfully!')
      
    } catch (error) {
      console.error('Error generating template:', error)
      showNotification('error', 'Error generating template file')
    }
  }

  const getImageStats = () => {
    if (!analysisResults) return { total: 0, tagged: 0, prompted: 0, generated: 0 }
    
    const total = analysisResults.results?.length || 0
    const tagged = Object.keys(selectedTags).filter(key => selectedTags[key]?.length > 0).length
    const prompted = Object.keys(imagePrompts).length
    const generated = Object.keys(imageGenerations).length
    
    return { total, tagged, prompted, generated }
  }

  const stats = getImageStats()

  return (
    <View padding="size-400" maxWidth="1400px" marginX="auto">
      <style>
        {`
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          .image-carousel { display: flex; transition: transform 0.3s ease; }
          .carousel-container { overflow: hidden; border-radius: 8px; }
        `}
      </style>
      
      <Flex justifyContent="space-between" alignItems="center" marginBottom="size-300">
        <View>
          <Heading level={1}>🤖 AI Prompt Generator</Heading>
          <Content marginTop="size-100">
            Advanced tool for analyzing images, generating prompts, and creating AI images
          </Content>
        </View>
        
        {analysisResults && (
          <Flex gap="size-200" alignItems="center">
            <ButtonGroup>
              <Button variant="secondary" onPress={() => setShowLoadDialog(true)}>
                <FolderOpen />
                <Text>Load Session</Text>
              </Button>
              <TextField 
                placeholder="Session name"
                value={sessionName}
                onChange={setSessionName}
                width="size-2000"
              />
              <Button variant="primary" onPress={saveSession} isDisabled={!sessionName.trim()}>
                <SaveFloppy />
                <Text>Save</Text>
              </Button>
            </ButtonGroup>
          </Flex>
        )}
      </Flex>

      {/* Stats Bar */}
      {analysisResults && (
        <Well marginBottom="size-300">
          <Flex justifyContent="space-between" alignItems="center">
            <Flex gap="size-300">
              <Badge variant="info">{stats.total} Images</Badge>
              <Badge variant="positive">{stats.tagged} Tagged</Badge>
              <Badge variant="neutral">{stats.prompted} Prompted</Badge>
              <Badge variant="negative">{stats.generated} Generated</Badge>
            </Flex>
            <ButtonGroup>
              <Button 
                variant="secondary" 
                onPress={generateAllPrompts}
                isDisabled={batchGenerating || stats.tagged === 0}
              >
                <Play />
                <Text>{batchGenerating ? 'Processing...' : 'Generate All Prompts'}</Text>
              </Button>
            </ButtonGroup>
          </Flex>
        </Well>
      )}

      <Tabs selectedKey={activeTab} onSelectionChange={setActiveTab}>
        <TabList>
          <Item key="upload">📁 Upload & Process</Item>
          {analysisResults && <Item key="analysis">🏷️ Tag Selection</Item>}
          {analysisResults && <Item key="prompts">✨ Prompt Generation</Item>}
          {Object.keys(imageGenerations).length > 0 && (
            <Item key="gallery">
              🖼️ Image Gallery
              <Badge variant="positive" marginStart="size-100">{Object.keys(imageGenerations).length}</Badge>
            </Item>
          )}
          <Item key="ai-docs">🤖 AI Documentation</Item>
        </TabList>
        
        <TabPanels>
          {/* Upload Tab */}
          <Item key="upload">
            <View marginTop="size-300">
              {!analysisResults ? (
                <Flex justifyContent="center" marginTop="size-400">
                  <View>
                    <Well
                      maxWidth="size-6000"
                      height="size-2400"
                      UNSAFE_style={{
                        border: '2px dashed var(--spectrum-global-color-gray-400)',
                        borderRadius: '8px',
                        padding: '40px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        backgroundColor: file ? 'var(--spectrum-global-color-gray-75)' : 'transparent'
                      }}
                      onDrop={handleFileDrop}
                      onDragOver={(e) => e.preventDefault()}
                      onDragEnter={(e) => e.preventDefault()}
                      onClick={() => document.getElementById('file-upload').click()}
                    >
                      <IllustratedMessage>
                        <DataUpload />
                        <Heading>{file ? file.name : 'Drop your Excel file here'}</Heading>
                        <Content>
                          {file ? 'File ready to process' : 'Excel file with ImageRef sheet containing image URLs'}
                        </Content>
                      </IllustratedMessage>
                    </Well>
                    
                    <View marginTop="size-200">
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                        id="file-upload"
                      />
                      <Flex justifyContent="center" alignItems="center" gap="size-200" marginBottom="size-200">
                        <Button variant="secondary" onPress={downloadTemplate}>Download Template</Button>
                        <Button variant="secondary" onPress={() => setShowLoadDialog(true)}>
                          <FolderOpen />
                          <Text>Load Session</Text>
                        </Button>
                        <Button variant="primary" onPress={() => document.getElementById('file-upload').click()}>
                          Choose File
                        </Button>
                      </Flex>
                    </View>

                    {isProcessing && (
                      <View marginTop="size-300">
                        <Flex direction="column" alignItems="center" gap="size-200">
                          <div style={{
                            width: '40px', height: '40px',
                            border: '4px solid var(--spectrum-gray-200)',
                            borderTop: '4px solid var(--spectrum-blue-600)',
                            borderRadius: '50%', animation: 'spin 1s linear infinite'
                          }} />
                          <Text weight="bold">Analyzing images...</Text>
                          <ProgressBar label="" isIndeterminate />
                        </Flex>
                      </View>
                    )}
                  </View>
                </Flex>
              ) : (
                <View>
                  <Flex justifyContent="space-between" alignItems="center">
                    <StatusLight variant="positive">
                      ✅ Analysis complete! Processed {analysisResults.successfulAnalyses} of {analysisResults.totalImages} images
                    </StatusLight>
                    <ActionButton onPress={resetAnalysis}>
                      <Refresh />
                      <Text>Start Over</Text>
                    </ActionButton>
                  </Flex>
                </View>
              )}
            </View>
          </Item>

          {/* Tag Selection Tab */}
          {analysisResults && (
            <Item key="analysis">
              <View marginTop="size-300">
                <Heading level={2} marginBottom="size-200">🏷️ Select Tags for Each Image</Heading>
                <Text marginBottom="size-300">
                  Review each image and select the most relevant tags that will be used to generate AI prompts.
                </Text>
                
                <Grid
                  areas={['list']}
                  columns={['1fr']}
                  gap="size-300"
                >
                  {analysisResults.results?.map((result, index) => (
                    <View key={index} marginBottom="size-300">
                      <Well>
                        <Flex gap="size-300">
                          {/* Image Preview */}
                          <View flexShrink={0}>
                            {!result.error ? (
                              <img 
                                src={result.imageUrl} 
                                alt={result.imageName}
                                style={{ 
                                  width: '120px', height: '120px', objectFit: 'cover',
                                  borderRadius: '8px', border: '2px solid var(--spectrum-gray-300)'
                                }}
                              />
                            ) : (
                              <View
                                width="120px"
                                height="120px"
                                UNSAFE_style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  backgroundColor: 'var(--spectrum-gray-100)', borderRadius: '8px',
                                  border: '2px solid var(--spectrum-gray-300)'
                                }}
                              >
                                <Alert size="L" />
                              </View>
                            )}
                          </View>

                          {/* Image Info and Tag Selection */}
                          <View flex={1}>
                            <Flex direction="column" gap="size-200">
                              <View>
                                <Text weight="bold" size="L">{result.imageName}</Text>
                                <Text UNSAFE_style={{ fontSize: '12px', color: '#6B6B6B', wordBreak: 'break-all' }}>
                                  {result.imageUrl}
                                </Text>
                              </View>

                              {result.error ? (
                                <StatusLight variant={result.error.includes('429') ? 'notice' : 'negative'}>
                                  {result.error.includes('429') ? <Clock /> : <Alert />}
                                  {result.status || 'Analysis failed'}
                                </StatusLight>
                              ) : (
                                <View>
                                  <Flex justifyContent="space-between" alignItems="center" marginBottom="size-100">
                                    <Text weight="bold">Available Tags ({result.tags?.length || 0})</Text>
                                    {selectedTags[index]?.length > 0 && (
                                      <Badge variant="positive">{selectedTags[index].length} selected</Badge>
                                    )}
                                  </Flex>
                                  
                                  <CheckboxGroup
                                    value={selectedTags[index] || []}
                                    onChange={(tagNames) => handleTagSelection(index, tagNames)}
                                    orientation="horizontal"
                                  >
                                    <Flex wrap gap="size-100">
                                      {result.tags?.map((tag, tagIndex) => (
                                        <Checkbox key={tagIndex} value={tag.name}>
                                          <Flex alignItems="center" gap="size-50">
                                            <Text>{tag.name}</Text>
                                            <Badge variant="info" size="S">
                                              {(tag.confidence * 100).toFixed(0)}%
                                            </Badge>
                                          </Flex>
                                        </Checkbox>
                                      ))}
                                    </Flex>
                                  </CheckboxGroup>
                                </View>
                              )}
                            </Flex>
                          </View>
                        </Flex>
                      </Well>
                    </View>
                  ))}
                </Grid>
              </View>
            </Item>
          )}

          {/* Prompt Generation Tab */}
          {analysisResults && (
            <Item key="prompts">
              <View marginTop="size-300">
                <Heading level={2} marginBottom="size-200">✨ Generate & Refine Prompts</Heading>
                <Text marginBottom="size-300">
                  Generate AI prompts for each image based on selected tags, then create images using DALL-E 3.
                </Text>
                
                {analysisResults.results?.map((result, index) => {
                  const hasSelectedTags = selectedTags[index]?.length > 0
                  const hasPrompt = imagePrompts[index]
                  const hasGeneratedImage = imageGenerations[index]
                  
                  if (!hasSelectedTags && !hasPrompt) return null

                  return (
                    <View key={index} marginBottom="size-400">
                      <Well>
                        <Grid
                          areas={['image content']}
                          columns={['200px', '1fr']}
                          gap="size-300"
                        >
                          <View gridArea="image">
                            <img 
                              src={result.imageUrl} 
                              alt={result.imageName}
                              style={{ 
                                width: '100%', height: '150px', objectFit: 'cover',
                                borderRadius: '8px'
                              }}
                            />
                            <Text weight="bold" marginTop="size-100">{result.imageName}</Text>
                          </View>

                          <View gridArea="content">
                            <Flex direction="column" gap="size-200">
                              {/* Selected Tags */}
                              {hasSelectedTags && (
                                <View>
                                  <Flex justifyContent="space-between" alignItems="center" marginBottom="size-100">
                                    <Text weight="bold">🏷️ Selected Tags:</Text>
                                    <Text size="S" UNSAFE_style={{ color: '#6B6B6B' }}>
                                      Click ✕ to remove tags
                                    </Text>
                                  </Flex>
                                  <Flex gap="size-75" wrap>
                                    {selectedTags[index].map((tagName, tagIndex) => (
                                      <ActionButton
                                        key={tagIndex}
                                        onPress={() => removeTagFromImage(index, tagName)}
                                        UNSAFE_style={{
                                          backgroundColor: 'var(--spectrum-blue-100)',
                                          border: '1px solid var(--spectrum-blue-400)',
                                          borderRadius: '16px',
                                          padding: '4px 12px',
                                          fontSize: '12px',
                                          color: 'var(--spectrum-blue-700)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                          cursor: 'pointer',
                                          transition: 'all 0.2s ease'
                                        }}
                                        UNSAFE_className="tag-button"
                                      >
                                        <Text size="XS" UNSAFE_style={{ color: 'inherit' }}>{tagName}</Text>
                                        <Close size="XS" UNSAFE_style={{ color: 'var(--spectrum-red-600)' }} />
                                      </ActionButton>
                                    ))}
                                  </Flex>
                                </View>
                              )}

                              {/* Prompt Generation */}
                              <View>
                                <Flex justifyContent="space-between" alignItems="center" marginBottom="size-100">
                                  <Text weight="bold">✨ Generated Prompt:</Text>
                                  <ButtonGroup>
                                    <Button 
                                      size="S"
                                      variant="primary" 
                                      onPress={() => generatePromptForImage(index)}
                                      isDisabled={isGeneratingPrompts[index] || !hasSelectedTags}
                                    >
                                      {isGeneratingPrompts[index] ? 'Generating...' : hasPrompt ? 'Regenerate' : 'Generate Prompt'}
                                    </Button>
                                    {hasPrompt && (
                                      <Button 
                                        size="S"
                                        variant="secondary" 
                                        onPress={() => generateImageForPrompt(index)}
                                        isDisabled={isGeneratingImages[index]}
                                      >
                                        {isGeneratingImages[index] ? 'Creating...' : hasGeneratedImage ? 'Regenerate for Gallery' : 'Generate for Gallery'}
                                      </Button>
                                    )}
                                  </ButtonGroup>
                                </Flex>

                                {hasPrompt && (
                                  <TextArea
                                    value={imagePrompts[index]}
                                    onChange={(value) => setImagePrompts(prev => ({ ...prev, [index]: value }))}
                                    width="100%"
                                    height="size-1000"
                                  />
                                )}
                              </View>

                              {/* Generated Image Status */}
                              {hasGeneratedImage && (
                                <View>
                                  <Flex alignItems="center" gap="size-100">
                                    <CheckmarkCircle color="positive" />
                                    <Text weight="bold">✅ Image generated successfully! Check the Gallery tab to view it.</Text>
                                  </Flex>
                                </View>
                              )}
                            </Flex>
                          </View>
                        </Grid>
                      </Well>
                    </View>
                  )
                })}
              </View>
            </Item>
          )}

          {/* Image Gallery Tab */}
          {Object.keys(imageGenerations).length > 0 && (
            <Item key="gallery">
              <View marginTop="size-300">
                <Flex justifyContent="space-between" alignItems="center" marginBottom="size-300">
                  <Heading level={2}>🖼️ Generated Images Gallery</Heading>
                  <ButtonGroup>
                    <ActionButton 
                      isSelected={viewMode === 'grid'}
                      onPress={() => setViewMode('grid')}
                    >
                      <ViewGrid />
                      <Text>Grid</Text>
                    </ActionButton>
                    <ActionButton 
                      isSelected={viewMode === 'carousel'}
                      onPress={() => setViewMode('carousel')}
                    >
                      <ViewSingle />
                      <Text>Carousel</Text>
                    </ActionButton>
                  </ButtonGroup>
                </Flex>

                {viewMode === 'grid' ? (
                  <Grid columns={['repeat(auto-fit, minmax(300px, 1fr))']} gap="size-200">
                    {Object.entries(imageGenerations).map(([index, generation]) => {
                      const imageResult = analysisResults.results[parseInt(index)]
                      return (
                        <Well key={index}>
                          <Flex direction="column" gap="size-200">
                            <Text weight="bold">{imageResult.imageName}</Text>
                            
                            <Flex gap="size-200">
                              <View flex={1}>
                                <Text size="S" marginBottom="size-50">📷 Original</Text>
                                <img 
                                  src={imageResult.imageUrl} 
                                  alt="Original"
                                  style={{ 
                                    width: '100%', height: '150px', objectFit: 'cover',
                                    borderRadius: '4px'
                                  }}
                                />
                              </View>
                              <View flex={1}>
                                <Text size="S" marginBottom="size-50">🤖 Generated</Text>
                                <img 
                                  src={generation.imageUrl} 
                                  alt="Generated"
                                  style={{ 
                                    width: '100%', height: '150px', objectFit: 'cover',
                                    borderRadius: '4px'
                                  }}
                                />
                              </View>
                            </Flex>

                            <View>
                              <Text size="S" weight="bold" marginBottom="size-50">✨ Prompt:</Text>
                              <Text size="S" UNSAFE_style={{ 
                                fontSize: '11px', color: '#6B6B6B', 
                                display: '-webkit-box', WebkitLineClamp: 3,
                                WebkitBoxOrient: 'vertical', overflow: 'hidden'
                              }}>
                                {imagePrompts[index]}
                              </Text>
                            </View>
                          </Flex>
                        </Well>
                      )
                    })}
                  </Grid>
                ) : (
                  <View>
                    {/* Carousel View */}
                    <View className="carousel-container" marginBottom="size-200">
                      <div style={{ position: 'relative' }}>
                        {Object.entries(imageGenerations).map(([index, generation], carouselIdx) => {
                          const imageResult = analysisResults.results[parseInt(index)]
                          const isActive = carouselIdx === carouselIndex
                          
                          return (
                            <Well 
                              key={index}
                              UNSAFE_style={{
                                display: isActive ? 'block' : 'none',
                                minHeight: '400px'
                              }}
                            >
                              <Grid
                                areas={['original generated', 'prompt prompt']}
                                columns={['1fr', '1fr']}
                                rows={['300px', 'auto']}
                                gap="size-300"
                              >
                                <View gridArea="original">
                                  <Text weight="bold" marginBottom="size-100">📷 Original: {imageResult.imageName}</Text>
                                  <img 
                                    src={imageResult.imageUrl} 
                                    alt="Original"
                                    style={{ 
                                      width: '100%', height: '250px', objectFit: 'cover',
                                      borderRadius: '8px', border: '2px solid var(--spectrum-gray-300)'
                                    }}
                                  />
                                </View>
                                <View gridArea="generated">
                                  <Text weight="bold" marginBottom="size-100">🤖 AI Generated</Text>
                                  <img 
                                    src={generation.imageUrl} 
                                    alt="Generated"
                                    style={{ 
                                      width: '100%', height: '250px', objectFit: 'cover',
                                      borderRadius: '8px', border: '2px solid var(--spectrum-blue-400)'
                                    }}
                                  />
                                </View>
                                <View gridArea="prompt">
                                  <Text weight="bold" marginBottom="size-100">✨ Generated Prompt:</Text>
                                  <Well>
                                    <Text size="S">{imagePrompts[index]}</Text>
                                  </Well>
                                </View>
                              </Grid>
                            </Well>
                          )
                        })}

                        {/* Carousel Navigation */}
                        <Flex justifyContent="center" gap="size-200" marginTop="size-200">
                          <ActionButton 
                            onPress={() => setCarouselIndex(Math.max(0, carouselIndex - 1))}
                            isDisabled={carouselIndex === 0}
                          >
                            <ChevronLeft />
                          </ActionButton>
                          
                          <Text>{carouselIndex + 1} of {Object.keys(imageGenerations).length}</Text>
                          
                          <ActionButton 
                            onPress={() => setCarouselIndex(Math.min(Object.keys(imageGenerations).length - 1, carouselIndex + 1))}
                            isDisabled={carouselIndex === Object.keys(imageGenerations).length - 1}
                          >
                            <ChevronRight />
                          </ActionButton>
                        </Flex>
                      </div>
                    </View>
                  </View>
                )}
              </View>
            </Item>
          )}

          {/* AI Documentation Tab */}
          <Item key="ai-docs">
            <View padding="size-200">
              <Flex direction="column" gap="size-300">
                <Well>
                  <Heading level={4}>📖 How to Use the AI Prompt Generator</Heading>
                  <Text>
                    Complete step-by-step guide to using the AI Prompt Generator for analyzing images, 
                    generating prompts, and creating new images with DALL-E 3.
                  </Text>
                </Well>

                <Well>
                  <Heading level={4}>🚀 Getting Started</Heading>
                  <Text><strong>What This App Does:</strong></Text>
                  <Text>• Analyzes images from Excel files using Azure Computer Vision</Text>
                  <Text>• Extracts relevant tags and keywords from each image</Text>
                  <Text>• Generates optimized prompts for AI image creation</Text>
                  <Text>• Creates new images using OpenAI's DALL-E 3 model</Text>
                  <Text>• Manages sessions to save and resume your work</Text>
                  <br/>
                  <Text><strong>Before You Start:</strong></Text>
                  <Text>• Prepare an Excel file with image URLs (see template requirements below)</Text>
                  <Text>• Ensure all images are publicly accessible via direct URLs</Text>
                  <Text>• Have a clear idea of what type of images you want to generate</Text>
                </Well>

                <Well>
                  <Heading level={4}>📁 Step 1: Upload & Process</Heading>
                  <Text><strong>Preparing Your Excel File:</strong></Text>
                  <Text>• Create a sheet named exactly "ImageRef"</Text>
                  <Text>• Put image URLs in Column A (one URL per row)</Text>
                  <Text>• URLs must point directly to image files (.jpg, .png, .gif, .bmp)</Text>
                  <Text>• Maximum recommended: 50 images per batch</Text>
                  <br/>
                  <Text><strong>Upload Process:</strong></Text>
                  <Text>1. Click "Download Template" to get the correct Excel format</Text>
                  <Text>2. Fill in your image URLs in the template</Text>
                  <Text>3. Drag and drop your file or click "Choose File"</Text>
                  <Text>4. The app will automatically start analyzing your images</Text>
                  <Text>5. Wait for the analysis to complete (this may take a few minutes)</Text>
                  <br/>
                  <Text><strong>Session Management:</strong></Text>
                  <Text>• Enter a session name to save your work automatically</Text>
                  <Text>• Use "Load Session" to resume previous work</Text>
                  <Text>• Sessions auto-save every 5 seconds when active</Text>
                </Well>

                <Well>
                  <Heading level={4}>🏷️ Step 2: Tag Selection</Heading>
                  <Text><strong>Understanding the Analysis Results:</strong></Text>
                  <Text>• Each image shows detected tags with confidence scores</Text>
                  <Text>• Higher confidence scores (closer to 100%) are more accurate</Text>
                  <Text>• Tags are automatically generated by Azure Computer Vision</Text>
                  <Text>• You can select which tags to use for prompt generation</Text>
                  <br/>
                  <Text><strong>Selecting Tags:</strong></Text>
                  <Text>1. Review each image and its detected tags</Text>
                  <Text>2. Check the boxes for tags that best describe what you want</Text>
                  <Text>3. Focus on tags that match your creative vision</Text>
                  <Text>4. Consider both subject matter and style-related tags</Text>
                  <Text>5. You can select multiple tags per image</Text>
                  <br/>
                  <Text><strong>Tips for Better Results:</strong></Text>
                  <Text>• Select 3-7 tags per image for optimal prompt generation</Text>
                  <Text>• Choose tags that represent the main subject and style</Text>
                  <Text>• Avoid overly generic tags like "image" or "photo"</Text>
                  <Text>• Include both descriptive and artistic tags when available</Text>
                </Well>

                <Well>
                  <Heading level={4}>✨ Step 3: Prompt Generation</Heading>
                  <Text><strong>Generating Prompts:</strong></Text>
                  <Text>1. Navigate to the "Prompt Generation" tab</Text>
                  <Text>2. Click "Generate Prompt" for individual images</Text>
                  <Text>3. Or use "Generate All Prompts" for batch processing</Text>
                  <Text>4. The app creates optimized prompts based on your selected tags</Text>
                  <Text>5. Review and edit prompts if needed</Text>
                  <br/>
                  <Text><strong>Understanding Generated Prompts:</strong></Text>
                  <Text>• Prompts combine your selected tags into coherent descriptions</Text>
                  <Text>• They include style, composition, and technical details</Text>
                  <Text>• Prompts are optimized for DALL-E 3's capabilities</Text>
                  <Text>• You can manually edit prompts before image generation</Text>
                  <br/>
                  <Text><strong>Creating Images with DALL-E 3:</strong></Text>
                  <Text>1. Click "Generate Image" next to any prompt</Text>
                  <Text>2. Wait for DALL-E 3 to process your request (30-60 seconds)</Text>
                  <Text>3. The generated image will appear next to the original</Text>
                  <Text>4. You can generate multiple variations by clicking again</Text>
                </Well>

                <Well>
                  <Heading level={4}>🖼️ Step 4: Image Gallery</Heading>
                  <Text><strong>Viewing Your Results:</strong></Text>
                  <Text>• The gallery tab appears after you generate images</Text>
                  <Text>• Switch between grid view and carousel view</Text>
                  <Text>• Compare original images with AI-generated versions</Text>
                  <Text>• View the prompts used for each generation</Text>
                  <br/>
                  <Text><strong>Gallery Features:</strong></Text>
                  <Text>• <strong>Grid View:</strong> See all images at once in a compact layout</Text>
                  <Text>• <strong>Carousel View:</strong> Focus on one image pair at a time</Text>
                  <Text>• <strong>Prompt Display:</strong> See the exact prompt used for each image</Text>
                  <Text>• <strong>Side-by-Side Comparison:</strong> Original vs. generated images</Text>
                </Well>

                <Well>
                  <Heading level={4}>💡 Tips for Best Results</Heading>
                  <Text><strong>Image URL Requirements:</strong></Text>
                  <Text>• Use direct links to image files (not webpage URLs)</Text>
                  <Text>• Ensure images are publicly accessible (no login required)</Text>
                  <Text>• HTTPS URLs are preferred for security</Text>
                  <Text>• Keep file sizes under 4MB for faster processing</Text>
                  <Text>• Minimum resolution: 50x50 pixels</Text>
                  <br/>
                  <Text><strong>Tag Selection Strategy:</strong></Text>
                  <Text>• Choose tags that represent your desired outcome</Text>
                  <Text>• Mix descriptive tags (objects, people) with style tags</Text>
                  <Text>• Consider the mood and atmosphere you want</Text>
                  <Text>• Don't select too many tags (3-7 is optimal)</Text>
                  <br/>
                  <Text><strong>Prompt Optimization:</strong></Text>
                  <Text>• Generated prompts can be edited before image creation</Text>
                  <Text>• Add specific style references if desired</Text>
                  <Text>• Include lighting and composition details</Text>
                  <Text>• Be specific about the mood and atmosphere</Text>
                </Well>

                <Well>
                  <Heading level={4}>🔧 Troubleshooting</Heading>
                  <Text><strong>Common Upload Issues:</strong></Text>
                  <Text>• <strong>File not recognized:</strong> Ensure sheet is named "ImageRef"</Text>
                  <Text>• <strong>No images found:</strong> Check that URLs are in Column A</Text>
                  <Text>• <strong>Analysis fails:</strong> Verify images are publicly accessible</Text>
                  <Text>• <strong>Slow processing:</strong> Reduce batch size or check internet connection</Text>
                  <br/>
                  <Text><strong>Image Analysis Problems:</strong></Text>
                  <Text>• <strong>No tags detected:</strong> Image may be too abstract or unclear</Text>
                  <Text>• <strong>Rate limit errors:</strong> Wait a few minutes and try again</Text>
                  <Text>• <strong>Invalid format:</strong> Convert images to JPEG or PNG</Text>
                  <Text>• <strong>File too large:</strong> Compress images under 4MB</Text>
                  <br/>
                  <Text><strong>Image Generation Issues:</strong></Text>
                  <Text>• <strong>Generation fails:</strong> Try simplifying the prompt</Text>
                  <Text>• <strong>Unexpected results:</strong> Adjust tag selection or edit prompt</Text>
                  <Text>• <strong>Content policy violation:</strong> Remove inappropriate content references</Text>
                  <Text>• <strong>Timeout errors:</strong> Try again or reduce prompt complexity</Text>
                </Well>

                <Well>
                  <Heading level={4}>💾 Session Management</Heading>
                  <Text><strong>Saving Your Work:</strong></Text>
                  <Text>• Enter a session name in the upload tab</Text>
                  <Text>• Work is automatically saved every 5 seconds</Text>
                  <Text>• Sessions include all analysis results, tags, and generated content</Text>
                  <Text>• Use descriptive names to easily find sessions later</Text>
                  <br/>
                  <Text><strong>Loading Previous Sessions:</strong></Text>
                  <Text>• Click "Load Session" in the upload tab</Text>
                  <Text>• Browse your saved sessions by name and date</Text>
                  <Text>• Click "Load" to restore all your previous work</Text>
                  <Text>• Continue working from where you left off</Text>
                  <br/>
                  <Text><strong>Managing Sessions:</strong></Text>
                  <Text>• Delete old sessions to free up browser storage</Text>
                  <Text>• Export important results before clearing sessions</Text>
                  <Text>• Sessions are stored locally in your browser</Text>
                  <Text>• Clear browser data will remove all sessions</Text>
                </Well>

                <Well>
                  <Heading level={4}>🎯 Best Practices</Heading>
                  <Text><strong>Workflow Optimization:</strong></Text>
                  <Text>• Start with a small batch (5-10 images) to test the process</Text>
                  <Text>• Use consistent image types for better tag selection</Text>
                  <Text>• Save sessions frequently with descriptive names</Text>
                  <Text>• Review and refine prompts before generating images</Text>
                  <br/>
                  <Text><strong>Quality Tips:</strong></Text>
                  <Text>• Use high-quality source images for better analysis</Text>
                  <Text>• Select tags that align with your creative goals</Text>
                  <Text>• Experiment with different tag combinations</Text>
                  <Text>• Generate multiple variations to find the best results</Text>
                  <br/>
                  <Text><strong>Efficiency Tips:</strong></Text>
                  <Text>• Process images in batches of 20-50 for optimal performance</Text>
                  <Text>• Use the "Generate All Prompts" feature for batch processing</Text>
                  <Text>• Keep the app tab active during processing</Text>
                  <Text>• Enable auto-refresh if available for real-time updates</Text>
                </Well>
              </Flex>
            </View>
          </Item>
        </TabPanels>
      </Tabs>

      {/* Load Session Dialog */}
      {showLoadDialog && (
        <View
          position="fixed"
          top="size-0"
          left="size-0"
          right="size-0"
          bottom="size-0"
          backgroundColor="rgba(0,0,0,0.5)"
          zIndex={1000}
          UNSAFE_style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowLoadDialog(false)}
        >
          <Well
            width="size-6000"
            maxHeight="80vh"
            UNSAFE_style={{ 
              overflow: 'auto',
              backgroundColor: 'var(--spectrum-global-color-gray-50)',
              border: '1px solid var(--spectrum-global-color-gray-300)',
              borderRadius: '8px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Heading level={2} marginBottom="size-200">📂 Load Saved Session</Heading>
            <Divider marginBottom="size-200" />
            
            {savedSessions.length === 0 ? (
              <Text>No saved sessions found.</Text>
            ) : (
              <View>
                {savedSessions.map((session) => (
                  <Well key={session.id} marginBottom="size-200">
                    <Flex justifyContent="space-between" alignItems="center">
                      <View>
                        <Text weight="bold">{session.name}</Text>
                        <Text size="S" UNSAFE_style={{ color: '#6B6B6B' }}>
                          {new Date(session.timestamp).toLocaleDateString()} - {session.fileName || 'Unknown file'}
                        </Text>
                      </View>
                      <ButtonGroup>
                        <Button size="S" variant="primary" onPress={() => loadSession(session)}>
                          Load
                        </Button>
                        <Button size="S" variant="negative" onPress={() => deleteSession(session.id)}>
                          Delete
                        </Button>
                      </ButtonGroup>
                    </Flex>
                  </Well>
                ))}
              </View>
            )}
            
            <Divider marginTop="size-200" marginBottom="size-200" />
            <Flex justifyContent="end">
              <Button variant="secondary" onPress={() => setShowLoadDialog(false)}>
                Cancel
              </Button>
            </Flex>
          </Well>
        </View>
      )}

      {/* Notification */}
      {notification && (
        <View 
          position="fixed" 
          top="size-200" 
          right="size-200" 
          zIndex={1001}
          UNSAFE_style={{
            padding: '12px 16px', borderRadius: '4px',
            backgroundColor: notification.type === 'success' ? '#2D5016' : '#D7373F',
            color: '#ffffff', boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
          }}
        >
          <Text UNSAFE_style={{ color: 'inherit' }}>{notification.message}</Text>
        </View>
      )}
    </View>
  )
}

export default AIPromptGeneratorEnhanced 