/* 
* <license header>
*/

import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  View,
  Flex,
  ActionButton,
  Text,
  Divider
} from '@adobe/react-spectrum'
import { useSidebar } from './SidebarContext'
import { 
  hasUserManagementAccess, 
  hasAEPOverviewAccess,
  hasJmeterTestingAccess,
  hasFileManagerAccess,
  hasApiDocumentationAccess,
  hasContentMigratorAccess,
  hasAIProfileInjectorAccess,
  hasApiProxyAccess,
  logAccessControlInfo 
} from '../utils/accessControl'
import ChevronDown from '@spectrum-icons/workflow/ChevronDown'
import ChevronRight from '@spectrum-icons/workflow/ChevronRight'
import Menu from '@spectrum-icons/workflow/Menu'
import Close from '@spectrum-icons/workflow/Close'
import Home from '@spectrum-icons/workflow/Home'
import Data from '@spectrum-icons/workflow/Data'
import GraphBarVertical from '@spectrum-icons/workflow/GraphBarVertical'
import TextBulletedHierarchy from '@spectrum-icons/workflow/TextBulletedHierarchy'
import Refresh from '@spectrum-icons/workflow/Refresh'
import Beaker from '@spectrum-icons/workflow/Beaker'
import FileCode from '@spectrum-icons/workflow/FileCode'
import TestAB from '@spectrum-icons/workflow/TestAB'
import DocumentOutline from '@spectrum-icons/workflow/DocumentOutline'
import MagicWand from '@spectrum-icons/workflow/MagicWand'
import UserGroup from '@spectrum-icons/workflow/UserGroup'
import Key from '@spectrum-icons/workflow/Key'
import Download from '@spectrum-icons/workflow/Download'
import LinkNav from '@spectrum-icons/workflow/LinkNav'
import WebPage from '@spectrum-icons/workflow/WebPage'
import Preview from '@spectrum-icons/workflow/Preview'
import Document from '@spectrum-icons/workflow/Document'
import Gift from '@spectrum-icons/workflow/Gift'

