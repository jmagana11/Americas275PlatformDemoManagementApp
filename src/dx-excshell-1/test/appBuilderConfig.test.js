const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const repoRoot = path.resolve(__dirname, '../../..')
const extensionRoot = path.join(repoRoot, 'src/dx-excshell-1')
const extConfigPath = path.join(extensionRoot, 'ext.config.yaml')
const packageJsonPath = path.join(repoRoot, 'package.json')

function getDeclaredActions() {
  const config = fs.readFileSync(extConfigPath, 'utf8')
  return [...config.matchAll(/\n {8}([A-Za-z0-9_-]+):\n {10}function: ([^\n]+)/g)]
    .map((match) => ({
      name: match[1],
      functionPath: match[2].trim()
    }))
}

function listRepoFiles() {
  return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: repoRoot,
    encoding: 'utf8'
  })
    .split('\n')
    .filter(Boolean)
}

describe('App Builder configuration safety', () => {
  test('declares every deployed action with an existing function file', () => {
    const declaredActions = getDeclaredActions()

    expect(declaredActions).toHaveLength(39)
    for (const action of declaredActions) {
      expect(action.functionPath).toMatch(/^actions\/[^/]+\/index\.js$/)
      expect(fs.existsSync(path.join(extensionRoot, action.functionPath))).toBe(true)
    }
  })

  test('does not leave undeclared action directories deployable by accident', () => {
    const declaredFunctionPaths = new Set(getDeclaredActions().map((action) => action.functionPath))
    const actionDirs = fs.readdirSync(path.join(extensionRoot, 'actions'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `actions/${entry.name}/index.js`)
      .filter((functionPath) => fs.existsSync(path.join(extensionRoot, functionPath)))

    const undeclared = actionDirs.filter((functionPath) => !declaredFunctionPaths.has(functionPath))
    expect(undeclared).toEqual([])
  })

  test('keeps known credential values out of tracked source', () => {
    const blockedPatterns = [
      ['59C7440F', '5DE147EA0A495EB3'],
      ['A79662A5', '5DE67F540A495CAC'],
      ['4b131a39', '664744c0b27fa587bb33421e'],
      ['c4a0b8e8', 'cd0a48918412d22dd9b0c7f5'],
      ['1526bae8', 'c7b4409eb2e6147cb0df3f8d'],
      ['5cd70dc2', '-58e9-46f6-9672-81d2fdc2cc6f'],
      ['p8e-Ox', '9i8c-mkYo_ds3EAv-HoIKusP9GLX0O'],
      ['624e3d18', '59294c41b4d1a4da69664348'],
      ['968ce106', 'd3b1444295206a084d7b43f2'],
      ['348327fd', 'af98449e80d72f0788d750cc'],
      ['348327f8', '-6c1b-4d1f-870f-3371fbc8352a'],
      ['b5154b39', '283f44b5982a5c3a9e3aeb90'],
      ['b5154c17', '60bb48a8855b7cc44418b68b']
    ].map((parts) => new RegExp(parts.join('')))

    const scannedFiles = listRepoFiles()
      .filter((file) => !file.startsWith('node_modules/'))
      .filter((file) => !file.startsWith('dist/'))
      .filter((file) => !file.startsWith('.parcel-cache/'))
      .filter((file) => file !== '.env')
      .filter((file) => !file.startsWith('.aio/'))

    const offenders = []
    for (const file of scannedFiles) {
      const absoluteFile = path.join(repoRoot, file)
      if (!fs.existsSync(absoluteFile) || fs.statSync(absoluteFile).isDirectory()) {
        continue
      }

      const content = fs.readFileSync(absoluteFile, 'utf8')
      if (blockedPatterns.some((pattern) => pattern.test(content))) {
        offenders.push(file)
      }
      if (/AZURE_VISION_KEY\s*=\s*['"][^'"]+['"]/.test(content)) {
        offenders.push(file)
      }
    }

    expect(offenders).toEqual([])
  })

  test('declares direct dependencies that source imports directly', () => {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    const dependencies = packageJson.dependencies || {}

    expect(dependencies).toHaveProperty('@azure/storage-blob')
    expect(dependencies).toHaveProperty('uuid')
    expect(dependencies).toHaveProperty('prop-types')
  })

  test('uses canonical env sources for known duplicate-valued app config', () => {
    const config = fs.readFileSync(extConfigPath, 'utf8')

    expect(config).toContain('MS_APP_ROLE_ID: $MS_APP_ROLE_ID')
    expect(config).not.toContain('$MA1HOL_MS_APP_ROLE_ID')
    expect(config).not.toContain('$POT5HOL_MS_APP_ROLE_ID')
    expect(config).not.toContain('$CAMPAIGN_TRIGGER_CLIENT_ID')
    expect(config).not.toContain('$CAMPAIGN_TRIGGER_CLIENT_SECRET')
    expect(config).not.toContain('$CAMPAIGN_TRIGGER_IMS_ORG')
    expect(config).toContain('CAMPAIGN_TRIGGER_SCOPE: $CAMPAIGN_TRIGGER_SCOPE')
    expect(config).toContain('CAMPAIGN_TRIGGER_SANDBOX: $CAMPAIGN_TRIGGER_SANDBOX')
  })
})
