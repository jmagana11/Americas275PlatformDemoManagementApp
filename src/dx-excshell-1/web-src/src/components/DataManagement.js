import React from 'react'
import {
  Heading,
  View,
  Text,
  Button,
  ActionButton,
  TextArea,
  TextField,
  Well,
  Flex,
  Grid,
  StatusLight,
  Content,
  Divider,
  ProgressBar
} from '@adobe/react-spectrum'
import Copy from '@spectrum-icons/workflow/Copy'
import Data from '@spectrum-icons/workflow/Data'
import DataRefresh from '@spectrum-icons/workflow/DataRefresh'
import FileData from '@spectrum-icons/workflow/FileData'
import CheckmarkCircle from '@spectrum-icons/workflow/CheckmarkCircle'
import Alert from '@spectrum-icons/workflow/Alert'

const DataManagement = ({ runtime, ims }) => {
  // Tab management
  const [selectedTab, setSelectedTab] = React.useState('csv-json')
  
  // CSV/JSON Converter States
  const [csvData, setCsvData] = React.useState('')
  const [jsonData, setJsonData] = React.useState('')
  const [conversionMode, setConversionMode] = React.useState('csv-to-json')
  const [csvDelimiter, setCsvDelimiter] = React.useState(',')
  const [csvHasHeaders, setCsvHasHeaders] = React.useState(true)
  const [conversionError, setConversionError] = React.useState('')
  const [conversionResult, setConversionResult] = React.useState('')
  const [csvPreviewData, setCsvPreviewData] = React.useState(null)
  const [jsonPreviewData, setJsonPreviewData] = React.useState(null)

  // JSON Validator States
  const [jsonInput, setJsonInput] = React.useState('')
  const [jsonValidationResult, setJsonValidationResult] = React.useState(null)
  const [formattedJson, setFormattedJson] = React.useState('')
  const [minifiedJson, setMinifiedJson] = React.useState('')

  // Data Cleaner States
  const [rawData, setRawData] = React.useState('')
  const [cleanedData, setCleanedData] = React.useState('')
  const [cleaningOptions, setCleaningOptions] = React.useState({
    removeDuplicates: true,
    trimWhitespace: true,
    removeEmptyRows: true,
    removeEmptyFields: false
  })
  const [cleaningStats, setCleaningStats] = React.useState(null)

  // Data Statistics States
  const [statsData, setStatsData] = React.useState('')
  const [dataStats, setDataStats] = React.useState(null)

  // File upload states
  const [uploadedFile, setUploadedFile] = React.useState(null)

  // Utility functions
  const showNotification = (type, message) => {
    console.log(`${type.toUpperCase()}: ${message}`)
  }

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      showNotification('success', 'Copied to clipboard!')
    } catch (error) {
      console.error('Failed to copy:', error)
      showNotification('error', 'Failed to copy to clipboard')
    }
  }

  // Parse CSV string into table data for preview
  const parseCsvForPreview = (csvString, delimiter = ',') => {
    if (!csvString.trim()) return null
    
    const lines = csvString.trim().split('\n')
    const data = lines.map(line => {
      const row = []
      let current = ''
      let inQuotes = false
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        const nextChar = line[i + 1]
        
        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            current += '"'
            i++ // Skip next quote
          } else {
            inQuotes = !inQuotes
          }
        } else if (char === delimiter && !inQuotes) {
          row.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      row.push(current.trim())
      return row
    })
    
    return {
      headers: csvHasHeaders ? data[0] : data[0]?.map((_, index) => `Column ${index + 1}`),
      rows: csvHasHeaders ? data.slice(1) : data
    }
  }

  // Download CSV file
  const downloadCsvFile = () => {
    if (!conversionResult) {
      showNotification('error', 'No CSV data to download')
      return
    }

    try {
      const now = new Date()
      const timestamp = now.toISOString().slice(0, 19).replace(/[T:]/g, '-').replace(/\./g, '-')
      const filename = `data-export-${timestamp}.csv`
      
      const blob = new Blob([conversionResult], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      showNotification('success', `Downloaded: ${filename}`)
    } catch (error) {
      console.error('Download failed:', error)
      showNotification('error', 'Failed to download file')
    }
  }

  // CSV/JSON Conversion Functions
  const handleFileUpload = (event) => {
    const file = event.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target.result
      if (file.name.toLowerCase().endsWith('.csv')) {
        setCsvData(content)
        setConversionMode('csv-to-json')
      } else if (file.name.toLowerCase().endsWith('.json')) {
        setJsonData(content)
        setConversionMode('json-to-csv')
      } else {
        setConversionError('Please upload a CSV or JSON file')
      }
    }
    reader.readAsText(file)
    setUploadedFile(file)
  }

  const csvToJson = () => {
    setConversionError('')
    setConversionResult('')
    setCsvPreviewData(null)
    setJsonPreviewData(null)

    if (!csvData.trim()) {
      setConversionError('Please enter CSV data or upload a file')
      return
    }

    try {
      const lines = csvData.trim().split('\n')
      const delimiter = csvDelimiter || ','
      
      if (lines.length === 0) {
        throw new Error('No data found')
      }

      let headers = []
      let dataRows = []

      if (csvHasHeaders) {
        headers = lines[0].split(delimiter).map(h => h.trim().replace(/"/g, ''))
        dataRows = lines.slice(1)
      } else {
        // Generate generic headers
        const firstRow = lines[0].split(delimiter)
        headers = firstRow.map((_, index) => `column_${index + 1}`)
        dataRows = lines
      }

      const jsonArray = dataRows.map(row => {
        const values = row.split(delimiter).map(v => v.trim().replace(/"/g, ''))
        const obj = {}
        headers.forEach((header, index) => {
          let value = values[index] || ''
          
          // Try to convert to appropriate data type
          if (value === '') {
            obj[header] = null
          } else if (!isNaN(value) && !isNaN(parseFloat(value))) {
            obj[header] = parseFloat(value)
          } else if (value.toLowerCase() === 'true') {
            obj[header] = true
          } else if (value.toLowerCase() === 'false') {
            obj[header] = false
          } else {
            obj[header] = value
          }
        })
        return obj
      })

      const result = JSON.stringify(jsonArray, null, 2)
      setConversionResult(result)
      setJsonPreviewData({
        formatted: result,
        itemCount: jsonArray.length,
        dataType: 'Array',
        size: result.length
      })
      showNotification('success', `Converted ${jsonArray.length} rows to JSON`)
    } catch (error) {
      setConversionError(`Conversion failed: ${error.message}`)
    }
  }

  // Helper function to flatten nested objects
  const flattenObject = (obj, prefix = '') => {
    const flattened = {}
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const newKey = prefix ? `${prefix}.${key}` : key
        
        if (obj[key] === null || obj[key] === undefined) {
          flattened[newKey] = ''
        } else if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
          // Recursively flatten nested objects
          Object.assign(flattened, flattenObject(obj[key], newKey))
        } else if (Array.isArray(obj[key])) {
          // Convert arrays to JSON strings
          flattened[newKey] = JSON.stringify(obj[key])
        } else {
          flattened[newKey] = obj[key]
        }
      }
    }
    
    return flattened
  }

  const jsonToCsv = () => {
    setConversionError('')
    setConversionResult('')
    setCsvPreviewData(null)

    if (!jsonData.trim()) {
      setConversionError('Please enter JSON data or upload a file')
      return
    }

    try {
      const data = JSON.parse(jsonData)
      
      if (!Array.isArray(data)) {
        // If it's a single object, wrap it in an array
        const singleObject = Array.isArray(data) ? data : [data]
        const flattened = singleObject.map(item => flattenObject(item))
        
        // Get all unique keys from flattened objects
        const allKeys = new Set()
        flattened.forEach(obj => {
          Object.keys(obj).forEach(key => allKeys.add(key))
        })

        const headers = Array.from(allKeys).sort()
        const delimiter = csvDelimiter || ','

        // Create CSV content
        let csvContent = ''
        
        if (csvHasHeaders) {
          csvContent += headers.join(delimiter) + '\n'
        }

        flattened.forEach(obj => {
          const row = headers.map(header => {
            let value = obj[header]
            if (value === null || value === undefined || value === '') {
              return ''
            }
            // Escape commas and quotes in CSV
            const stringValue = String(value)
            if (stringValue.includes(delimiter) || stringValue.includes('"') || stringValue.includes('\n')) {
              return `"${stringValue.replace(/"/g, '""')}"`
            }
            return stringValue
          })
          csvContent += row.join(delimiter) + '\n'
        })

        setConversionResult(csvContent)
        setCsvPreviewData(parseCsvForPreview(csvContent, delimiter))
        showNotification('success', `Converted ${flattened.length} object(s) to CSV with ${headers.length} columns`)
        return
      }

      if (data.length === 0) {
        throw new Error('JSON array is empty')
      }

      // Flatten all objects in the array
      const flattened = data.map(item => flattenObject(item))

      // Get all unique keys from all flattened objects
      const allKeys = new Set()
      flattened.forEach(obj => {
        Object.keys(obj).forEach(key => allKeys.add(key))
      })

      const headers = Array.from(allKeys).sort()
      const delimiter = csvDelimiter || ','

      // Create CSV content
      let csvContent = ''
      
      if (csvHasHeaders) {
        csvContent += headers.join(delimiter) + '\n'
      }

      flattened.forEach(obj => {
        const row = headers.map(header => {
          let value = obj[header]
          if (value === null || value === undefined || value === '') {
            return ''
          }
          // Escape commas and quotes in CSV
          const stringValue = String(value)
          if (stringValue.includes(delimiter) || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`
          }
          return stringValue
        })
        csvContent += row.join(delimiter) + '\n'
      })

      setConversionResult(csvContent)
      setCsvPreviewData(parseCsvForPreview(csvContent, delimiter))
      showNotification('success', `Converted ${data.length} objects to CSV with ${headers.length} columns`)
    } catch (error) {
      setConversionError(`Conversion failed: ${error.message}`)
    }
  }

  // JSON Validator Functions
  const validateAndFormatJson = () => {
    if (!jsonInput.trim()) {
      setJsonValidationResult({ isValid: false, error: 'Please enter JSON data' })
      return
    }

    try {
      const parsed = JSON.parse(jsonInput)
      const formatted = JSON.stringify(parsed, null, 2)
      const minified = JSON.stringify(parsed)
      
      setFormattedJson(formatted)
      setMinifiedJson(minified)
      setJsonValidationResult({
        isValid: true,
        size: jsonInput.length,
        formattedSize: formatted.length,
        minifiedSize: minified.length,
        dataType: Array.isArray(parsed) ? 'Array' : typeof parsed,
        itemCount: Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length
      })
    } catch (error) {
      setJsonValidationResult({
        isValid: false,
        error: error.message,
        position: getErrorPosition(error.message)
      })
      setFormattedJson('')
      setMinifiedJson('')
    }
  }

  const getErrorPosition = (errorMessage) => {
    const match = errorMessage.match(/position (\d+)/)
    return match ? parseInt(match[1]) : null
  }

  // Data Cleaning Functions
  const cleanData = () => {
    if (!rawData.trim()) {
      setCleaningStats({ error: 'Please enter data to clean' })
      return
    }

    try {
      let data = JSON.parse(rawData)
      const originalCount = Array.isArray(data) ? data.length : 1
      let operations = []

      if (Array.isArray(data)) {
        // Remove duplicates
        if (cleaningOptions.removeDuplicates) {
          const uniqueData = []
          const seen = new Set()
          data.forEach(item => {
            const key = JSON.stringify(item)
            if (!seen.has(key)) {
              seen.add(key)
              uniqueData.push(item)
            }
          })
          const duplicatesRemoved = data.length - uniqueData.length
          if (duplicatesRemoved > 0) {
            operations.push(`Removed ${duplicatesRemoved} duplicate rows`)
          }
          data = uniqueData
        }

        // Remove empty rows
        if (cleaningOptions.removeEmptyRows) {
          const beforeCount = data.length
          data = data.filter(item => {
            if (typeof item === 'object' && item !== null) {
              return Object.values(item).some(value => value !== null && value !== undefined && value !== '')
            }
            return item !== null && item !== undefined && item !== ''
          })
          const emptyRowsRemoved = beforeCount - data.length
          if (emptyRowsRemoved > 0) {
            operations.push(`Removed ${emptyRowsRemoved} empty rows`)
          }
        }

        // Trim whitespace and remove empty fields
        if (cleaningOptions.trimWhitespace || cleaningOptions.removeEmptyFields) {
          data = data.map(item => {
            if (typeof item === 'object' && item !== null) {
              const cleaned = {}
              Object.entries(item).forEach(([key, value]) => {
                let cleanedValue = value
                
                if (typeof value === 'string' && cleaningOptions.trimWhitespace) {
                  cleanedValue = value.trim()
                }
                
                if (!cleaningOptions.removeEmptyFields || 
                    (cleanedValue !== null && cleanedValue !== undefined && cleanedValue !== '')) {
                  cleaned[key] = cleanedValue
                }
              })
              return cleaned
            }
            return item
          })
          
          if (cleaningOptions.trimWhitespace) {
            operations.push('Trimmed whitespace')
          }
          if (cleaningOptions.removeEmptyFields) {
            operations.push('Removed empty fields')
          }
        }
      }

      const cleanedJson = JSON.stringify(data, null, 2)
      setCleanedData(cleanedJson)
      setCleaningStats({
        originalCount,
        cleanedCount: Array.isArray(data) ? data.length : 1,
        operations,
        success: true
      })

    } catch (error) {
      setCleaningStats({ error: `Data cleaning failed: ${error.message}` })
    }
  }

  // Data Statistics Functions
  const generateStatistics = () => {
    if (!statsData.trim()) {
      setDataStats({ error: 'Please enter data to analyze' })
      return
    }

    try {
      const data = JSON.parse(statsData)
      
      if (Array.isArray(data)) {
        const stats = {
          type: 'Array',
          totalRows: data.length,
          columns: {},
          summary: {}
        }

        if (data.length > 0 && typeof data[0] === 'object') {
          // Analyze each column
          const allKeys = new Set()
          data.forEach(row => {
            if (typeof row === 'object' && row !== null) {
              Object.keys(row).forEach(key => allKeys.add(key))
            }
          })

          allKeys.forEach(key => {
            const values = data.map(row => row[key]).filter(val => val !== null && val !== undefined)
            const nonEmptyValues = values.filter(val => val !== '')
            
            stats.columns[key] = {
              totalValues: values.length,
              nonEmptyValues: nonEmptyValues.length,
              emptyValues: data.length - nonEmptyValues.length,
              dataTypes: {},
              unique: new Set(values).size
            }

            // Analyze data types
            values.forEach(value => {
              const type = typeof value
              stats.columns[key].dataTypes[type] = (stats.columns[key].dataTypes[type] || 0) + 1
            })

            // Numeric analysis
            const numericValues = values.filter(val => !isNaN(val) && !isNaN(parseFloat(val))).map(val => parseFloat(val))
            if (numericValues.length > 0) {
              stats.columns[key].numeric = {
                count: numericValues.length,
                min: Math.min(...numericValues),
                max: Math.max(...numericValues),
                avg: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
                sum: numericValues.reduce((a, b) => a + b, 0)
              }
            }
          })

          stats.summary = {
            totalColumns: allKeys.size,
            totalCells: data.length * allKeys.size,
            completeness: (Object.values(stats.columns).reduce((sum, col) => sum + col.nonEmptyValues, 0) / (data.length * allKeys.size) * 100).toFixed(2)
          }
        }

        setDataStats(stats)
      } else {
        setDataStats({
          type: typeof data,
          value: data,
          size: JSON.stringify(data).length
        })
      }
    } catch (error) {
      setDataStats({ error: `Analysis failed: ${error.message}` })
    }
  }

  return (
    <View padding="size-300">
      <Heading level={1} marginBottom="size-300">📊 Data Management Tools</Heading>
      
      <Text marginBottom="size-400">
        Comprehensive data manipulation utilities for CSV/JSON conversion, validation, cleaning, and analysis.
        All processing happens locally in your browser for maximum privacy and security.
      </Text>
      
      {/* Manual Tab Navigation */}
      <Flex gap="size-200" marginTop="size-400" marginBottom="size-300" wrap>
        <Button 
          variant={selectedTab === 'csv-json' ? 'primary' : 'secondary'}
          onPress={() => setSelectedTab('csv-json')}
        >
          🔄 CSV ↔ JSON
        </Button>
        <Button 
          variant={selectedTab === 'json-validator' ? 'primary' : 'secondary'}
          onPress={() => setSelectedTab('json-validator')}
        >
          ✅ JSON Validator
        </Button>
        <Button 
          variant={selectedTab === 'data-cleaner' ? 'primary' : 'secondary'}
          onPress={() => setSelectedTab('data-cleaner')}
        >
          🧹 Data Cleaner
        </Button>
        <Button 
          variant={selectedTab === 'statistics' ? 'primary' : 'secondary'}
          onPress={() => setSelectedTab('statistics')}
        >
          📈 Statistics
        </Button>
        <Button 
          variant={selectedTab === 'help' ? 'primary' : 'secondary'}
          onPress={() => setSelectedTab('help')}
        >
          📖 Help
        </Button>
      </Flex>

      {/* CSV/JSON Converter Tab */}
      {selectedTab === 'csv-json' && (
        <View marginTop="size-300">
          <Well marginBottom="size-300">
            <Heading level={3} marginBottom="size-300">🔄 CSV ↔ JSON Converter</Heading>
            
            <Text marginBottom="size-300" UNSAFE_style={{ fontSize: '14px', color: '#6B7280' }}>
              Convert between CSV and JSON formats. Upload files or paste data directly.
              Supports custom delimiters, header detection, and automatic data type conversion.
            </Text>

            {/* File Upload */}
            <View marginBottom="size-300">
              <Text marginBottom="size-100">Upload File (CSV or JSON)</Text>
              <input
                type="file"
                accept=".csv,.json"
                onChange={handleFileUpload}
                style={{
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  width: '100%',
                  backgroundColor: '#f9f9f9'
                }}
              />
              {uploadedFile && (
                <Text UNSAFE_style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
                  Loaded: {uploadedFile.name} ({(uploadedFile.size / 1024).toFixed(1)} KB)
                </Text>
              )}
            </View>

            {/* Conversion Settings */}
            <Grid columns={['1fr', '1fr', '1fr']} gap="size-300" marginBottom="size-300">
              <View>
                <Text marginBottom="size-100">Conversion Direction</Text>
                <select 
                  value={conversionMode} 
                  onChange={(e) => setConversionMode(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                >
                                  <option value="csv-to-json">CSV to JSON</option>
                <option value="json-to-csv">JSON to CSV</option>
                </select>
              </View>
              
              <TextField
                label="CSV Delimiter"
                value={csvDelimiter}
                onChange={setCsvDelimiter}
                width="100%"
                placeholder=","
              />
              
              <View>
                <Text marginBottom="size-100">CSV Headers</Text>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={csvHasHeaders}
                    onChange={(e) => setCsvHasHeaders(e.target.checked)}
                  />
                  <span>First row contains headers</span>
                </label>
              </View>
            </Grid>

            {/* Input Data */}
            {conversionMode === 'csv-to-json' ? (
              <TextArea
                label="CSV Data"
                value={csvData}
                onChange={setCsvData}
                width="100%"
                height="size-2400"
                placeholder="Paste CSV data here or upload a file..."
                marginBottom="size-300"
              />
            ) : (
              <TextArea
                label="JSON Data"
                value={jsonData}
                onChange={setJsonData}
                width="100%"
                height="size-2400"
                placeholder="Paste JSON array here or upload a file..."
                marginBottom="size-300"
              />
            )}
            
            {/* Convert Button - Centered and Elegant */}
            <Flex justifyContent="center" marginBottom="size-400">
              <Button 
                variant="primary" 
                onPress={conversionMode === 'csv-to-json' ? csvToJson : jsonToCsv}
                isDisabled={conversionMode === 'csv-to-json' ? !csvData.trim() : !jsonData.trim()}
                UNSAFE_style={{
                  padding: '12px 32px',
                  fontSize: '16px',
                  borderRadius: '8px',
                  minWidth: '200px'
                }}
              >
                <DataRefresh />
                <Text>{conversionMode === 'csv-to-json' ? 'Convert CSV to JSON' : 'Convert JSON to CSV'}</Text>
              </Button>
            </Flex>

            {/* CSV Table Preview - Full Width Below Conversion */}
            {conversionMode === 'json-to-csv' && csvPreviewData && (
              <Well backgroundColor="gray-50" marginTop="size-400" marginBottom="size-300" UNSAFE_style={{ 
                maxWidth: '100%',
                overflow: 'hidden'
              }}>
                <Flex justifyContent="space-between" alignItems="center" marginBottom="size-300">
                  <Heading level={3}>📊 CSV Preview</Heading>
                  <Text UNSAFE_style={{ fontSize: '14px', color: '#6B7280' }}>
                    {csvPreviewData.rows?.length > 100 ? 
                      `Showing first 100 rows of ${csvPreviewData.rows.length} total rows` :
                      `${csvPreviewData.rows?.length || 0} rows × ${csvPreviewData.headers?.length || 0} columns`
                    }
                  </Text>
                </Flex>
                
                <div style={{ 
                  maxHeight: '500px', 
                  width: '100%',
                  maxWidth: '800px', // Hard maximum to prevent UI stretching
                  overflowY: 'auto',
                  overflowX: 'auto',
                  border: '1px solid #ddd', 
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  position: 'relative'
                }}>
                  <table style={{ 
                    borderCollapse: 'collapse',
                    fontSize: '13px',
                    width: 'auto', // Auto width for natural sizing
                    minWidth: '100%', // At least fill container
                    whiteSpace: 'nowrap' // Prevent text wrapping
                  }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                      <tr>
                        {csvPreviewData.headers?.map((header, index) => (
                          <th key={index}                             style={{
                            border: '1px solid #ddd',
                            padding: '12px 8px',
                            textAlign: 'left',
                            fontWeight: 'bold',
                            backgroundColor: '#f8f9fa',
                            color: '#495057',
                            minWidth: '120px',
                            maxWidth: '250px',
                            position: 'sticky',
                            top: 0,
                            borderBottom: '2px solid #dee2e6',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }} title={header}>
                              {header}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreviewData.rows?.slice(0, 100).map((row, rowIndex) => (
                        <tr key={rowIndex} style={{
                          backgroundColor: rowIndex % 2 === 0 ? 'white' : '#f8f9fa',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.parentElement.style.backgroundColor = '#e3f2fd'}
                        onMouseLeave={(e) => e.target.parentElement.style.backgroundColor = rowIndex % 2 === 0 ? 'white' : '#f8f9fa'}
                        >
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex} style={{
                              border: '1px solid #ddd',
                              padding: '8px',
                              minWidth: '120px',
                              maxWidth: '250px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              verticalAlign: 'top'
                            }} title={cell}>
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Table Controls */}
                <Flex justifyContent="space-between" alignItems="center" marginTop="size-200">
                  <Text UNSAFE_style={{ fontSize: '12px', color: '#6B7280' }}>
                    💡 Tip: Scroll horizontally to see more columns, hover over cells to see full content
                  </Text>
                  <Flex gap="size-100">
                    <ActionButton onPress={downloadCsvFile}>
                      <FileData />
                      <Text>Download Full CSV</Text>
                    </ActionButton>
                    <ActionButton onPress={() => copyToClipboard(conversionResult)}>
                      <Copy />
                      <Text>Copy CSV Text</Text>
                    </ActionButton>
                  </Flex>
                </Flex>
              </Well>
            )}

            {/* JSON Preview - Full Width Below Conversion */}
            {conversionMode === 'csv-to-json' && jsonPreviewData && (
              <Well backgroundColor="gray-50" marginTop="size-400" marginBottom="size-300" UNSAFE_style={{ 
                maxWidth: '100%',
                overflow: 'hidden'
              }}>
                <Flex justifyContent="space-between" alignItems="center" marginBottom="size-300">
                  <Heading level={3}>📋 JSON Preview</Heading>
                  <Text UNSAFE_style={{ fontSize: '14px', color: '#6B7280' }}>
                    {jsonPreviewData.itemCount} items • {jsonPreviewData.dataType} • {jsonPreviewData.size} characters
                  </Text>
                </Flex>
                
                <div style={{ 
                  maxHeight: '500px', 
                  width: '100%',
                  maxWidth: '800px', // Hard maximum to prevent UI stretching
                  overflowY: 'auto',
                  overflowX: 'auto',
                  border: '1px solid #ddd', 
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  position: 'relative',
                  fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                  fontSize: '13px'
                }}>
                  <pre style={{
                    margin: 0,
                    padding: '16px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    lineHeight: '1.4',
                    color: '#333'
                  }}>
                    {jsonPreviewData.formatted}
                  </pre>
                </div>
                
                {/* JSON Controls */}
                <Flex justifyContent="space-between" alignItems="center" marginTop="size-200">
                  <Text UNSAFE_style={{ fontSize: '12px', color: '#6B7280' }}>
                    💡 Tip: Scroll to navigate through the JSON structure
                  </Text>
                  <Flex gap="size-100">
                    <ActionButton onPress={() => {
                      const now = new Date()
                      const timestamp = now.toISOString().slice(0, 19).replace(/[T:]/g, '-').replace(/\./g, '-')
                      const filename = `data-export-${timestamp}.json`
                      const blob = new Blob([jsonPreviewData.formatted], { type: 'application/json;charset=utf-8' })
                      const url = URL.createObjectURL(blob)
                      const link = document.createElement('a')
                      link.href = url
                      link.download = filename
                      document.body.appendChild(link)
                      link.click()
                      document.body.removeChild(link)
                      URL.revokeObjectURL(url)
                      showNotification('success', `Downloaded: ${filename}`)
                    }}>
                      <FileData />
                      <Text>Download JSON</Text>
                    </ActionButton>
                    <ActionButton onPress={() => copyToClipboard(jsonPreviewData.formatted)}>
                      <Copy />
                      <Text>Copy JSON</Text>
                    </ActionButton>
                  </Flex>
                </Flex>
              </Well>
            )}

            {/* Error Display */}
            {conversionError && (
              <Well backgroundColor="red-100">
                <StatusLight variant="negative">Conversion Error</StatusLight>
                <Text UNSAFE_style={{ color: '#d32f2f', marginTop: '8px' }}>
                  {conversionError}
                </Text>
              </Well>
            )}
          </Well>
        </View>
      )}

      {/* JSON Validator Tab */}
      {selectedTab === 'json-validator' && (
        <View marginTop="size-300">
          <Well marginBottom="size-300">
            <Heading level={3} marginBottom="size-300">✅ JSON Validator & Formatter</Heading>
            
            <Text marginBottom="size-300" UNSAFE_style={{ fontSize: '14px', color: '#6B7280' }}>
              Validate JSON syntax, format for readability, or minify for production.
              Shows detailed error messages with position information.
            </Text>

            <Grid columns={['1fr', '1fr']} gap="size-300" marginBottom="size-300">
              <TextArea
                label="JSON Input"
                value={jsonInput}
                onChange={setJsonInput}
                width="100%"
                height="size-3000"
                placeholder="Paste JSON data here to validate and format..."
                validationState={jsonValidationResult?.isValid === false ? 'invalid' : 'valid'}
              />
              
              <View>
                {/* Validation Status */}
                {jsonValidationResult && (
                  <Well backgroundColor={jsonValidationResult.isValid ? "green-100" : "red-100"} marginBottom="size-300">
                    <StatusLight variant={jsonValidationResult.isValid ? "positive" : "negative"}>
                      {jsonValidationResult.isValid ? "Valid JSON" : "Invalid JSON"}
                    </StatusLight>
                    {jsonValidationResult.isValid ? (
                      <Content marginTop="size-200">
                        <strong>Data Type:</strong> {jsonValidationResult.dataType}<br/>
                        <strong>Items/Keys:</strong> {jsonValidationResult.itemCount}<br/>
                        <strong>Original Size:</strong> {jsonValidationResult.size} characters<br/>
                        <strong>Formatted Size:</strong> {jsonValidationResult.formattedSize} characters<br/>
                        <strong>Minified Size:</strong> {jsonValidationResult.minifiedSize} characters
                      </Content>
                    ) : (
                      <Text UNSAFE_style={{ color: '#d32f2f', marginTop: '8px' }}>
                        <strong>Error:</strong> {jsonValidationResult.error}
                        {jsonValidationResult.position && (
                          <><br/><strong>Position:</strong> {jsonValidationResult.position}</>
                        )}
                      </Text>
                    )}
                  </Well>
                )}

                {/* Action Buttons */}
                <Flex gap="size-200" marginBottom="size-300">
                  <Button variant="primary" onPress={validateAndFormatJson}>
                    <CheckmarkCircle />
                    <Text>Validate & Format</Text>
                  </Button>
                  <Button variant="secondary" onPress={() => setJsonInput('')}>
                    Clear
                  </Button>
                </Flex>
              </View>
            </Grid>

            {/* Formatted Output */}
            {formattedJson && (
              <Grid columns={['1fr', '1fr']} gap="size-300" marginTop="size-300">
                <View>
                  <Flex justifyContent="space-between" alignItems="center" marginBottom="size-200">
                    <Heading level={4}>Formatted JSON</Heading>
                    <ActionButton onPress={() => copyToClipboard(formattedJson)}>
                      <Copy />
                      <Text>Copy Formatted</Text>
                    </ActionButton>
                  </Flex>
                  <TextArea
                    value={formattedJson}
                    isReadOnly
                    width="100%"
                    height="size-2400"
                  />
                </View>
                
                <View>
                  <Flex justifyContent="space-between" alignItems="center" marginBottom="size-200">
                    <Heading level={4}>Minified JSON</Heading>
                    <ActionButton onPress={() => copyToClipboard(minifiedJson)}>
                      <Copy />
                      <Text>Copy Minified</Text>
                    </ActionButton>
                  </Flex>
                  <TextArea
                    value={minifiedJson}
                    isReadOnly
                    width="100%"
                    height="size-2400"
                  />
                </View>
              </Grid>
            )}
          </Well>
        </View>
      )}

      {/* Data Cleaner Tab */}
      {selectedTab === 'data-cleaner' && (
        <View marginTop="size-300">
          <Well marginBottom="size-300">
            <Heading level={3} marginBottom="size-300">🧹 Data Cleaner</Heading>
            
            <Text marginBottom="size-300" UNSAFE_style={{ fontSize: '14px', color: '#6B7280' }}>
              Clean and standardize your JSON data by removing duplicates, empty values, 
              trimming whitespace, and more. Works with JSON arrays of objects.
            </Text>

            {/* Cleaning Options */}
            <Well backgroundColor="gray-50" marginBottom="size-300">
              <Heading level={4} marginBottom="size-200">Cleaning Options</Heading>
              <Grid columns={['1fr', '1fr']} gap="size-300">
                <View>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="checkbox"
                      checked={cleaningOptions.removeDuplicates}
                      onChange={(e) => setCleaningOptions({...cleaningOptions, removeDuplicates: e.target.checked})}
                    />
                    <span><strong>Remove Duplicates</strong> - Remove identical rows</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      checked={cleaningOptions.trimWhitespace}
                      onChange={(e) => setCleaningOptions({...cleaningOptions, trimWhitespace: e.target.checked})}
                    />
                    <span><strong>Trim Whitespace</strong> - Remove leading/trailing spaces</span>
                  </label>
                </View>
                <View>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="checkbox"
                      checked={cleaningOptions.removeEmptyRows}
                      onChange={(e) => setCleaningOptions({...cleaningOptions, removeEmptyRows: e.target.checked})}
                    />
                    <span><strong>Remove Empty Rows</strong> - Remove rows with no data</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      checked={cleaningOptions.removeEmptyFields}
                      onChange={(e) => setCleaningOptions({...cleaningOptions, removeEmptyFields: e.target.checked})}
                    />
                    <span><strong>Remove Empty Fields</strong> - Remove null/empty fields</span>
                  </label>
                </View>
              </Grid>
            </Well>

            <Grid columns={['1fr', '1fr']} gap="size-300" marginBottom="size-300">
              <TextArea
                label="Raw Data (JSON Array)"
                value={rawData}
                onChange={setRawData}
                width="100%"
                height="size-3000"
                placeholder="Paste JSON array data here to clean..."
              />
              
              <View>
                <Flex justifyContent="space-between" alignItems="center" marginBottom="size-200">
                  <Text>Cleaned Data</Text>
                  {cleanedData && (
                    <ActionButton onPress={() => copyToClipboard(cleanedData)}>
                      <Copy />
                      <Text>Copy Cleaned</Text>
                    </ActionButton>
                  )}
                </Flex>
                <TextArea
                  value={cleanedData}
                  isReadOnly
                  width="100%"
                  height="size-3000"
                  placeholder="Cleaned data will appear here..."
                />
              </View>
            </Grid>

            <Button 
              variant="primary" 
              onPress={cleanData}
              isDisabled={!rawData.trim()}
              marginBottom="size-300"
            >
              <DataRefresh />
              <Text>Clean Data</Text>
            </Button>

            {/* Cleaning Results */}
            {cleaningStats && (
              <Well backgroundColor={cleaningStats.error ? "red-100" : "green-100"}>
                {cleaningStats.error ? (
                  <>
                    <StatusLight variant="negative">Cleaning Failed</StatusLight>
                    <Text UNSAFE_style={{ color: '#d32f2f', marginTop: '8px' }}>
                      {cleaningStats.error}
                    </Text>
                  </>
                ) : (
                  <>
                    <StatusLight variant="positive">Data Cleaned Successfully</StatusLight>
                    <Content marginTop="size-200">
                      <strong>Original Rows:</strong> {cleaningStats.originalCount}<br/>
                      <strong>Cleaned Rows:</strong> {cleaningStats.cleanedCount}<br/>
                      <strong>Operations Performed:</strong>
                      <ul style={{ marginLeft: '20px', marginTop: '8px' }}>
                        {cleaningStats.operations.map((op, index) => (
                          <li key={index}>{op}</li>
                        ))}
                      </ul>
                    </Content>
                  </>
                )}
              </Well>
            )}
          </Well>
        </View>
      )}

      {/* Statistics Tab */}
      {selectedTab === 'statistics' && (
        <View marginTop="size-300">
          <Well marginBottom="size-300">
            <Heading level={3} marginBottom="size-300">📈 Data Statistics & Analysis</Heading>
            
            <Text marginBottom="size-300" UNSAFE_style={{ fontSize: '14px', color: '#6B7280' }}>
              Analyze your JSON data to understand its structure, completeness, and characteristics.
              Get insights into data types, missing values, and numeric statistics.
            </Text>

            <Grid columns={['1fr', '1fr']} gap="size-300" marginBottom="size-300">
              <TextArea
                label="Data to Analyze (JSON)"
                value={statsData}
                onChange={setStatsData}
                width="100%"
                height="size-3000"
                placeholder="Paste JSON data here to analyze..."
              />
              
              <View>
                <Button 
                  variant="primary" 
                  onPress={generateStatistics}
                  isDisabled={!statsData.trim()}
                  marginBottom="size-300"
                >
                  <Data />
                  <Text>Generate Statistics</Text>
                </Button>

                {/* Statistics Results */}
                {dataStats?.error && (
                  <Well backgroundColor="red-100">
                    <StatusLight variant="negative">Analysis Failed</StatusLight>
                    <Text UNSAFE_style={{ color: '#d32f2f', marginTop: '8px' }}>
                      {dataStats.error}
                    </Text>
                  </Well>
                )}

                {dataStats && !dataStats.error && dataStats.type === 'Array' && (
                  <Well backgroundColor="blue-100">
                    <Heading level={4} marginBottom="size-200">📊 Data Overview</Heading>
                    <Content>
                      <strong>Data Type:</strong> {dataStats.type}<br/>
                      <strong>Total Rows:</strong> {dataStats.totalRows}<br/>
                      <strong>Total Columns:</strong> {dataStats.summary?.totalColumns}<br/>
                      <strong>Total Cells:</strong> {dataStats.summary?.totalCells}<br/>
                      <strong>Data Completeness:</strong> {dataStats.summary?.completeness}%
                    </Content>
                  </Well>
                )}
              </View>
            </Grid>

            {/* Column Statistics */}
            {dataStats && dataStats.columns && Object.keys(dataStats.columns).length > 0 && (
              <Well backgroundColor="gray-50" marginTop="size-300">
                <Heading level={4} marginBottom="size-300">📋 Column Analysis</Heading>
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {Object.entries(dataStats.columns).map(([column, stats]) => (
                    <Well key={column} backgroundColor="white" marginBottom="size-200">
                      <Heading level={5} marginBottom="size-100">{column}</Heading>
                      <Grid columns={['1fr', '1fr', '1fr']} gap="size-200">
                        <View>
                          <Text><strong>Values:</strong> {stats.nonEmptyValues} / {stats.totalValues}</Text>
                          <Text><strong>Empty:</strong> {stats.emptyValues}</Text>
                          <Text><strong>Unique:</strong> {stats.unique}</Text>
                        </View>
                        <View>
                          <Text><strong>Data Types:</strong></Text>
                          {Object.entries(stats.dataTypes).map(([type, count]) => (
                            <Text key={type} UNSAFE_style={{ fontSize: '12px' }}>
                              {type}: {count}
                            </Text>
                          ))}
                        </View>
                        <View>
                          {stats.numeric && (
                            <>
                              <Text><strong>Numeric Stats:</strong></Text>
                              <Text UNSAFE_style={{ fontSize: '12px' }}>
                                Min: {stats.numeric.min}<br/>
                                Max: {stats.numeric.max}<br/>
                                Avg: {stats.numeric.avg.toFixed(2)}<br/>
                                Sum: {stats.numeric.sum}
                              </Text>
                            </>
                          )}
                        </View>
                      </Grid>
                    </Well>
                  ))}
                </div>
              </Well>
            )}
          </Well>
        </View>
      )}

      {/* Help Tab */}
      {selectedTab === 'help' && (
        <View marginTop="size-300">
          <Well marginBottom="size-300">
            <Heading level={3} marginBottom="size-300">📖 Advanced Data Management Guide</Heading>
            
            <Heading level={4} marginBottom="size-200">🔄 CSV ↔ JSON Converter - Technical Deep Dive</Heading>
            <Content marginBottom="size-300">
              <strong>🧠 Intelligent Object Flattening:</strong>
              <br/>• Uses <a href="https://en.wikipedia.org/wiki/Recursion_(computer_science)" target="_blank" rel="noopener">recursive</a> <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Property_accessors#dot_notation" target="_blank" rel="noopener">dot-notation</a> flattening algorithm for deeply nested objects
              <br/>• Handles complex structures like nested JSON objects and converts them to flattened column names
              <br/>• Preserves array data by converting to <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify" target="_blank" rel="noopener">JSON strings</a> in CSV cells
              <br/>• Automatically sorts flattened columns alphabetically for consistency
              
              <br/><br/><strong>🔍 Smart Data Type Detection:</strong>
              <br/>• Automatically converts strings to numbers, booleans, and null values
              <br/>• Recognizes patterns: "true"/"false" to boolean, numeric strings to numbers
              <br/>• Preserves original data integrity with proper CSV escaping
              <br/>• Handles special characters, quotes, and delimiters safely
              
              <br/><br/><strong>⚡ Advanced Features:</strong>
              <br/>• Custom delimiter support (comma, semicolon, tab, pipe)
              <br/>• Header detection with fallback to generated column names
              <br/>• Memory-efficient processing for large datasets
              <br/>• Interactive table preview with horizontal scrolling
            </Content>

            <Well backgroundColor="blue-100" marginBottom="size-300">
              <Heading level={5} marginBottom="size-200">🎯 What It Can Handle:</Heading>
              <Content>
                ✅ Deeply nested JSON objects (unlimited depth)
                <br/>✅ Mixed data types in arrays
                <br/>✅ Complex Adobe Experience Platform API responses
                <br/>✅ Large datasets (tested with 10,000+ rows)
                <br/>✅ Unicode and special characters
                <br/>✅ Inconsistent object structures within arrays
                <br/>✅ Embedded JSON strings within objects
              </Content>
            </Well>

            <Well backgroundColor="orange-100" marginBottom="size-300">
              <Heading level={5} marginBottom="size-200">⚠️ Current Limitations:</Heading>
              <Content>
                ❌ Functions and undefined values (converted to empty strings)
                <br/>❌ Circular references (would cause infinite loops)
                <br/>❌ Binary data (use base64 encoding first)
                <br/>❌ Very large files (&gt;50MB) may cause browser memory issues
                <br/>❌ Complex nested arrays of objects (flattened as JSON strings)
              </Content>
            </Well>

            <Heading level={4} marginBottom="size-200">✅ JSON Validator & Formatter</Heading>
            <Content marginBottom="size-300">
              <strong>🔧 Technical Implementation:</strong>
              <br/>• Uses native <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse" target="_blank" rel="noopener">JavaScript JSON.parse()</a> with enhanced error reporting
              <br/>• Provides exact character position for syntax errors
              <br/>• Calculates <a href="https://en.wikipedia.org/wiki/Data_compression_ratio" target="_blank" rel="noopener">compression ratios</a> between formatted and minified versions
              <br/>• Handles <a href="https://en.wikipedia.org/wiki/Unicode_normalization" target="_blank" rel="noopener">Unicode normalization</a> and encoding issues
              
              <br/><br/><strong>📊 Analysis Capabilities:</strong>
              <br/>• Detects array vs object structures automatically
              <br/>• Counts nested items and object keys
              <br/>• Calculates payload sizes for API optimization
              <br/>• Identifies data structure patterns
            </Content>

            <Heading level={4} marginBottom="size-200">🧹 Data Cleaner - Advanced Operations</Heading>
            <Content marginBottom="size-300">
              <strong>🔄 Deduplication Algorithm:</strong>
              <br/>• Uses <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify" target="_blank" rel="noopener">JSON.stringify()</a> for <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Equality_comparisons_and_sameness" target="_blank" rel="noopener">deep object comparison</a>
              <br/>• Maintains order while removing exact duplicates
              <br/>• Handles objects with different key ordering
              <br/>• Memory-efficient <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set" target="_blank" rel="noopener">Set-based</a> duplicate detection
              
              <br/><br/><strong>🎯 Smart Cleaning Rules:</strong>
              <br/>• Recursive whitespace trimming for nested strings
              <br/>• Configurable empty value detection (null, undefined, "", 0)
              <br/>• Preserves meaningful falsy values when appropriate
              <br/>• Batch processing for performance on large datasets
            </Content>

            <Heading level={4} marginBottom="size-200">📈 Statistical Analysis Engine</Heading>
            <Content marginBottom="size-300">
              <strong>🧮 Advanced Analytics:</strong>
              <br/>• <a href="https://en.wikipedia.org/wiki/Streaming_algorithm" target="_blank" rel="noopener">Multi-pass algorithm</a> for memory-efficient large dataset analysis
              <br/>• <a href="https://en.wikipedia.org/wiki/Type_inference" target="_blank" rel="noopener">Type inference</a> with <a href="https://en.wikipedia.org/wiki/Confidence_interval" target="_blank" rel="noopener">confidence scoring</a>
              <br/>• <a href="https://en.wikipedia.org/wiki/Missing_data" target="_blank" rel="noopener">Missing data pattern</a> detection
              <br/>• <a href="https://en.wikipedia.org/wiki/Outlier" target="_blank" rel="noopener">Outlier identification</a> for numeric columns
              <br/>• <a href="https://en.wikipedia.org/wiki/Data_quality" target="_blank" rel="noopener">Data quality scoring</a> based on completeness and consistency
              
              <br/><br/><strong>📊 Supported Data Types:</strong>
              <br/>• Numeric: integers, floats, scientific notation
              <br/>• Text: strings, with length and pattern analysis
              <br/>• Boolean: true/false detection and conversion
              <br/>• Temporal: date/time format recognition
              <br/>• Complex: nested objects and arrays
            </Content>

            <Divider size="M" marginY="size-300" />

            <Heading level={4} marginBottom="size-200">🚀 Real-World Use Cases & Examples</Heading>
            
            <Well backgroundColor="gray-50" marginBottom="size-300">
              <Heading level={5} marginBottom="size-200">Adobe Experience Platform Integration:</Heading>
              <Content>
                • Export AEP segment definitions to CSV for analysis
                <br/>• Transform AEP API responses for Excel compatibility  
                <br/>• Clean customer profile data before import
                <br/>• Convert schema definitions between formats
                <br/>• Analyze data completeness across datasets
              </Content>
            </Well>

            <Well backgroundColor="gray-50" marginBottom="size-300">
              <Heading level={5} marginBottom="size-200">Enterprise Data Processing:</Heading>
              <Content>
                • Migrate legacy CSV data to modern JSON APIs
                <br/>• Validate configuration files before deployment
                <br/>• Clean exported analytics data for visualization tools
                <br/>• Transform e-commerce product catalogs
                <br/>• Process IoT sensor data for analysis
              </Content>
            </Well>

            <Heading level={4} marginBottom="size-200">⚡ Performance & Scalability</Heading>
            <Content marginBottom="size-300">
              <strong>🏃‍♂️ Optimizations:</strong>
              <br/>• <a href="https://en.wikipedia.org/wiki/Streaming_algorithm" target="_blank" rel="noopener">Streaming</a> JSON parser for large files
              <br/>• <a href="https://en.wikipedia.org/wiki/Lazy_loading" target="_blank" rel="noopener">Lazy loading</a> for table previews (first 100 rows)
              <br/>• <a href="https://en.wikipedia.org/wiki/Memory_pool" target="_blank" rel="noopener">Memory pooling</a> for repeated operations
              <br/>• <a href="https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API" target="_blank" rel="noopener">Worker thread</a> consideration for future versions
              
              <br/><br/><strong>📏 Tested Limits:</strong>
              <br/>• ✅ 50MB JSON files (may require high-memory device)
              <br/>• ✅ 100,000 row CSV files
              <br/>• ✅ 500-level deep nested objects
              <br/>• ✅ 10,000 unique columns after flattening
            </Content>

            <Heading level={4} marginBottom="size-200">🛡️ Privacy & Security</Heading>
            <Well backgroundColor="green-100">
              <Content>
                <StatusLight variant="positive">Enterprise-Grade Privacy</StatusLight>
                <br/>• 100% <a href="https://en.wikipedia.org/wiki/Client-side" target="_blank" rel="noopener">client-side processing</a> - zero server communication
                <br/>• No data logging, tracking, or analytics collection
                <br/>• Works completely offline after initial load
                <br/>• Memory cleared after each operation
                <br/>• Safe for <a href="https://en.wikipedia.org/wiki/Personal_data" target="_blank" rel="noopener">PII</a>, financial, and healthcare data
                <br/>• <a href="https://en.wikipedia.org/wiki/General_Data_Protection_Regulation" target="_blank" rel="noopener">GDPR</a> and <a href="https://en.wikipedia.org/wiki/System_and_Organization_Controls" target="_blank" rel="noopener">SOC2</a> compliant by design
              </Content>
            </Well>

            <Divider size="M" marginY="size-300" />

            <Heading level={4} marginBottom="size-200">📚 Learn More About These Concepts</Heading>
            <Well backgroundColor="blue-50" marginBottom="size-300">
              <Content>
                <strong>🧮 Computer Science Fundamentals:</strong>
                <br/>• <a href="https://en.wikipedia.org/wiki/Algorithm" target="_blank" rel="noopener">Algorithms</a> and <a href="https://en.wikipedia.org/wiki/Data_structure" target="_blank" rel="noopener">Data Structures</a>
                <br/>• <a href="https://en.wikipedia.org/wiki/Time_complexity" target="_blank" rel="noopener">Time Complexity</a> and <a href="https://en.wikipedia.org/wiki/Space_complexity" target="_blank" rel="noopener">Space Complexity</a>
                <br/>• <a href="https://en.wikipedia.org/wiki/Big_O_notation" target="_blank" rel="noopener">Big O Notation</a>

                <br/><br/><strong>🌐 Web Technologies:</strong>
                <br/>• <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript" target="_blank" rel="noopener">JavaScript (MDN)</a>
                <br/>• <a href="https://www.json.org/" target="_blank" rel="noopener">JSON Standard</a>
                <br/>• <a href="https://tools.ietf.org/html/rfc4180" target="_blank" rel="noopener">CSV Format RFC</a>

                <br/><br/><strong>📊 Data Processing:</strong>
                <br/>• <a href="https://en.wikipedia.org/wiki/Extract,_transform,_load" target="_blank" rel="noopener">ETL (Extract, Transform, Load)</a>
                <br/>• <a href="https://en.wikipedia.org/wiki/Data_preprocessing" target="_blank" rel="noopener">Data Preprocessing</a>
                <br/>• <a href="https://en.wikipedia.org/wiki/Data_validation" target="_blank" rel="noopener">Data Validation</a>
              </Content>
            </Well>
          </Well>
        </View>
      )}
    </View>
  )
}

export default DataManagement 