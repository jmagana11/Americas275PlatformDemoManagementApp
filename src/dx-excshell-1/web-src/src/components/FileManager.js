/*
* <license header>
*/

import React, { useState, useRef } from 'react'
import {
  Flex,
  View,
  Heading,
  Text,
  Button,
  Picker,
  Item,
  StatusLight,
  ProgressBar,
  TableView,
  TableHeader,
  Column,
  TableBody,
  Row,
  Cell,
  Divider,
  Well,
  TextField,
  Dialog,
  DialogTrigger,
  Header,
  Content
} from '@adobe/react-spectrum'
import DataUpload from '@spectrum-icons/workflow/DataUpload'
import DataAdd from '@spectrum-icons/workflow/DataAdd'
import CheckmarkCircle from '@spectrum-icons/workflow/CheckmarkCircle'
import Alert from '@spectrum-icons/workflow/Alert'
import Download from '@spectrum-icons/workflow/Download'
import actionWebInvoke from '../utils'
import allActions from '../config.json'

export const FileManager = ({ runtime, ims }) => {
  const [customFilename, setCustomFilename] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [fileData, setFileData] = useState(null)
  const [csvPreview, setCsvPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [detectedFileType, setDetectedFileType] = useState(null)
  const [detectionConfidence, setDetectionConfidence] = useState(null)
  const [filenameConflict, setFilenameConflict] = useState(null)
  const [suggestedFilename, setSuggestedFilename] = useState('')
  const [showConflictDialog, setShowConflictDialog] = useState(false)
  const fileInputRef = useRef(null)

  // Organize file types by verticals
  const verticals = {
    retail: {
      name: 'Retail',
      description: 'Retail-specific templates for order management and inventory',
      fileTypes: [
        { key: 'order_data', label: 'Order Confirmations (order_data.csv)' },
        { key: 'inventory_stock', label: 'Inventory Stock (inventory_stock.csv)' }
      ]
    },
    recommendations: {
      name: 'Recommendations',
      description: 'Product recommendation and catalog templates',
      fileTypes: [
        { key: 'product_catalog', label: 'Product Recommendations (product_catalog.csv)' }
      ]
    },
    travel: {
      name: 'Travel & Hospitality',
      description: 'Hotel reservations and travel booking templates',
      fileTypes: [
        { key: 'reservation_info', label: 'Reservation Info (reservation_info.csv)' },
        { key: 'resort_summary', label: 'Resort Summary (resort_summary.csv)' },
        { key: 'resort_attributes', label: 'Resort Attributes (resort_attributes.csv)' },
        { key: 'rewards_member', label: 'Rewards Member (rewards_member.csv)' }
      ]
    }
  }

  const fileTypes = Object.values(verticals).flatMap(vertical => vertical.fileTypes)

  // Template detection function
  const detectTemplateType = (headers) => {
    const headerSet = new Set(headers.map(h => h.toLowerCase()))
    
    // Define signature fields for each template
    const signatures = {
      order_data: ['customer_id', 'order_number', 'shipping_address'],
      product_catalog: ['prod_id', 'name', 'brand', 'price'],
      inventory_stock: ['sku', 'store_id', 'quantity_in_stock'],
      reservation_info: ['confirmation_id', 'hotel_id', 'room_id'],
      resort_summary: ['hotel_id', 'hotel_name', 'hotel_phone'],
      resort_attributes: ['hotel_id', 'room_id', 'room_type'],
      rewards_member: ['member_id', 'member_status', 'points_balance']
    }
    
    let bestMatch = null
    let highestScore = 0
    
    Object.entries(signatures).forEach(([templateType, signatureFields]) => {
      const score = signatureFields.filter(field => 
        headerSet.has(field.toLowerCase())
      ).length
      
      if (score > highestScore && score >= signatureFields.length * 0.6) {
        highestScore = score
        bestMatch = templateType
      }
    })
    
    const confidence = bestMatch ? (highestScore / signatures[bestMatch].length) * 100 : 0
    
    return { 
      templateType: bestMatch || null, 
      confidence: confidence || 0 
    }
  }

  // Generate smart filename based on template type and session
  const generateSmartFilename = (fileType, sessionId, customName = '') => {
    const timestamp = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const time = new Date().toTimeString().split(' ')[0].replace(/:/g, '-') // HH-MM-SS
    
    if (customName && customName.trim()) {
      return `${customName.trim()}_${timestamp}.csv`
    }
    
    const templateNames = {
      order_data: 'order_confirmations',
      product_catalog: 'product_recommendations', 
      inventory_stock: 'inventory_stock',
      reservation_info: 'reservation_info',
      resort_summary: 'resort_summary',
      resort_attributes: 'resort_attributes',
      rewards_member: 'rewards_member'
    }
    
    const baseName = templateNames[fileType] || fileType
    return `${baseName}_${sessionId}_${timestamp}_${time}.csv`
  }

  // Check for filename conflicts (simulate API call)
  const checkFilenameConflict = async (filename) => {
    // This would typically call your backend to check if file exists
    // For now, we'll simulate with localStorage to demonstrate the concept
    const existingFiles = JSON.parse(localStorage.getItem('uploadedFiles') || '[]')
    const conflict = existingFiles.find(file => file.filename === filename)
    
    return {
      exists: !!conflict,
      lastModified: conflict?.lastModified || null,
      fileSize: conflict?.fileSize || null
    }
  }

  // Template data for each file type
  const templates = {
    order_data: [
      {
        customer_id: 'CUST-001',
        customer_name: 'John Doe',
        order_date: '2024-01-15',
        order_number: 'ORD-001',
        shipping_address: '123 Main St, City, State 12345',
        status: 'confirmed',
        tracking_number: 'TRK-123456789'
      },
      {
        customer_id: 'CUST-002',
        customer_name: 'Jane Smith',
        order_date: '2024-01-16',
        order_number: 'ORD-002',
        shipping_address: '456 Oak Ave, Town, State 67890',
        status: 'shipped',
        tracking_number: 'TRK-987654321'
      }
    ],
    product_catalog: [
      {
        prod_id: 'PROD-001',
        name: 'Wireless Headphones',
        brand: 'TechAudio',
        price: '149.99',
        description: 'High-quality wireless headphones with noise cancellation',
        image: 'https://example.com/images/headphones.jpg',
        link: 'https://example.com/products/wireless-headphones'
      },
      {
        prod_id: 'PROD-002',
        name: 'Smart Watch',
        brand: 'SmartTech',
        price: '89.99',
        description: 'Feature-rich smartwatch with health tracking',
        image: 'https://example.com/images/smartwatch.jpg',
        link: 'https://example.com/products/smart-watch'
      }
    ],
    inventory_stock: [
      {
        sku: 'SKU-001',
        product_name: 'Wireless Headphones',
        store_id: 'STORE-001',
        store_name: 'Downtown Mall',
        store_address: '123 Main St, Downtown, CA 90210',
        quantity_in_stock: '15',
        reorder_level: '5',
        last_updated: '2024-01-15'
      },
      {
        sku: 'SKU-002',
        product_name: 'Smart Watch',
        store_id: 'STORE-002',
        store_name: 'Westside Plaza',
        store_address: '456 Oak Ave, Westside, CA 90211',
        quantity_in_stock: '8',
        reorder_level: '3',
        last_updated: '2024-01-15'
      }
    ],
    // Travel & Hospitality Templates
    reservation_info: [
      {
        confirmation_id: '354098092',
        arrival_date: '2024-07-15',
        departure_date: '2024-07-20',
        check_in_time: '4:00 PM',
        check_out_time: '11:00 AM',
        hotel_id: 'BW-OHARE-SOUTH',
        hotel_name: 'Best Western Plus O\'Hare International South Hotel',
        hotel_address: '3001 N Mannheim Road, Franklin Park, Illinois, 60131-2434, United States',
        room_id: 'ROOM-001',
        rate_type: 'Rewards Member Flexible Rate',
        total_charged_today: '0.00',
        total_charged_arrival: '5,000 Points + $498.60',
        room_subtotal: '498.60',
        taxes_fees: '0.00',
        total_cost: '5,000 Points + $498.60'
      },
      {
        confirmation_id: '354098093',
        arrival_date: '2024-08-10',
        departure_date: '2024-08-15',
        check_in_time: '3:00 PM',
        check_out_time: '11:00 AM',
        hotel_id: 'BW-DOWNTOWN',
        hotel_name: 'Best Western Plus Downtown Hotel',
        hotel_address: '123 Main Street, Downtown, CA 90210',
        room_id: 'ROOM-002',
        rate_type: 'Standard Rate',
        total_charged_today: '150.00',
        total_charged_arrival: '350.00',
        room_subtotal: '500.00',
        taxes_fees: '45.00',
        total_cost: '545.00'
      }
    ],
    resort_summary: [
      {
        hotel_id: 'BW-OHARE-SOUTH',
        hotel_name: 'Best Western Plus O\'Hare International South Hotel',
        hotel_address: '3001 N Mannheim Road, Franklin Park, Illinois, 60131-2434, United States',
        hotel_phone: '(847) 255-9292',
        reservations_phone: '855-564-2515',
        hotel_logo: 'Best Western PLUS.',
        hotel_website: 'https://www.bestwestern.com/ohare-south',
        hotel_description: 'Conveniently located near O\'Hare International Airport',
        amenities: 'Wi-Fi, Parking, Restaurant/Bar, Pet-Friendly, Fitness Center',
        star_rating: '3',
        property_type: 'Hotel'
      },
      {
        hotel_id: 'BW-DOWNTOWN',
        hotel_name: 'Best Western Plus Downtown Hotel',
        hotel_address: '123 Main Street, Downtown, CA 90210',
        hotel_phone: '(555) 123-4567',
        reservations_phone: '855-564-2515',
        hotel_logo: 'Best Western PLUS.',
        hotel_website: 'https://www.bestwestern.com/downtown',
        hotel_description: 'Located in the heart of downtown',
        amenities: 'Wi-Fi, Parking, Restaurant/Bar, Pool, Spa',
        star_rating: '4',
        property_type: 'Hotel'
      }
    ],
    resort_attributes: [
      {
        hotel_id: 'BW-OHARE-SOUTH',
        room_id: 'ROOM-001',
        room_type: '2 Queen Beds',
        room_description: 'Spacious room with two queen beds',
        room_features: 'Non-Smoking, Activity Table And Chairs, Microwave And Refrigerator, Wi-Fi, Full Breakfast',
        room_amenities: 'Free Wi-Fi, Free Breakfast, Microwave, Refrigerator, Coffee Maker',
        room_size: '300 sq ft',
        max_occupancy: '4 Adults',
        bed_configuration: '2 Queen Beds',
        room_category: 'Standard',
        room_images: 'https://example.com/images/queen-room.jpg',
        room_rates: 'Rewards Member Flexible Rate',
        cancellation_policy: 'Free cancellation until 24 hours before arrival'
      },
      {
        hotel_id: 'BW-DOWNTOWN',
        room_id: 'ROOM-002',
        room_type: '1 King Bed',
        room_description: 'Comfortable king room with city view',
        room_features: 'Non-Smoking, City View, Work Desk, Wi-Fi, Full Breakfast',
        room_amenities: 'Free Wi-Fi, Free Breakfast, Work Desk, City View, Coffee Maker',
        room_size: '250 sq ft',
        max_occupancy: '2 Adults',
        bed_configuration: '1 King Bed',
        room_category: 'Deluxe',
        room_images: 'https://example.com/images/king-room.jpg',
        room_rates: 'Standard Rate',
        cancellation_policy: 'Free cancellation until 24 hours before arrival'
      }
    ],
    rewards_member: [
      {
        member_id: '6006637464812299',
        member_name: 'John Smith',
        member_email: 'john.smith@email.com',
        member_phone: '+1-555-123-4567',
        member_status: 'Diamond',
        member_tier: 'Diamond',
        points_balance: '25,000',
        member_since: '2020-03-15',
        total_stays: '45',
        total_nights: '180',
        preferred_hotel_brand: 'Best Western',
        preferred_room_type: 'King Bed',
        marketing_opt_in: 'true',
        last_activity: '2024-01-15',
        member_address: '123 Main St, City, State 12345'
      },
      {
        member_id: '6006637464812300',
        member_name: 'Jane Doe',
        member_email: 'jane.doe@email.com',
        member_phone: '+1-555-987-6543',
        member_status: 'Gold',
        member_tier: 'Gold',
        points_balance: '12,500',
        member_since: '2021-07-22',
        total_stays: '23',
        total_nights: '92',
        preferred_hotel_brand: 'Best Western',
        preferred_room_type: 'Queen Bed',
        marketing_opt_in: 'false',
        last_activity: '2024-01-10',
        member_address: '456 Oak Ave, Town, State 67890'
      }
    ]
  }

  const downloadTemplate = (fileType) => {
    console.log('Downloading template for:', fileType)
    const template = templates[fileType]
    console.log('Template found:', template)
    
    if (!template || template.length === 0) {
      console.error('Template not available for file type:', fileType)
      alert('Template not available for this file type')
      return
    }

    try {
      // Convert template to CSV
      const headers = Object.keys(template[0])
      console.log('Headers:', headers)
      
      const csvContent = [
        headers.join(','),
        ...template.map(row => 
          headers.map(header => {
            const value = row[header] || ''
            // Escape quotes and wrap in quotes if contains comma
            return value.includes(',') ? `"${value.replace(/"/g, '""')}"` : value
          }).join(',')
        )
      ].join('\n')

      console.log('CSV Content generated:', csvContent.substring(0, 200) + '...')

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `${fileType}_template.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      console.log('Download initiated for:', fileType)
    } catch (error) {
      console.error('Error downloading template:', error)
      alert('Error downloading template: ' + error.message)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelection(files[0])
    }
  }

  const handleFileInputChange = (e) => {
    const files = Array.from(e.target.files)
    if (files.length > 0) {
      handleFileSelection(files[0])
    }
  }

  const handleFileSelection = async (file) => {
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.xlsx')) {
      alert('Please select a CSV or Excel file')
      return
    }

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const content = e.target.result
        const jsonData = csvToJson(content)
        
        if (!jsonData || jsonData.length === 0) {
          alert('No valid data found in the file')
          return
        }
        
        // Detect template type
        const headers = Object.keys(jsonData[0])
        const detection = detectTemplateType(headers)
        
        setFileData(jsonData)
        setCsvPreview(jsonData.slice(0, 10)) // Show first 10 rows for preview
        setDetectedFileType(detection.templateType || null)
        setDetectionConfidence(detection.confidence || 0)
        setUploadResult(null)
        
        // Generate and check filename for conflicts
        if (detection.templateType && sessionId.trim()) {
          const generatedFilename = generateSmartFilename(detection.templateType, sessionId.trim(), customFilename)
          const conflict = await checkFilenameConflict(generatedFilename)
          
          if (conflict.exists) {
            setFilenameConflict(conflict)
            setSuggestedFilename(generatedFilename)
            setShowConflictDialog(true)
          }
        }
        
        console.log('Detected template:', detection.templateType, 'with confidence:', detection.confidence)
      } catch (error) {
        console.error('Error parsing file:', error)
        alert('Error parsing file: ' + error.message)
      }
    }
    reader.readAsText(file)
  }

  const csvToJson = (csvContent) => {
    const lines = csvContent.split('\n').filter(line => line.trim())
    if (lines.length === 0) return []
    
    const headers = lines[0].split(',').map(header => header.trim().replace(/"/g, ''))
    if (headers.length === 0) return []
    
    const result = []
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i])
      if (values.length >= headers.length) {
        const obj = {}
        headers.forEach((header, index) => {
          obj[header] = values[index] || ''
        })
        result.push(obj)
      }
    }
    
    return result
  }

  const parseCSVLine = (line) => {
    const result = []
    let current = ''
    let inQuotes = false
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    
    result.push(current.trim())
    return result
  }

  const uploadFile = async () => {
    if (!fileData || !fileData.length) {
      alert('Please select a file first')
      return
    }

    if (!sessionId.trim()) {
      alert('Please enter a Session ID')
      return
    }

    setUploading(true)
    setUploadResult(null)

    try {
      const actionName = 'upload-file'
      const actionUrl = allActions[actionName]
      
      if (!actionUrl) {
        throw new Error(`Action ${actionName} not found in config`)
      }

      // Include IMS information and session ID in the headers for authenticated requests
      const headers = ims ? {
        'authorization': `Bearer ${ims.token}`,
        'x-gw-ims-org-id': ims.org,
        'x-session-id': sessionId.trim()  // Add session ID header
      } : {
        'x-session-id': sessionId.trim()  // Add session ID header even without IMS
      }

      const response = await actionWebInvoke(actionUrl, headers, {
        fileData: fileData,
        fileType: detectedFileType,
        customFilename: customFilename.trim() || null,
        sessionId: sessionId.trim(),  // Also include in body as parameter
        // Include IMS context for action processing
        imsOrg: ims?.org,
        imsToken: ims?.token
      })

      // The response from Adobe I/O Runtime actions is in the 'body' property
      const responseBody = response.body || response

      if (responseBody && responseBody.success) {
        // Store the uploaded filename for API tester
        localStorage.setItem('lastUploadedFilename', responseBody.filename)
        
        // Track uploaded files for conflict detection
        const uploadedFiles = JSON.parse(localStorage.getItem('uploadedFiles') || '[]')
        uploadedFiles.push({
          filename: responseBody.filename,
          lastModified: new Date().toISOString(),
          fileSize: fileData.length + ' records',
          sessionId: sessionId.trim()
        })
        localStorage.setItem('uploadedFiles', JSON.stringify(uploadedFiles))
        
        setUploadResult({
          success: true,
          message: responseBody.message,
          filename: responseBody.filename
        })
      } else {
        setUploadResult({
          success: false,
          message: responseBody?.error || response?.error || 'Upload failed'
        })
      }
    } catch (error) {
      console.error('Upload error:', error)
      setUploadResult({
        success: false,
        message: error.message || 'Upload failed'
      })
    }

    setUploading(false)
  }

  const clearFile = () => {
    setFileData(null)
    setCsvPreview(null)
    setUploadResult(null)
    setDetectedFileType(null)
    setDetectionConfidence(null)
    setFilenameConflict(null)
    setSuggestedFilename('')
    setShowConflictDialog(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleOverrideFile = () => {
    setShowConflictDialog(false)
    setFilenameConflict(null)
  }

  const handleRenameFile = () => {
    const timestamp = new Date().toISOString().split('T')[0]
    const time = new Date().toTimeString().split(' ')[0].replace(/:/g, '-')
    const newFilename = suggestedFilename.replace('.csv', `_${timestamp}_${time}.csv`)
    setCustomFilename(newFilename.split('_')[0]) // Set the base name for custom filename
    setShowConflictDialog(false)
    setFilenameConflict(null)
  }

  const handleCancelUpload = () => {
    setShowConflictDialog(false)
    setFilenameConflict(null)
    clearFile()
  }

  return (
    <Flex direction="column" gap="size-300" margin="size-200">
      <Heading level={2}>File Manager</Heading>
      <Text>Upload order confirmations and product recommendations to Azure Blob Storage</Text>
      
      {/* Show IMS context info */}
      {ims && (
        <View backgroundColor="gray-75" padding="size-200" borderRadius="medium">
          <Text size="S">
            Connected as: {ims.org ? `${ims.org}` : 'Unknown Org'} 
            {ims.token ? ' (Authenticated)' : ' (Not Authenticated)'}
          </Text>
        </View>
      )}

      {/* Upload Configuration */}
      <View>
        <Heading level={3} marginBottom="size-200">Upload Configuration</Heading>
        <Flex direction="column" gap="size-200">
          
          {/* Template Download Section - Organized by Verticals */}
          <View>
            <Heading level={4} marginBottom="size-200">Download Templates by Vertical</Heading>
            
            {Object.entries(verticals).map(([verticalKey, vertical]) => (
              <Well key={verticalKey} marginBottom="size-300">
                <Flex direction="column" gap="size-200">
                  <View>
                    <Heading level={5} marginBottom="size-100">{vertical.name}</Heading>
                    <Text size="S" UNSAFE_style={{ color: '#666' }}>
                      {vertical.description}
                    </Text>
                  </View>
                  
                  <Flex gap="size-200" wrap>
                    {vertical.fileTypes.map(fileType => (
                      <Button 
                        key={fileType.key}
                        variant="secondary" 
                        onPress={() => downloadTemplate(fileType.key)}
                        size="S"
                      >
                        <Download size="S" />
                        <Text>{fileType.label.split(' (')[0]}</Text>
                      </Button>
                    ))}
                  </Flex>
                </Flex>
              </Well>
            ))}
          </View>
          
          <TextField
            label="Session ID"
            placeholder="Enter a unique session identifier"
            value={sessionId}
            onChange={setSessionId}
            width="size-3600"
            isRequired={true}
            description="Required: A unique identifier for this upload session"
          />
          <TextField
            label="Custom Filename (optional)"
            placeholder="e.g. user1_orders, christmas_products"
            value={customFilename}
            onChange={setCustomFilename}
            width="size-3600"
            description="If provided, this will be the filename used in Azure Blob Storage. Otherwise, default names will be used."
          />
        </Flex>
      </View>

      <Divider />

      {/* File Upload Area */}
      <View>
        <Heading level={3} marginBottom="size-200">Upload File</Heading>
        <Well
          UNSAFE_style={{
            border: dragOver ? '2px dashed #1473e6' : '2px dashed #ccc',
            backgroundColor: dragOver ? '#f0f8ff' : '#fafafa',
            padding: '40px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Flex direction="column" alignItems="center" gap="size-200">
            <DataUpload size="XL" />
            <Heading level={4}>Drag and drop your CSV file here</Heading>
            <Text>or click to browse files</Text>
            <Button 
              variant="primary"
              onPress={() => fileInputRef.current?.click()}
            >
              <DataAdd />
              <Text>Browse Files</Text>
            </Button>
          </Flex>
        </Well>
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx"
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
        />
      </View>

      {/* File Preview */}
      {csvPreview && csvPreview.length > 0 && (
        <View>
          <Heading level={3} marginBottom="size-200">File Preview</Heading>
          
          {/* Template Detection Info */}
          {detectedFileType ? (
            <Well marginBottom="size-300" UNSAFE_style={{ backgroundColor: '#f0f8ff', border: '1px solid #1473e6' }}>
              <Flex direction="column" gap="size-100">
                <Flex alignItems="center" gap="size-200">
                  <StatusLight variant="positive">Template Detected</StatusLight>
                  <Text UNSAFE_style={{ fontWeight: 'bold' }}>
                    {fileTypes.find(ft => ft.key === detectedFileType)?.label || detectedFileType}
                  </Text>
                </Flex>
                <Text size="S" UNSAFE_style={{ color: '#666' }}>
                  Confidence: {detectionConfidence ? detectionConfidence.toFixed(1) : '0'}% • 
                  {Object.entries(verticals).find(([key, vertical]) => 
                    vertical.fileTypes.some(ft => ft.key === detectedFileType)
                  )?.[1]?.name || 'Unknown'} Vertical
                </Text>
              </Flex>
            </Well>
          ) : (
            <Well marginBottom="size-300" UNSAFE_style={{ backgroundColor: '#fff3cd', border: '1px solid #ffc107' }}>
              <Flex direction="column" gap="size-100">
                <Flex alignItems="center" gap="size-200">
                  <StatusLight variant="notice">Template Not Detected</StatusLight>
                  <Text UNSAFE_style={{ fontWeight: 'bold' }}>Unknown Template Format</Text>
                </Flex>
                <Text size="S" UNSAFE_style={{ color: '#666' }}>
                  The file structure doesn't match any known template. Please download a template from above and ensure your file follows the correct format.
                </Text>
              </Flex>
            </Well>
          )}
          
          <Text marginBottom="size-200">
            Showing first {csvPreview?.length || 0} rows of {fileData?.length || 0} total records
          </Text>
          
          <TableView aria-label="File preview" maxWidth="100%" maxHeight="400px" width="100%">
            <TableHeader>
              {Object.keys(csvPreview?.[0] || {}).map(header => (
                <Column key={header} isRowHeader={false}>{header}</Column>
              ))}
            </TableHeader>
            <TableBody>
              {csvPreview?.map((row, index) => (
                <Row key={`row-${index}`}>
                  {Object.keys(csvPreview?.[0] || {}).map((header, colIndex) => (
                    <Cell key={`cell-${index}-${colIndex}`}>
                      {String(row[header] || '')}
                    </Cell>
                  ))}
                </Row>
              ))}
            </TableBody>
          </TableView>

          <Flex marginTop="size-300" gap="size-200">
            <Button 
              variant="primary" 
              onPress={uploadFile}
              isDisabled={uploading || !detectedFileType}
            >
              {uploading ? <ProgressBar label="Uploading..." isIndeterminate /> : (
                <>
                  <DataUpload />
                  <Text>Upload to Azure Blob Storage</Text>
                </>
              )}
            </Button>
            <Button variant="secondary" onPress={clearFile}>
              Clear File
            </Button>
          </Flex>
        </View>
      )}

      {/* Upload Result */}
      {uploadResult && (
        <View>
          <Flex alignItems="center" gap="size-200">
            {uploadResult.success ? (
              <>
                <StatusLight variant="positive">Success</StatusLight>
                <CheckmarkCircle color="positive" />
                <Text>{uploadResult.message}</Text>
              </>
            ) : (
              <>
                <StatusLight variant="negative">Error</StatusLight>
                <Alert color="negative" />
                <Text>{uploadResult.message}</Text>
              </>
            )}
          </Flex>
        </View>
      )}

      {/* Filename Conflict Dialog */}
      {showConflictDialog && (
        <Dialog>
          <Header>
            <Heading level={2}>File Already Exists</Heading>
          </Header>
          <Content>
            <Flex direction="column" gap="size-300">
              <Text>
                A file with the name <strong>{suggestedFilename}</strong> already exists.
              </Text>
              
              {filenameConflict && (
                <Well UNSAFE_style={{ backgroundColor: '#f8f9fa' }}>
                  <Text size="S">
                    <strong>Existing file details:</strong><br/>
                    Last modified: {filenameConflict.lastModified || 'Unknown'}<br/>
                    File size: {filenameConflict.fileSize || 'Unknown'}
                  </Text>
                </Well>
              )}
              
              <Text>
                What would you like to do?
              </Text>
              
              <Flex gap="size-200" justifyContent="end">
                <Button variant="secondary" onPress={handleCancelUpload}>
                  Cancel Upload
                </Button>
                <Button variant="secondary" onPress={handleRenameFile}>
                  Rename File
                </Button>
                <Button variant="primary" onPress={handleOverrideFile}>
                  Override Existing
                </Button>
              </Flex>
            </Flex>
          </Content>
        </Dialog>
      )}
    </Flex>
  )
}

export default FileManager 