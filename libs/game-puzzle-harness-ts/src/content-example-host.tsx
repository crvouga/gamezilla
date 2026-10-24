import { AuthClientProvider } from '@libs/auth-client-ts/auth-client-provider';
import { AuthModalsProvider } from '@libs/auth-client-ts/auth-modals-provider';
import { ConfigServiceProvider } from '@libs/auth-client-ts/config-service-context';
import { LoggerProvider } from '@pkgs/logger-client-ts/solid';
import { createNoopLogger } from '@pkgs/logger-shared-ts/logger';
import { AppRouterProvider } from '@pkgs/ui-root-client-ts/app-router';
import { createMemoryHistory, MemoryRouter, Route } from '@solidjs/router';
import type { JSX } from 'solid-js';
import { contentExampleAuth } from './content-example-auth';

/** The reference app also hosts the policy denial surface's identity and navigation dependencies. */
export function ContentExampleHost(props: {
  children: JSX.Element;
}): JSX.Element {
  return (
    <LoggerProvider value={createNoopLogger()}>
      <ConfigServiceProvider value={{ getApiUrl: () => '' }}>
        <AuthClientProvider port={contentExampleAuth()}>
          <MemoryRouter
            history={createMemoryHistory()}
            root={(route) => (
              <AppRouterProvider>
                <AuthModalsProvider>{route.children}</AuthModalsProvider>
              </AppRouterProvider>
            )}
          >
            <Route path="*" component={() => props.children} />
          </MemoryRouter>
        </AuthClientProvider>
      </ConfigServiceProvider>
    </LoggerProvider>
  );
}
