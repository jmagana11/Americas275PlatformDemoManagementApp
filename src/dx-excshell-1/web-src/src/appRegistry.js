import Data from '@spectrum-icons/workflow/Data'
import GraphBarVertical from '@spectrum-icons/workflow/GraphBarVertical'
import TextBulletedHierarchy from '@spectrum-icons/workflow/TextBulletedHierarchy'
import Beaker from '@spectrum-icons/workflow/Beaker'
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
import HomeIcon from '@spectrum-icons/workflow/Home'

import { Home as HomeComponent } from './components/Home'
import { About } from './components/About'
import SegmentRefresh from './components/SegmentRefresh'
import SandboxManagement from './components/SandboxManagement'
import JmeterTesting from './components/JmeterTesting'
import AEPOverview from './components/AEPOverview'
import AEPProfileInjector from './components/AEPProfileInjectorSimplified'
import JsonEditor from './components/JsonEditor'
import AIPromptGeneratorEnhanced from './components/AIPromptGeneratorEnhanced'
import ApiMonitor from './components/ApiMonitor'
import ProxyManager from './components/ProxyManager'
import CampaignTrigger from './components/CampaignTrigger'
import DataManagement from './components/DataManagement'
import CryptoUtils from './components/CryptoUtils'
import UserManagement from './components/UserManagement'
import AIUserGuide from './components/AIUserGuide'
import URLShortener from './components/URLShortener'
import AIPromptGenerator from './components/AIPromptGenerator'
import AIApiDocumentation from './components/AIApiDocumentation'
import FileManager from './components/FileManager'
import ApiDocumentation from './components/ApiDocumentation'
import JmeterTestwoFolders from './components/JmeterTestwoFolders'
import JmeterTestWfolders from './components/JmeterTestWfolders'
import CreateSandbox from './components/CreateSandbox'
import DeleteSandbox from './components/DeleteSandbox'
import ActionsForm from './components/ActionsForm'
import ContentTemplateMigrator from './components/ContentTemplateMigrator'
import OfferSimulator from './components/OfferSimulator'
import Administration from './components/Administration'

import {
  hasAEPOverviewAccess,
  hasAIProfileInjectorAccess,
  hasAdminAccess,
  hasApiDocumentationAccess,
  hasApiProxyAccess,
  hasContentMigratorAccess,
  hasFileManagerAccess,
  hasFeatureAccess,
  hasJmeterTestingAccess,
  hasUserManagementAccess
} from './utils/accessControl'

export const NAV_SECTIONS = Object.freeze([
  {
    key: 'aep',
    title: 'AEP Functions',
    icon: Data,
    defaultExpanded: true
  },
  {
    key: 'products',
    title: 'AJO Actions',
    icon: TextBulletedHierarchy,
    defaultExpanded: false
  },
  {
    key: 'ai',
    title: 'AI Tooling',
    icon: MagicWand,
    defaultExpanded: false
  },
  {
    key: 'utilities',
    title: 'Utilities',
    icon: Preview,
    defaultExpanded: false
  }
])

