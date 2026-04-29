import React, { useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  TextField,
  Button,
  Flex,
  Well,
  StatusLight,
  Tooltip,
  TooltipTrigger,
  ActionButton
} from '@adobe/react-spectrum'
import Edit from '@spectrum-icons/workflow/Edit'
import CheckmarkCircle from '@spectrum-icons/workflow/CheckmarkCircle'
import Alert from '@spectrum-icons/workflow/Alert'
import Delete from '@spectrum-icons/workflow/Delete'

// XDM validation rules and examples
const XDM_VALIDATION_RULES = {
  date: {
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    example: '2024-05-20',
    hint: 'Use yyyy-MM-dd format only (no timestamps)',
    fix: (value) => {
      if (typeof value === 'string' && value.includes('T')) {
        return value.split('T')[0]
      }
      return value
    }
  },
  nationality: {
    pattern: /^[A-Z]{2}$/,
    example: 'US',
    hint: 'Use 2-letter country codes (US, CA, GB, etc.)',
    fix: (value) => {
      const countryMap = {
        'american': 'US', 'american': 'US', 'united states': 'US',
        'canadian': 'CA', 'canada': 'CA',
        'british': 'GB', 'england': 'GB', 'uk': 'GB',
        'german': 'DE', 'germany': 'DE',
        'french': 'FR', 'france': 'FR',
        'spanish': 'ES', 'spain': 'ES',
        'italian': 'IT', 'italy': 'IT',
        'japanese': 'JP', 'japan': 'JP',
        'chinese': 'CN', 'china': 'CN'
      }
      return countryMap[value?.toLowerCase()] || 'US'
    }
  },
  gender: {
    enum: ['male', 'female', 'not_specified'],
    example: 'male',
    hint: 'Use only: male, female, or not_specified',
    fix: (value) => {
      const genderMap = {
        'non_binary': 'not_specified',
        'other': 'not_specified',
        'unknown': 'not_specified',
        'm': 'male',
        'f': 'female'
      }
      return genderMap[value?.toLowerCase()] || 'not_specified'
    }
  },
  status: {
    enum: ['active', 'inactive'],
    example: 'active',
    hint: 'Use only: active or inactive',
    fix: (value) => {
      const statusMap = {
        'suspended': 'inactive',
        'disabled': 'inactive',
        'enabled': 'active',
        'pending': 'active'
      }
      return statusMap[value?.toLowerCase()] || 'active'
    }
  },
  number: {
    type: 'number',
    example: 1234.56,
    hint: 'Must be a number, not a string',
    fix: (value) => {
      if (typeof value === 'string' && !isNaN(value)) {
        return parseFloat(value)
      }
      return value
    }
  },
  boolean: {
    type: 'boolean',
    example: true,
    hint: 'Must be true or false, not a string',
    fix: (value) => {
      if (typeof value === 'string') {
        return value.toLowerCase() === 'true'
      }
      return Boolean(value)
    }
  }
}

