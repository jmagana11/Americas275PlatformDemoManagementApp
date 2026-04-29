/* 
* <license header>
*/

import React, { useState, useEffect, useRef } from 'react'
import {
  Flex,
  Heading,
  Text,
  View,
  Divider,
  Well,
  Tabs,
  TabList,
  TabPanels,
  TabPanel,
  Item,
  Button,
  Picker,
  TextField,
  NumberField,
  StatusLight,
  ProgressBar,
  TableView,
  TableHeader,
  Column,
  TableBody,
  Row,
  Cell,
  Dialog,
  DialogTrigger,
  Header,
  Content,
  Footer
} from '@adobe/react-spectrum'
import Play from '@spectrum-icons/workflow/Play'
import CheckmarkCircle from '@spectrum-icons/workflow/CheckmarkCircle'
import Alert from '@spectrum-icons/workflow/Alert'
import Refresh from '@spectrum-icons/workflow/Refresh'
import DataUpload from '@spectrum-icons/workflow/DataUpload'
import DataAdd from '@spectrum-icons/workflow/DataAdd'
import Download from '@spectrum-icons/workflow/Download'
import actionWebInvoke from '../utils'
import allActions from '../config.json'

const CodeBlock = ({ children }) => (
  <Text UNSAFE_style={{ 
    fontFamily: 'monospace', 
    backgroundColor: '#f5f5f5', 
    padding: '8px', 
    borderRadius: '4px',
    display: 'block',
    whiteSpace: 'pre-wrap'
  }}>
    {children}
  </Text>
)