export const appFeatures = Object.freeze([
  {
    key: 'home',
    path: '/',
    exact: true,
    component: HomeComponent,
    nav: {
      label: 'Home',
      icon: HomeIcon
    }
  },
  {
    key: 'aepOverview',
    path: '/AEPOverview',
    component: AEPOverview,
    accessCheck: hasAEPOverviewAccess,
    nav: {
      section: 'aep',
      label: 'AEP Overview',
      icon: GraphBarVertical
    }
  },
  {
    key: 'aepProfileInjector',
    path: '/AEPProfileInjector',
    component: AEPProfileInjector,
    accessCheck: hasAIProfileInjectorAccess,
    nav: {
      section: 'ai',
      label: 'AI AEP Profile Injector',
      icon: Data
    }
  },
  {
    key: 'jsonEditor',
    path: '/JsonEditor',
    component: JsonEditor
  },
  {
    key: 'aiPromptGeneratorEnhanced',
    path: '/AIPromptGeneratorEnhanced',
    component: AIPromptGeneratorEnhanced,
    nav: {
      section: 'ai',
      label: 'AI Prompt Generator',
      icon: MagicWand
    }
  },
  {
    key: 'apiMonitor',
    path: '/ApiMonitor',
    component: ApiMonitor,
    nav: {
      section: 'utilities',
      label: 'API Monitor',
      icon: WebPage
    }
  },
  {
    key: 'administration',
    path: '/Administration',
    component: Administration,
    accessCheck: hasAdminAccess,
    nav: {
      section: 'utilities',
      label: 'Administration',
      icon: UserGroup
    }
  },
  {
    key: 'proxyManager',
    path: '/ProxyManager',
    component: ProxyManager,
    accessCheck: hasApiProxyAccess,
    nav: {
      section: 'utilities',
      label: 'API Proxy',
      icon: Preview
    }
  },
  {
    key: 'campaignTrigger',
    path: '/CampaignTrigger',
    component: CampaignTrigger,
    nav: {
      section: 'products',
      label: 'Campaign Trigger'
    }
  },
  {
    key: 'dataManagement',
    path: '/DataManagement',
    component: DataManagement,
    nav: {
      section: 'utilities',
      label: 'Data Management',
      icon: Download
    }
  },
  {
    key: 'cryptoUtils',
    path: '/CryptoUtils',
    component: CryptoUtils,
    nav: {
      section: 'utilities',
      label: 'Crypto & Token Utils',
      icon: Key
    }
  },
  {
    key: 'userManagement',
    path: '/UserManagement',
    component: UserManagement,
    accessCheck: hasUserManagementAccess,
    nav: {
      section: 'aep',
      label: 'User Management',
      icon: UserGroup
    }
  },
  {
    key: 'aiUserGuide',
    path: '/AIUserGuide',
    component: AIUserGuide
  },
  {
    key: 'urlShortener',
    path: '/URLShortener',
    component: URLShortener,
    nav: {
      section: 'utilities',
      label: 'URL Shortener',
      icon: LinkNav
    }
  },
  {
    key: 'aiPromptGenerator',
    path: '/AIPromptGenerator',
    component: AIPromptGenerator
  },
  {
    key: 'aiApiDocumentation',
    path: '/AIApiDocumentation',
    component: AIApiDocumentation
  },
  {
    key: 'fileManager',
    path: '/FileManager',
    component: FileManager,
    accessCheck: hasFileManagerAccess
  },
  {
    key: 'apiDocumentation',
    path: '/ApiDocumentation',
    component: ApiDocumentation,
    accessCheck: hasApiDocumentationAccess,
    nav: {
      section: 'products',
      label: 'Custom Action APIs',
      icon: DocumentOutline
    }
  },
  {
    key: 'jmeterTestwoFolders',
    path: '/JmeterTestwoFolders',
    component: JmeterTestwoFolders
  },
  {
    key: 'jmeterTestWfolders',
    path: '/JmeterTestWfolders',
    component: JmeterTestWfolders
  },
  {
    key: 'createSandbox',
    path: '/CreateSandbox',
    component: CreateSandbox
  },
  {
    key: 'deleteSandbox',
    path: '/DeleteSandbox',
    component: DeleteSandbox
  },
  {
    key: 'actionsForm',
    path: '/ActionsForm',
    component: ActionsForm
  },
  {
    key: 'contentTemplateMigrator',
    path: '/ContentTemplateMigrator',
    component: ContentTemplateMigrator,
    accessCheck: hasContentMigratorAccess,
    nav: {
      section: 'products',
      label: 'Content Migrator',
      icon: Document
    }
  },
  {
    key: 'offerSimulator',
    path: '/OfferSimulator',
    component: OfferSimulator,
    nav: {
      section: 'products',
      label: 'Offer Simulator',
      icon: Gift
    }
  },
  {
    key: 'segmentRefresh',
    path: '/SegmentRefresh',
    component: SegmentRefresh
  },
  {
    key: 'jmeterTesting',
    path: '/JmeterTesting',
    component: JmeterTesting,
    accessCheck: hasJmeterTestingAccess,
    nav: {
      section: 'aep',
      label: 'Jmeter Testing',
      icon: Beaker
    }
  },
  {
    key: 'sandboxManagement',
    path: '/SandboxManagement',
    component: SandboxManagement
  },
  {
    key: 'about',
    path: '/about',
    component: About
  }
])

export function isFeatureAccessible(feature, ims, accessState) {
  return hasFeatureAccess(feature.key, ims, accessState)
}

export function getTopLevelNavItems(ims, accessState) {
  return appFeatures.filter((feature) => feature.nav && !feature.nav.section && isFeatureAccessible(feature, ims, accessState))
}

export function getSectionNavItems(sectionKey, ims, accessState) {
  return appFeatures.filter((feature) => (
    feature.nav &&
    feature.nav.section === sectionKey &&
    isFeatureAccessible(feature, ims, accessState)
  ))
}
