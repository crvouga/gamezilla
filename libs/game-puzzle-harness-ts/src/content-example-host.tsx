import { AuthClientProvider } from '@libs/auth-client-ts/auth-client-provider';
import { AuthModalsProvider } from '@libs/auth-client-ts/auth-modals-provider';
import { ConfigServiceProvider } from '@libs/auth-client-ts/config-service-context';
import { LoggerProvider } from '@pkgs/logger-client-ts/solid';
import { createNoopLogger } from '@pkgs/logger-shared-ts/logger';
import { AppRouterProvider } from '@pkgs/ui-root-client-ts/app-router';
import { createRouter, memoryHistory } from '@solidjs/router';
import type { JSX } from '@solidjs/web';
import { contentExampleAuth } from './content-example-auth';

/** The reference app also hosts the policy denial surface's identity and navigation dependencies. */
export function ContentExampleHost(props: {
  children: JSX.Element;
}): JSX.Element {
  // The single route renders this host's own children, so its router is too.
  const Router = createRouter({
    routes: [{ path: '*', component: () => props.children }],
    history: memoryHistory(),
  });
  return (
    <LoggerProvider value={createNoopLogger()}>
      <ConfigServiceProvider value={{ getApiUrl: () => '' }}>
        <AuthClientProvider port={contentExampleAuth()}>
          <Router>
            {(route) => (
              <AppRouterProvider>
                <AuthModalsProvider>{route.children}</AuthModalsProvider>
              </AppRouterProvider>
            )}
          </Router>
        </AuthClientProvider>
      </ConfigServiceProvider>
    </LoggerProvider>
  );
}
