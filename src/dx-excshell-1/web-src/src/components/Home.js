/*
* <license header>
*/

import React from 'react'
import { Heading, View, Text, Well, Flex, StatusLight } from '@adobe/react-spectrum'
import { getUserEmail, getUserAccessPermissions, logAccessControlInfo } from '../utils/accessControl'

export const Home = ({ ims }) => {
  // Log access control info when component mounts
  React.useEffect(() => {
    if (ims) {
      logAccessControlInfo(ims)
    }
  }, [ims])

  const userEmail = getUserEmail(ims)
  const permissions = getUserAccessPermissions(ims)

  // Create a list of accessible modules
  const accessibleModules = Object.entries(permissions)
    .filter(([key, hasAccess]) => hasAccess)
    .map(([key]) => key)

  // Create a list of restricted modules
  const restrictedModules = Object.entries(permissions)
    .filter(([key, hasAccess]) => !hasAccess)
    .map(([key]) => key)

  return (
    <View width='size-6000'>
      <Heading level={1}>Welcome to Americas 275 Environment Management App!</Heading>
      
      {/* App Overview */}
      <View marginTop="size-300">
        <Heading level={2}>Application Overview</Heading>
        <Text>
          The Americas 275 Environment Management App is a comprehensive Adobe Experience Platform (AEP) 
          utility suite designed to streamline operations, testing, and management tasks for Adobe 
          professionals. This enterprise-grade application provides secure, role-based access to 
          specialized tools and services.
        </Text>
      </View>

      {/* Key Features */}
      <View marginTop="size-400">
        <Heading level={2}>Key Features</Heading>
        <Flex direction="column" gap="size-200">
          <View>
            <Heading level={3}>🔧 AEP Functions</Heading>
            <Text>
              Core Adobe Experience Platform operations including sandbox management, segment operations, 
              profile management, and comprehensive AEP overview dashboards. Includes specialized 
              Jmeter testing capabilities for performance validation.
            </Text>
          </View>
          
          <View>
            <Heading level={3}>📊 AJO Actions</Heading>
            <Text>
              Adobe Journey Optimizer tools featuring file management, API testing interfaces, 
              comprehensive documentation access, and content template migration capabilities.
            </Text>
          </View>
          
          <View>
            <Heading level={3}>🤖 AI Tooling</Heading>
            <Text>
              Advanced AI-powered utilities including enhanced prompt generation and intelligent 
              AEP profile injection systems for automated data management.
            </Text>
          </View>
          
          <View>
            <Heading level={3}>🛠️ Utilities</Heading>
            <Text>
              Essential utility services including URL shortening, cryptographic tools, data management 
              interfaces, API monitoring dashboards, and proxy management systems.
            </Text>
          </View>
        </Flex>
      </View>

      {/* Security & Access Control */}
      <View marginTop="size-400">
        <Heading level={2}>🔐 Security & Access Control</Heading>
        <Text>
          This application implements enterprise-grade security with role-based access control. 
          Each module is protected by email-based authorization, ensuring only authorized personnel 
          can access sensitive functionality. All access attempts are logged for audit purposes.
        </Text>
      </View>

      {/* Technical Architecture */}
      <View marginTop="size-400">
        <Heading level={2}>🏗️ Technical Architecture</Heading>
        <Text>
          Built on Adobe App Builder with React Spectrum UI components, this application runs 
          in the Experience Cloud shell and integrates with Adobe I/O Runtime for serverless 
          backend operations. The modular architecture supports 20+ specialized runtime actions 
          for various AEP and Adobe Journey Optimizer operations.
        </Text>
      </View>
      
      {/* Debug Information */}
      {ims && (
        <Well marginTop="size-300">
          <Heading level={3}>User Information (Debug)</Heading>
          <Flex direction="column" gap="size-200">
            <Flex alignItems="center" gap="size-100">
              <Text>Email:</Text>
              <Text UNSAFE_style={{ fontFamily: 'monospace' }}>{userEmail || 'Not available'}</Text>
            </Flex>
            
            {/* Access Permissions Summary */}
            <View>
              <Text UNSAFE_style={{ fontWeight: '600', marginBottom: '8px' }}>
                Access Permissions:
              </Text>
              <Flex direction="column" gap="size-100">
                {Object.entries(permissions).map(([module, hasAccess]) => (
                  <Flex key={module} alignItems="center" gap="size-100">
                    <Text UNSAFE_style={{ fontSize: '12px', minWidth: '140px' }}>
                      {module.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
                    </Text>
                    <StatusLight 
                      variant={hasAccess ? 'positive' : 'negative'}
                      UNSAFE_style={{ fontSize: '10px' }}
                    >
                      {hasAccess ? 'Granted' : 'Denied'}
                    </StatusLight>
                  </Flex>
                ))}
              </Flex>
            </View>

            {/* Accessible Modules */}
            {accessibleModules.length > 0 && (
              <View>
                <Text UNSAFE_style={{ fontWeight: '600', marginBottom: '8px', color: '#059669' }}>
                  ✅ Accessible Modules ({accessibleModules.length}):
                </Text>
                <Flex wrap gap="size-100">
                  {accessibleModules.map(module => (
                    <Text 
                      key={module}
                      UNSAFE_style={{ 
                        fontSize: '11px',
                        backgroundColor: '#D1FAE5',
                        color: '#065F46',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontFamily: 'monospace'
                      }}
                    >
                      {module.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </Text>
                  ))}
                </Flex>
              </View>
            )}

            {/* Restricted Modules */}
            {restrictedModules.length > 0 && (
              <View>
                <Text UNSAFE_style={{ fontWeight: '600', marginBottom: '8px', color: '#DC2626' }}>
                  ❌ Restricted Modules ({restrictedModules.length}):
                </Text>
                <Flex wrap gap="size-100">
                  {restrictedModules.map(module => (
                    <Text 
                      key={module}
                      UNSAFE_style={{ 
                        fontSize: '11px',
                        backgroundColor: '#FEE2E2',
                        color: '#991B1B',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontFamily: 'monospace'
                      }}
                    >
                      {module.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </Text>
                  ))}
                </Flex>
              </View>
            )}

            {/* Summary */}
            <View marginTop="size-200">
              <Text UNSAFE_style={{ fontSize: '12px', color: '#6B7280' }}>
                Total modules: {Object.keys(permissions).length} | 
                Accessible: {accessibleModules.length} | 
                Restricted: {restrictedModules.length}
              </Text>
            </View>
          </Flex>
        </Well>
      )}
    </View>
  )
}
