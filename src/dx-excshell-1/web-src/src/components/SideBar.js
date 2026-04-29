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
import { logAccessControlInfo } from '../utils/accessControl'
import { getSectionNavItems, getTopLevelNavItems, NAV_SECTIONS } from '../appRegistry'
import ChevronDown from '@spectrum-icons/workflow/ChevronDown'
import ChevronRight from '@spectrum-icons/workflow/ChevronRight'
import Menu from '@spectrum-icons/workflow/Menu'
import Close from '@spectrum-icons/workflow/Close'

function SideBar({ ims }) {
  const { sidebarCollapsed, toggleSidebar } = useSidebar()
  
  // Log access control info when component mounts or ims changes
  React.useEffect(() => {
    if (ims) {
      logAccessControlInfo(ims)
    }
  }, [ims])
  
  // State for each section's collapsed status
  const [sectionStates, setSectionStates] = useState(() => NAV_SECTIONS.reduce((states, section) => {
    states[section.key] = section.defaultExpanded
    return states
  }, {}))

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

  const NavItem = ({ item }) => {
    const Icon = item.nav.icon
    return (
      <NavLink
        to={item.path}
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
              {item.nav.label}
            </Text>
          )}
        </Flex>
      </NavLink>
    )
  }

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
            
            {getTopLevelNavItems(ims).map((item) => (
              <NavItem key={item.key} item={item} />
            ))}

            <Divider size="S" marginY="size-100" />

            {NAV_SECTIONS.map((section) => (
              <View key={section.key}>
                <SectionHeader
                  section={section.key}
                  title={section.title}
                  icon={section.icon}
                  isExpanded={sectionStates[section.key]}
                  onClick={() => toggleSection(section.key)}
                />
                {sectionStates[section.key] && !sidebarCollapsed && (
                  <View marginStart="size-0">
                    {getSectionNavItems(section.key, ims).map((item) => (
                      <NavItem key={item.key} item={item} />
                    ))}
                  </View>
                )}
              </View>
            ))}

          </Flex>
        </View>
      </Flex>
    </View>
  )
}

export default SideBar
