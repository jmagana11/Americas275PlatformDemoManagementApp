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
  Dialog,
  DialogTrigger,
  AlertDialog,
  ComboBox,
  Section,
  ListBox
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
import * as XLSX from 'xlsx'
import { getActionUrlFromRuntime } from '../utils/actionUrls'

const AIPromptGenerator = ({ runtime, ims }) => {
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
  const [activeTab, setActiveTab] = useState('analysis')
  const [notification, setNotification] = useState(null)
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'carousel'
  
  // Save/Load states
  const [sessionName, setSessionName] = useState('')
  const [savedSessions, setSavedSessions] = useState([])
  const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false)

  // Load saved sessions on mount
  useEffect(() => {
    loadSavedSessions()
  }, [])

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
      setActiveTab('analysis')
      setIsLoadDialogOpen(false)
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
    const droppedFile = e.items?.[0]?.getFile?.() || e.dataTransfer?.files?.[0]
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
    
    if (!prompt) {
      showNotification('error', `Please generate a prompt for ${imageResult.imageName} first`)
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
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      const resultBody = result.body || result
      
      if (resultBody.type === 'content_policy_violation') {
        showNotification('error', `Content policy violation for ${imageResult.imageName}: ${resultBody.message}`)
        return
      }

      setImageGenerations(prev => ({
        ...prev,
        [imageIndex]: resultBody
      }))

    } catch (error) {
      console.error('Error generating image:', error)
      showNotification('error', `Error generating image for ${imageResult.imageName}`)
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
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
    
    setBatchGenerating(false)
    showNotification('success', `Generated prompts for ${imagesWithTags.length} images`)
  }

  const generateAllImages = async () => {
    setBatchGenerating(true)
    const imagesWithPrompts = Object.keys(imagePrompts)
      .filter(index => imagePrompts[index] && !imageGenerations[index])

    if (imagesWithPrompts.length === 0) {
      showNotification('error', 'No prompts available for image generation')
      setBatchGenerating(false)
      return
    }

    for (const index of imagesWithPrompts) {
      await generateImageForPrompt(parseInt(index))
      // Longer delay for image generation to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    
    setBatchGenerating(false)
    showNotification('success', `Generated images for ${imagesWithPrompts.length} prompts`)
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
          <Heading level={1}>AI Prompt Generator</Heading>
          <Content marginTop="size-100">
            Advanced tool for analyzing images, generating prompts, and creating AI images
          </Content>
        </View>
        
        {analysisResults && (
          <Flex gap="size-200" alignItems="center">
            <ButtonGroup>
              <Button variant="secondary" onPress={() => setIsLoadDialogOpen(true)}>
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
              <Badge variant="notice">{stats.prompted} Prompted</Badge>
              <Badge variant="negative">{stats.generated} Generated</Badge>
            </Flex>
            <ButtonGroup>
              <Button 
                variant="secondary" 
                onPress={generateAllPrompts}
                isDisabled={batchGenerating || stats.tagged === 0}
              >
                <Play />
                <Text>Generate All Prompts</Text>
              </Button>
              <Button 
                variant="primary" 
                onPress={generateAllImages}
                isDisabled={batchGenerating || stats.prompted === 0}
              >
                <Play />
                <Text>Generate All Images</Text>
              </Button>
            </ButtonGroup>
          </Flex>
        </Well>
      )}

      <Tabs selectedKey={activeTab} onSelectionChange={setActiveTab}>
        <TabList>
          <Item key="upload">Upload & Process</Item>
          {analysisResults && <Item key="analysis">Tag Selection</Item>}
          {analysisResults && <Item key="prompts">Prompt Generation</Item>}
          {Object.keys(imageGenerations).length > 0 && <Item key="gallery">Image Gallery</Item>}
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
                      Analysis complete! Processed {analysisResults.successfulAnalyses} of {analysisResults.totalImages} images
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
                <Heading level={2} marginBottom="size-200">Select Tags for Each Image</Heading>
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
                <Heading level={2} marginBottom="size-200">Generate & Refine Prompts</Heading>
                
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
                                  <Text weight="bold" marginBottom="size-100">Selected Tags:</Text>
                                  <Flex gap="size-75" wrap>
                                    {selectedTags[index].map((tagName, tagIndex) => (
                                      <Badge key={tagIndex} variant="info">{tagName}</Badge>
                                    ))}
                                  </Flex>
                                </View>
                              )}

                              {/* Prompt Generation */}
                              <View>
                                <Flex justifyContent="space-between" alignItems="center" marginBottom="size-100">
                                  <Text weight="bold">Generated Prompt:</Text>
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
                                        {isGeneratingImages[index] ? 'Creating...' : hasGeneratedImage ? 'Regenerate Image' : 'Generate Image'}
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

                              {/* Generated Image Preview */}
                              {hasGeneratedImage && (
                                <View>
                                  <Text weight="bold" marginBottom="size-100">Generated Image:</Text>
                                  <img 
                                    src={imageGenerations[index].imageUrl} 
                                    alt="Generated"
                                    style={{ 
                                      width: '200px', height: '200px', objectFit: 'cover',
                                      borderRadius: '8px', border: '2px solid var(--spectrum-gray-300)'
                                    }}
                                  />
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
                  <Heading level={2}>Generated Images Gallery</Heading>
                  <ButtonGroup>
                    <ActionButton 
                      isSelected={viewMode === 'grid'}
                      onPress={() => setViewMode('grid')}
                    >
                      <ViewGrid />
                    </ActionButton>
                    <ActionButton 
                      isSelected={viewMode === 'carousel'}
                      onPress={() => setViewMode('carousel')}
                    >
                      <ViewSingle />
                    </ActionButton>
                  </ButtonGroup>
                </Flex>

                {viewMode === 'grid' ? (
                  <Grid columns={['repeat(auto-fit, minmax(300px, 1fr))']} gap="size-200">
                    {Object.entries(imageGenerations).map(([index, generation], carouselIdx) => {
                      const imageResult = analysisResults.results[parseInt(index)]
                      return (
                        <Well key={index}>
                          <Flex direction="column" gap="size-200">
                            <Text weight="bold">{imageResult.imageName}</Text>
                            
                            <Flex gap="size-200">
                              <View flex={1}>
                                <Text size="S" marginBottom="size-50">Original</Text>
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
                                <Text size="S" marginBottom="size-50">Generated</Text>
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
                              <Text size="S" weight="bold" marginBottom="size-50">Prompt:</Text>
                              <Text size="S" UNSAFE_style={{ 
                                fontSize: '11px', color: '#6B6B6B', 
                                display: '-webkit-box', '-webkit-line-clamp': 3,
                                '-webkit-box-orient': 'vertical', overflow: 'hidden'
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
                                  <Text weight="bold" marginBottom="size-100">Original: {imageResult.imageName}</Text>
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
                                  <Text weight="bold" marginBottom="size-100">AI Generated</Text>
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
                                  <Text weight="bold" marginBottom="size-100">Generated Prompt:</Text>
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
        </TabPanels>
      </Tabs>

      {/* Load Session Dialog */}
      <DialogTrigger isOpen={isLoadDialogOpen} onOpenChange={setIsLoadDialogOpen}>
        <Button>Trigger</Button>
        <Dialog size="L">
          <Heading>Load Saved Session</Heading>
          <Divider />
          <Content>
            {savedSessions.length === 0 ? (
              <Text>No saved sessions found.</Text>
            ) : (
              <View maxHeight="400px" overflow="auto">
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
          </Content>
        </Dialog>
      </DialogTrigger>

      {/* Notification */}
      {notification && (
        <View 
          position="fixed" 
          top="size-200" 
          right="size-200" 
          zIndex={1000}
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

export default AIPromptGenerator 