const UnifiedDataManager = ({ runtime, ims }) => {
  const [activeTab, setActiveTab] = useState('documentation')
  const [apiMode, setApiMode] = useState('products')
  const [userId, setUserId] = useState('')
  const [productLimit, setProductLimit] = useState(5)
  const [filename, setFilename] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [sku, setSku] = useState('')
  const [storeId, setStoreId] = useState('')
  
  // Logs state
  const [logs, setLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedMode, setSelectedMode] = useState('')
  const [selectedLog, setSelectedLog] = useState(null)
  const [showLogDetailDialog, setShowLogDetailDialog] = useState(false)

  // File Manager state
  const [dragOver, setDragOver] = useState(false)
  const [fileData, setFileData] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [csvPreview, setCsvPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [detectedFileType, setDetectedFileType] = useState(null)
  const [detectionConfidence, setDetectionConfidence] = useState(null)
  const [filenameConflict, setFilenameConflict] = useState(null)
  const [suggestedFilename, setSuggestedFilename] = useState('')
  const [customFilename, setCustomFilename] = useState('')
  const [showConflictDialog, setShowConflictDialog] = useState(false)
  const fileInputRef = useRef(null)

  // Load last uploaded filename from localStorage on component mount
  useEffect(() => {
    const lastFilename = localStorage.getItem('lastUploadedFilename')
    if (lastFilename) {
      setFilename(lastFilename)
    }
  }, [])

  const apiModes = [
    { key: 'products', label: 'Product Recommendations' },
    { key: 'orders', label: 'Order Confirmations' },
    { key: 'stock', label: 'Order In Stock' },
    { key: 'reservation_info', label: 'Reservation Info' },
    { key: 'resort_summary', label: 'Resort Summary' },
    { key: 'resort_attributes', label: 'Resort Attributes' },
    { key: 'rewards_member', label: 'Rewards Member' }
  ]

  // File Manager constants
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

  const handleLogClick = (log) => {
    setSelectedLog(log)
    setShowLogDetailDialog(true)
  }

  // File Manager functions
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

  const getFilenameFromFile = (file) => {
    // Use the actual filename from the uploaded file
    return file.name
  }

  const checkFilenameConflict = async (filename) => {
    try {
      const actionName = 'check-file-exists'
      const actionUrl = allActions[actionName]
      
      if (!actionUrl) {
        console.warn(`Action ${actionName} not found in config, falling back to localStorage check`)
        // Fallback to localStorage check if action not available
        const existingFiles = JSON.parse(localStorage.getItem('uploadedFiles') || '[]')
        const conflict = existingFiles.find(file => file.filename === filename)
        
        return {
          exists: !!conflict,
          lastModified: conflict?.lastModified || null,
          fileSize: conflict?.fileSize || null
        }
      }

      const headers = ims ? {
        'authorization': `Bearer ${ims.token}`,
        'x-gw-ims-org-id': ims.org
      } : {}

      const response = await actionWebInvoke(actionUrl, headers, {
        filename: filename
      })

      const responseBody = response.body || response

      if (responseBody && responseBody.exists) {
        return {
          exists: true,
          lastModified: responseBody.lastModified,
          fileSize: responseBody.size,
          etag: responseBody.etag,
          metadata: responseBody.metadata
        }
      } else {
        return {
          exists: false,
          lastModified: null,
          fileSize: null
        }
      }
    } catch (error) {
      console.error('Error checking file existence:', error)
      // Fallback to localStorage check on error
      const existingFiles = JSON.parse(localStorage.getItem('uploadedFiles') || '[]')
      const conflict = existingFiles.find(file => file.filename === filename)
      
      return {
        exists: !!conflict,
        lastModified: conflict?.lastModified || null,
        fileSize: conflict?.fileSize || null
      }
    }
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
    console.log('Drag over event triggered')
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }

  const handleDragLeave = (e) => {
    console.log('Drag leave event triggered')
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }

  const handleDrop = (e) => {
    console.log('Drop event triggered')
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    console.log('Files dropped:', files)
    if (files.length > 0) {
      console.log('Processing file:', files[0].name)
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
    console.log('handleFileSelection called with file:', file.name)
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
        
        // Create a clean copy of the data to avoid any React references
        const cleanData = JSON.parse(JSON.stringify(jsonData))
        
        setFileData(cleanData)
        setSelectedFile(file) // Store the file object
        setCsvPreview(cleanData.slice(0, 10)) // Show first 10 rows for preview
        setDetectedFileType(detection.templateType || null)
        setDetectionConfidence(detection.confidence || 0)
        setUploadResult(null)
        
        // Check filename for conflicts using the actual filename
        const actualFilename = getFilenameFromFile(file)
        const conflict = await checkFilenameConflict(actualFilename)
        
        if (conflict.exists) {
          setFilenameConflict(conflict)
          setSuggestedFilename(actualFilename)
          setShowConflictDialog(true)
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

  const uploadFile = async (customFilename = null) => {
    if (!fileData || !fileData.length) {
      alert('Please select a file first')
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

      // Include IMS information in the headers for authenticated requests
      const headers = ims ? {
        'authorization': `Bearer ${ims.token}`,
        'x-gw-ims-org-id': ims.org
      } : {}

      // Use custom filename if provided, otherwise use suggestedFilename or original filename
      console.log('Filename debugging:')
      console.log('  customFilename:', customFilename, 'type:', typeof customFilename)
      console.log('  suggestedFilename:', suggestedFilename, 'type:', typeof suggestedFilename)
      console.log('  selectedFile:', selectedFile, 'type:', typeof selectedFile)
      console.log('  selectedFile.name:', selectedFile?.name, 'type:', typeof selectedFile?.name)
      
      // Ensure we only use string values for filename
      const safeCustomFilename = typeof customFilename === 'string' ? customFilename : null
      const safeSuggestedFilename = typeof suggestedFilename === 'string' ? suggestedFilename : null
      const safeSelectedFileName = selectedFile && typeof selectedFile.name === 'string' ? selectedFile.name : null
      
      const filenameToUse = safeCustomFilename || safeSuggestedFilename || safeSelectedFileName || 'default_filename.csv'
      console.log('  final filenameToUse:', filenameToUse, 'type:', typeof filenameToUse)

      // Create a completely clean upload object with only serializable data
      // Force a deep copy to remove any React references
      console.log('Original fileData type:', typeof fileData, 'length:', fileData?.length)
      console.log('fileData sample:', fileData?.slice(0, 2))
      
      const cleanFileData = JSON.parse(JSON.stringify(fileData))
      console.log('Clean fileData type:', typeof cleanFileData, 'length:', cleanFileData?.length)
      
      // Test each parameter individually to find the circular reference
      console.log('Testing fileData serialization...')
      try {
        JSON.stringify(cleanFileData)
        console.log('✓ fileData is serializable')
      } catch (error) {
        console.error('✗ fileData has circular references:', error)
      }
      
      console.log('Testing fileType serialization...')
      try {
        JSON.stringify(detectedFileType)
        console.log('✓ fileType is serializable')
      } catch (error) {
        console.error('✗ fileType has circular references:', error)
      }
      
      console.log('Testing filename serialization...')
      try {
        JSON.stringify(filenameToUse)
        console.log('✓ filename is serializable')
      } catch (error) {
        console.error('✗ filename has circular references:', error)
      }
      
      const uploadParams = {
        fileData: cleanFileData,
        fileType: detectedFileType,
        filename: filenameToUse
      }

      // Only add IMS context if it's available and safe
      if (ims?.org && typeof ims.org === 'string') {
        uploadParams.imsOrg = ims.org
        console.log('Testing imsOrg serialization...')
        try {
          JSON.stringify(ims.org)
          console.log('✓ imsOrg is serializable')
        } catch (error) {
          console.error('✗ imsOrg has circular references:', error)
        }
      }
      if (ims?.token && typeof ims.token === 'string') {
        uploadParams.imsToken = ims.token
        console.log('Testing imsToken serialization...')
        try {
          JSON.stringify(ims.token)
          console.log('✓ imsToken is serializable')
        } catch (error) {
          console.error('✗ imsToken has circular references:', error)
        }
      }

      // Test serialization before sending
      try {
        JSON.stringify(uploadParams)
        console.log('Upload params are serializable')
      } catch (error) {
        console.error('Serialization test failed:', error)
        throw new Error('Upload data contains circular references')
      }

      const response = await actionWebInvoke(actionUrl, headers, uploadParams)

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
          fileSize: fileData.length + ' records'
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
    setSelectedFile(null)
    setCsvPreview(null)
    setUploadResult(null)
    setDetectedFileType(null)
    setDetectionConfidence(null)
    setFilenameConflict(null)
    setSuggestedFilename('')
    setCustomFilename('')
    setShowConflictDialog(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleOverrideFile = () => {
    setShowConflictDialog(false)
    setFilenameConflict(null)
    // Trigger upload immediately after override choice with original filename
    uploadFile(suggestedFilename)
  }

  const handleRenameFile = () => {
    let newFilename
    if (!customFilename.trim()) {
      // If no custom filename provided, generate one
      const timestamp = new Date().toISOString().split('T')[0]
      const time = new Date().toTimeString().split(' ')[0].replace(/:/g, '-')
      const baseName = suggestedFilename.replace('.csv', '')
      newFilename = `${baseName}_${timestamp}_${time}.csv`
      setSuggestedFilename(newFilename)
    } else {
      // Use the user's custom filename
      newFilename = customFilename.trim()
      // Ensure it ends with .csv
      if (!newFilename.toLowerCase().endsWith('.csv')) {
        newFilename += '.csv'
      }
      setSuggestedFilename(newFilename)
    }
    setShowConflictDialog(false)
    setFilenameConflict(null)
    setCustomFilename('') // Clear the custom filename input
    // Trigger upload immediately after rename choice with the new filename
    uploadFile(newFilename)
  }

  const handleCancelUpload = () => {
    setShowConflictDialog(false)
    setFilenameConflict(null)
    setCustomFilename('')
    clearFile()
  }

  const handleTabChange = (newTab) => {
    setActiveTab(newTab)
    // Close log detail dialog when switching tabs
    setShowLogDetailDialog(false)
    setSelectedLog(null)
  }

  const loadLogs = async () => {
    setLoadingLogs(true)
    try {
      const actionUrl = allActions['data-api-logs']
      if (!actionUrl) {
        throw new Error('data-api-logs action not found in config')
      }
      
      const params = {}
      if (startDate) params.startDate = startDate
      if (endDate) params.endDate = endDate
      if (selectedMode) params.mode = selectedMode
      
      const response = await actionWebInvoke(actionUrl, {}, params)
      const responseBody = response.body || response
      
      if (responseBody && responseBody.success !== false) {
        setLogs(responseBody.logs || [])
      } else {
        setLogs([])
      }
    } catch (error) {
      console.error('Error loading logs:', error)
      setLogs([])
    } finally {
      setLoadingLogs(false)
    }
  }

  const testApi = async () => {
    setTesting(true)
    setTestResult(null)

    try {
      // Get the action URL for the data-api
      const actionUrl = allActions['data-api']
      
      if (!actionUrl) {
        throw new Error('data-api action not found in config')
      }
      
      // Validate filename is provided
      if (!filename.trim()) {
        setTestResult({
          success: false,
          error: 'Filename is required. Please upload a file first or enter a filename manually.'
        })
        setTesting(false)
        return
      }

      // Prepare request parameters
      const params = {
        mode: apiMode,
        filename: filename.trim()
      }

      if (apiMode === 'products') {
        params.limit = productLimit
      } else if (apiMode === 'orders') {
        if (!userId.trim()) {
          setTestResult({
            success: false,
            error: 'User ID is required for order confirmations'
          })
          setTesting(false)
          return
        }
        params.userId = userId.trim()
      } else if (apiMode === 'stock') {
        if (!sku.trim()) {
          setTestResult({
            success: false,
            error: 'SKU is required for stock queries'
          })
          setTesting(false)
          return
        }
        if (!storeId.trim()) {
          setTestResult({
            success: false,
            error: 'Store ID is required for stock queries'
          })
          setTesting(false)
          return
        }
        params.sku = sku.trim()
        params.storeId = storeId.trim()
      } else if (apiMode === 'reservation_info') {
        if (!userId.trim()) {
          setTestResult({
            success: false,
            error: 'Confirmation ID is required for reservation info'
          })
          setTesting(false)
          return
        }
        params.confirmationId = userId.trim() // Reuse userId field for confirmation ID
      } else if (apiMode === 'resort_summary') {
        if (!sku.trim()) {
          setTestResult({
            success: false,
            error: 'Hotel ID is required for resort summary'
          })
          setTesting(false)
          return
        }
        params.hotelId = sku.trim() // Reuse sku field for hotel ID
      } else if (apiMode === 'resort_attributes') {
        if (!sku.trim()) {
          setTestResult({
            success: false,
            error: 'Hotel ID is required for resort attributes'
          })
          setTesting(false)
          return
        }
        if (!storeId.trim()) {
          setTestResult({
            success: false,
            error: 'Room ID is required for resort attributes'
          })
          setTesting(false)
          return
        }
        params.hotelId = sku.trim() // Reuse sku field for hotel ID
        params.roomId = storeId.trim() // Reuse storeId field for room ID
      } else if (apiMode === 'rewards_member') {
        if (!userId.trim()) {
          setTestResult({
            success: false,
            error: 'Member ID is required for rewards member'
          })
          setTesting(false)
          return
        }
        params.memberId = userId.trim() // Reuse userId field for member ID
      }

      // Include IMS context in parameters
      if (ims) {
        params.imsOrg = ims.org
        params.imsToken = ims.token
      }

      const response = await actionWebInvoke(actionUrl, {}, params)
      const responseBody = response.body || response

      if (responseBody && responseBody.success !== false) {
        setTestResult({
          success: true,
          data: responseBody
        })
      } else {
        setTestResult({
          success: false,
          error: responseBody?.error || 'API call failed'
        })
      }
    } catch (error) {
      console.error('API test error:', error)
      setTestResult({
        success: false,
        error: error.message || 'API call failed'
      })
    }

    setTesting(false)
  }



  const renderProductData = (products) => {
    if (!products || !Array.isArray(products)) {
      return <Text>No product data available</Text>
    }

    return (
      <TableView aria-label="Product data" maxWidth="100%" maxHeight="400px" width="100%">
        <TableHeader>
          <Column key="prod_id">Product ID</Column>
          <Column key="name">Name</Column>
          <Column key="brand">Brand</Column>
          <Column key="price">Price</Column>
          <Column key="description">Description</Column>
        </TableHeader>
        <TableBody>
          {products.map((product, index) => (
            <Row key={`product-${index}`}>
              <Cell>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' }} title={product.prod_id}>
                  {product.prod_id || ''}
                </div>
              </Cell>
              <Cell>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }} title={product.name}>
                  {product.name || ''}
                </div>
              </Cell>
              <Cell>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' }} title={product.brand}>
                  {product.brand || ''}
                </div>
              </Cell>
              <Cell>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }} title={product.price}>
                  {product.price || ''}
                </div>
              </Cell>
              <Cell>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }} title={product.description}>
                  {product.description || ''}
                </div>
              </Cell>
            </Row>
          ))}
        </TableBody>
      </TableView>
    )
  }

  const renderOrderData = (orders) => {
    if (!orders || !Array.isArray(orders)) {
      return <Text>No order data available</Text>
    }

    return (
      <TableView aria-label="Order data" maxWidth="100%" maxHeight="400px" width="100%">
        <TableHeader>
          <Column key="order_number">Order Number</Column>
          <Column key="customer_name">Customer Name</Column>
          <Column key="order_date">Order Date</Column>
          <Column key="status">Status</Column>
          <Column key="tracking_number">Tracking Number</Column>
        </TableHeader>
        <TableBody>
          {orders.map((order, index) => (
            <Row key={`order-${index}`}>
              <Cell>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' }} title={order.order_number}>
                  {order.order_number || ''}
                </div>
              </Cell>
              <Cell>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }} title={order.customer_name}>
                  {order.customer_name || ''}
                </div>
              </Cell>
              <Cell>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }} title={order.order_date}>
                  {order.order_date || ''}
                </div>
              </Cell>
              <Cell>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }} title={order.status}>
                  {order.status || ''}
                </div>
              </Cell>
              <Cell>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }} title={order.tracking_number}>
                  {order.tracking_number || ''}
                </div>
              </Cell>
            </Row>
          ))}
        </TableBody>
      </TableView>
    )
  }

  const renderStockData = (stockData) => {
    if (!stockData) {
      return <Text>No stock data available</Text>
    }

    // Handle both single object and array formats
    const stockItems = Array.isArray(stockData) ? stockData : [stockData]
    
    if (stockItems.length === 0) {
      return <Text>No stock data available</Text>
    }

    return (
      <TableView aria-label="Stock data" maxWidth="100%" maxHeight="400px" width="100%">
        <TableHeader>
          <Column key="sku">SKU</Column>
          <Column key="product_name">Product Name</Column>
          <Column key="store_name">Store Name</Column>
          <Column key="quantity_in_stock">Quantity</Column>
          <Column key="last_updated">Last Updated</Column>
        </TableHeader>
        <TableBody>
          {stockItems.map((item, index) => (
            <Row key={`stock-${index}`}>
              <Cell>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' }} title={item.sku}>
                  {item.sku || ''}
                </div>
              </Cell>
              <Cell>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '250px' }} title={item.product_name}>
                  {item.product_name || ''}
                </div>
              </Cell>
              <Cell>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }} title={item.store_name}>
                  {item.store_name || ''}
                </div>
              </Cell>
              <Cell>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }} title={item.quantity_in_stock}>
                  {item.quantity_in_stock || ''}
                </div>
              </Cell>
              <Cell>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' }} title={item.last_updated}>
                  {item.last_updated || ''}
                </div>
              </Cell>
            </Row>
          ))}
        </TableBody>
      </TableView>
    )
  }

  // Travel & Hospitality render functions
  const renderReservationData = (reservationData) => {
    if (!reservationData) {
      return <Text>No reservation data available</Text>
    }

    const reservation = Array.isArray(reservationData) ? reservationData[0] : reservationData
    
    if (!reservation) {
      return <Text>No reservation data available</Text>
    }

    return (
      <Well UNSAFE_style={{ backgroundColor: '#f0f8ff', padding: '16px' }}>
        <Flex direction="column" gap="size-200">
          <Heading level={4}>Reservation Details</Heading>
          <Flex direction="column" gap="size-100">
            <Flex gap="size-200">
              <Text><strong>Confirmation ID:</strong></Text>
              <Text>{reservation.confirmation_id || 'N/A'}</Text>
            </Flex>
            <Flex gap="size-200">
              <Text><strong>Hotel:</strong></Text>
              <Text>{reservation.hotel_name || 'N/A'}</Text>
            </Flex>
            <Flex gap="size-200">
              <Text><strong>Arrival:</strong></Text>
              <Text>{reservation.arrival_date || 'N/A'} at {reservation.check_in_time || 'N/A'}</Text>
            </Flex>
            <Flex gap="size-200">
              <Text><strong>Departure:</strong></Text>
              <Text>{reservation.departure_date || 'N/A'} at {reservation.check_out_time || 'N/A'}</Text>
            </Flex>
            <Flex gap="size-200">
              <Text><strong>Room ID:</strong></Text>
              <Text>{reservation.room_id || 'N/A'}</Text>
            </Flex>
            <Flex gap="size-200">
              <Text><strong>Rate Type:</strong></Text>
              <Text>{reservation.rate_type || 'N/A'}</Text>
            </Flex>
            <Flex gap="size-200">
              <Text><strong>Total Cost:</strong></Text>
              <Text>{reservation.total_cost || 'N/A'}</Text>
            </Flex>
          </Flex>
        </Flex>
      </Well>
    )
  }

  const renderResortSummaryData = (resortData) => {
    if (!resortData) {
      return <Text>No resort data available</Text>
    }

    const resort = Array.isArray(resortData) ? resortData[0] : resortData
    
    if (!resort) {
      return <Text>No resort data available</Text>
    }

    return (
      <Well UNSAFE_style={{ backgroundColor: '#f0f8ff', padding: '16px' }}>
        <Flex direction="column" gap="size-200">
          <Heading level={4}>Resort Summary</Heading>
          <Flex direction="column" gap="size-100">
            <Flex gap="size-200">
              <Text><strong>Hotel ID:</strong></Text>
              <Text>{resort.hotel_id || 'N/A'}</Text>
            </Flex>
            <Flex gap="size-200">
              <Text><strong>Hotel Name:</strong></Text>
              <Text>{resort.hotel_name || 'N/A'}</Text>
            </Flex>
            <Flex gap="size-200">
              <Text><strong>Address:</strong></Text>
              <Text>{resort.hotel_address || 'N/A'}</Text>
            </Flex>
            <Flex gap="size-200">
              <Text><strong>Phone:</strong></Text>
              <Text>{resort.hotel_phone || 'N/A'}</Text>
            </Flex>
            <Flex gap="size-200">
              <Text><strong>Reservations:</strong></Text>
              <Text>{resort.reservations_phone || 'N/A'}</Text>
            </Flex>
            <Flex gap="size-200">
              <Text><strong>Amenities:</strong></Text>
              <Text>{resort.amenities || 'N/A'}</Text>
            </Flex>
            <Flex gap="size-200">
              <Text><strong>Star Rating:</strong></Text>
              <Text>{resort.star_rating || 'N/A'}</Text>
            </Flex>
          </Flex>
        </Flex>
      </Well>
    )
  }

  const renderResortAttributesData = (attributesData) => {
    if (!attributesData) {
      return <Text>No room attributes data available</Text>
    }

    const attributes = Array.isArray(attributesData) ? attributesData[0] : attributesData
    
    if (!attributes) {
      return <Text>No room attributes data available</Text>
    }

    return (
      <Well UNSAFE_style={{ backgroundColor: '#f0f8ff', padding: '16px' }}>
        <Flex direction="column" gap="size-200">
          <Heading level={4}>Room Attributes</Heading>
          <Flex direction="column" gap="size-100">
            <Flex gap="size-200">
              <Text><strong>Hotel ID:</strong></Text>
              <Text>{attributes.hotel_id || 'N/A'}</Text>
            </Flex>
            <Flex gap="size-200">
              <Text><strong>Room ID:</strong></Text>
              <Text>{attributes.room_id || 'N/A'}</Text>
            </Flex>
            <Flex gap="size-200">
              <Text><strong>Room Type:</strong></Text>
              <Text>{attributes.room_type || 'N/A'}</Text>
            </Flex>
            <Flex gap="size-200">
              <Text><strong>Description:</strong></Text>
              <Text>{attributes.room_description || 'N/A'}</Text>
            </Flex>
            <Flex gap="size-200">
              <Text><strong>Size:</strong></Text>
              <Text>{attributes.room_size || 'N/A'}</Text>
            </Flex>
            <Flex gap="size-200">
              <Text><strong>Max Occupancy:</strong></Text>
              <Text>{attributes.max_occupancy || 'N/A'}</Text>
            </Flex>
            <Flex gap="size-200">
              <Text><strong>Features:</strong></Text>
              <Text>{attributes.room_features || 'N/A'}</Text>
            </Flex>
            <Flex gap="size-200">
              <Text><strong>Rates:</strong></Text>
              <Text>{attributes.room_rates || 'N/A'}</Text>
            </Flex>
          </Flex>
        </Flex>
      </Well>
    )
  }

  const renderRewardsMemberData = (memberData) => {
    if (!memberData) {
      return <Text>No rewards member data available</Text>
    }

    const member = Array.isArray(memberData) ? memberData[0] : memberData
    
    if (!member) {
      return <Text>No rewards member data available</Text>
    }

    return (
      <Well UNSAFE_style={{ backgroundColor: '#f0f8ff', padding: '16px' }}>
        <Flex direction="column" gap="size-200">
          <Heading level={4}>Rewards Member</Heading>
          <Flex direction="column" gap="size-100">
            <Flex gap="size-200">
              <Text><strong>Member ID:</strong></Text>
              <Text>{member.member_id || 'N/A'}</Text>
            </Flex>
            <Flex gap="size-200">
              <Text><strong>Name:</strong></Text>
              <Text>{member.member_name || 'N/A'}</Text>
            </Flex>
            <Flex gap="size-200">
              <Text><strong>Email:</strong></Text>
              <Text>{member.member_email || 'N/A'}</Text>
            </Flex>
            <Flex gap="size-200">
              <Text><strong>Status:</strong></Text>
              <Text>{member.member_status || 'N/A'} ({member.member_tier || 'N/A'})</Text>
            </Flex>
            <Flex gap="size-200">
              <Text><strong>Points Balance:</strong></Text>
              <Text>{member.points_balance || 'N/A'}</Text>
            </Flex>
            <Flex gap="size-200">
              <Text><strong>Member Since:</strong></Text>
              <Text>{member.member_since || 'N/A'}</Text>
            </Flex>
            <Flex gap="size-200">
              <Text><strong>Total Stays:</strong></Text>
              <Text>{member.total_stays || 'N/A'} ({member.total_nights || 'N/A'} nights)</Text>
            </Flex>
            <Flex gap="size-200">
              <Text><strong>Preferred Hotel:</strong></Text>
              <Text>{member.preferred_hotel_brand || 'N/A'}</Text>
            </Flex>
          </Flex>
        </Flex>
      </Well>
    )
  }

  return (
    <View width="100%">
      <Flex direction="column" gap="size-300">
        <Heading level={1}>Custom Action API Configurator</Heading>
        <Text>
          Common APIs for Custom Action use cases. Simply download a template, give it a name, fill it with data, upload, get data by testing, and get the details from the logs. All you need to configure the custom action is here.
        </Text>

        {/* Show IMS context info */}
        {ims && (
          <View backgroundColor="gray-75" padding="size-200" borderRadius="medium">
            <Text size="S">
              Connected as: {ims.org ? `${ims.org}` : 'Unknown Org'} 
              {ims.token ? ' (Authenticated)' : ' (Not Authenticated)'}
            </Text>
          </View>
        )}

              <Tabs selectedKey={activeTab} onSelectionChange={handleTabChange}>
        <TabList>
          <Item key="documentation">Documentation</Item>
          <Item key="upload">File Upload</Item>
          <Item key="tester">API Tester</Item>
          <Item key="logs">Logs</Item>
        </TabList>
          <TabPanels>
            <Item key="documentation">
              <Flex direction="column" gap="size-300">
                <Divider />

                {/* Overview */}
                <Heading level={2}>📚 API Documentation</Heading>
                <Text>This unified data management system provides APIs for retrieving data from uploaded CSV files.</Text>

                <Divider />

                {/* Getting Started */}
                <Heading level={2}>🚀 Getting Started</Heading>
                
                <Well>
                  <Flex direction="column" gap="size-200">
                    <Text><strong>Quick Workflow:</strong></Text>
                    <Text>1. <strong>Download Template:</strong> Go to File Upload tab → Download template for your use case</Text>
                    <Text>2. <strong>Prepare Data:</strong> Fill the template with your data and save as CSV</Text>
                    <Text>3. <strong>Upload File:</strong> Drag & drop your CSV → System auto-detects template type</Text>
                    <Text>4. <strong>Test API:</strong> Go to API Tester tab → Test your uploaded data</Text>
                    <Text>5. <strong>Monitor:</strong> Check Logs tab for usage and performance</Text>
                    
                    <Text><strong>💡 Pro Tip:</strong></Text>
                    <Text>Use the API Tester tab to see real request/response examples. Trigger test calls to understand the exact data formats.</Text>
                  </Flex>
                </Well>

                <Divider />

                {/* Data Retrieval API */}
                <Heading level={2}>📥 Data Retrieval API</Heading>
                
                <Well>
                  <Flex direction="column" gap="size-200">
                    <Text><strong>Endpoint:</strong></Text>
                    <CodeBlock>POST https://440115-508coralsquirrel.adobeioruntime.net/api/v1/web/dx-excshell-1/data-api</CodeBlock>
                    
                    <Text><strong>Purpose:</strong></Text>
                    <Text>Retrieve specific data from uploaded CSV files using different modes and parameters.</Text>
                    
                    <Text><strong>Request Headers:</strong></Text>
                    <CodeBlock>Content-Type: application/json</CodeBlock>
                    
                    <Text><strong>Available Modes:</strong></Text>
                    <Text>• <strong>Retail:</strong> products, orders, stock</Text>
                    <Text>• <strong>Travel & Hospitality:</strong> reservation_info, resort_summary, resort_attributes, rewards_member</Text>

                    <Text><strong>Request Examples by Mode:</strong></Text>
                    
                    <Text><strong>🛍️ Retail - Products:</strong></Text>
                    <CodeBlock>{`{
  "mode": "products",
  "filename": "demos/product_catalog_session123_2024-01-15.csv",
  "limit": 5
}`}</CodeBlock>

                    <Text><strong>📦 Retail - Orders:</strong></Text>
                    <CodeBlock>{`{
  "mode": "orders",
  "filename": "demos/order_data_session123_2024-01-15.csv",
  "userId": "CUST-001"
}`}</CodeBlock>

                    <Text><strong>📊 Retail - Stock:</strong></Text>
                    <CodeBlock>{`{
  "mode": "stock",
  "filename": "demos/inventory_stock_session123_2024-01-15.csv",
  "sku": "SKU-001",
  "storeId": "STORE-001"
}`}</CodeBlock>

                    <Text><strong>🏨 Travel - Reservation Info:</strong></Text>
                    <CodeBlock>{`{
  "mode": "reservation_info",
  "filename": "demos/reservation_info_session123_2024-01-15.csv",
  "confirmationId": "354098092"
}`}</CodeBlock>
                    
                    <Text><strong>🏨 Travel - Resort Summary:</strong></Text>
                    <CodeBlock>{`{
  "mode": "resort_summary",
  "filename": "demos/resort_summary_session123_2024-01-15.csv",
  "hotelId": "BW-OHARE-SOUTH"
}`}</CodeBlock>
                    
                    <Text><strong>🏨 Travel - Resort Attributes:</strong></Text>
                    <CodeBlock>{`{
  "mode": "resort_attributes",
  "filename": "demos/resort_attributes_session123_2024-01-15.csv",
  "hotelId": "BW-OHARE-SOUTH",
  "roomId": "ROOM-001"
}`}</CodeBlock>

                    <Text><strong>🏨 Travel - Rewards Member:</strong></Text>
                    <CodeBlock>{`{
  "mode": "rewards_member",
  "filename": "demos/rewards_member_session123_2024-01-15.csv",
  "memberId": "6006637464812299"
}`}</CodeBlock>

                    <Text><strong>Response Structure:</strong></Text>
                    <CodeBlock>{`{
  "success": true,
  "data": {
    // Response data varies by mode
  }
}`}</CodeBlock>
                  </Flex>
                </Well>

                <Divider />

                {/* Template Reference */}
                <Heading level={2}>📋 Template Reference</Heading>
                
                <Well>
                  <Flex direction="column" gap="size-300">
                    {/* Retail Vertical */}
                    <View>
                      <Heading level={4}>🛍️ Retail</Heading>
                  <Flex direction="column" gap="size-200">
                    <Text><strong>Order Data (order_data.csv):</strong></Text>
                    <CodeBlock>customer_id, customer_name, order_date, order_number, shipping_address, status, tracking_number</CodeBlock>
                    
                        <Text><strong>Inventory Stock (inventory_stock.csv):</strong></Text>
                        <CodeBlock>sku, product_name, store_id, store_name, store_address, quantity_in_stock, reorder_level, last_updated</CodeBlock>
                      </Flex>
                    </View>
                    
                    <Divider />
                    
                    {/* Recommendations Vertical */}
                    <View>
                      <Heading level={4}>🎯 Recommendations</Heading>
                      <Flex direction="column" gap="size-200">
                    <Text><strong>Product Catalog (product_catalog.csv):</strong></Text>
                    <CodeBlock>prod_id, name, brand, price, description, image, link</CodeBlock>
                      </Flex>
                    </View>
                    
                    <Divider />
                    
                    {/* Travel & Hospitality Vertical */}
                    <View>
                      <Heading level={4}>🏨 Travel & Hospitality</Heading>
                      <Flex direction="column" gap="size-200">
                        <Text><strong>Reservation Info (reservation_info.csv):</strong></Text>
                        <CodeBlock>confirmation_id, arrival_date, departure_date, check_in_time, check_out_time, hotel_id, hotel_name, hotel_address, room_id, rate_type, total_charged_today, total_charged_arrival, room_subtotal, taxes_fees, total_cost</CodeBlock>
                        
                        <Text><strong>Resort Summary (resort_summary.csv):</strong></Text>
                        <CodeBlock>hotel_id, hotel_name, hotel_address, hotel_phone, reservations_phone, hotel_logo, hotel_website, hotel_description, amenities, star_rating, property_type</CodeBlock>
                        
                        <Text><strong>Resort Attributes (resort_attributes.csv):</strong></Text>
                        <CodeBlock>hotel_id, room_id, room_type, room_description, room_features, room_amenities, room_size, max_occupancy, bed_configuration, room_category, room_images, room_rates, cancellation_policy</CodeBlock>
                        
                        <Text><strong>Rewards Member (rewards_member.csv):</strong></Text>
                        <CodeBlock>member_id, member_name, member_email, member_phone, member_status, member_tier, points_balance, member_since, total_stays, total_nights, preferred_hotel_brand, preferred_room_type, marketing_opt_in, last_activity, member_address</CodeBlock>
                      </Flex>
                    </View>
                  </Flex>
                </Well>

                <Divider />

                {/* Best Practices */}
                <Heading level={2}>💡 Best Practices</Heading>
                
                <Well>
                  <Flex direction="column" gap="size-200">
                    <Text><strong>📥 API Testing Best Practices:</strong></Text>
                    <Text>• Use the API Tester tab to validate your data</Text>
                    <Text>• Test with different parameters to understand behavior</Text>
                    <Text>• Check the Logs tab to monitor API performance</Text>
                    <Text>• Use the exact filename returned from upload in your API calls</Text>
                    
                    <Text><strong>🔍 Template Best Practices:</strong></Text>
                    <Text>• Download templates from the File Upload tab</Text>
                    <Text>• Follow the exact column structure shown in templates</Text>
                    <Text>• Use consistent data formats (dates, numbers, etc.)</Text>
                    <Text>• Include all required fields for your use case</Text>
                    
                    <Text><strong>📊 Data Management Best Practices:</strong></Text>
                    <Text>• Use meaningful session IDs for better organization</Text>
                    <Text>• Check the preview before uploading to ensure data quality</Text>
                    <Text>• Monitor API usage through the Logs tab</Text>
                    <Text>• Test your data thoroughly before production use</Text>
                  </Flex>
                </Well>
              </Flex>
            </Item>

            <Item key="upload">
              <Flex direction="column" gap="size-300">
                <Heading level={2}>File Upload</Heading>
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

                {/* Template Downloads */}
                <View>
                  <Heading level={3} marginBottom="size-200">Download Templates</Heading>
                  <Text marginBottom="size-200">Download CSV templates organized by vertical to get started with your data upload.</Text>
                  
                  {/* Template Download Section - Organized by Verticals */}
                  <View>
                    <Heading level={4} marginBottom="size-200">Templates by Vertical</Heading>
                    
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
                </View>

                <Divider />

                {/* File Upload Area */}
                <View>
                  <Heading level={3} marginBottom="size-200">Upload File</Heading>
                  <div
                    style={{
                      border: dragOver ? '2px dashed #1473e6' : '2px dashed #ccc',
                      backgroundColor: dragOver ? '#f0f8ff' : '#fafafa',
                      padding: '40px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      borderRadius: '8px',
                      minHeight: '200px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onDragEnter={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    onClick={() => fileInputRef.current?.click()}
                  >
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
                  </div>
                  
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
                              {(() => {
                                const template = fileTypes.find(ft => ft.key === detectedFileType)
                                if (template) {
                                  // Remove the filename part from the label (everything in parentheses)
                                  return template.label.replace(/\s*\([^)]*\)/, '')
                                }
                                return detectedFileType
                              })()}
                            </Text>
                          </Flex>
                          <Text size="S" UNSAFE_style={{ color: '#666' }}>
                            Confidence: {detectionConfidence ? detectionConfidence.toFixed(1) : '0'}% • 
                            {Object.entries(verticals).find(([key, vertical]) => 
                              vertical.fileTypes.some(ft => ft.key === detectedFileType)
                            )?.[1]?.name || 'Unknown'} Vertical
                          </Text>
                          {selectedFile && (
                            <Text size="S" UNSAFE_style={{ color: '#666' }}>
                              📁 File: {selectedFile.name}
                            </Text>
                          )}
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
                          {selectedFile && (
                            <Text size="S" UNSAFE_style={{ color: '#666' }}>
                              📁 File: {selectedFile.name}
                            </Text>
                          )}
                        </Flex>
                      </Well>
                    )}
                    
                    <Text marginBottom="size-200">
                      Showing first {csvPreview?.length || 0} rows of {fileData?.length || 0} total records
                      <Text size="S" UNSAFE_style={{ color: '#666', marginLeft: '8px' }}>
                        💡 Hover over cells to see full content in tooltip
                      </Text>
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
                            {Object.keys(csvPreview?.[0] || {}).map((header, colIndex) => {
                              const cellValue = String(row[header] || '')
                              return (
                                <Cell key={`cell-${index}-${colIndex}`}>
                                  <div 
                                    style={{ 
                                      overflow: 'hidden', 
                                      textOverflow: 'ellipsis', 
                                      whiteSpace: 'nowrap',
                                      maxWidth: '200px'
                                    }}
                                    title={cellValue}
                                  >
                                    {cellValue}
                                  </div>
                                </Cell>
                              )
                            })}
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
                        {selectedFile && (
                          <Text size="S" UNSAFE_style={{ color: '#666' }}>
                            📁 Your file: {selectedFile.name}
                          </Text>
                        )}
                        
                        {filenameConflict && (
                          <Well UNSAFE_style={{ backgroundColor: '#f8f9fa' }}>
                            <Text size="S">
                              <strong>Existing file details:</strong><br/>
                              Last modified: {filenameConflict.lastModified ? new Date(filenameConflict.lastModified).toLocaleString() : 'Unknown'}<br/>
                              File size: {filenameConflict.fileSize ? `${filenameConflict.fileSize} bytes` : 'Unknown'}<br/>
                              {filenameConflict.metadata && (
                                <>
                                  File type: {filenameConflict.metadata.fileType || 'Unknown'}<br/>
                                  Uploaded: {filenameConflict.metadata.uploadedAt ? new Date(filenameConflict.metadata.uploadedAt).toLocaleString() : 'Unknown'}
                                </>
                              )}
                            </Text>
                          </Well>
                        )}
                        
                        <Text>
                          What would you like to do?
                        </Text>
                        
                        <Text size="S" UNSAFE_style={{ color: '#666' }}>
                          💡 <strong>Tip:</strong> You can enter just the filename (e.g., "my_data") and the .csv extension will be added automatically.
                        </Text>
                        
                        <Flex direction="column" gap="size-200">
                          <TextField
                            label="New Filename (optional)"
                            placeholder="e.g. my_data (extension added automatically)"
                            value={customFilename}
                            onChange={setCustomFilename}
                            width="size-3600"
                            description=""
                          />
                          {customFilename.trim() && (
                            <Well UNSAFE_style={{ backgroundColor: '#f0f8ff' }}>
                              <Text size="S">
                                <strong>Final filename will be:</strong> {
                                  customFilename.trim().toLowerCase().endsWith('.csv') 
                                    ? customFilename.trim() 
                                    : `${customFilename.trim()}.csv`
                                }
                              </Text>
                            </Well>
                          )}
                        </Flex>
                        
                        <Flex gap="size-200" justifyContent="end">
                          <Button variant="secondary" onPress={handleCancelUpload}>
                            Cancel Upload
                          </Button>
                          <Button variant="secondary" onPress={handleRenameFile}>
                            Rename and Upload File
                          </Button>
                          <Button variant="primary" onPress={handleOverrideFile}>
                            Override Existing File
                          </Button>
                        </Flex>
                      </Flex>
                    </Content>
                  </Dialog>
                )}
              </Flex>
            </Item>

            <Item key="tester">
              <Flex direction="column" gap="size-300">
                <Heading level={2}>API Tester</Heading>
                <Text>Test the data retrieval API with different modes and parameters.</Text>

                <Well>
                  <Flex direction="column" gap="size-200">
                    <Picker
                      label="API Mode"
                      selectedKey={apiMode}
                      onSelectionChange={setApiMode}
                      width="size-3600"
                    >
                      {apiModes.map(mode => (
                        <Item key={mode.key}>{mode.label}</Item>
                      ))}
                    </Picker>

                    <TextField
                      label="Filename"
                      placeholder="e.g. demos/order_data.csv"
                      value={filename}
                      onChange={setFilename}
                      width="size-3600"
                      description="Enter the filename of the uploaded CSV file"
                    />

                    {apiMode === 'products' && (
                      <NumberField
                        label="Product Limit"
                        value={productLimit}
                        onChange={setProductLimit}
                        minValue={1}
                        maxValue={100}
                        width="size-2000"
                        description="Number of products to return (1-100)"
                      />
                    )}

                    {apiMode === 'orders' && (
                      <TextField
                        label="User ID"
                        placeholder="e.g. user123"
                        value={userId}
                        onChange={setUserId}
                        width="size-3600"
                        description="User ID to filter orders"
                      />
                    )}

                    {apiMode === 'stock' && (
                      <Flex gap="size-200">
                        <TextField
                          label="SKU"
                          placeholder="e.g. SKU-001"
                          value={sku}
                          onChange={setSku}
                          flex="1"
                          description="Product SKU to check"
                        />
                        <TextField
                          label="Store ID"
                          placeholder="e.g. STORE-001"
                          value={storeId}
                          onChange={setStoreId}
                          flex="1"
                          description="Store ID to check"
                        />
                      </Flex>
                    )}

                    {apiMode === 'reservation_info' && (
                      <TextField
                        label="Confirmation ID"
                        placeholder="e.g. 354098092"
                        value={userId}
                        onChange={setUserId}
                        width="size-3600"
                        description="Reservation confirmation ID to retrieve"
                      />
                    )}

                    {apiMode === 'resort_summary' && (
                      <TextField
                        label="Hotel ID"
                        placeholder="e.g. BW-OHARE-SOUTH"
                        value={sku}
                        onChange={setSku}
                        width="size-3600"
                        description="Hotel ID to get resort summary"
                      />
                    )}

                    {apiMode === 'resort_attributes' && (
                      <Flex gap="size-200">
                        <TextField
                          label="Hotel ID"
                          placeholder="e.g. BW-OHARE-SOUTH"
                          value={sku}
                          onChange={setSku}
                          flex="1"
                          description="Hotel ID for room attributes"
                        />
                        <TextField
                          label="Room ID"
                          placeholder="e.g. ROOM-001"
                          value={storeId}
                          onChange={setStoreId}
                          flex="1"
                          description="Room ID for specific room details"
                        />
                      </Flex>
                    )}

                    {apiMode === 'rewards_member' && (
                      <TextField
                        label="Member ID"
                        placeholder="e.g. 6006637464812299"
                        value={userId}
                        onChange={setUserId}
                        width="size-3600"
                        description="Rewards member ID to retrieve"
                      />
                    )}

                    <Button 
                      variant="primary" 
                      onPress={testApi}
                      isDisabled={testing}
                      width="size-2000"
                    >
                      {testing ? (
                        <ProgressBar label="Testing..." isIndeterminate />
                      ) : (
                        <>
                          <Play />
                          <Text>Test API</Text>
                        </>
                      )}
                    </Button>
                  </Flex>
                </Well>

                {/* Test Results */}
                {testResult && (
                  <View>
                    <Heading level={3}>Test Results</Heading>
                    <Well>
                      <Flex direction="column" gap="size-200">
                        <Flex alignItems="center" gap="size-200">
                          {testResult.success ? (
                            <>
                              <StatusLight variant="positive">Success</StatusLight>
                              <CheckmarkCircle color="positive" />
                              <Text>API call successful</Text>
                            </>
                          ) : (
                            <>
                              <StatusLight variant="negative">Error</StatusLight>
                              <Alert color="negative" />
                              <Text>{testResult.error}</Text>
                            </>
                          )}
                        </Flex>

                        {testResult.success && testResult.data && (
                          <View>
                            <Text><strong>Response Data:</strong></Text>
                            {apiMode === 'products' && renderProductData(testResult.data.data)}
                            {apiMode === 'orders' && renderOrderData(testResult.data.data)}
                            {apiMode === 'stock' && renderStockData(testResult.data.data)}
                            {apiMode === 'reservation_info' && renderReservationData(testResult.data.data)}
                            {apiMode === 'resort_summary' && renderResortSummaryData(testResult.data.data)}
                            {apiMode === 'resort_attributes' && renderResortAttributesData(testResult.data.data)}
                            {apiMode === 'rewards_member' && renderRewardsMemberData(testResult.data.data)}
                          </View>
                        )}
                      </Flex>
                    </Well>
                  </View>
                )}
              </Flex>
            </Item>

            <Item key="logs">
              <Flex direction="column" gap="size-300">
                <Heading level={2}>API Logs</Heading>
                <Text>View all data-api requests and responses. Logs are global and accessible to all users with File Manager access.</Text>

                {/* Filters */}
                <Well>
                  <Flex direction="column" gap="size-200">
                    <Heading level={3}>Filters</Heading>
                    <Flex gap="size-200" alignItems="end">
                      <TextField
                        label="Start Date"
                        type="date"
                        value={startDate}
                        onChange={setStartDate}
                        width="size-2000"
                      />
                      <TextField
                        label="End Date"
                        type="date"
                        value={endDate}
                        onChange={setEndDate}
                        width="size-2000"
                      />
                      <Picker
                        label="Mode"
                        selectedKey={selectedMode}
                        onSelectionChange={setSelectedMode}
                        width="size-2000"
                      >
                        <Item key="">All Modes</Item>
                        {apiModes.map(mode => (
                          <Item key={mode.key}>{mode.label}</Item>
                        ))}
                      </Picker>
                      <Button 
                        variant="primary" 
                        onPress={loadLogs}
                        isDisabled={loadingLogs}
                      >
                        {loadingLogs ? (
                          <ProgressBar label="Loading..." isIndeterminate />
                        ) : (
                          <>
                            <Refresh />
                            <Text>Load Logs</Text>
                          </>
                        )}
                      </Button>
                    </Flex>
                  </Flex>
                </Well>

                {/* Logs Table */}
                {logs.length > 0 && (
                  <View>
                    <Heading level={3}>Request Logs ({logs.length} entries)</Heading>
                    <Text>Click "View Details" to see complete request and response information.</Text>
                    <Text UNSAFE_style={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
                      💡 Tip: Each row has a "View Details" button to see full information
                    </Text>
                    <TableView 
                      aria-label="API logs" 
                      maxWidth="100%" 
                      maxHeight="600px" 
                      width="100%"
                    >
                      <TableHeader>
                        <Column key="timestamp">Timestamp</Column>
                        <Column key="user">User</Column>
                        <Column key="mode">Mode</Column>
                        <Column key="filename">Filename</Column>
                        <Column key="success">Success</Column>
                        <Column key="responseTime">Response Time</Column>
                        <Column key="dataCount">Data Count</Column>
                        <Column key="actions">Actions</Column>
                      </TableHeader>
                      <TableBody>
                        {logs.map((log, index) => (
                          <Row key={`log-${index}`}>
                            <Cell>{new Date(log.timestamp).toLocaleString()}</Cell>
                            <Cell>{log.user || 'anonymous'}</Cell>
                            <Cell>{log.request.mode || 'N/A'}</Cell>
                            <Cell>{log.request.filename || 'N/A'}</Cell>
                            <Cell>
                              <StatusLight variant={log.response.success ? 'positive' : 'negative'}>
                                {log.response.success ? 'Success' : 'Error'}
                              </StatusLight>
                            </Cell>
                            <Cell>{log.responseTime}ms</Cell>
                            <Cell>
                              {log.response.success && log.response.data ? 
                                (Array.isArray(log.response.data) ? log.response.data.length : 
                                 (['stock', 'reservation_info', 'resort_summary', 'resort_attributes', 'rewards_member'].includes(log.request.mode) ? '1 item' : 'N/A')) : 
                                'N/A'
                              }
                            </Cell>
                            <Cell>
                              <Button 
                                variant="secondary" 
                                size="S"
                                onPress={() => handleLogClick(log)}
                              >
                                View Details
                              </Button>
                            </Cell>
                          </Row>
                        ))}
                      </TableBody>
                    </TableView>
                  </View>
                )}

                {logs.length === 0 && !loadingLogs && (
                  <Well>
                    <Flex direction="column" gap="size-200" alignItems="center">
                      <Text>No logs found. Click "Load Logs" to fetch recent API requests.</Text>
                    </Flex>
                  </Well>
                )}
              </Flex>
            </Item>
          </TabPanels>
        </Tabs>

        {/* Log Detail Dialog */}
        {selectedLog && showLogDetailDialog && (
          <Dialog isOpen={showLogDetailDialog} onOpenChange={setShowLogDetailDialog}>
            <Content>
              <Header>
                <Heading level={2}>Log Details</Heading>
              </Header>
              <Flex direction="column" gap="size-300">
                <Well>
                  <Flex direction="column" gap="size-200">
                    <Heading level={3}>Request Information</Heading>
                    <Flex gap="size-200">
                      <View flex="1">
                        <Text><strong>Timestamp:</strong></Text>
                        <Text>{new Date(selectedLog.timestamp).toLocaleString()}</Text>
                      </View>
                      <View flex="1">
                        <Text><strong>User:</strong></Text>
                        <Text>{selectedLog.user || 'anonymous'}</Text>
                      </View>
                      <View flex="1">
                        <Text><strong>Response Time:</strong></Text>
                        <Text>{selectedLog.responseTime}ms</Text>
                      </View>
                    </Flex>
                    <Flex gap="size-200">
                      <View flex="1">
                        <Text><strong>API Mode:</strong></Text>
                        <Text>{selectedLog.request.mode || 'N/A'}</Text>
                      </View>
                      <View flex="1">
                        <Text><strong>Data File:</strong></Text>
                        <Text>{selectedLog.request.filename || 'N/A'}</Text>
                      </View>
                    </Flex>
                    <Flex alignItems="center" gap="size-200">
                    <Text><strong>API Parameters:</strong></Text>
                      <Button 
                        variant="secondary" 
                        size="S"
                        onPress={() => {
                          const params = {
                            mode: selectedLog.request.mode,
                            filename: selectedLog.request.filename,
                            ...(selectedLog.request.limit && { limit: selectedLog.request.limit }),
                            ...(selectedLog.request.userId && { userId: selectedLog.request.userId }),
                            ...(selectedLog.request.sku && { sku: selectedLog.request.sku }),
                            ...(selectedLog.request.storeId && { storeId: selectedLog.request.storeId }),
                            ...(selectedLog.request.confirmationId && { confirmationId: selectedLog.request.confirmationId }),
                            ...(selectedLog.request.hotelId && { hotelId: selectedLog.request.hotelId }),
                            ...(selectedLog.request.roomId && { roomId: selectedLog.request.roomId }),
                            ...(selectedLog.request.memberId && { memberId: selectedLog.request.memberId })
                          }
                          navigator.clipboard.writeText(JSON.stringify(params, null, 2))
                          alert('API parameters copied to clipboard!')
                        }}
                      >
                        Copy Parameters
                      </Button>
                    </Flex>
                    <CodeBlock>{JSON.stringify({
                      mode: selectedLog.request.mode,
                      filename: selectedLog.request.filename,
                      ...(selectedLog.request.limit && { limit: selectedLog.request.limit }),
                      ...(selectedLog.request.userId && { userId: selectedLog.request.userId }),
                      ...(selectedLog.request.sku && { sku: selectedLog.request.sku }),
                      ...(selectedLog.request.storeId && { storeId: selectedLog.request.storeId }),
                      ...(selectedLog.request.confirmationId && { confirmationId: selectedLog.request.confirmationId }),
                      ...(selectedLog.request.hotelId && { hotelId: selectedLog.request.hotelId }),
                      ...(selectedLog.request.roomId && { roomId: selectedLog.request.roomId }),
                      ...(selectedLog.request.memberId && { memberId: selectedLog.request.memberId })
                    }, null, 2)}</CodeBlock>
                  </Flex>
                </Well>

                <Well>
                  <Flex direction="column" gap="size-200">
                    <Heading level={3}>API Response</Heading>
                    <Flex alignItems="center" gap="size-200">
                      <StatusLight variant={selectedLog.response.success ? 'positive' : 'negative'}>
                        {selectedLog.response.success ? 'Success' : 'Error'}
                      </StatusLight>
                      <Text>
                        {selectedLog.response.success ? 'API request completed successfully' : 'API request failed'}
                      </Text>
                    </Flex>
                    {selectedLog.response.success ? (
                      <>
                        <Text><strong>Data Count:</strong></Text>
                        <Text>
                          {selectedLog.response.data && Array.isArray(selectedLog.response.data) 
                            ? `${selectedLog.response.data.length} items returned`
                            : (['stock', 'reservation_info', 'resort_summary', 'resort_attributes', 'rewards_member'].includes(selectedLog.request.mode) 
                                ? `1 item returned (${selectedLog.request.mode} mode)` 
                                : 'Single item returned')
                          }
                        </Text>
                        <Flex alignItems="center" gap="size-200">
                        <Text><strong>Response Data:</strong></Text>
                          <Button 
                            variant="secondary" 
                            size="S"
                            onPress={() => {
                              navigator.clipboard.writeText(JSON.stringify(selectedLog.response, null, 2))
                              alert('Response data copied to clipboard!')
                            }}
                          >
                            Copy Response
                          </Button>
                        </Flex>
                        <CodeBlock>{JSON.stringify(selectedLog.response, null, 2)}</CodeBlock>
                      </>
                    ) : (
                      <>
                        <Flex alignItems="center" gap="size-200">
                        <Text><strong>Error Message:</strong></Text>
                          <Button 
                            variant="secondary" 
                            size="S"
                            onPress={() => {
                              navigator.clipboard.writeText(selectedLog.response.error || 'Unknown error')
                              alert('Error message copied to clipboard!')
                            }}
                          >
                            Copy Error
                          </Button>
                        </Flex>
                        <CodeBlock>{selectedLog.response.error || 'Unknown error'}</CodeBlock>
                      </>
                    )}
                  </Flex>
                </Well>
              </Flex>
              <Footer>
                <Flex gap="size-200" justifyContent="end">
                  <Button variant="secondary" onPress={() => setShowLogDetailDialog(false)}>
                    Close
                  </Button>
                </Flex>
              </Footer>
            </Content>
          </Dialog>
        )}
      </Flex>
    </View>
  )
}

export default UnifiedDataManager 