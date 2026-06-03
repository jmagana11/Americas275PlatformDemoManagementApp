const fs = require('fs')
const path = require('path')

const repoRoot = path.resolve(__dirname, '../../..')
const appRegistryPath = path.join(repoRoot, 'src/dx-excshell-1/web-src/src/appRegistry.js')
const appPath = path.join(repoRoot, 'src/dx-excshell-1/web-src/src/components/App.js')
const indexPath = path.join(repoRoot, 'src/dx-excshell-1/web-src/src/index.js')
const sideBarPath = path.join(repoRoot, 'src/dx-excshell-1/web-src/src/components/SideBar.js')
const { FEATURE_ACCESS_DEFINITIONS } = require('../actions/shared/accessPolicy')

const expectedRoutes = [
  '/',
  '/AEPOverview',
  '/AEPProfileInjector',
  '/JsonEditor',
  '/AIPromptGeneratorEnhanced',
  '/ApiMonitor',
  '/Administration',
  '/ProxyManager',
  '/CampaignTrigger',
  '/DataManagement',
  '/CryptoUtils',
  '/UserManagement',
  '/AIUserGuide',
  '/URLShortener',
  '/AIPromptGenerator',
  '/AIApiDocumentation',
  '/FileManager',
  '/ApiDocumentation',
  '/JmeterTestwoFolders',
  '/JmeterTestWfolders',
  '/CreateSandbox',
  '/DeleteSandbox',
  '/ActionsForm',
  '/ContentTemplateMigrator',
  '/OfferSimulator',
  '/SegmentRefresh',
  '/JmeterTesting',
  '/SandboxManagement',
  '/about'
]

const expectedNavLabels = [
  'Home',
  'AEP Overview',
  'User Management',
  'Jmeter Testing',
  'Custom Action APIs',
  'Content Migrator',
  'Campaign Trigger',
  'Offer Decisioning Studio',
  'AI Prompt Generator',
  'AI AEP Profile Injector',
  'URL Shortener',
  'Crypto & Token Utils',
  'Data Management',
  'API Monitor',
  'Administration',
  'API Proxy'
]

function readSource(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

describe('frontend app registry', () => {
  test('keeps all existing route paths in the registry', () => {
    const registry = readSource(appRegistryPath)

    for (const routePath of expectedRoutes) {
      expect(registry).toContain(`path: '${routePath}'`)
    }
  })

  test('keeps current visible sidebar labels in the registry', () => {
    const registry = readSource(appRegistryPath)

    for (const label of expectedNavLabels) {
      expect(registry).toContain(`label: '${label}'`)
    }
  })

  test('keeps access policy coverage aligned with registry feature keys', () => {
    const registry = readSource(appRegistryPath)

    for (const definition of FEATURE_ACCESS_DEFINITIONS) {
      expect(registry).toContain(`key: '${definition.key}'`)
    }
  })

  test('drives App routes and SideBar navigation from the registry', () => {
    const app = readSource(appPath)
    const sideBar = readSource(sideBarPath)

    expect(app).toContain("import { appFeatures, isFeatureAccessible } from '../appRegistry'")
    expect(app).toContain('appFeatures.map')
    expect(app).toContain('path={feature.path}')
    expect(app).toContain('exact={feature.exact}')
    expect(app).not.toContain("Route path='/AEPOverview'")
    expect(app).not.toContain("Route path='/ContentTemplateMigrator'")

    expect(sideBar).toContain("from '../appRegistry'")
    expect(sideBar).toContain('NAV_SECTIONS.map')
    expect(sideBar).toContain('getSectionNavItems')
    expect(sideBar).not.toContain('hasUserManagementAccess')
    expect(sideBar).not.toContain('hasContentMigratorAccess')
  })

  test('keeps local raw bootstrap useful for access-controlled navigation', () => {
    const index = readSource(indexPath)

    expect(index).toContain("email: 'jmagana@adobe.com'")
    expect(index).toContain("userId: 'local-development-user'")
  })
})
