import React, { useState } from 'react'
import {
  Provider,
  defaultTheme,
  View,
  Heading,
  Content,
  Text,
  Button,
  ButtonGroup,
  TextField,
  Checkbox,
  CheckboxGroup,
  NumberField,
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
  IllustratedMessage,
  Badge,
  Divider,
  Link
} from '@adobe/react-spectrum'
import DataUpload from '@spectrum-icons/workflow/DataUpload'
import LinkOut from '@spectrum-icons/workflow/LinkOut'
import Download from '@spectrum-icons/workflow/Download'
import Copy from '@spectrum-icons/workflow/Copy'
import Delete from '@spectrum-icons/workflow/Delete'
import Add from '@spectrum-icons/workflow/Add'
import Refresh from '@spectrum-icons/workflow/Refresh'
import { getActionUrlFromRuntime } from '../utils/actionUrls'
import * as XLSX from 'xlsx'

const URLShortener = ({ runtime, ims }) => {
  // State management
  const [activeTab, setActiveTab] = useState('config')
  const [notification, setNotification] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Single URL state
  const [singleUrl, setSingleUrl] = useState('')
  const [singleResult, setSingleResult] = useState(null)
  
  // Batch processing state
  const [csvFile, setCsvFile] = useState(null)
  const [csvData, setCsvData] = useState([])
  const [batchResults, setBatchResults] = useState([])
  
  // API Configuration state
  const [validateUrl, setValidateUrl] = useState(true)
  const [crawlable, setCrawlable] = useState(true)
  const [forwardQuery, setForwardQuery] = useState(true)
  const [findIfExists, setFindIfExists] = useState(true)
  const [shortCodeLength, setShortCodeLength] = useState(5)
  const [tags, setTags] = useState(['americas275'])
  const [newTag, setNewTag] = useState('')

  // Utility functions
  const showNotification = (type, message) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 5000)
  }

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      showNotification('success', 'Copied to clipboard!')
    } catch (error) {
      showNotification('error', 'Failed to copy to clipboard')
    }
  }

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()])
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  // CSV file handling
  const handleCsvUpload = (event) => {
    const file = event.target.files[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.csv')) {
      showNotification('error', 'Please upload a CSV file')
      return
    }

    setCsvFile(file)
    
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target.result
        const lines = text.split('\n').filter(line => line.trim())
        
        if (lines.length < 2) {
          showNotification('error', 'CSV file must contain at least a header and one data row')
          return
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
        const longUrlIndex = headers.findIndex(h => h.includes('longurl') || h.includes('long_url') || h.includes('url'))
        
        if (longUrlIndex === -1) {
          showNotification('error', 'CSV file must contain a column with "longURL", "long_url", or "url" in the header')
          return
        }

        const data = lines.slice(1).map((line, index) => {
          const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
          return {
            index: index + 1,
            longUrl: values[longUrlIndex] || '',
            originalRow: line
          }
        }).filter(item => item.longUrl)

        setCsvData(data)
        
        if (data.length > 50) {
          showNotification('notice', `⚠️ Loaded ${data.length} URLs. Note: Maximum 50 URLs per batch to prevent timeouts. Consider splitting large files.`)
        } else {
          showNotification('success', `✅ Loaded ${data.length} URLs from CSV file`)
        }
        
      } catch (error) {
        showNotification('error', 'Error parsing CSV file: ' + error.message)
      }
    }
    reader.readAsText(file)
  }

  // Single URL shortening
  const shortenSingleUrl = async () => {
    if (!singleUrl.trim()) {
      showNotification('error', 'Please enter a URL to shorten')
      return
    }

    setIsProcessing(true)
    try {
      const requestData = {
        urls: singleUrl.trim(),
        validateUrl,
        tags,
        crawlable,
        forwardQuery,
        findIfExists,
        shortCodeLength
      }

      const response = await fetch(getActionUrlFromRuntime('url-shortener', runtime), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const result = await response.json()
      const resultBody = result.body || result

      if (!resultBody.success) {
        throw new Error(resultBody.error || 'Unknown error occurred')
      }

      setSingleResult(resultBody.results)
      showNotification('success', '✅ URL shortened successfully!')

    } catch (error) {
      console.error('Error shortening URL:', error)
      showNotification('error', `Error: ${error.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  // Batch URL shortening
  const shortenBatchUrls = async () => {
    if (csvData.length === 0) {
      showNotification('error', 'Please upload a CSV file first')
      return
    }

    setIsProcessing(true)
    setBatchResults([])

    try {
      const requestData = {
        urls: csvData.map(item => ({ longUrl: item.longUrl })),
        validateUrl,
        tags,
        crawlable,
        forwardQuery,
        findIfExists,
        shortCodeLength
      }

      const response = await fetch(getActionUrlFromRuntime('url-shortener', runtime), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const result = await response.json()
      const resultBody = result.body || result

      if (!resultBody.success) {
        throw new Error(resultBody.error || 'Unknown error occurred')
      }

      setBatchResults(resultBody.results)
      showNotification('success', `✅ Processed ${resultBody.processedCount} URLs (${resultBody.successCount} successful, ${resultBody.errorCount} failed)`)

    } catch (error) {
      console.error('Error processing batch URLs:', error)
      showNotification('error', `Error: ${error.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  // Download CSV template
  const downloadCsvTemplate = () => {
    try {
      const csvContent = [
        'longURL',
        'https://example.com/very-long-url-1',
        'https://example.com/very-long-url-2', 
        'https://dsn.adobe.com/web/sample-page?token=123456789',
        'https://adobe.com/products/experience-platform'
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob)
        link.setAttribute('href', url)
        link.setAttribute('download', 'url-shortener-template.csv')
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
      
      showNotification('success', 'CSV template downloaded successfully!')
      
    } catch (error) {
      console.error('Error generating CSV template:', error)
      showNotification('error', 'Error generating CSV template')
    }
  }

  // Download Excel file
  const downloadExcel = () => {
    if (batchResults.length === 0) {
      showNotification('error', 'No results to download')
      return
    }

    try {
      const excelData = batchResults.map(result => ({
        'Long URL': result.longUrl,
        'Short URL': result.shortUrl || 'Error',
        'Short Code': result.shortCode || '',
        'QR Code URL': result.qrCodeUrl || '',
        'Error': result.error || '',
        'Date Created': result.dateCreated || '',
        'Tags': result.tags ? result.tags.join(', ') : ''
      }))

      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.json_to_sheet(excelData)
      
      // Set column widths
      worksheet['!cols'] = [
        { wch: 50 }, // Long URL
        { wch: 30 }, // Short URL
        { wch: 15 }, // Short Code
        { wch: 35 }, // QR Code URL
        { wch: 30 }, // Error
        { wch: 20 }, // Date Created
        { wch: 20 }  // Tags
      ]

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Shortened URLs')
      
      const fileName = `shortened-urls-${new Date().getTime()}.xlsx`
      XLSX.writeFile(workbook, fileName)
      
      showNotification('success', 'Excel file downloaded successfully!')
      
    } catch (error) {
      console.error('Error generating Excel file:', error)
      showNotification('error', 'Error generating Excel file')
    }
  }

  return (
    <View padding="size-400" maxWidth="1400px" marginX="auto">
      <Flex justifyContent="space-between" alignItems="center" marginBottom="size-300">
        <View>
          <Heading level={1}>🔗 URL Shortener</Heading>
          <Content marginTop="size-100">
            Shorten URLs individually or in batches with customizable options and QR code generation
          </Content>
        </View>
      </Flex>

      {notification && (
        <StatusLight variant={notification.type} marginBottom="size-300">
          {notification.message}
        </StatusLight>
      )}

      <Tabs selectedKey={activeTab} onSelectionChange={setActiveTab}>
        <TabList>
          <Item key="config">⚙️ Configuration</Item>
          <Item key="single">🔗 Single URL</Item>
          <Item key="batch">📁 Batch Processing</Item>
          {batchResults.length > 0 && (
            <Item key="results">
              📊 Results
              <Badge variant="positive" marginStart="size-100">{batchResults.length}</Badge>
            </Item>
          )}
        </TabList>

        <TabPanels>
          {/* Configuration Tab */}
          <Item key="config">
            <View marginTop="size-300">
              <Well>
                <Heading level={3} marginBottom="size-300">⚙️ API Configuration</Heading>
                
                <Grid
                  areas={['left right']}
                  columns={['1fr', '1fr']}
                  gap="size-400"
                >
                  <View gridArea="left">
                    <Flex direction="column" gap="size-200">
                      <Heading level={4}>URL Settings</Heading>
                      <CheckboxGroup>
                        <Checkbox isSelected={validateUrl} onChange={setValidateUrl}>
                          Validate URL before shortening
                        </Checkbox>
                        <Checkbox isSelected={crawlable} onChange={setCrawlable}>
                          Make URLs crawlable by search engines
                        </Checkbox>
                        <Checkbox isSelected={forwardQuery} onChange={setForwardQuery}>
                          Forward query parameters
                        </Checkbox>
                        <Checkbox isSelected={findIfExists} onChange={setFindIfExists}>
                          Find existing short URL if available
                        </Checkbox>
                      </CheckboxGroup>
                      
                      <NumberField
                        label="Short Code Length"
                        value={shortCodeLength}
                        onChange={setShortCodeLength}
                        minValue={4}
                        maxValue={10}
                        width="size-1200"
                      />
                    </Flex>
                  </View>

                  <View gridArea="right">
                    <Flex direction="column" gap="size-200">
                      <Heading level={4}>Tags</Heading>
                      <Text UNSAFE_style={{ fontSize: '14px', color: '#6B6B6B' }}>
                        Add tags to organize and track your shortened URLs
                      </Text>
                      
                      <Flex gap="size-100" alignItems="end">
                        <TextField
                          label="Add Tag"
                          placeholder="e.g., campaign-name"
                          value={newTag}
                          onChange={setNewTag}
                          width="size-2000"
                        />
                        <Button variant="secondary" onPress={addTag} isDisabled={!newTag.trim()}>
                          <Add />
                        </Button>
                      </Flex>

                      {tags.length > 0 && (
                        <View>
                          <Text weight="bold" marginBottom="size-100">Current Tags:</Text>
                          <Flex wrap gap="size-100">
                            {tags.map((tag, index) => (
                              <Badge key={index} variant="info">
                                {tag}
                                <ActionButton onPress={() => removeTag(tag)} marginStart="size-50">
                                  <Delete />
                                </ActionButton>
                              </Badge>
                            ))}
                          </Flex>
                        </View>
                      )}
                    </Flex>
                  </View>
                </Grid>
              </Well>
            </View>
          </Item>

          {/* Single URL Tab */}
          <Item key="single">
            <View marginTop="size-300">
              <Well>
                <Heading level={3} marginBottom="size-200">🔗 Shorten Single URL</Heading>
                <Flex direction="column" gap="size-200">
                  <TextField
                    label="Long URL"
                    placeholder="https://example.com/very-long-url-that-needs-shortening"
                    value={singleUrl}
                    onChange={setSingleUrl}
                    width="100%"
                  />
                  <ButtonGroup>
                    <Button 
                      variant="primary" 
                      onPress={shortenSingleUrl}
                      isDisabled={isProcessing || !singleUrl.trim()}
                    >
                      <LinkOut />
                      <Text>{isProcessing ? 'Processing...' : 'Shorten URL'}</Text>
                    </Button>
                    <Button variant="secondary" onPress={() => setSingleUrl('')}>
                      <Refresh />
                      <Text>Clear</Text>
                    </Button>
                  </ButtonGroup>
                </Flex>
              </Well>

              {singleResult && (
                <Well marginTop="size-300">
                  <Heading level={3} marginBottom="size-200">✅ Result</Heading>
                  {singleResult.error ? (
                    <StatusLight variant="negative">
                      Error: {singleResult.error}
                    </StatusLight>
                  ) : (
                    <Flex direction="column" gap="size-200">
                      <Flex justifyContent="space-between" alignItems="center">
                        <Text weight="bold">Short URL:</Text>
                        <Flex alignItems="center" gap="size-100">
                          <Link>
                            <a href={singleResult.shortUrl} target="_blank" rel="noopener noreferrer">
                              {singleResult.shortUrl}
                            </a>
                          </Link>
                          <ActionButton onPress={() => copyToClipboard(singleResult.shortUrl)}>
                            <Copy />
                          </ActionButton>
                        </Flex>
                      </Flex>
                      
                      <Flex justifyContent="space-between" alignItems="center">
                        <Text weight="bold">QR Code:</Text>
                        <Flex alignItems="center" gap="size-100">
                          <Link>
                            <a href={singleResult.qrCodeUrl} target="_blank" rel="noopener noreferrer">
                              View QR Code
                            </a>
                          </Link>
                          <ActionButton onPress={() => copyToClipboard(singleResult.qrCodeUrl)}>
                            <Copy />
                          </ActionButton>
                        </Flex>
                      </Flex>

                      <View marginTop="size-200">
                        <img 
                          src={singleResult.qrCodeUrl} 
                          alt="QR Code" 
                          style={{ maxWidth: '200px', height: 'auto', border: '1px solid #ccc', borderRadius: '4px' }}
                        />
                      </View>

                      <Flex justifyContent="space-between" alignItems="center">
                        <Text weight="bold">Short Code:</Text>
                        <Text>{singleResult.shortCode}</Text>
                      </Flex>
                      
                      <Flex justifyContent="space-between" alignItems="center">
                        <Text weight="bold">Created:</Text>
                        <Text>{new Date(singleResult.dateCreated).toLocaleString()}</Text>
                      </Flex>
                    </Flex>
                  )}
                </Well>
              )}
            </View>
          </Item>

          {/* Batch Processing Tab */}
          <Item key="batch">
            <View marginTop="size-300">
              <Well marginBottom="size-300">
                <Flex justifyContent="space-between" alignItems="center" marginBottom="size-200">
                  <Heading level={3}>📁 Upload CSV File</Heading>
                  <Button variant="secondary" onPress={downloadCsvTemplate}>
                    <Download />
                    <Text>Download Template</Text>
                  </Button>
                </Flex>
                
                <Text marginBottom="size-200">
                  Upload a CSV file with a column containing long URLs. The column header should contain "longURL", "long_url", or "url".
                  <br /><strong>Note:</strong> Maximum 50 URLs per batch to prevent timeouts.
                </Text>
                
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCsvUpload}
                  style={{ marginBottom: '12px' }}
                />

                {csvFile && (
                  <StatusLight variant="positive" marginTop="size-200">
                    ✅ Loaded: {csvFile.name} ({csvData.length} URLs found)
                  </StatusLight>
                )}
              </Well>

              {csvData.length > 0 && (
                <Well marginBottom="size-300">
                  <Flex justifyContent="space-between" alignItems="center" marginBottom="size-200">
                    <Heading level={3}>📋 Preview URLs ({csvData.length})</Heading>
                    <Button 
                      variant="primary" 
                      onPress={shortenBatchUrls}
                      isDisabled={isProcessing}
                    >
                      <LinkOut />
                      <Text>{isProcessing ? 'Processing...' : 'Shorten All URLs'}</Text>
                    </Button>
                  </Flex>
                  
                  <View maxHeight="200px" overflow="auto">
                    {csvData.slice(0, 10).map((item, index) => (
                      <Text key={index} UNSAFE_style={{ fontSize: '14px', marginBottom: '4px' }}>
                        {index + 1}. {item.longUrl}
                      </Text>
                    ))}
                    {csvData.length > 10 && (
                      <Text UNSAFE_style={{ fontSize: '14px', fontStyle: 'italic' }}>
                        ... and {csvData.length - 10} more URLs
                      </Text>
                    )}
                  </View>
                </Well>
              )}

              {isProcessing && (
                <Well>
                  <Flex direction="column" alignItems="center" gap="size-200">
                    <Text weight="bold">Processing URLs...</Text>
                    <ProgressBar label="" isIndeterminate />
                  </Flex>
                </Well>
              )}
            </View>
          </Item>

          {/* Results Tab */}
          {batchResults.length > 0 && (
            <Item key="results">
              <View marginTop="size-300">
                <Flex justifyContent="space-between" alignItems="center" marginBottom="size-300">
                  <Heading level={3}>📊 Batch Results ({batchResults.length})</Heading>
                  <Button variant="primary" onPress={downloadExcel}>
                    <Download />
                    <Text>Download Excel</Text>
                  </Button>
                </Flex>

                <View maxHeight="500px" overflow="auto">
                  {batchResults.map((result, index) => (
                    <Well key={index} marginBottom="size-200">
                      <Flex direction="column" gap="size-100">
                        <Text weight="bold" UNSAFE_style={{ fontSize: '14px' }}>
                          {index + 1}. {result.longUrl}
                        </Text>
                        
                        {result.error ? (
                          <StatusLight variant="negative">
                            Error: {result.error}
                          </StatusLight>
                        ) : (
                          <Flex direction="column" gap="size-100">
                            <Flex justifyContent="space-between" alignItems="center">
                              <Text UNSAFE_style={{ fontSize: '14px' }}>
                                <strong>Short:</strong> 
                                <Link marginStart="size-100">
                                  <a href={result.shortUrl} target="_blank" rel="noopener noreferrer">
                                    {result.shortUrl}
                                  </a>
                                </Link>
                              </Text>
                              <ActionButton onPress={() => copyToClipboard(result.shortUrl)}>
                                <Copy />
                              </ActionButton>
                            </Flex>
                            
                            <Flex justifyContent="space-between" alignItems="center">
                              <Text UNSAFE_style={{ fontSize: '14px' }}>
                                <strong>QR:</strong>
                                <Link marginStart="size-100">
                                  <a href={result.qrCodeUrl} target="_blank" rel="noopener noreferrer">
                                    View QR Code
                                  </a>
                                </Link>
                              </Text>
                              <ActionButton onPress={() => copyToClipboard(result.qrCodeUrl)}>
                                <Copy />
                              </ActionButton>
                            </Flex>
                          </Flex>
                        )}
                      </Flex>
                    </Well>
                  ))}
                </View>
              </View>
            </Item>
          )}
        </TabPanels>
      </Tabs>
    </View>
  )
}

export default URLShortener 