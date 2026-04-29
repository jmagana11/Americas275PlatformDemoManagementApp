const fetch = require('node-fetch')

/**
 * This action generates realistic AEP profiles using AI based on the provided template structure
 * 
 * @param {object} params - The input parameters
 * @param {number} params.count - Number of profiles to generate
 * @param {object} params.template - The pruned template structure from frontend
 * @param {string} params.emailDomain - Email domain for generated emails
 * @param {string} params.customization - User customization
 * @returns {object} Generated profiles response
 */
async function main(params) {
  try {
    // Always generate exactly 1 golden profile
    const count = 1
    const template = params.template || params.schemaTemplate || null
    const emailDomain = params.emailDomain || 'gmail'
    const customization = params.customization || ''
    const tenantId = params.__ow_headers?.['x-gw-ims-org-id']?.replace('@AdobeOrg', '') ||
      (params.orgId || process.env.AEP_ORG_ID || '').replace('@AdobeOrg', '')

    if (!template) {
      return {
        statusCode: 400,
        body: { error: 'Missing required parameter: template' }
      }
    }

    console.log('Generating golden profile with AI for template:', JSON.stringify(template, null, 2))
    if (customization) {
      console.log('User customization:', customization)
    }

    // Generate single golden profile using AI
    const profiles = await generateGoldenProfileWithAI(template, emailDomain, customization, tenantId, params)

    return {
      statusCode: 200,
      body: {
        profiles: profiles,
        count: profiles.length,
        message: `Successfully generated golden profile based on provided template.`
      }
    }
  } catch (error) {
    console.error('Error generating golden profile:', error)
    return {
      statusCode: 500,
      body: { error: 'Internal server error', details: error.message }
    }
  }
}

// Removed old generateProfilesWithAI function - now using generateGoldenProfileWithAI for single profile generation

/**
 * Legacy function - no longer used
 */
