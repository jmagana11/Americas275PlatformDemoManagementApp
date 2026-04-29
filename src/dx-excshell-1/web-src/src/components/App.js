/* 
* <license header>
*/

import React from 'react'
import { Provider, defaultTheme, Flex, View } from '@adobe/react-spectrum'
import ErrorBoundary from 'react-error-boundary'
import { HashRouter as Router, Switch, Route, Redirect } from 'react-router-dom'
import { 
  hasUserManagementAccess,
  hasAEPOverviewAccess,
  hasJmeterTestingAccess,
  hasFileManagerAccess,
  hasApiDocumentationAccess,
  hasContentMigratorAccess,
  hasAIProfileInjectorAccess,
  hasApiProxyAccess
} from '../utils/accessControl'
import SideBar from './SideBar'
import { SidebarProvider } from './SidebarContext'
import { Home } from './Home'
import { About } from './About'
import SegmentRefresh from './SegmentRefresh'
import SandboxManagement from './SandboxManagement'
import JmeterTesting from './JmeterTesting'
import AEPOverview from './AEPOverview'
import AEPProfileInjector from './AEPProfileInjectorSimplified'
import JsonEditor from './JsonEditor'
import AIPromptGeneratorEnhanced from './AIPromptGeneratorEnhanced'
import ApiMonitor from './ApiMonitor'
import ProxyManager from './ProxyManager'
import CampaignTrigger from './CampaignTrigger'
import DataManagement from './DataManagement'
import CryptoUtils from './CryptoUtils'
import UserManagement from './UserManagement'
import AIUserGuide from './AIUserGuide'
import URLShortener from './URLShortener'
import AIPromptGenerator from './AIPromptGenerator'
import AIApiDocumentation from './AIApiDocumentation'
import FileManager from './FileManager'
import ApiDocumentation from './ApiDocumentation'
import JmeterTestwoFolders from './JmeterTestwoFolders'
import JmeterTestWfolders from './JmeterTestWfolders'
import CreateSandbox from './CreateSandbox'
import DeleteSandbox from './DeleteSandbox'
import ActionsForm from './ActionsForm'
import ContentTemplateMigrator from './ContentTemplateMigrator'
import OfferSimulator from './OfferSimulator'

// Protected Route Component
const ProtectedRoute = ({ component: Component, runtime, ims, accessCheck, ...rest }) => {
  return (
    <Route
      {...rest}
      render={props => {
        if (!accessCheck(ims)) {
          console.log('Access denied, redirecting to home')
          return <Redirect to="/" />
        }
        return <Component {...props} runtime={runtime} ims={ims} />
      }}
    />
  )
}