// Detect field type and validation rule - More precise matching
const getValidationRule = (key, value, path) => {
  const keyLower = key.toLowerCase()
  const pathLower = path.toLowerCase()
  
  // Date validation - only for specific date fields with timestamp format
  if ((keyLower === 'birthdate' || keyLower === 'date' || keyLower.endsWith('date')) && 
      typeof value === 'string' && (value.includes('T') && value.includes('Z'))) {
    return XDM_VALIDATION_RULES.date
  }
  
  // Nationality validation - only for specific nationality fields with country names
  if (keyLower === 'nationality' && typeof value === 'string' &&
      ['american', 'canadian', 'british', 'german', 'french', 'spanish', 'italian', 'japanese', 'chinese'].includes(value.toLowerCase())) {
    return XDM_VALIDATION_RULES.nationality
  }
  
  // Gender validation - only for specific gender fields with invalid values
  if (keyLower === 'gender' && typeof value === 'string' &&
      ['non_binary', 'other', 'unknown', 'm', 'f'].includes(value.toLowerCase())) {
    return XDM_VALIDATION_RULES.gender
  }
  
  // Status validation - only for specific status fields with invalid values
  if (keyLower === 'status' && typeof value === 'string' &&
      ['suspended', 'disabled', 'enabled', 'pending'].includes(value.toLowerCase())) {
    return XDM_VALIDATION_RULES.status
  }
  
  // PreferredLanguage should be string, but needs to be a proper language code
  if (keyLower === 'preferredlanguage') {
    // If it's a number or numeric string, convert to proper language code
    if (typeof value === 'number' || (typeof value === 'string' && !isNaN(value))) {
      return {
        type: 'string',
        example: 'en-US',
        hint: 'Must be a language code like "en-US", not a number',
        fix: (value) => 'en-US' // Default to English US
      }
    }
    // If it's an empty string or doesn't match language pattern
    if (typeof value === 'string' && (value === '' || value.length < 2)) {
      return {
        type: 'string',
        example: 'en-US',
        hint: 'Must be a valid language code like "en-US"',
        fix: (value) => 'en-US' // Default to English US
      }
    }
  }
  
  // StudentType enum validation
  if (keyLower === 'studenttype' && typeof value === 'string') {
    // Check if it's an invalid enum value
    const validStudentTypes = ['current', 'former', 'potential', 'alumni']
    if (!validStudentTypes.includes(value.toLowerCase())) {
      return {
        enum: validStudentTypes,
        example: 'potential',
        hint: 'Must be one of: current, former, potential, alumni',
        fix: (value) => {
          // Map common invalid values to valid ones
          const mapping = {
            'prospective': 'potential',
            'prospect': 'potential',
            'graduate': 'alumni',
            'graduated': 'alumni',
            'active': 'current',
            'enrolled': 'current'
          }
          return mapping[value.toLowerCase()] || 'potential'
        }
      }
    }
  }
  
  // CustomerSatisfaction should be number, not boolean - check nested path
  if (keyLower === 'customersatisfaction' || pathLower.includes('customersatisfaction')) {
    if (typeof value === 'boolean') {
      return {
        type: 'number',
        example: 4.5,
        hint: 'Must be a number (satisfaction score), not boolean',
        fix: (value) => value ? 5.0 : 1.0
      }
    }
    // Also handle string numbers
    if (typeof value === 'string' && !isNaN(value)) {
      return XDM_VALIDATION_RULES.number
    }
  }
  
  // LifetimeValue should be number, not string - check nested path
  if (keyLower === 'lifetimevalue' || pathLower.includes('lifetimevalue')) {
    if (typeof value === 'string' && !isNaN(value)) {
      return XDM_VALIDATION_RULES.number
    }
  }
  
  // Number validation - only for specific numeric fields that are strings
  if (typeof value === 'string' && !isNaN(value) && value.trim() !== '' && 
      (keyLower === 'lifetimevalue' || keyLower === 'customersatisfaction' || 
       keyLower === 'score' || keyLower === 'amount' || keyLower === 'value')) {
    return XDM_VALIDATION_RULES.number
  }
  
  // Boolean validation - only for obvious boolean strings
  if (typeof value === 'string' && (value === 'true' || value === 'false') && 
      (keyLower.includes('is') || keyLower.includes('has') || keyLower.includes('enabled'))) {
    return XDM_VALIDATION_RULES.boolean
  }
  
  return null
}

// Validate a value against XDM rules
const validateValue = (key, value, path) => {
  const rule = getValidationRule(key, value, path)
  if (!rule) return { isValid: true }
  
  if (rule.pattern && typeof value === 'string') {
    return {
      isValid: rule.pattern.test(value),
      rule,
      suggestion: rule.fix ? rule.fix(value) : null
    }
  }
  
  if (rule.enum && Array.isArray(rule.enum)) {
    return {
      isValid: rule.enum.includes(value),
      rule,
      suggestion: rule.fix ? rule.fix(value) : rule.enum[0]
    }
  }
  
  if (rule.type) {
    const isValidType = typeof value === rule.type
    return {
      isValid: isValidType,
      rule,
      suggestion: rule.fix ? rule.fix(value) : value
    }
  }
  
  return { isValid: true }
}