function SideBar({ ims }) {
  const { sidebarCollapsed, toggleSidebar } = useSidebar()
  
  // Log access control info when component mounts or ims changes
  React.useEffect(() => {
    if (ims) {
      logAccessControlInfo(ims)
    }
  }, [ims])
  
  // State for each section's collapsed status
  const [sectionStates, setSectionStates] = useState({
    aep: true,           // Adobe Experience Platform - expanded by default
    products: false,     // Product Recommendations & Orders
    ai: false,          // AI Tooling
    utilities: false    // Utilities
  })

  const toggleSection = (section) => {
    // If sidebar is collapsed, expand it first and then expand the section
    if (sidebarCollapsed) {
      toggleSidebar()
      setSectionStates(prev => ({
        ...prev,
        [section]: true
      }))
    } else {
      // Normal toggle behavior when sidebar is expanded
      setSectionStates(prev => ({
        ...prev,
        [section]: !prev[section]
      }))
    }
  }

  const SectionHeader = ({ section, title, icon: Icon, isExpanded, onClick }) => (
    <ActionButton
      isQuiet
      onPress={onClick}
      width="100%"
      UNSAFE_style={{
        justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
        padding: sidebarCollapsed ? '8px' : '6px 8px',
        borderRadius: '4px',
        margin: '1px 0',
        backgroundColor: 'transparent',
        border: 'none',
        minHeight: '32px'
      }}
    >
      {sidebarCollapsed ? (
        <Icon size="S" UNSAFE_style={{ color: '#6B7280' }} />
      ) : (
        <Flex alignItems="center" gap="size-75" width="100%">
          <Text 
            UNSAFE_style={{ 
              color: '#374151', 
              fontWeight: '600',
              fontSize: '13px',
              flexGrow: 1,
              textAlign: 'left',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0
            }}
          >
            {title}
          </Text>
          {isExpanded ? 
            <ChevronDown size="XS" UNSAFE_style={{ color: '#6B7280', flexShrink: 0 }} /> : 
            <ChevronRight size="XS" UNSAFE_style={{ color: '#6B7280', flexShrink: 0 }} />
          }
        </Flex>
      )}
    </ActionButton>
  )

  const NavItem = ({ to, children, icon: Icon }) => (
    <NavLink 
      to={to}
      className="SideNav-itemLink" 
      activeClassName="is-selected"
      style={{ textDecoration: 'none' }}
    >
      <Flex 
        alignItems="center" 
        gap="size-75"
        UNSAFE_style={{
          padding: sidebarCollapsed ? '6px' : '4px 8px 4px 12px',
          margin: '1px 0',
          borderRadius: '3px',
          color: '#6B7280',
          fontSize: '12px',
          transition: 'all 0.2s ease',
          cursor: 'pointer',
          minHeight: '28px',
          justifyContent: sidebarCollapsed ? 'center' : 'flex-start'
        }}
        UNSAFE_className="nav-item-hover"
      >
        {sidebarCollapsed && Icon && <Icon size="XS" UNSAFE_style={{ flexShrink: 0 }} />}
        {!sidebarCollapsed && (
          <Text 
            UNSAFE_style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
              flex: 1
            }}
          >
            {children}
          </Text>
        )}
      </Flex>
    </NavLink>
  )

  return (
    <View 
      backgroundColor="gray-50" 
      height="100vh"
      UNSAFE_style={{
        width: sidebarCollapsed ? '40px' : '180px', // Custom width between size-1700 and size-1800
        borderRight: '1px solid #E5E7EB',
        transition: 'width 0.3s ease',
        overflowY: 'auto',
        overflowX: 'hidden'
      }}
    >
      <Flex direction="column" height="100%">
        {/* Header with collapse toggle */}
        <View 
          padding="size-200"
          UNSAFE_style={{ 
            borderBottom: '1px solid #E5E7EB',
            backgroundColor: '#F9FAFB'
          }}
        >
          <Flex alignItems="center" justifyContent="space-between">
            {!sidebarCollapsed && (
              <Text 
                UNSAFE_style={{ 
                  fontWeight: '700',
                  fontSize: '16px',
                  color: '#111827'
                }}
              >
                Americas 275
              </Text>
            )}
            <ActionButton
              isQuiet
              onPress={toggleSidebar}
              UNSAFE_style={{ minWidth: 'auto' }}
            >
              {sidebarCollapsed ? <Menu size="M" /> : <Close size="M" />}
            </ActionButton>
          </Flex>
        </View>

        {/* Navigation Content */}
        <View padding="size-75" flex>
          <Flex direction="column" gap="size-50">
            
            {/* Home */}
            <NavItem to="/" icon={Home}>
              Home
            </NavItem>

            <Divider size="S" marginY="size-100" />

            {/* AEP Functions Section */}
            <View>
              <SectionHeader
                section="aep"
                title="AEP Functions"
                icon={Data}
                isExpanded={sectionStates.aep}
                onClick={() => toggleSection('aep')}
              />
              {sectionStates.aep && !sidebarCollapsed && (
                <View marginStart="size-0">
                  {hasAEPOverviewAccess(ims) && (
                    <NavItem to="/AEPOverview" icon={GraphBarVertical}>
                      AEP Overview
                    </NavItem>
                  )}
                  {hasUserManagementAccess(ims) && (
                    <NavItem to="/UserManagement" icon={UserGroup}>
                      User Management
                    </NavItem>
                  )}
                  {hasJmeterTestingAccess(ims) && (
                    <NavItem to="/JmeterTesting" icon={Beaker}>
                      Jmeter Testing
                    </NavItem>
                  )}
                </View>
              )}
            </View>

            {/* AJO Actions Section */}
            <View>
              <SectionHeader
                section="products"
                title="AJO Actions"
                icon={TextBulletedHierarchy}
                isExpanded={sectionStates.products}
                onClick={() => toggleSection('products')}
              />
              {sectionStates.products && !sidebarCollapsed && (
                <View marginStart="size-0">
                  {hasApiDocumentationAccess(ims) && (
                    <NavItem to="/ApiDocumentation" icon={DocumentOutline}>
                      Custom Action APIs
                    </NavItem>
                  )}
                  {hasContentMigratorAccess(ims) && (
                    <NavItem to="/ContentTemplateMigrator" icon={Document}>
                      Content Migrator
                    </NavItem>
                  )}
                  <NavItem to="/CampaignTrigger">
                    Campaign Trigger
                  </NavItem>
                  <NavItem to="/OfferSimulator" icon={Gift}>
                    Offer Simulator
                  </NavItem>
                </View>
              )}
            </View>

            {/* AI Tooling Section */}
            <View>
              <SectionHeader
                section="ai"
                title="AI Tooling"
                icon={MagicWand}
                isExpanded={sectionStates.ai}
                onClick={() => toggleSection('ai')}
              />
              {sectionStates.ai && !sidebarCollapsed && (
                <View marginStart="size-0">
                  <NavItem to="/AIPromptGeneratorEnhanced" icon={MagicWand}>
                    AI Prompt Generator
                  </NavItem>
                  {hasAIProfileInjectorAccess(ims) && (
                    <NavItem to="/AEPProfileInjector" icon={Data}>
                      AI AEP Profile Injector
                    </NavItem>
                  )}
                </View>
              )}
            </View>

            {/* Utilities Section */}
            <View>
              <SectionHeader
                section="utilities"
                title="Utilities"
                icon={Preview}
                isExpanded={sectionStates.utilities}
                onClick={() => toggleSection('utilities')}
              />
              {sectionStates.utilities && !sidebarCollapsed && (
                <View marginStart="size-0">
                  <NavItem to="/URLShortener" icon={LinkNav}>
                    URL Shortener
                  </NavItem>
                  <NavItem to="/CryptoUtils" icon={Key}>
                    Crypto & Token Utils
                  </NavItem>
                  <NavItem to="/DataManagement" icon={Download}>
                    Data Management
                  </NavItem>
                  <NavItem to="/ApiMonitor" icon={WebPage}>
                    API Monitor
                  </NavItem>
                  {hasApiProxyAccess(ims) && (
                    <NavItem to="/ProxyManager" icon={Preview}>
                      API Proxy
                    </NavItem>
                  )}
                </View>
              )}
            </View>

          </Flex>
        </View>
      </Flex>
    </View>
  )
}

export default SideBar