function App (props) {
  console.log('runtime object:', props.runtime)
  console.log('ims object:', props.ims)

  // use exc runtime event handlers
  // respond to configuration change events (e.g. user switches org)
  props.runtime.on('configuration', ({ imsOrg, imsToken, locale }) => {
    console.log('configuration change', { imsOrg, imsToken, locale })
  })
  // respond to history change events
  props.runtime.on('history', ({ type, path }) => {
    console.log('history change', { type, path })
  })

  return (
    <ErrorBoundary onError={onError} FallbackComponent={fallbackComponent}>
      <Router>
        <Provider theme={defaultTheme} colorScheme={'light'}>
          <SidebarProvider>
            <Flex direction="row" height="100vh" width="100%">
              <SideBar ims={props.ims} />
              <View flex="1" height="100vh" UNSAFE_style={{ overflowY: 'auto' }}>
                <View padding="size-400">
                  <Switch>
                    <Route exact path='/'>
                      <Home ims={props.ims}></Home>
                    </Route>
                    <Route path='/AEPOverview'>
                      <ProtectedRoute 
                        component={AEPOverview} 
                        runtime={props.runtime} 
                        ims={props.ims}
                        accessCheck={hasAEPOverviewAccess}
                      />
                    </Route>
                    <Route path='/AEPProfileInjector'>
                      <ProtectedRoute 
                        component={AEPProfileInjector} 
                        runtime={props.runtime} 
                        ims={props.ims}
                        accessCheck={hasAIProfileInjectorAccess}
                      />
                    </Route>
                    <Route path='/JsonEditor'>
                      <JsonEditor runtime={props.runtime} ims={props.ims}/>
                    </Route>
                    <Route path='/AIPromptGeneratorEnhanced'>
                      <AIPromptGeneratorEnhanced runtime={props.runtime} ims={props.ims}/>
                    </Route>
                    <Route path='/ApiMonitor'>
                      <ApiMonitor runtime={props.runtime} ims={props.ims}/>
                    </Route>
                    <Route path='/ProxyManager'>
                      <ProtectedRoute 
                        component={ProxyManager} 
                        runtime={props.runtime} 
                        ims={props.ims}
                        accessCheck={hasApiProxyAccess}
                      />
                    </Route>
                    <Route path='/CampaignTrigger'>
                      <CampaignTrigger runtime={props.runtime} ims={props.ims}/>
                    </Route>
                    <Route path='/DataManagement'>
                      <DataManagement runtime={props.runtime} ims={props.ims}/>
                    </Route>
                    <Route path='/CryptoUtils'>
                      <CryptoUtils runtime={props.runtime} ims={props.ims}/>
                    </Route>
                    <Route path='/UserManagement'>
                      <ProtectedRoute 
                        component={UserManagement} 
                        runtime={props.runtime} 
                        ims={props.ims}
                        accessCheck={hasUserManagementAccess}
                      />
                    </Route>
                    <Route path='/AIUserGuide'>
                      <AIUserGuide runtime={props.runtime} ims={props.ims}/>
                    </Route>
                    <Route path='/URLShortener'>
                      <URLShortener runtime={props.runtime} ims={props.ims}/>
                    </Route>
                    <Route path='/AIPromptGenerator'>
                      <AIPromptGenerator runtime={props.runtime} ims={props.ims}/>
                    </Route>
                    <Route path='/AIApiDocumentation'>
                      <AIApiDocumentation runtime={props.runtime} ims={props.ims}/>
                    </Route>
                    <Route path='/FileManager'>
                      <ProtectedRoute 
                        component={FileManager} 
                        runtime={props.runtime} 
                        ims={props.ims}
                        accessCheck={hasFileManagerAccess}
                      />
                    </Route>

                    <Route path='/ApiDocumentation'>
                      <ProtectedRoute 
                        component={ApiDocumentation} 
                        runtime={props.runtime} 
                        ims={props.ims}
                        accessCheck={hasApiDocumentationAccess}
                      />
                    </Route>
                    <Route path='/JmeterTestwoFolders'>
                      <JmeterTestwoFolders runtime={props.runtime} ims={props.ims}/>
                    </Route>
                    <Route path='/JmeterTestWfolders'>
                      <JmeterTestWfolders runtime={props.runtime} ims={props.ims}/>
                    </Route>
                    <Route path='/CreateSandbox'>
                      <CreateSandbox runtime={props.runtime} ims={props.ims}/>
                    </Route>
                    <Route path='/DeleteSandbox'>
                      <DeleteSandbox runtime={props.runtime} ims={props.ims}/>
                    </Route>
                    <Route path='/ActionsForm'>
                      <ActionsForm runtime={props.runtime} ims={props.ims}/>
                    </Route>
                    <Route path='/ContentTemplateMigrator'>
                      <ProtectedRoute 
                        component={ContentTemplateMigrator} 
                        runtime={props.runtime} 
                        ims={props.ims}
                        accessCheck={hasContentMigratorAccess}
                      />
                    </Route>
                    <Route path='/OfferSimulator'>
                      <OfferSimulator runtime={props.runtime} ims={props.ims}/>
                    </Route>
                    <Route path='/SegmentRefresh'>
                      <SegmentRefresh runtime={props.runtime} ims={props.ims}/>
                    </Route>
                    <Route path='/JmeterTesting'>
                      <ProtectedRoute 
                        component={JmeterTesting} 
                        runtime={props.runtime} 
                        ims={props.ims}
                        accessCheck={hasJmeterTestingAccess}
                      />
                    </Route>
                    <Route path='/SandboxManagement'>
                      <SandboxManagement runtime={props.runtime} ims={props.ims}/>
                    </Route>
                    <Route path='/about'>
                      <About></About>
                    </Route>
                  </Switch>
                </View>
              </View>
            </Flex>
          </SidebarProvider>
        </Provider>
      </Router>
    </ErrorBoundary>
  )

  // Methods

  // error handler on UI rendering failure
  function onError (e, componentStack) { }

  // component to show if UI fails rendering
  function fallbackComponent ({ componentStack, error }) {
    return (
      <React.Fragment>
        <h1 style={{ textAlign: 'center', marginTop: '20px' }}>
          Something went wrong :(
        </h1>
        <pre>{componentStack + '\n' + error.message}</pre>
      </React.Fragment>
    )
  }
}

export default App