// Auto-fix XDM issues and return summary
const autoFixXDMIssues = (data) => {
  const fixes = []
  const fixedData = JSON.parse(JSON.stringify(data))
  
  const applyFixes = (obj, path = '') => {
    if (typeof obj !== 'object' || obj === null) return
    
    Object.entries(obj).forEach(([key, value]) => {
      const currentPath = path ? `${path}.${key}` : key
      const rule = getValidationRule(key, value, currentPath)
      
      // Debug logging
      if (key.toLowerCase() === 'preferredlanguage' || key.toLowerCase() === 'customersatisfaction' || 
          key.toLowerCase() === 'lifetimevalue' || key.toLowerCase() === 'studenttype') {
        console.log('Auto-fix checking:', {
          key,
          value,
          currentPath,
          rule: rule ? 'Found rule' : 'No rule',
          valueType: typeof value
        })
      }
      
      if (rule && rule.fix) {
        const validation = validateValue(key, value, currentPath)
        if (!validation.isValid && validation.suggestion !== undefined && validation.suggestion !== value) {
          console.log('Applying fix:', {
            path: currentPath,
            field: key,
            originalValue: value,
            fixedValue: validation.suggestion,
            reason: rule.hint
          })
          
          // Apply the fix
          obj[key] = validation.suggestion
          
          // Record what was fixed
          fixes.push({
            path: currentPath,
            field: key,
            originalValue: value,
            fixedValue: validation.suggestion,
            reason: rule.hint,
            example: rule.example
          })
        }
      }
      
      // Recursively check nested objects
      if (typeof value === 'object' && value !== null) {
        applyFixes(value, currentPath)
      }
    })
  }
  
  applyFixes(fixedData)
  
  console.log('Auto-fix completed. Total fixes:', fixes.length)
  fixes.forEach(fix => console.log('Fixed:', fix))
  
  return { fixedData, fixes }
}