async function generateProfilesWithAI_DEPRECATED(template, count, emailDomain, customization, tenantId, params = {}) {
  const AZURE_OPENAI_ENDPOINT = params.AZURE_OPENAI_ENDPOINT || process.env.AZURE_OPENAI_ENDPOINT
  const AZURE_OPENAI_KEY = params.AZURE_OPENAI_KEY || process.env.AZURE_OPENAI_KEY

  if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_KEY) {
    throw new Error('Azure OpenAI configuration is missing')
  }

  // Analyze the template to understand what fields need to be populated
  const templateAnalysis = analyzeTemplate(template)
  
  // Create a detailed prompt for AI to generate realistic profile data
  const systemPrompt = `You are an expert data generator for Adobe Experience Platform. Generate realistic, diverse customer profiles.

INSTRUCTIONS:
1. Return ONLY valid JSON array - no explanations or markdown
2. The template shows field structure with empty/default values
3. Use field NAMES to understand what realistic data to generate
4. Generate diverse, realistic data for each field based on its name
5. Email format: firstname_lastname_number@${emailDomain}.svpoc.io
6. Use realistic phone numbers, addresses, dates (ISO 8601 format)
7. Ensure data consistency within each profile
8. Generate diverse demographics from different cultures`

  const userPrompt = `Generate exactly ${count} diverse, realistic customer profiles using this structure:

${JSON.stringify(template, null, 2)}

CRITICAL REQUIREMENTS:
- Generate EXACTLY ${count} profiles (not 1, not ${count-1}, but exactly ${count})
- The template shows empty/default values - replace them with realistic data
- Use field names to understand what type of data to generate
- For "name" fields: use realistic names from diverse cultures
- For "email" fields: use the specified email format
- For "address" fields: use realistic US addresses
- For "age" fields: use realistic ages (18-80)
- For "phone" fields: use realistic phone numbers
- For date fields: use realistic ISO 8601 dates
- Generate diverse, consistent profiles
${customization ? `\nSPECIAL INSTRUCTIONS: ${customization}` : ''}

IMPORTANT: Return a JSON array with exactly ${count} profile objects.

Return JSON array of exactly ${count} profiles with realistic data:`

  try {
    const response = await fetch(AZURE_OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': AZURE_OPENAI_KEY
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userPrompt
          }
        ],
        max_tokens: Math.min(8000, count * 400), // Increased token allocation for multiple profiles
        temperature: 0.7, // Balanced creativity/speed
        top_p: 0.9
      })
    })

    if (!response.ok) {
      throw new Error(`Azure OpenAI API error: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    
    if (!result.choices || !result.choices[0] || !result.choices[0].message) {
      throw new Error('Invalid response from Azure OpenAI')
    }

    const generatedContent = result.choices[0].message.content.trim()
    console.log('AI Generated Content:', generatedContent)
    console.log('Requested count:', count)

    // Parse the AI response as JSON
    let profiles
    try {
      // Clean up the response in case AI added markdown formatting
      const cleanContent = generatedContent
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()
      
      profiles = JSON.parse(cleanContent)
      
      if (!Array.isArray(profiles)) {
        console.error('AI response is not an array, wrapping single object')
        profiles = [profiles]
      }
      
      console.log('Parsed profiles count:', profiles.length)
      console.log('Expected count:', count)
      
      if (profiles.length !== count) {
        console.warn(`AI generated ${profiles.length} profiles but ${count} were requested`)
      }
      
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError)
      console.error('AI Response:', generatedContent)
      
      // Fallback: generate profiles using template-based approach
      console.log('Falling back to template-based generation')
      profiles = generateFallbackProfiles(template, count, emailDomain, customization, tenantId)
    }

    // Validate and enhance profiles
    const validatedProfiles = profiles.map((profile, index) => {
      return validateAndEnhanceProfile(profile, template, emailDomain, customization, tenantId, index)
    })

    return validatedProfiles.slice(0, count) // Ensure we return exactly the requested count

  } catch (error) {
    console.error('Error calling Azure OpenAI:', error)
    
    // Fallback to template-based generation
    console.log('Falling back to template-based generation due to AI error')
    return generateFallbackProfiles(template, count, emailDomain, customization, tenantId)
  }
}

/**
 * Analyze template structure to provide context for AI generation
 */
function analyzeTemplate(template) {
  const analysis = {
    fieldCount: 0,
    hasIdentityFields: false,
    hasTenantProperties: false,
    identityFields: [],
    tenantFields: [],
    fieldTypes: {}
  }

  function analyzeObject(obj, path = '') {
    for (const key in obj) {
      if (!obj.hasOwnProperty(key)) continue
      
      const fullPath = path ? `${path}.${key}` : key
      analysis.fieldCount++
      
      // Check for identity fields
      if (key.includes('email') || key.includes('phone') || key.includes('id') || key.includes('ID')) {
        analysis.hasIdentityFields = true
        analysis.identityFields.push(fullPath)
      }
      
      // Check for tenant properties
      if (key.startsWith('_') && key.includes('275')) {
        analysis.hasTenantProperties = true
        analysis.tenantFields.push(fullPath)
      }
      
      const value = obj[key]
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        analysis.fieldTypes[fullPath] = 'object'
        analyzeObject(value, fullPath)
      } else if (Array.isArray(value)) {
        analysis.fieldTypes[fullPath] = 'array'
      } else {
        analysis.fieldTypes[fullPath] = typeof value
      }
    }
  }

  analyzeObject(template)
  return analysis
}

/**
 * Validate and enhance a profile to ensure it matches the template
 */
function validateAndEnhanceProfile(profile, template, emailDomain, customization, tenantId, index) {
  // Ensure the profile has all required structure
  const enhancedProfile = JSON.parse(JSON.stringify(profile))
  
  // Add unique identifiers if missing
  if (!hasEmailField(enhancedProfile)) {
    // Add email to the most appropriate location
    addEmailToProfile(enhancedProfile, emailDomain, customization, index)
  }
  
  // Ensure tenant properties are present
  ensureTenantProperties(enhancedProfile, tenantId)
  
  // Validate data types match template
  validateDataTypes(enhancedProfile, template)
  
  return enhancedProfile
}

/**
 * Check if profile has an email field
 */
function hasEmailField(profile) {
  function searchForEmail(obj) {
    for (const key in obj) {
      if (key.toLowerCase().includes('email')) {
        return true
      }
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        if (searchForEmail(obj[key])) {
          return true
        }
      }
    }
    return false
  }
  return searchForEmail(profile)
}

/**
 * Add email to profile in appropriate location
 */
function addEmailToProfile(profile, emailDomain, customization, index) {
  // Generate a unique email
  const firstName = generateRandomName('first')
  const lastName = generateRandomName('last')
  const email = `${firstName.toLowerCase()}_${lastName.toLowerCase()}_${Date.now()}_${index}@${emailDomain}.svpoc.io`
  
  // Try to find the best place to add email
  if (profile.personalEmail) {
    profile.personalEmail.address = email
  } else if (profile.email) {
    profile.email = email
  } else {
    // Add to tenant properties if they exist
    const tenantKeys = Object.keys(profile).filter(key => key.startsWith('_'))
    if (tenantKeys.length > 0) {
      const emailKey = `${tenantKeys[0]}.identification.core.email`
      setNestedProperty(profile, emailKey, email)
    } else {
      profile.email = email
    }
  }
}

/**
 * Ensure tenant properties are properly structured
 */
function ensureTenantProperties(profile, tenantId) {
  const tenantPrefix = `_adobedemoamericas${tenantId}`
  
  // Look for existing tenant properties and ensure they're properly formatted
  for (const key in profile) {
    if (key.startsWith('_') && key.includes('275')) {
      // This is likely a tenant property, ensure it's properly structured
      continue
    }
  }
}

/**
 * Validate data types match template expectations
 */
function validateDataTypes(profile, template) {
  // This is a simplified validation - in a full implementation,
  // you'd recursively check all fields match expected types
  return profile
}

/**
 * Set nested property using dot notation
 */
function setNestedProperty(obj, path, value) {
  const keys = path.split('.')
  let current = obj
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {}
    }
    current = current[key]
  }
  
  current[keys[keys.length - 1]] = value
}

/**
 * Fallback profile generation using template-based approach
 */
function generateFallbackProfiles(template, count, emailDomain, customization, tenantId) {
  console.log('Generating fallback profiles using template-based approach')
  
  const profiles = []
  for (let i = 0; i < count; i++) {
    const profile = populateTemplate(template, emailDomain, i, customization, 'profile')
    profiles.push(profile)
  }
  
  return profiles
}

/**
 * Populate template with realistic data (fallback method)
 */
function populateTemplate(template, emailDomain, index = 0, customization = '', parentKey = '') {
  if (Array.isArray(template)) {
    return [populateTemplate(template[0], emailDomain, index, customization, parentKey)]
  } else if (typeof template === 'object' && template !== null) {
    const obj = {}
    for (const key in template) {
      if (!template.hasOwnProperty(key)) continue
      obj[key] = populateTemplate(template[key], emailDomain, index, customization, key)
    }
    return obj
  } else {
    // Generate appropriate value based on key name
    return generateValueForKey(parentKey || 'unknown', emailDomain, index, customization)
  }
}

/**
 * Generate appropriate value based on field key
 */
function generateValueForKey(key, emailDomain, index, customization = '') {
  const keyLower = key.toLowerCase()
  
  if (keyLower.includes('email')) {
    const firstName = generateRandomName('first')
    const lastName = generateRandomName('last')
    return `${firstName.toLowerCase()}_${lastName.toLowerCase()}_${Date.now()}_${index}@${emailDomain}.svpoc.io`
  } else if (keyLower.includes('name')) {
    return generateRandomName()
  } else if (keyLower.includes('phone')) {
    return generatePhoneNumber()
  } else if (keyLower.includes('date') || keyLower.includes('time')) {
    return new Date().toISOString()
  } else if (keyLower.includes('id')) {
    return `ID_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`
  } else if (keyLower.includes('address')) {
    return generateAddress()
  } else if (keyLower.includes('city')) {
    return generateCity()
  } else if (keyLower.includes('state')) {
    return generateState()
  } else if (keyLower.includes('country')) {
    return 'United States'
  } else if (keyLower.includes('zip') || keyLower.includes('postal')) {
    return generateZipCode()
  } else {
    return `Sample_${key}_${index}`
  }
}

/**
 * Helper functions for generating realistic data
 */
function generateRandomName(type = 'full') {
  const firstNames = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Christopher', 'Karen']
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin']
  
  if (type === 'first') {
    return firstNames[Math.floor(Math.random() * firstNames.length)]
  } else if (type === 'last') {
    return lastNames[Math.floor(Math.random() * lastNames.length)]
  } else {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]
    return `${firstName} ${lastName}`
  }
}

function generatePhoneNumber() {
  const areaCode = Math.floor(Math.random() * 900) + 100
  const exchange = Math.floor(Math.random() * 900) + 100
  const number = Math.floor(Math.random() * 9000) + 1000
  return `+1-${areaCode}-${exchange}-${number}`
}

function generateAddress() {
  const streetNumbers = [Math.floor(Math.random() * 9999) + 1]
  const streetNames = ['Main St', 'Oak Ave', 'Pine Rd', 'Elm Dr', 'Cedar Ln', 'Maple Way', 'Park Blvd', 'First St', 'Second Ave', 'Third Rd']
  return `${streetNumbers} ${streetNames[Math.floor(Math.random() * streetNames.length)]}`
}

function generateCity() {
  const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville', 'Fort Worth', 'Columbus', 'Charlotte']
  return cities[Math.floor(Math.random() * cities.length)]
}

function generateState() {
  const states = ['CA', 'TX', 'FL', 'NY', 'PA', 'IL', 'OH', 'GA', 'NC', 'MI', 'NJ', 'VA', 'WA', 'AZ', 'MA']
  return states[Math.floor(Math.random() * states.length)]
}

function generateZipCode() {
  return Math.floor(Math.random() * 90000) + 10000
}

/**
 * Create an empty template with default values for AI to work with
 */
function createEmptyTemplate(obj, path = '', tenantId = '') {
  if (obj === null || obj === undefined) {
    return null
  }
  
  if (Array.isArray(obj)) {
    if (obj.length > 0) {
      return [createEmptyTemplate(obj[0], path, tenantId)]
    }
    return []
  }
  
  if (typeof obj === 'object') {
    const result = {}
    for (const key in obj) {
      if (!obj.hasOwnProperty(key)) continue
      
      // Skip only the current tenant ID that causes wrapping issues
      const tenantPrefix = tenantId ? `_${tenantId}` : ''
      if (tenantPrefix && (key === tenantPrefix || key.startsWith(tenantPrefix))) {
        console.log(`Skipping tenant property: ${key}`)
        continue
      }
      
      const currentPath = path ? `${path}.${key}` : key
      const value = obj[key]
      
      if (value === null || value === undefined) {
        result[key] = null
      } else if (Array.isArray(value)) {
        result[key] = value.length > 0 ? [createEmptyTemplate(value[0], currentPath, tenantId)] : []
      } else if (typeof value === 'object') {
        result[key] = createEmptyTemplate(value, currentPath, tenantId)
      } else {
        // Replace with appropriate empty/default value based on field name and type
        result[key] = getEmptyValue(key, value)
      }
    }
    return result
  }
  
  return getEmptyValue(path, obj)
}

/**
 * Get appropriate empty/default value for a field
 */
function getEmptyValue(fieldName, originalValue) {
  const fieldLower = fieldName.toLowerCase()
  
  // Return appropriate default values based on field name patterns
  if (fieldLower.includes('email')) {
    return ""
  } else if (fieldLower.includes('name') || fieldLower.includes('title')) {
    return ""
  } else if (fieldLower.includes('phone') || fieldLower.includes('mobile')) {
    return ""
  } else if (fieldLower.includes('address') || fieldLower.includes('street') || fieldLower.includes('city') || fieldLower.includes('state') || fieldLower.includes('country')) {
    return ""
  } else if (fieldLower.includes('age') || fieldLower.includes('count') || fieldLower.includes('number') || fieldLower.includes('score')) {
    return 0
  } else if (fieldLower.includes('date') || fieldLower.includes('time') || fieldLower.includes('timestamp')) {
    return ""
  } else if (fieldLower.includes('id') || fieldLower.includes('key')) {
    return ""
  } else if (fieldLower.includes('flag') || fieldLower.includes('enabled') || fieldLower.includes('active') || fieldLower.includes('test')) {
    return false
  } else if (typeof originalValue === 'string') {
    return ""
  } else if (typeof originalValue === 'number') {
    return 0
  } else if (typeof originalValue === 'boolean') {
    return false
  } else {
    return ""
  }
}

async function generateGoldenProfileWithAI(template, emailDomain, customization, tenantId, params = {}) {
  try {
    const endpoint = params.AZURE_OPENAI_ENDPOINT || process.env.AZURE_OPENAI_ENDPOINT
    const apiKey = params.AZURE_OPENAI_KEY || process.env.AZURE_OPENAI_KEY

    if (!endpoint || !apiKey) {
      throw new Error('Azure OpenAI configuration is missing')
    }

    // Create empty template for AI to work with
    const emptyTemplate = createEmptyTemplate(template, '', tenantId)
    
    let prompt = `You are an expert at generating realistic customer profile data for Adobe Experience Platform (AEP) that passes strict XDM validation.

TASK: Generate exactly 1 high-quality, realistic customer profile (a "Golden Profile") based on the provided XDM schema template.

TEMPLATE STRUCTURE:
${JSON.stringify(emptyTemplate, null, 2)}

CRITICAL XDM VALIDATION REQUIREMENTS:
1. **Date Format**: Use ONLY "yyyy-MM-dd" format (e.g., "2024-05-20") - NO timestamps or ISO strings
2. **Nationality**: Use ONLY 2-letter country codes (e.g., "US", "CA", "GB") - NOT full country names
3. **Data Types**: 
   - Numbers must be actual numbers, not strings (e.g., 1234.56, not "1234.56")
   - Booleans must be true/false, not strings
   - Strings must be quoted strings
4. **Gender**: Use only valid enum values: "male", "female", "not_specified" - NO "non_binary"
5. **User Status**: Use only valid enum values: "active", "inactive" - NO "suspended"
6. **Required Fields**: Ensure ALL required tenant properties (_adobedemoamericas275) are included
7. **Segments**: Must be objects with proper structure, not strings

SPECIFIC FIELD REQUIREMENTS:
- person.nationality: 2-letter country code (US, CA, GB, etc.)
- person.gender: "male", "female", or "not_specified" only
- userAccount.status: "active" or "inactive" only
- All dates: "yyyy-MM-dd" format only
- All numeric fields: actual numbers, not strings
- All boolean fields: true/false, not strings
- segments: array of objects, not strings

EMAIL DOMAIN: Use ${emailDomain}.svpoc.io for all email addresses

SPECIAL INSTRUCTIONS:
${customization || 'Generate a diverse, realistic customer profile.'}

OUTPUT FORMAT:
Return ONLY a valid JSON object representing the single customer profile. Do not include any explanatory text, markdown formatting, or additional commentary. The response should be pure JSON that can be directly parsed and will pass Adobe XDM validation.

The profile should be complete, realistic, and ready for immediate use in AEP testing without validation errors.`

    console.log('AI Prompt for Golden Profile:', prompt)

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2000, // Sufficient for 1 detailed profile
        temperature: 0.8,
        top_p: 0.9
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Azure OpenAI API error:', response.status, errorText)
      throw new Error(`Azure OpenAI API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log('Azure OpenAI response:', JSON.stringify(data, null, 2))

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response format from Azure OpenAI')
    }

    const aiContent = data.choices[0].message.content.trim()
    console.log('AI generated content:', aiContent)

    // Parse the AI response
    let profile
    try {
      // Remove any markdown formatting if present
      const cleanContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      profile = JSON.parse(cleanContent)
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError)
      console.error('AI content was:', aiContent)
      throw new Error('AI generated invalid JSON format')
    }

    // Ensure testProfile is set to true (only at root level)
    profile.testProfile = true

    // Don't add tenant wrapper - keep the profile clean and ready for injection

    console.log('Generated golden profile:', JSON.stringify(profile, null, 2))
    
    return [profile] // Return as array for consistency with existing code

  } catch (error) {
    console.error('Error in generateGoldenProfileWithAI:', error)
    throw error
  }
}

exports.main = main 
