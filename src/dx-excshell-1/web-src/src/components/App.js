/* 
* <license header>
*/

import React from 'react'
import { Provider, defaultTheme, Flex, View } from '@adobe/react-spectrum'
import ErrorBoundary from 'react-error-boundary'
import { HashRouter as Router, Switch, Route, Redirect } from 'react-router-dom'
import SideBar from './SideBar'
import { SidebarProvider } from './SidebarContext'
import { appFeatures } from '../appRegistry'

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

const AppRoute = ({ feature, runtime, ims }) => {
  const Component = feature.component

  if (feature.accessCheck) {
    return (
      <ProtectedRoute
        exact={feature.exact}
        path={feature.path}
        component={Component}
        runtime={runtime}
        ims={ims}
        accessCheck={feature.accessCheck}
      />
    )
  }

  return (
    <Route exact={feature.exact} path={feature.path}>
      <Component runtime={runtime} ims={ims} />
    </Route>
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
                    {appFeatures.map((feature) => (
                      <AppRoute
                        key={feature.key}
                        path={feature.path}
                        exact={feature.exact}
                        feature={feature}
                        runtime={props.runtime}
                        ims={props.ims}
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