export default function JsonEditor({ 
  data, 
  onChange, 
  title = "JSON Editor", 
  allowPruning = false,
  schemaStructure = null,
  onPrune = null 
}) {
  const [editingPath, setEditingPath] = useState(null)
  const [editingValue, setEditingValue] = useState('')
  const [hoveredPath, setHoveredPath] = useState(null)
  const [pruneHoveredPath, setPruneHoveredPath] = useState(null)
  const [xdmFixes, setXdmFixes] = useState([])
  const [hasAutoFixed, setHasAutoFixed] = useState(false)
  const [removedPaths, setRemovedPaths] = useState(new Set())
  const [hoverTimeout, setHoverTimeout] = useState(null)

  // Helper functions for managing hover state with delays
  const handleMouseEnterPrune = useCallback((path) => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout)
      setHoverTimeout(null)
    }
    setPruneHoveredPath(path)
  }, [hoverTimeout])

  const handleMouseLeavePrune = useCallback(() => {
    // Add a small delay before hiding the delete button
    const timeout = setTimeout(() => {
      setPruneHoveredPath(null)
    }, 300) // 300ms delay for better UX
    setHoverTimeout(timeout)
  }, [])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout)
      }
    }
  }, [hoverTimeout])

  const handleEdit = useCallback((path, value) => {
    setEditingPath(path)
    setEditingValue(typeof value === 'string' ? value : JSON.stringify(value))
  }, [])

  const handleSave = useCallback(() => {
    if (!editingPath) return
    
    try {
      let newValue
      try {
        // Try to parse as JSON first
        newValue = JSON.parse(editingValue)
      } catch {
        // If not valid JSON, treat as string
        newValue = editingValue
      }
      
      // Update the data
      const newData = JSON.parse(JSON.stringify(data))
      const pathParts = editingPath.split('.')
      let current = newData
      
      for (let i = 0; i < pathParts.length - 1; i++) {
        current = current[pathParts[i]]
      }
      
      current[pathParts[pathParts.length - 1]] = newValue
      
      onChange(newData)
      setEditingPath(null)
      setEditingValue('')
    } catch (error) {
      console.error('Error updating value:', error)
    }
  }, [editingPath, editingValue, data, onChange])

  const handleCancel = useCallback(() => {
    setEditingPath(null)
    setEditingValue('')
  }, [])

  const handleAutoFixAll = useCallback(() => {
    const { fixedData, fixes } = autoFixXDMIssues(data)
    if (fixes.length > 0) {
      setXdmFixes(fixes)
      setHasAutoFixed(true)
      onChange(fixedData)
    }
  }, [data, onChange])

  const handleManualAutoFix = useCallback((path, suggestion) => {
    const pathParts = path.split('.')
    const newData = JSON.parse(JSON.stringify(data))
    let current = newData
    
    for (let i = 0; i < pathParts.length - 1; i++) {
      current = current[pathParts[i]]
    }
    
    current[pathParts[pathParts.length - 1]] = suggestion
    onChange(newData)
  }, [data, onChange])

    // Validate JSON structure against schema
  const validateAgainstSchema = useCallback((jsonData, schema) => {
    if (!schema || !jsonData) return { isValid: true, extraProperties: [], testProfileWarnings: [] }
    
    const extraProperties = []
    const testProfileWarnings = []
    
    const checkObject = (obj, schemaObj, path = '') => {
      if (!obj || typeof obj !== 'object' || !schemaObj || typeof schemaObj !== 'object') return
      
      Object.keys(obj).forEach(key => {
        const currentPath = path ? `${path}.${key}` : key
        
        // Special handling for testProfile - always allow but warn
        if (key === 'testProfile' && path === '') {
          testProfileWarnings.push({
            path: currentPath,
            key,
            value: obj[key],
            reason: 'testProfile not in original schema structure - will not be imported to Platform',
            type: 'warning'
          })
          return
        }
        
        // Check if this property exists in schema
        if (!schemaObj.hasOwnProperty(key)) {
          console.log(`❌ Schema validation: Property ${currentPath} not found in template structure`)
          extraProperties.push({
            path: currentPath,
            key,
            value: obj[key],
            reason: 'Property not found in schema structure',
            type: 'error'
          })
        } else if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key]) && 
                   typeof schemaObj[key] === 'object' && schemaObj[key] !== null && !Array.isArray(schemaObj[key])) {
          // Only recursively check nested objects if both are objects
          checkObject(obj[key], schemaObj[key], currentPath)
        }
      })
    }
    
    checkObject(jsonData, schema)
    
    return {
      isValid: extraProperties.length === 0,
      extraProperties,
      testProfileWarnings
    }
  }, [])

  // Remove property and all its children
  const handlePruneProperty = useCallback((path) => {
    const pathParts = path.split('.')
    const newData = JSON.parse(JSON.stringify(data))
    let current = newData
    
    // Navigate to parent object
    for (let i = 0; i < pathParts.length - 1; i++) {
      current = current[pathParts[i]]
    }
    
    // Remove the property
    const propertyKey = pathParts[pathParts.length - 1]
    delete current[propertyKey]
    
    // Track removed paths
    const newRemovedPaths = new Set(removedPaths)
    newRemovedPaths.add(path)
    setRemovedPaths(newRemovedPaths)
    
    // Call onChange and onPrune callbacks
    onChange(newData)
    if (onPrune) {
      onPrune(path, propertyKey)
    }
    
    console.log('🗑️ Pruned property:', { path, propertyKey, remainingData: newData })
  }, [data, onChange, onPrune, removedPaths])

  // Clean data against schema structure
  const cleanAgainstSchema = useCallback(() => {
    if (!schemaStructure) return
    
    const validation = validateAgainstSchema(data, schemaStructure)
    if (validation.extraProperties.length > 0) {
      let cleanedData = JSON.parse(JSON.stringify(data))
      
      // Remove extra properties (sort by path length desc to remove children first)
      validation.extraProperties
        .sort((a, b) => b.path.split('.').length - a.path.split('.').length)
        .forEach(extra => {
          const pathParts = extra.path.split('.')
          let current = cleanedData
          
          for (let i = 0; i < pathParts.length - 1; i++) {
            if (current[pathParts[i]]) {
              current = current[pathParts[i]]
            }
          }
          
          if (current && current.hasOwnProperty(pathParts[pathParts.length - 1])) {
            delete current[pathParts[pathParts.length - 1]]
          }
        })
      
      onChange(cleanedData)
      console.log('🧹 Cleaned extra properties:', validation.extraProperties.map(p => p.path))
    }
  }, [data, schemaStructure, validateAgainstSchema, onChange])

  const renderValue = (key, value, path = '') => {
    const currentPath = path ? `${path}.${key}` : key
    const validation = validateValue(key, value, currentPath)
    const isEditing = editingPath === currentPath
    const isHovered = hoveredPath === currentPath
    const isPruneHovered = pruneHoveredPath === currentPath
    const isExtraProperty = schemaValidation.extraProperties.some(p => p.path === currentPath)
    const isTestProfileWarning = schemaValidation.testProfileWarnings.some(p => p.path === currentPath)
    
    // Debug logging
    if (!validation.isValid) {
      console.log('Validation failed for:', {
        key,
        value,
        currentPath,
        validation
      })
    }
    
    if (isEditing) {
      return (
        <Flex direction="row" gap="size-100" alignItems="center" wrap>
          <TextField
            value={editingValue}
            onChange={setEditingValue}
            width="size-2400"
            autoFocus
          />
          <ActionButton onPress={handleSave} isQuiet>
            <CheckmarkCircle />
          </ActionButton>
          <ActionButton onPress={handleCancel} isQuiet>
            <Text>Cancel</Text>
          </ActionButton>
        </Flex>
      )
    }

    const getValueStyle = () => {
      // Priority: Validation error > Test profile warning > Extra property > Prune hover > Regular hover
      if (!validation.isValid) {
        return {
          cursor: 'pointer',
          padding: '2px 4px',
          borderRadius: '3px',
          backgroundColor: isPruneHovered ? '#ffebee' : (isHovered ? '#f0f8ff' : 'transparent'),
          border: '1px solid #d73502',
          display: 'inline-block',
          minWidth: '20px',
          position: 'relative'
        }
      } else if (isTestProfileWarning) {
        return {
          cursor: 'pointer',
          padding: '2px 4px',
          borderRadius: '3px',
          backgroundColor: isPruneHovered ? '#ffebee' : (isHovered ? '#fff8e1' : '#fffde7'),
          border: isPruneHovered ? '2px solid #d32f2f' : (isHovered ? '1px solid #ff9800' : '1px solid #ffc107'),
          display: 'inline-block',
          minWidth: '20px',
          position: 'relative'
        }
      } else if (isExtraProperty) {
        return {
          cursor: 'pointer',
          padding: '2px 4px',
          borderRadius: '3px',
          backgroundColor: isPruneHovered ? '#ffebee' : (isHovered ? '#f0f8ff' : '#ffebee'),
          border: isPruneHovered ? '2px solid #d32f2f' : (isHovered ? '1px solid #1473E6' : '1px solid #f44336'),
          display: 'inline-block',
          minWidth: '20px',
          position: 'relative'
        }
      } else {
        return {
          cursor: 'pointer',
          padding: '2px 4px',
          borderRadius: '3px',
          backgroundColor: isPruneHovered ? '#ffebee' : (isHovered ? '#f0f8ff' : 'transparent'),
          border: isPruneHovered ? '2px solid #d32f2f' : (isHovered ? '1px solid #1473E6' : '1px solid transparent'),
          display: 'inline-block',
          minWidth: '20px',
          position: 'relative'
        }
      }
    }

    const valueStyle = getValueStyle()

    const valueElement = (
      <span
        style={valueStyle}
        onMouseEnter={() => {
          setHoveredPath(currentPath)
          if (allowPruning) handleMouseEnterPrune(currentPath)
        }}
        onMouseLeave={() => {
          setHoveredPath(null)
          if (allowPruning) handleMouseLeavePrune()
        }}
        onClick={() => handleEdit(currentPath, value)}
      >
        {typeof value === 'string' ? `"${value}"` : JSON.stringify(value)}
      </span>
    )

    const renderWithPruning = () => {
      if (allowPruning && (isPruneHovered || isExtraProperty || isTestProfileWarning)) {
        return (
          <div
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px',
              padding: '2px',
              borderRadius: '3px'
            }}
            onMouseEnter={() => {
              setHoveredPath(currentPath)
              if (allowPruning) handleMouseEnterPrune(currentPath)
            }}
            onMouseLeave={() => {
              setHoveredPath(null)
              if (allowPruning) handleMouseLeavePrune()
            }}
          >
            {valueElement}
            {isPruneHovered && !isTestProfileWarning && (
              <ActionButton 
                isQuiet 
                onPress={() => handlePruneProperty(currentPath)}
                UNSAFE_style={{
                  backgroundColor: '#d32f2f',
                  color: 'white',
                  minWidth: '20px',
                  height: '20px',
                  marginLeft: '4px',
                  zIndex: 10
                }}
                onMouseEnter={() => handleMouseEnterPrune(currentPath)}
                onMouseLeave={() => handleMouseLeavePrune()}
              >
                <Delete size="XS" />
              </ActionButton>
            )}
            {isTestProfileWarning && (
              <Text size="XS" color="orange-600" UNSAFE_style={{ color: '#ff9800' }}>
                ⚠️ Not in schema (won't import)
              </Text>
            )}
            {isExtraProperty && !isTestProfileWarning && (
              <Text size="XS" color="negative">
                ⚠️ Extra property
              </Text>
            )}
          </div>
        )
      }
      return valueElement
    }

    if (!validation.isValid) {
      return (
        <Flex direction="row" gap="size-100" alignItems="center" wrap>
          {renderWithPruning()}
          <Alert size="XS" color="negative" />
          <Text color="negative" size="XS">
            {validation.rule.hint}
          </Text>
        </Flex>
      )
    }

    return renderWithPruning()
  }

  const renderObject = (obj, path = '', level = 0) => {
    if (obj === null || obj === undefined) {
      return renderValue('', obj, path)
    }

    if (Array.isArray(obj)) {
      return (
        <View>
          <Text>[</Text>
          <View marginStart="size-200">
            {obj.map((item, index) => (
              <View key={index}>
                {renderObject(item, `${path}[${index}]`, level + 1)}
                {index < obj.length - 1 && <Text>,</Text>}
              </View>
            ))}
          </View>
          <Text>]</Text>
        </View>
      )
    }

    if (typeof obj === 'object') {
      const entries = Object.entries(obj)
      return (
        <View>
          <Text>{'{'}</Text>
          <View marginStart="size-200">
            {entries.map(([key, value], index) => {
              const currentPath = path ? `${path}.${key}` : key
              const isPruneHovered = pruneHoveredPath === currentPath
              const isExtraProperty = schemaValidation.extraProperties.some(p => p.path === currentPath)
              const isTestProfileWarning = schemaValidation.testProfileWarnings.some(p => p.path === currentPath)
              
              const getKeyStyle = () => {
                if (isTestProfileWarning) {
                  return {
                    padding: '2px 4px',
                    borderRadius: '3px',
                    backgroundColor: isPruneHovered ? '#ffebee' : '#fffde7',
                    border: isPruneHovered ? '2px solid #d32f2f' : '1px solid #ffc107',
                    cursor: allowPruning && !isTestProfileWarning ? 'pointer' : 'default'
                  }
                } else if (isExtraProperty) {
                  return {
                    padding: '2px 4px',
                    borderRadius: '3px',
                    backgroundColor: isPruneHovered ? '#ffebee' : '#ffebee',
                    border: isPruneHovered ? '2px solid #d32f2f' : '1px solid #f44336',
                    cursor: allowPruning ? 'pointer' : 'default'
                  }
                } else {
                  return {
                    padding: '2px 4px',
                    borderRadius: '3px',
                    backgroundColor: isPruneHovered ? '#ffebee' : 'transparent',
                    border: isPruneHovered ? '2px solid #d32f2f' : '1px solid transparent',
                    cursor: allowPruning ? 'pointer' : 'default'
                  }
                }
              }
              
              const keyStyle = getKeyStyle()
              
              return (
                <View key={key}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '2px' }}>
                    <div
                      style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '4px',
                        padding: '2px',
                        borderRadius: '3px'
                      }}
                      onMouseEnter={() => {
                        if (allowPruning && !isTestProfileWarning) handleMouseEnterPrune(currentPath)
                      }}
                      onMouseLeave={() => {
                        if (allowPruning && !isTestProfileWarning) handleMouseLeavePrune()
                      }}
                    >
                      <span style={keyStyle}>
                        <Text>"{key}": </Text>
                      </span>
                      {allowPruning && isPruneHovered && !isTestProfileWarning && (
                        <ActionButton 
                          isQuiet 
                          onPress={() => handlePruneProperty(currentPath)}
                          UNSAFE_style={{
                            backgroundColor: '#d32f2f',
                            color: 'white',
                            minWidth: '20px',
                            height: '20px',
                            marginLeft: '4px',
                            zIndex: 10
                          }}
                          onMouseEnter={() => handleMouseEnterPrune(currentPath)}
                          onMouseLeave={() => handleMouseLeavePrune()}
                        >
                          <Delete size="XS" />
                        </ActionButton>
                      )}
                    </div>
                    {isTestProfileWarning && (
                      <Text size="XS" UNSAFE_style={{ color: '#ff9800' }} marginEnd="size-50">
                        ⚠️ Schema
                      </Text>
                    )}
                    {isExtraProperty && !isTestProfileWarning && (
                      <Text size="XS" color="negative" marginEnd="size-50">
                        ⚠️
                      </Text>
                    )}
                    {typeof value === 'object' && value !== null ? 
                      renderObject(value, currentPath, level + 1) :
                      renderValue(key, value, path)
                    }
                    {index < entries.length - 1 && <Text>,</Text>}
                  </div>
                </View>
              )
            })}
          </View>
          <Text>{'}'}</Text>
        </View>
      )
    }

    return renderValue('', obj, path)
  }

  // Count validation errors
  const countErrors = (obj, path = '') => {
    let errorCount = 0
    
    if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
      Object.entries(obj).forEach(([key, value]) => {
        const currentPath = path ? `${path}.${key}` : key
        const validation = validateValue(key, value, currentPath)
        if (!validation.isValid) {
          errorCount++
        }
        if (typeof value === 'object' && value !== null) {
          errorCount += countErrors(value, currentPath)
        }
      })
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          errorCount += countErrors(item, `${path}[${index}]`)
        }
      })
    }
    
    return errorCount
  }

  const errorCount = countErrors(data)
  const schemaValidation = schemaStructure ? validateAgainstSchema(data, schemaStructure) : { isValid: true, extraProperties: [], testProfileWarnings: [] }
  
  // Debug: Log validation results
  if (schemaValidation.extraProperties.length > 0) {
    console.log('🚨 Extra properties detected:', schemaValidation.extraProperties.map(p => p.path))
    console.log('Schema structure keys:', schemaStructure ? Object.keys(schemaStructure) : 'No schema')
    console.log('Data keys:', data ? Object.keys(data) : 'No data')
  }

  return (
    <Well>
      <Flex direction="column" gap="size-200">
        <Flex direction="row" justifyContent="space-between" alignItems="center">
          <Text><strong>{title}</strong></Text>
          <Flex direction="row" gap="size-200" alignItems="center">
            {/* Schema Validation Status */}
            {schemaStructure && (
              <>
                {schemaValidation.testProfileWarnings.length > 0 && (
                  <StatusLight variant="notice" UNSAFE_style={{ backgroundColor: '#fff8e1', color: '#ff9800' }}>
                    Schema mismatch detected
                  </StatusLight>
                )}
                {schemaValidation.extraProperties.length > 0 ? (
                  <>
                    <StatusLight variant="negative">
                      {schemaValidation.extraProperties.length} extra propert{schemaValidation.extraProperties.length !== 1 ? 'ies' : 'y'}
                    </StatusLight>
                    <Button
                      variant="secondary"
                      size="S"
                      onPress={cleanAgainstSchema}
                    >
                      🧹 Remove Extra Properties
                    </Button>
                  </>
                ) : schemaValidation.testProfileWarnings.length === 0 ? (
                  <StatusLight variant="positive">
                    Schema structure valid
                  </StatusLight>
                ) : (
                  <StatusLight variant="positive">
                    Schema structure valid (mismatch noted)
                  </StatusLight>
                )}
              </>
            )}
            
            {/* XDM Validation Status */}
            {errorCount > 0 ? (
              <>
                <StatusLight variant="negative">
                  {errorCount} XDM validation error{errorCount !== 1 ? 's' : ''}
                </StatusLight>
                <Button
                  variant="primary"
                  size="S"
                  onPress={handleAutoFixAll}
                >
                  🔧 Auto-Fix All XDM Issues
                </Button>
              </>
            ) : (
              <StatusLight variant="positive">
                XDM validation passed
              </StatusLight>
            )}
          </Flex>
        </Flex>
        
        {/* XDM Fixes Summary */}
        {hasAutoFixed && xdmFixes.length > 0 && (
          <Well marginBottom="size-200">
            <Flex direction="column" gap="size-100">
              <Text><strong>🔧 XDM Issues Auto-Fixed ({xdmFixes.length})</strong></Text>
              {xdmFixes.map((fix, index) => (
                <Flex key={index} direction="column" gap="size-50">
                  <Text size="S">
                    <strong>{fix.field}:</strong> "{fix.originalValue}" → "{JSON.stringify(fix.fixedValue)}"
                  </Text>
                  <Text size="XS" color="neutral">
                    📍 {fix.path} • 💡 {fix.reason}
                  </Text>
                </Flex>
              ))}
            </Flex>
          </Well>
        )}
        
        <Text color="neutral" marginBottom="size-200">
          💡 Click any value to edit. Red borders indicate XDM validation errors.
          {allowPruning && (
            <> Hover over properties to see red highlight and delete button for pruning. ⚠️ indicates extra properties not in schema.</>
          )}
        </Text>
        
        {/* Test Profile Warnings */}
        {schemaStructure && schemaValidation.testProfileWarnings.length > 0 && (
          <Well marginBottom="size-200" UNSAFE_style={{ backgroundColor: '#fff8e1', borderColor: '#ffc107' }}>
            <Flex direction="column" gap="size-100">
              <Text UNSAFE_style={{ color: '#ff9800' }}><strong>⚠️ Schema Structure Mismatch Detected</strong></Text>
              <Text size="S">The AI-generated profile contains properties not in your original schema structure. These fields will be ignored during data import:</Text>
              {schemaValidation.testProfileWarnings.map((warning, index) => (
                <Flex key={index} direction="row" gap="size-100" alignItems="center">
                  <Text size="S" UNSAFE_style={{ color: '#ff9800' }}>
                    📍 <strong>{warning.path}</strong>: {JSON.stringify(warning.value)} - Not defined in Platform schema, will not be imported
                  </Text>
                </Flex>
              ))}
              <Text size="S" UNSAFE_style={{ color: '#ff6f00', fontStyle: 'italic' }}>
                💡 <strong>Note:</strong> Your original schema structure doesn't include testProfile field. To enable test profiles in AJO, you would need to modify your schema in Adobe Experience Platform first.
              </Text>
            </Flex>
          </Well>
        )}

        {/* Schema Validation Details */}
        {schemaStructure && schemaValidation.extraProperties.length > 0 && (
          <Well marginBottom="size-200" backgroundColor="negative">
            <Flex direction="column" gap="size-100">
              <Text><strong>⚠️ Extra Properties Found ({schemaValidation.extraProperties.length})</strong></Text>
              <Text size="S">These properties are not defined in your schema structure and should be removed:</Text>
              {schemaValidation.extraProperties.slice(0, 5).map((extra, index) => (
                <Flex key={index} direction="row" gap="size-100" alignItems="center">
                  <Text size="S" color="negative">
                    📍 {extra.path}: {JSON.stringify(extra.value)}
                  </Text>
                  {allowPruning && (
                    <ActionButton 
                      size="S"
                      isQuiet 
                      onPress={() => handlePruneProperty(extra.path)}
                    >
                      <Delete size="XS" />
                    </ActionButton>
                  )}
                </Flex>
              ))}
              {schemaValidation.extraProperties.length > 5 && (
                <Text size="S" color="neutral">
                  ... and {schemaValidation.extraProperties.length - 5} more
                </Text>
              )}
            </Flex>
          </Well>
        )}
        
        <View
          backgroundColor="gray-50"
          padding="size-200"
          borderRadius="medium"
          UNSAFE_style={{
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
            fontSize: '12px',
            lineHeight: '1.6',
            maxHeight: '500px',
            overflow: 'auto',
            whiteSpace: 'pre-wrap'
          }}
        >
          {renderObject(data)}
        </View>
      </Flex>
    </Well>
  )
} 