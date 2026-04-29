/* 
* <license header>
*/

import React from 'react'
import { Provider, defaultTheme, Flex, View } from '@adobe/react-spectrum'
import ErrorBoundary from 'react-error-boundary'
import { HashRouter as Router, Switch, Route, Redirect } from 'react-router-dom'
import SideBar from './SideBar'
import { SidebarProvider } from './SidebarContext'
import { appFeatures, isFeatureAccessible } from '../appRegistry'
import { buildAccessStateFromResponse, createStaticAccessState } from '../utils/accessControl'
import { loadMyAccess } from '../utils/accessManagement'

const AccessDenied = () => (
  <View padding="size-400">
    <h2>Access denied</h2>
  </View>
)

const AccessLoading = () => (
  <View padding="size-400">
    <h2>Loading access</h2>
  </View>
)

const AccessControlledRoute = ({ feature, runtime, ims, accessState, accessLoading, refreshAccess, ...rest }) => {
  const Component = feature.component
  return (
    <Route
      {...rest}
      render={props => {
        if (!isFeatureAccessible(feature, ims, accessState)) {
          if (feature.key === 'administration' && accessLoading) {
            return <AccessLoading />
          }
          if (feature.path === '/') {
            return <AccessDenied />
          }
          console.log('Access denied, redirecting to home')
          return <Redirect to="/" />
        }
        return <Component {...props} runtime={runtime} ims={ims} accessState={accessState} refreshAccess={refreshAccess} />
      }}
    />
  )
}

const AppRoute = ({ feature, runtime, ims, accessState, accessLoading, refreshAccess }) => {
  return (
    <AccessControlledRoute
      exact={feature.exact}
      path={feature.path}
      feature={feature}
      runtime={runtime}
      ims={ims}
      accessState={accessState}
      accessLoading={accessLoading}
      refreshAccess={refreshAccess}
    />
  )
}

function App (props) {
  const [accessState, setAccessState] = React.useState(() => createStaticAccessState())
  const [accessLoading, setAccessLoading] = React.useState(false)

  const refreshAccess = React.useCallback(async () => {
    setAccessLoading(true)
    try {
      const result = await loadMyAccess(props.ims)
      setAccessState(buildAccessStateFromResponse(result))
    } catch (error) {
      setAccessState(createStaticAccessState({
        source: 'fallback',
        loadError: error.message || 'Access policies unavailable',
        userEmail: props.ims && props.ims.profile && props.ims.profile.email
      }))
    } finally {
      setAccessLoading(false)
    }
  }, [props.ims])

  React.useEffect(() => {
    refreshAccess()
  }, [refreshAccess])

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
              <SideBar ims={props.ims} accessState={accessState} />
              <View flex="1" height="100vh" UNSAFE_style={{ overflowY: 'auto' }}>
                <View padding="size-400">
                  <Switch>
                    {appFeatures.map((feature) => (
                      <AppRoute
                        key={feature.key}
                        path={feature.path}
                        exact={feature.exact}
                        feature={feature}
                        runtime={props.runtime}
                        ims={props.ims}
                        accessState={accessState}
                        accessLoading={accessLoading}
                        refreshAccess={refreshAccess}
                      />
                    ))}
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
