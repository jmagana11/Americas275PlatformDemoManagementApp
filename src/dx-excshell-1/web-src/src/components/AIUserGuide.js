import React from 'react'
import { 
  Heading, 
  View, 
  Text,
  Flex,
  Well,
  Divider,
  StatusLight,
  Content,
  Button,
  Badge
} from '@adobe/react-spectrum'

const AIUserGuide = () => (
  <View width="100%" maxWidth="1200px" marginX="auto" padding="size-400">
          <Heading level={1}>🤖 AI Prompt Generator - User Guide</Heading>
    
    <Text marginTop="size-200" UNSAFE_style={{ fontSize: '18px', lineHeight: '1.6' }}>
              The AI Prompt Generator provides a complete workflow for analyzing images, generating optimized prompts, 
      and creating new AI images with session management and advanced features.
    </Text>

    <StatusLight variant="positive" marginTop="size-300">
              ✨ <strong>KEY FEATURES:</strong> Features tabbed interface, session management, individual tag selection, 
      batch operations, and integrated image gallery!
    </StatusLight>

    <Divider marginTop="size-600" marginBottom="size-600" />

    {/* Overview */}
    <View marginTop="size-600">
              <Heading level={2}>🚀 Overview of Key Features</Heading>
      
      <Well marginTop="size-300">
        <Flex direction="column" gap="size-300">
          <View>
            <Heading level={3}>🆕 What's New</Heading>
            <ul style={{ marginLeft: '20px', lineHeight: '1.8' }}>
              <li><strong>📋 Tabbed Workflow:</strong> Organized into 4 clear stages (Upload → Tag Selection → Prompt Generation → Gallery)</li>
              <li><strong>💾 Advanced Session Management:</strong> Auto-save every 5 seconds + seamless session continuation</li>
              <li><strong>🏷️ Individual Tag Selection:</strong> Each image gets independent tag management</li>
              <li><strong>🔄 Tag Deletion:</strong> Remove tags directly from prompt generation tab</li>
              <li><strong>⚡ Batch Operations:</strong> Generate all prompts with one click</li>
              <li><strong>📊 Progress Tracking:</strong> Live stats showing tagged, prompted, and generated counts</li>
              <li><strong>🖼️ Image Gallery:</strong> Grid and carousel views for comparing original vs AI-generated images</li>
              <li><strong>🎯 Smart Navigation:</strong> Automatically advances to relevant tabs</li>
              <li><strong>🔄 Auto-Backup:</strong> Never lose work with background saves and console monitoring</li>
            </ul>
          </View>
        </Flex>
      </Well>
    </View>

    <Divider marginTop="size-600" marginBottom="size-600" />

    {/* Step 1: Setup and Upload */}
    <View marginTop="size-600">
      <Heading level={2}>Step 1: 📁 Upload & Process</Heading>
      
      <Well marginTop="size-300">
        <Flex direction="column" gap="size-300">
          <View>
            <Heading level={3}>📥 Get Started</Heading>
            <Text marginTop="size-100">
              Start fresh or resume previous work:
            </Text>
            
                         <ul style={{ marginLeft: '20px', lineHeight: '1.8', marginTop: '12px' }}>
               <li><strong>📂 Load Session:</strong> Resume saved work (name auto-populates for continued saving)</li>
               <li><strong>📄 Download Template:</strong> Get properly formatted Excel template</li>
               <li><strong>📤 Choose File:</strong> Upload your prepared Excel file</li>
               <li><strong>💾 Set Session Name:</strong> Enter a name to enable automatic 5-second background saves</li>
             </ul>
          </View>

          <View>
            <Heading level={3}>📊 Excel File Requirements</Heading>
            <Text marginTop="size-100">
              Your Excel file must contain an "ImageRef" sheet with:
            </Text>
            
            <ul style={{ marginLeft: '20px', lineHeight: '1.8', marginTop: '12px' }}>
              <li><strong>imageLocation column:</strong> Public URLs to your images</li>
              <li><strong>Supported formats:</strong> JPG, PNG, GIF, BMP, WEBP</li>
              <li><strong>Best practice:</strong> 5-20 images per batch for optimal performance</li>
              <li><strong>URL requirements:</strong> Must be publicly accessible (https:// or http://)</li>
            </ul>
          </View>

          <View>
            <Heading level={3}>🔍 Automatic Processing</Heading>
            <Text marginTop="size-100">
              After upload, the system automatically:
            </Text>
            
            <ol style={{ marginLeft: '20px', lineHeight: '1.8', marginTop: '12px' }}>
              <li>Reads your Excel file and extracts image URLs</li>
              <li>Analyzes each image using Azure Computer Vision API</li>
              <li>Extracts descriptive tags with confidence scores</li>
              <li>Creates thumbnails and organizes results</li>
              <li>Advances to Tag Selection tab when complete</li>
            </ol>

            <StatusLight variant="info" marginTop="size-200">
              Processing takes 1-2 seconds per image. Watch the progress indicator for status updates.
            </StatusLight>
          </View>
        </Flex>
      </Well>
    </View>

    <Divider marginTop="size-600" marginBottom="size-600" />

    {/* Step 2: Tag Selection */}
    <View marginTop="size-600">
      <Heading level={2}>Step 2: 🏷️ Tag Selection</Heading>
      
      <Well marginTop="size-300">
        <Flex direction="column" gap="size-300">
          <View>
            <Heading level={3}>🎯 Individual Image Management</Heading>
            <Text marginTop="size-100">
              Each image has its own independent tag selection:
            </Text>
            
            <ul style={{ marginLeft: '20px', lineHeight: '1.8', marginTop: '12px' }}>
              <li><strong>Image Preview:</strong> 120px thumbnails with image names</li>
              <li><strong>Available Tags:</strong> All detected tags with confidence scores</li>
              <li><strong>Checkbox Selection:</strong> Choose any combination of tags per image</li>
              <li><strong>Selection Badge:</strong> Shows count of selected tags for each image</li>
            </ul>
          </View>

          <View>
            <Heading level={3}>📊 Progress Tracking</Heading>
            <Text marginTop="size-100">
              The stats bar shows live progress with color-coded badges:
            </Text>
            
            <ul style={{ marginLeft: '20px', lineHeight: '1.8', marginTop: '12px' }}>
              <li><Badge variant="info">Blue Badge</Badge> <strong>Total Images</strong> processed</li>
              <li><Badge variant="positive">Green Badge</Badge> <strong>Tagged Images</strong> with selected tags</li>
              <li><Badge variant="neutral">Gray Badge</Badge> <strong>Prompted Images</strong> with generated prompts</li>
              <li><Badge variant="negative">Red Badge</Badge> <strong>Generated Images</strong> completed</li>
            </ul>
          </View>

          <View>
            <Heading level={3}>💡 Tag Selection Best Practices</Heading>
            <ul style={{ marginLeft: '20px', lineHeight: '1.8' }}>
              <li><strong>Quality over quantity:</strong> Choose 3-8 most relevant tags per image</li>
              <li><strong>Focus on confidence:</strong> Tags above 70% confidence are typically accurate</li>
              <li><strong>Consider your goal:</strong> Select tags matching what you want to recreate</li>
              <li><strong>Mix specifics and mood:</strong> Combine object tags with style/mood tags</li>
            </ul>
          </View>
        </Flex>
      </Well>
    </View>

    <Divider marginTop="size-600" marginBottom="size-600" />

    {/* Step 3: Prompt Generation */}
    <View marginTop="size-600">
      <Heading level={2}>Step 3: ✨ Prompt Generation</Heading>
      
      <Well marginTop="size-300">
        <Flex direction="column" gap="size-300">
          <View>
            <Heading level={3}>🛠️ Individual & Batch Operations</Heading>
            <Text marginTop="size-100">
              Generate prompts individually or in batch:
            </Text>
            
            <ul style={{ marginLeft: '20px', lineHeight: '1.8', marginTop: '12px' }}>
              <li><strong>Individual Generation:</strong> Click "Generate Prompt" for specific images</li>
              <li><strong>Batch Generation:</strong> "Generate All Prompts" processes all tagged images</li>
              <li><strong>Editable Prompts:</strong> Modify generated text in the text area</li>
              <li><strong>Progress Tracking:</strong> See "Processing..." status during generation</li>
            </ul>
          </View>

          <View>
            <Heading level={3}>🏷️ Interactive Tag Management</Heading>
            <Text marginTop="size-100">
              NEW: Delete tags directly from the prompt generation tab:
            </Text>
            
            <ul style={{ marginLeft: '20px', lineHeight: '1.8', marginTop: '12px' }}>
              <li><strong>Clickable Tag Pills:</strong> Tags display as interactive buttons</li>
              <li><strong>Click ✕ to Remove:</strong> Red close icon on each tag</li>
              <li><strong>Visual Feedback:</strong> Tags turn red on hover before deletion</li>
              <li><strong>Bi-directional Sync:</strong> Changes reflect in Tag Selection tab</li>
              <li><strong>Smart Notifications:</strong> Suggests regenerating prompts after tag changes</li>
            </ul>

            <StatusLight variant="notice" marginTop="size-200">
              💡 After removing tags, regenerate the prompt to reflect the changes!
            </StatusLight>
          </View>

          <View>
            <Heading level={3}>🖼️ Direct Image Generation</Heading>
            <Text marginTop="size-100">
              Generate AI images directly from prompts:
            </Text>
            
            <ul style={{ marginLeft: '20px', lineHeight: '1.8', marginTop: '12px' }}>
              <li><strong>Individual:</strong> "Generate for Gallery" creates one image per prompt</li>
              <li><strong>Success Feedback:</strong> Confirmation when images are generated</li>
              <li><strong>Gallery Navigation:</strong> Automatic tab highlighting when images are ready</li>
            </ul>
          </View>
        </Flex>
      </Well>
    </View>

    <Divider marginTop="size-600" marginBottom="size-600" />

    {/* Step 4: Image Gallery */}
    <View marginTop="size-600">
      <Heading level={2}>Step 4: 🖼️ Image Gallery</Heading>
      
      <Well marginTop="size-300">
        <Flex direction="column" gap="size-300">
          <View>
            <Heading level={3}>👁️ Two Viewing Modes</Heading>
            <Text marginTop="size-100">
              Switch between viewing modes for different experiences:
            </Text>
            
            <ul style={{ marginLeft: '20px', lineHeight: '1.8', marginTop: '12px' }}>
              <li><strong>🔲 Grid View:</strong> See all image pairs in a responsive grid layout</li>
              <li><strong>🖼️ Carousel View:</strong> Focus on one comparison at a time with navigation</li>
              <li><strong>Side-by-side Comparison:</strong> Original vs AI-generated images</li>
              <li><strong>Full Prompt Display:</strong> Complete generated prompt text for each image</li>
            </ul>
          </View>

          <View>
            <Heading level={3}>🎛️ Gallery Features</Heading>
            <ul style={{ marginLeft: '20px', lineHeight: '1.8' }}>
              <li><strong>Live Counter:</strong> Badge shows number of generated images</li>
              <li><strong>High-Quality Display:</strong> 250px images in carousel, 150px in grid</li>
              <li><strong>Image Information:</strong> Original filename and generated prompt</li>
              <li><strong>Navigation Controls:</strong> Previous/Next buttons in carousel mode</li>
              <li><strong>Responsive Design:</strong> Adapts to different screen sizes</li>
            </ul>
          </View>
        </Flex>
      </Well>
    </View>

    <Divider marginTop="size-600" marginBottom="size-600" />

    {/* Session Management */}
    <View marginTop="size-600">
      <Heading level={2}>💾 Session Management</Heading>
      
      <Well marginTop="size-300">
        <Flex direction="column" gap="size-300">
          <View>
            <Heading level={3}>💿 Save Your Work</Heading>
            <Text marginTop="size-100">
              Save complete sessions with all your progress:
            </Text>
            
            <ul style={{ marginLeft: '20px', lineHeight: '1.8', marginTop: '12px' }}>
              <li><strong>Named Sessions:</strong> Give each session a descriptive name</li>
              <li><strong>Complete State:</strong> Saves analysis, tags, prompts, and generated images</li>
              <li><strong>File Context:</strong> Remembers original Excel filename</li>
              <li><strong>Timestamp:</strong> Shows when each session was saved</li>
              <li><strong>Overwrite Protection:</strong> Confirms before overwriting existing sessions</li>
            </ul>
          </View>

          <View>
            <Heading level={3}>📂 Load Previous Work</Heading>
            <Text marginTop="size-100">
              Resume work from any point in your workflow:
            </Text>
            
            <ul style={{ marginLeft: '20px', lineHeight: '1.8', marginTop: '12px' }}>
              <li><strong>Available from Start:</strong> Load session button visible immediately</li>
              <li><strong>Smart Navigation:</strong> Opens to the most relevant tab based on progress</li>
              <li><strong>Session Browser:</strong> Clean dialog showing all saved sessions</li>
              <li><strong>Quick Actions:</strong> Load or delete sessions with one click</li>
              <li><strong>File Restoration:</strong> Shows original filename context</li>
              <li><strong>🆕 Name Population:</strong> Session name field automatically fills with loaded session name</li>
            </ul>

            <StatusLight variant="positive" marginTop="size-200">
              ✨ <strong>NEW:</strong> When you load a session, the name field populates automatically for seamless continued saving!
            </StatusLight>
          </View>

          <View>
            <Heading level={3}>⚡ Automatic Background Save</Heading>
            <Text marginTop="size-100">
              🆕 <strong>NEW FEATURE:</strong> Your work saves automatically every 5 seconds:
            </Text>
            
            <ul style={{ marginLeft: '20px', lineHeight: '1.8', marginTop: '12px' }}>
              <li><strong>Zero Interruption:</strong> Runs silently in the background without affecting performance</li>
              <li><strong>Smart Conditions:</strong> Only saves when you have meaningful progress and a session name</li>
              <li><strong>Console Monitoring:</strong> Check browser console for auto-save confirmations</li>
              <li><strong>Overwrite Protection:</strong> Automatically updates your current session</li>
              <li><strong>No Manual Saves Needed:</strong> Set a session name once and forget about saving</li>
            </ul>

            <StatusLight variant="info" marginTop="size-200">
              💡 <strong>Monitor Auto-Save:</strong> Open browser console (F12) to see auto-save confirmations with timestamps
            </StatusLight>
          </View>

          <View>
            <Heading level={3}>🗂️ Session Management Tips</Heading>
            <ul style={{ marginLeft: '20px', lineHeight: '1.8' }}>
              <li><strong>Descriptive Names:</strong> Use names like "Product Photos - Batch 1"</li>
              <li><strong>Set Name Early:</strong> Enter session name to enable automatic background saves</li>
              <li><strong>Load & Continue:</strong> Loading a session populates the name field for continued saving</li>
              <li><strong>Session Cleanup:</strong> Delete old sessions to keep organized</li>
              <li><strong>Console Monitoring:</strong> Watch auto-save logs to confirm regular backups</li>
            </ul>
          </View>
        </Flex>
      </Well>
    </View>

    <Divider marginTop="size-600" marginBottom="size-600" />

    {/* Advanced Features */}
    <View marginTop="size-600">
      <Heading level={2}>⚡ Advanced Features & Tips</Heading>
      
      <Well marginTop="size-300">
        <Flex direction="column" gap="size-300">
          <View>
            <Heading level={3}>🚀 Efficiency Features</Heading>
            <ul style={{ marginLeft: '20px', lineHeight: '1.8' }}>
              <li><strong>Batch Processing:</strong> Process multiple images simultaneously</li>
              <li><strong>Rate Limiting:</strong> Automatic delays prevent API overload</li>
              <li><strong>Error Recovery:</strong> Detailed error messages with suggested fixes</li>
              <li><strong>Progress Indicators:</strong> Visual feedback during all operations</li>
              <li><strong>Content Policy Handling:</strong> Automatic detection and user notification</li>
            </ul>
          </View>

          <View>
            <Heading level={3}>🎯 Best Practices</Heading>
            <ul style={{ marginLeft: '20px', lineHeight: '1.8' }}>
              <li><strong>Start Small:</strong> Test with 3-5 images before large batches</li>
              <li><strong>Quality Images:</strong> Use high-resolution, well-lit photos</li>
              <li><strong>Strategic Tagging:</strong> Select tags that match your creative goals</li>
              <li><strong>Prompt Refinement:</strong> Edit generated prompts for better results</li>
              <li><strong>Save Frequently:</strong> Use session management to preserve work</li>
            </ul>
          </View>

          <View>
            <Heading level={3}>⚠️ Limitations & Considerations</Heading>
            <ul style={{ marginLeft: '20px', lineHeight: '1.8' }}>
              <li><strong>API Rate Limits:</strong> Built-in delays prevent service overload</li>
              <li><strong>Content Policies:</strong> AI-generated content must comply with platform policies</li>
              <li><strong>Image Quality:</strong> Results depend on input image quality and tag selection</li>
              <li><strong>Processing Time:</strong> Large batches may take several minutes</li>
              <li><strong>Session Storage:</strong> Saved in browser localStorage (device-specific)</li>
            </ul>
          </View>
        </Flex>
      </Well>
    </View>

    <Divider marginTop="size-600" marginBottom="size-600" />

    {/* Troubleshooting */}
    <View marginTop="size-600">
      <Heading level={2}>🔧 Troubleshooting</Heading>
      
      <Well marginTop="size-300">
        <Flex direction="column" gap="size-300">
          <View>
            <Heading level={3}>🚨 Common Issues</Heading>
            <ul style={{ marginLeft: '20px', lineHeight: '1.8' }}>
              <li><strong>"Invalid prompt" Error:</strong> Regenerate the prompt after changing tags</li>
              <li><strong>"Rate limit exceeded":</strong> Wait a few minutes before retrying</li>
              <li><strong>"Analysis failed":</strong> Check that image URLs are publicly accessible</li>
              <li><strong>"No sessions found":</strong> Sessions are stored per browser/device</li>
              <li><strong>Slow processing:</strong> Large images or poor connectivity can cause delays</li>
            </ul>
          </View>

          <View>
            <Heading level={3}>💡 Quick Fixes</Heading>
            <ul style={{ marginLeft: '20px', lineHeight: '1.8' }}>
              <li><strong>Refresh the page</strong> if interface becomes unresponsive</li>
              <li><strong>Use smaller image batches</strong> (5-10 images) for better performance</li>
              <li><strong>Check browser console</strong> for detailed error messages</li>
              <li><strong>Clear browser cache</strong> if experiencing persistent issues</li>
              <li><strong>Verify image URLs</strong> work in a new browser tab</li>
            </ul>
          </View>
        </Flex>
      </Well>
    </View>

    <StatusLight variant="positive" marginTop="size-600">
      🎉 <strong>Ready to create amazing AI images!</strong> Start with the Upload & Process tab and follow the guided workflow.
    </StatusLight>
  </View>
)

export default AIUserGuide 