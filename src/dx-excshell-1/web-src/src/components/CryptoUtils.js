import React from 'react'
import {
  View,
  Heading,
  Text,
  Button,
  ActionButton,
  TextField,
  TextArea,
  Well,
  Flex,
  Grid,
  StatusLight,
  Tabs,
  Item,
  Content,
  Divider
} from '@adobe/react-spectrum'
import Copy from '@spectrum-icons/workflow/Copy'
import Key from '@spectrum-icons/workflow/Key'
import DataRefresh from '@spectrum-icons/workflow/DataRefresh'
import Shield from '@spectrum-icons/workflow/Shield'

const CryptoUtils = ({ runtime, ims }) => {
  // Tab management
  const [selectedTab, setSelectedTab] = React.useState('jwt')
  
  // JWT Decoder States
  const [jwtInput, setJwtInput] = React.useState('')
  const [decodedHeader, setDecodedHeader] = React.useState('')
  const [decodedPayload, setDecodedPayload] = React.useState('')
  const [jwtError, setJwtError] = React.useState('')

  // Hash Generator States
  const [hashInput, setHashInput] = React.useState('')
  const [hashOutput, setHashOutput] = React.useState('')
  const [hashType, setHashType] = React.useState('SHA-256')
  const [hashError, setHashError] = React.useState('')

  // Base64 Encoder/Decoder States
  const [base64Input, setBase64Input] = React.useState('')
  const [base64Output, setBase64Output] = React.useState('')
  const [base64Mode, setBase64Mode] = React.useState('encode')
  const [base64Error, setBase64Error] = React.useState('')
  const [uploadedImage, setUploadedImage] = React.useState(null)
  const [imagePreview, setImagePreview] = React.useState('')
  const [imageBase64, setImageBase64] = React.useState('')

  // Notification function
  const showNotification = (type, message) => {
    // Could integrate with Adobe's notification system if available
    console.log(`${type.toUpperCase()}: ${message}`)
  }

  // Copy to clipboard function
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      showNotification('success', 'Copied to clipboard!')
    } catch (error) {
      console.error('Failed to copy:', error)
      showNotification('error', 'Failed to copy to clipboard')
    }
  }

  // JWT Token Decoder
  const decodeJWT = () => {
    setJwtError('')
    setDecodedHeader('')
    setDecodedPayload('')

    if (!jwtInput.trim()) {
      setJwtError('Please enter a JWT token')
      return
    }

    try {
      const token = jwtInput.trim()
      const parts = token.split('.')

      if (parts.length !== 3) {
        throw new Error('Invalid JWT format. Expected 3 parts separated by dots.')
      }

      // Decode header
      const headerDecoded = atob(parts[0].replace(/-/g, '+').replace(/_/g, '/'))
      const headerParsed = JSON.parse(headerDecoded)
      setDecodedHeader(JSON.stringify(headerParsed, null, 2))

      // Decode payload
      const payloadDecoded = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
      const payloadParsed = JSON.parse(payloadDecoded)
      
      // Add human-readable timestamps
      if (payloadParsed.exp) {
        payloadParsed.exp_readable = new Date(payloadParsed.exp * 1000).toISOString()
      }
      if (payloadParsed.iat) {
        payloadParsed.iat_readable = new Date(payloadParsed.iat * 1000).toISOString()
      }
      if (payloadParsed.nbf) {
        payloadParsed.nbf_readable = new Date(payloadParsed.nbf * 1000).toISOString()
      }

      setDecodedPayload(JSON.stringify(payloadParsed, null, 2))
    } catch (error) {
      setJwtError(`Decoding failed: ${error.message}`)
    }
  }

  // Clear JWT inputs
  const clearJWT = () => {
    setJwtInput('')
    setDecodedHeader('')
    setDecodedPayload('')
    setJwtError('')
  }

  // Hash Generator
  const generateHash = async () => {
    setHashError('')
    setHashOutput('')

    if (!hashInput.trim()) {
      setHashError('Please enter text to hash')
      return
    }

    try {
      const encoder = new TextEncoder()
      const data = encoder.encode(hashInput.trim())
      
      let hashBuffer
      switch (hashType) {
        case 'SHA-1':
          hashBuffer = await crypto.subtle.digest('SHA-1', data)
          break
        case 'SHA-256':
          hashBuffer = await crypto.subtle.digest('SHA-256', data)
          break
        case 'SHA-384':
          hashBuffer = await crypto.subtle.digest('SHA-384', data)
          break
        case 'SHA-512':
          hashBuffer = await crypto.subtle.digest('SHA-512', data)
          break
        default:
          throw new Error('Unsupported hash type')
      }

      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      setHashOutput(hashHex)
    } catch (error) {
      setHashError(`Hashing failed: ${error.message}`)
    }
  }

  // Base64 Encoder/Decoder
  const processBase64 = () => {
    setBase64Error('')
    setBase64Output('')

    if (!base64Input.trim()) {
      setBase64Error('Please enter text to process')
      return
    }

    try {
      if (base64Mode === 'encode') {
        const encoded = btoa(base64Input)
        setBase64Output(encoded)
      } else {
        const decoded = atob(base64Input.trim())
        setBase64Output(decoded)
      }
    } catch (error) {
      setBase64Error(`${base64Mode === 'encode' ? 'Encoding' : 'Decoding'} failed: ${error.message}`)
    }
  }

  // Image Upload Handler
  const handleImageUpload = (event) => {
    const file = event.target.files[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setBase64Error('Please select a valid image file')
      return
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setBase64Error('Image size must be less than 10MB')
      return
    }

    setBase64Error('')
    setUploadedImage(file)

    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target.result
      setImagePreview(result)
      
      // Extract base64 part (remove data:image/...;base64, prefix)
      const base64String = result.split(',')[1]
      setImageBase64(base64String)
    }
    reader.readAsDataURL(file)
  }

  // Clear image upload
  const clearImageUpload = () => {
    setUploadedImage(null)
    setImagePreview('')
    setImageBase64('')
    setBase64Error('')
    // Clear file input
    const fileInput = document.getElementById('image-upload')
    if (fileInput) fileInput.value = ''
  }

  return (
    <View padding="size-300">
        <Heading level={1} marginBottom="size-300">🔐 Crypto & Token Utilities</Heading>
        
        <Text marginBottom="size-400">
          Safe client-side tools for token decoding, hash generation, and encoding utilities.
          All processing happens in your browser - no data is sent to any server.
        </Text>
        
        {/* Manual Tab Navigation */}
        <Flex gap="size-200" marginTop="size-400" marginBottom="size-300">
          <Button 
            variant={selectedTab === 'jwt' ? 'primary' : 'secondary'}
            onPress={() => setSelectedTab('jwt')}
          >
            🔓 JWT Decoder
          </Button>
          <Button 
            variant={selectedTab === 'hash' ? 'primary' : 'secondary'}
            onPress={() => setSelectedTab('hash')}
          >
            🔐 Hash Generator
          </Button>
          <Button 
            variant={selectedTab === 'base64' ? 'primary' : 'secondary'}
            onPress={() => setSelectedTab('base64')}
          >
            📝 Base64 Encoder/Decoder
          </Button>
          <Button 
            variant={selectedTab === 'help' ? 'primary' : 'secondary'}
            onPress={() => setSelectedTab('help')}
          >
            📖 Help
          </Button>
        </Flex>

        {/* Tab Content */}
        {selectedTab === 'jwt' && (
            <View marginTop="size-300">
              <Well marginBottom="size-300">
                <Heading level={3} marginBottom="size-300">JWT Token Decoder</Heading>
                
                <Text marginBottom="size-300">
                  Decode JWT tokens (like Microsoft OAuth tokens) to view their header and payload contents.
                </Text>

                <TextArea
                  label="JWT Token"
                  value={jwtInput}
                  onChange={setJwtInput}
                  width="100%"
                  height="size-1200"
                  placeholder="Paste your JWT token here (e.g., eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...)"
                  marginBottom="size-300"
                  validationState={jwtError ? 'invalid' : 'valid'}
                  errorMessage={jwtError}
                />

                <Flex gap="size-200" marginBottom="size-300">
                  <Button variant="primary" onPress={decodeJWT} isDisabled={!jwtInput.trim()}>
                    <Key />
                    <Text>Decode Token</Text>
                  </Button>
                  <Button variant="secondary" onPress={clearJWT}>
                    <DataRefresh />
                    <Text>Clear</Text>
                  </Button>
                </Flex>

                {(decodedHeader || decodedPayload) && (
                  <Grid columns={['1fr', '1fr']} gap="size-300">
                    <Well>
                      <Flex justifyContent="space-between" alignItems="center" marginBottom="size-200">
                        <Heading level={4}>Header</Heading>
                        {decodedHeader && (
                          <ActionButton onPress={() => copyToClipboard(decodedHeader)}>
                            <Copy />
                          </ActionButton>
                        )}
                      </Flex>
                      <TextArea
                        value={decodedHeader}
                        isReadOnly
                        width="100%"
                        height="size-2000"
                      />
                    </Well>

                    <Well>
                      <Flex justifyContent="space-between" alignItems="center" marginBottom="size-200">
                        <Heading level={4}>Payload</Heading>
                        {decodedPayload && (
                          <ActionButton onPress={() => copyToClipboard(decodedPayload)}>
                            <Copy />
                          </ActionButton>
                        )}
                      </Flex>
                      <TextArea
                        value={decodedPayload}
                        isReadOnly
                        width="100%"
                        height="size-2000"
                      />
                    </Well>
                  </Grid>
                )}
              </Well>
            </View>
        )}

        {selectedTab === 'hash' && (
            <View marginTop="size-300">
              <Well marginBottom="size-300">
                <Heading level={3} marginBottom="size-300">Hash Generator</Heading>
                
                <Text marginBottom="size-300" UNSAFE_style={{ fontSize: '14px', color: '#6B7280' }}>
                  Generate cryptographic hashes for strings like email addresses for Facebook Custom Audiences,
                  data anonymization, or other privacy-compliant data processing.
                </Text>

                <Grid columns={['2fr', '1fr']} gap="size-300" marginBottom="size-300">
                  <TextField
                    label="Text to Hash"
                    value={hashInput}
                    onChange={setHashInput}
                    width="100%"
                    placeholder="Enter email address or any text to hash"
                    validationState={hashError ? 'invalid' : 'valid'}
                    errorMessage={hashError}
                  />
                  
                  <View>
                    <Text marginBottom="size-100">Hash Algorithm</Text>
                    <select 
                      value={hashType} 
                      onChange={(e) => setHashType(e.target.value)}
                      style={{ 
                        width: '100%', 
                        padding: '8px', 
                        borderRadius: '4px', 
                        border: '1px solid #ccc'
                      }}
                    >
                      <option value="SHA-256">SHA-256 (Recommended)</option>
                      <option value="SHA-1">SHA-1</option>
                      <option value="SHA-384">SHA-384</option>
                      <option value="SHA-512">SHA-512</option>
                    </select>
                  </View>
                </Grid>

                <Button 
                  variant="primary" 
                  onPress={generateHash} 
                  isDisabled={!hashInput.trim()}
                  marginBottom="size-300"
                >
                  <Shield />
                  <Text>Generate Hash</Text>
                </Button>

                {hashOutput && (
                  <Well backgroundColor="gray-50">
                    <Flex justifyContent="space-between" alignItems="center" marginBottom="size-200">
                      <Heading level={4}>{hashType} Hash Result</Heading>
                      <ActionButton onPress={() => copyToClipboard(hashOutput)}>
                        <Copy />
                        <Text>Copy Hash</Text>
                      </ActionButton>
                    </Flex>
                    <TextArea
                      value={hashOutput}
                      isReadOnly
                      width="100%"
                      height="size-800"
                    />
                    <Text UNSAFE_style={{ fontSize: '12px', color: '#6B7280', marginTop: '8px' }}>
                      Example use: Facebook Custom Audiences, data anonymization, secure comparisons
                    </Text>
                  </Well>
                )}
              </Well>
            </View>
        )}

        {selectedTab === 'base64' && (
            <View marginTop="size-300">
              <Well marginBottom="size-300">
                <Heading level={3} marginBottom="size-300">Base64 Encoder/Decoder</Heading>
                
                <Text marginBottom="size-300" UNSAFE_style={{ fontSize: '14px', color: '#6B7280' }}>
                  Encode text to Base64 or decode Base64 strings back to readable text.
                  Useful for API authentication, data transmission, and debugging.
                </Text>

                <Grid columns={['2fr', '1fr']} gap="size-300" marginBottom="size-300">
                  <TextArea
                    label="Input Text"
                    value={base64Input}
                    onChange={setBase64Input}
                    width="100%"
                    height="size-1200"
                    placeholder={base64Mode === 'encode' ? 'Enter text to encode' : 'Enter Base64 string to decode'}
                    validationState={base64Error ? 'invalid' : 'valid'}
                    errorMessage={base64Error}
                  />
                  
                  <View>
                    <Text marginBottom="size-100">Operation</Text>
                    <select 
                      value={base64Mode} 
                      onChange={(e) => setBase64Mode(e.target.value)}
                      style={{ 
                        width: '100%', 
                        padding: '8px', 
                        borderRadius: '4px', 
                        border: '1px solid #ccc'
                      }}
                    >
                      <option value="encode">Encode to Base64</option>
                      <option value="decode">Decode from Base64</option>
                    </select>
                  </View>
                </Grid>

                <Button 
                  variant="primary" 
                  onPress={processBase64} 
                  isDisabled={!base64Input.trim()}
                  marginBottom="size-300"
                >
                  <DataRefresh />
                  <Text>{base64Mode === 'encode' ? 'Encode' : 'Decode'}</Text>
                </Button>

                {base64Output && (
                  <Well backgroundColor="gray-50">
                    <Flex justifyContent="space-between" alignItems="center" marginBottom="size-200">
                      <Heading level={4}>
                        {base64Mode === 'encode' ? 'Base64 Encoded' : 'Decoded Text'}
                      </Heading>
                      <ActionButton onPress={() => copyToClipboard(base64Output)}>
                        <Copy />
                        <Text>Copy Result</Text>
                      </ActionButton>
                    </Flex>
                    <TextArea
                      value={base64Output}
                      isReadOnly
                      width="100%"
                      height="size-1200"
                    />
                  </Well>
                )}
              </Well>

              {/* Image Upload Section */}
              <Well marginTop="size-300">
                <Heading level={3} marginBottom="size-300">📷 Image to Base64 Converter</Heading>
                
                <Text marginBottom="size-300" UNSAFE_style={{ fontSize: '14px', color: '#6B7280' }}>
                  Upload an image file to get its Base64 encoded string. Perfect for embedding images in emails, 
                  web pages, or API requests. Supports JPG, PNG, GIF, WebP formats up to 10MB.
                </Text>

                <Flex direction="column" gap="size-300">
                  {/* File Upload */}
                  <View>
                    <Text marginBottom="size-100">Select Image File</Text>
                    <input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      style={{
                        padding: '8px',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        width: '100%',
                        backgroundColor: '#f9f9f9'
                      }}
                    />
                    {base64Error && (
                      <Text UNSAFE_style={{ color: '#d32f2f', fontSize: '12px', marginTop: '4px' }}>
                        {base64Error}
                      </Text>
                    )}
                  </View>

                  {/* Clear Button */}
                  {uploadedImage && (
                    <Button variant="secondary" onPress={clearImageUpload}>
                      Clear Image
                    </Button>
                  )}

                  {/* Image Preview and Results */}
                  {imagePreview && (
                    <Grid columns={['1fr', '1fr']} gap="size-400">
                      {/* Image Preview */}
                      <View>
                        <Heading level={4} marginBottom="size-200">Image Preview</Heading>
                        <Well backgroundColor="gray-50">
                          <img 
                            src={imagePreview} 
                            alt="Uploaded preview"
                            style={{
                              maxWidth: '100%',
                              maxHeight: '200px',
                              objectFit: 'contain',
                              border: '1px solid #ddd',
                              borderRadius: '4px'
                            }}
                          />
                          <Text UNSAFE_style={{ fontSize: '12px', color: '#6B7280', marginTop: '8px' }}>
                            File: {uploadedImage?.name} ({(uploadedImage?.size / 1024).toFixed(1)} KB)
                          </Text>
                        </Well>
                      </View>

                      {/* Base64 Output */}
                      <View>
                        <Flex justifyContent="space-between" alignItems="center" marginBottom="size-200">
                          <Heading level={4}>Base64 String</Heading>
                          <ActionButton onPress={() => copyToClipboard(imageBase64)}>
                            <Copy />
                            <Text>Copy Base64</Text>
                          </ActionButton>
                        </Flex>
                        <Well backgroundColor="gray-50">
                          <TextArea
                            value={imageBase64}
                            isReadOnly
                            width="100%"
                            height="size-1600"
                            placeholder="Base64 encoded image will appear here..."
                          />
                          <Text UNSAFE_style={{ fontSize: '12px', color: '#6B7280', marginTop: '8px' }}>
                            Use in HTML: &lt;img src="data:image/{uploadedImage?.type?.split('/')[1]};base64,{imageBase64 ? imageBase64.substring(0, 20) + '...' : ''}" /&gt;
                          </Text>
                        </Well>
                      </View>
                    </Grid>
                  )}

                  {/* Usage Examples */}
                  {imageBase64 && (
                    <Well backgroundColor="blue-100" marginTop="size-300">
                      <Heading level={4} marginBottom="size-200">💡 Usage Examples</Heading>
                      <Content>
                        <strong>HTML Embed:</strong><br/>
                        <code>&lt;img src="data:image/{uploadedImage?.type?.split('/')[1]};base64,{imageBase64.substring(0, 30)}..." /&gt;</code>
                        <br/><br/>
                        <strong>CSS Background:</strong><br/>
                        <code>background-image: url('data:image/{uploadedImage?.type?.split('/')[1]};base64,{imageBase64.substring(0, 30)}...');</code>
                        <br/><br/>
                        <strong>API Payload:</strong><br/>
                        <code>{`{"image": "${imageBase64.substring(0, 30)}...", "filename": "${uploadedImage?.name}"}`}</code>
                      </Content>
                    </Well>
                  )}
                </Flex>
              </Well>
            </View>
        )}

        {selectedTab === 'help' && (
            <View marginTop="size-300">
              <Well marginBottom="size-300">
                <Heading level={3} marginBottom="size-300">🔐 Crypto & Token Utilities Guide</Heading>
                
                <Heading level={4} marginBottom="size-200">🔓 JWT Token Decoder</Heading>
                <Content marginBottom="size-300">
                  • <strong>Purpose:</strong> Decode JWT tokens to inspect their contents
                  <br/>• <strong>Input:</strong> Complete JWT token (header.payload.signature)
                  <br/>• <strong>Output:</strong> Readable JSON for header and payload
                  <br/>• <strong>Note:</strong> Signature is not verified - for inspection only
                  <br/>• <strong>Privacy:</strong> All processing happens in your browser
                </Content>

                <Heading level={4} marginBottom="size-200">🔐 Hash Generator</Heading>
                <Content marginBottom="size-300">
                  • <strong>Purpose:</strong> Generate cryptographic hashes for data privacy
                  <br/>• <strong>Algorithms:</strong> SHA-1, SHA-256, SHA-384, SHA-512
                  <br/>• <strong>Use Cases:</strong> Facebook Custom Audiences, data anonymization
                  <br/>• <strong>Recommended:</strong> SHA-256 for best security/compatibility balance
                  <br/>• <strong>Output:</strong> Hexadecimal hash string
                </Content>

                <Heading level={4} marginBottom="size-200">📝 Base64 Encoder/Decoder</Heading>
                <Content marginBottom="size-300">
                  • <strong>Purpose:</strong> Convert between text and Base64 encoding
                  <br/>• <strong>Text Encoding:</strong> Convert readable text to Base64
                  <br/>• <strong>Text Decoding:</strong> Convert Base64 back to readable text
                  <br/>• <strong>Image Upload:</strong> Upload images to get Base64 encoded strings
                  <br/>• <strong>Use Cases:</strong> API authentication, image embedding, data transmission, debugging
                  <br/>• <strong>Supported:</strong> JPG, PNG, GIF, WebP up to 10MB
                </Content>

                <Divider size="M" marginY="size-300" />

                <Heading level={4} marginBottom="size-200">🛡️ Security & Privacy</Heading>
                <Well backgroundColor="green-100">
                  <Content>
                    <StatusLight variant="positive">All processing is client-side</StatusLight>
                    <br/>• No data is transmitted to any server
                    <br/>• All operations happen in your browser
                    <br/>• Your tokens and data remain private
                    <br/>• Safe to use with sensitive information
                  </Content>
                </Well>

                <Heading level={4} marginBottom="size-200" marginTop="size-300">💡 Common Use Cases</Heading>
                <Content>
                  <strong>JWT Decoder:</strong> Inspect Microsoft OAuth tokens, debug authentication issues
                  <br/><strong>Hash Generator:</strong> Prepare email lists for Facebook Custom Audiences
                  <br/><strong>Base64:</strong> Debug API requests, encode credentials, decode responses
                </Content>
              </Well>
            </View>
        )}
      </View>
  )
}

export default CryptoUtils 