import React from 'react'
import {
  Flex,
  Heading,
  Text,
  View,
  Well,
  Divider
} from '@adobe/react-spectrum'

const AIApiDocumentation = () => {
  return (
    <View width="100%" maxWidth="1200px" marginX="auto" padding="size-400">
      <Heading level={1}>AI Tooling API Documentation</Heading>
      <Text marginTop="size-200">
        This section uses three backend actions built on Adobe I/O Runtime to process images and generate AI content.
      </Text>

      {/* Image Analysis Action */}
      <View marginTop="size-600">
        <Heading level={2}>1. Image Analysis Action</Heading>
        <Text marginTop="size-100">
          Analyzes images using Azure Computer Vision API to extract tags with confidence scores.
        </Text>
        
        <Flex direction="column" gap="size-300" marginTop="size-300">
          <View>
            <Heading level={3}>Endpoint</Heading>
            <Well>
              <Text UNSAFE_style={{ fontFamily: 'monospace', fontSize: '14px' }}>
                POST /api/v1/web/dx-excshell-1/image-analysis
              </Text>
            </Well>
          </View>

          <View>
            <Heading level={3}>Request Body</Heading>
            <Well>
              <Text UNSAFE_style={{ fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
{`{
  "imageUrls": [
    "https://example.com/image1.jpg",
    "https://example.com/image2.jpg"
  ],
  "fileName": "analysis_batch_001.xlsx"
}`}
              </Text>
            </Well>
          </View>

          <View>
            <Heading level={3}>Response</Heading>
            <Well>
              <Text UNSAFE_style={{ fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
{`{
  "fileName": "analysis_batch_001.xlsx",
  "totalImages": 2,
  "processedImages": 2,
  "successfulAnalyses": 2,
  "results": [
    {
      "imageName": "Image 1",
      "imageUrl": "https://example.com/image1.jpg",
      "tags": [
        { "name": "dog", "confidence": 0.9547 },
        { "name": "outdoor", "confidence": 0.8421 }
      ]
    }
  ]
}`}
              </Text>
            </Well>
          </View>

          <View>
            <Heading level={3}>Features</Heading>
            <ul style={{ marginLeft: '20px' }}>
              <li>Processes up to 20 images per request</li>
              <li>Rate limiting protection with automatic retries</li>
              <li>Error handling for failed analyses</li>
              <li>Confidence scores for each detected tag</li>
            </ul>
          </View>
        </Flex>
      </View>

      <Divider marginTop="size-600" marginBottom="size-600" />

      {/* Prompt Generation Action */}
      <View marginTop="size-600">
        <Heading level={2}>2. Prompt Generation Action</Heading>
        <Text marginTop="size-100">
          Uses Azure OpenAI to generate optimized image generation prompts from selected tags.
        </Text>
        
        <Flex direction="column" gap="size-300" marginTop="size-300">
          <View>
            <Heading level={3}>Endpoint</Heading>
            <Well>
              <Text UNSAFE_style={{ fontFamily: 'monospace', fontSize: '14px' }}>
                POST /api/v1/web/dx-excshell-1/prompt-generation
              </Text>
            </Well>
          </View>

          <View>
            <Heading level={3}>Request Body</Heading>
            <Well>
              <Text UNSAFE_style={{ fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
{`{
  "imageName": "sunset_beach.jpg",
  "selectedTags": [
    "sunset",
    "beach", 
    "ocean"
  ]
}`}
              </Text>
            </Well>
          </View>

          <View>
            <Heading level={3}>Response</Heading>
            <Well>
              <Text UNSAFE_style={{ fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
{`{
  "imageName": "sunset_beach.jpg",
  "generatedPrompt": "A breathtaking sunset over a tranquil beach with ocean waves, featuring dramatic colors and professional composition, high resolution, cinematic lighting",
  "selectedTags": ["sunset", "beach", "ocean"]
}`}
              </Text>
            </Well>
          </View>

          <View>
            <Heading level={3}>Features</Heading>
            <ul style={{ marginLeft: '20px' }}>
              <li>Optimized for AI image generation tools (DALL-E, Midjourney, Stable Diffusion)</li>
              <li>Incorporates professional photography terms</li>
              <li>Maintains semantic relationships between tags</li>
            </ul>
          </View>
        </Flex>
      </View>

      <Divider marginTop="size-600" marginBottom="size-600" />

      {/* Image Generation Action */}
      <View marginTop="size-600">
        <Heading level={2}>3. Image Generation Action</Heading>
        <Text marginTop="size-100">
          Creates images using Azure DALL-E from text prompts with content policy compliance.
        </Text>
        
        <Flex direction="column" gap="size-300" marginTop="size-300">
          <View>
            <Heading level={3}>Endpoint</Heading>
            <Well>
              <Text UNSAFE_style={{ fontFamily: 'monospace', fontSize: '14px' }}>
                POST /api/v1/web/dx-excshell-1/image-generation
              </Text>
            </Well>
          </View>

          <View>
            <Heading level={3}>Request Body</Heading>
            <Well>
              <Text UNSAFE_style={{ fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
{`{
  "prompt": "A breathtaking sunset over a tranquil beach with ocean waves, captured in stunning detail with vibrant colors",
  "size": "1024x1024"
}`}
              </Text>
            </Well>
          </View>

          <View>
            <Heading level={3}>Response</Heading>
            <Well>
              <Text UNSAFE_style={{ fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
{`{
  "prompt": "A breathtaking sunset over a tranquil beach...",
  "imageUrl": "https://generated-image-url.com/image.png",
  "revisedPrompt": "Enhanced version of the original prompt",
  "size": "1024x1024"
}`}
              </Text>
            </Well>
          </View>

          <View>
            <Heading level={3}>Features</Heading>
            <ul style={{ marginLeft: '20px' }}>
              <li>High-quality image generation using DALL-E 3</li>
              <li>Content policy compliance checking</li>
              <li>Multiple size options available</li>
              <li>Automatic prompt enhancement</li>
            </ul>
          </View>
        </Flex>
      </View>

      <Divider marginTop="size-600" marginBottom="size-600" />

      {/* Usage Notes */}
      <View marginTop="size-600">
        <Heading level={2}>Usage Notes</Heading>
        <Text marginTop="size-100">
          Important considerations when using these APIs:
        </Text>
        
        <ul style={{ marginLeft: '20px', lineHeight: '1.6', marginTop: '12px' }}>
          <li><strong>Rate Limits:</strong> APIs have built-in rate limiting to prevent overuse</li>
          <li><strong>Image Requirements:</strong> Images must be publicly accessible URLs</li>
          <li><strong>Content Policy:</strong> Generated content must comply with Azure's content policies</li>
          <li><strong>Processing Time:</strong> Image analysis takes 1-2 seconds per image, generation takes 10-30 seconds</li>
        </ul>
      </View>
    </View>
  )
}

export default AIApiDocumentation 