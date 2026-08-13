// @io-wall-ok
/**
 * Product client root — SystemProvider + providers + React Navigation.
 * Production and DST mount the same component.
 */

import { AppProviders } from '@apps/client/providers/app-providers';
import type { ClientSystemResources } from '@apps/client/providers/client-system-resources';
import { RootErrorBoundary } from '@apps/client/providers/root-error-boundary';
import type { Io } from '@pkgs/io';
import { wallIo } from '@pkgs/io';
import { SystemProvider } from '@pkgs/system/react';
import { navigationRef, setAppLinkingConfig } from '@pkgs/ui';
import { NavigationContainer } from '@react-navigation/native';
import { type ReactNode, useMemo } from 'react';

import { RootNavigator } from './navigation/root-navigator';
import { appLinking } from './navigation/types';

setAppLinkingConfig(appLinking.config as never);

export type AppProps = {
  readonly io?: Io;
  readonly resources?: ClientSystemResources;
};

export function App(props: AppProps): ReactNode {
  const io = useMemo(() => props.io ?? wallIo(), [props.io]);
  return (
    <SystemProvider
      io={io}
      {...(props.resources !== undefined ? { resources: props.resources } : {})}
    >
      <RootErrorBoundary>
        <NavigationContainer ref={navigationRef} linking={appLinking as never}>
          <AppProviders>
            <RootNavigator />
          </AppProviders>
        </NavigationContainer>
      </RootErrorBoundary>
    </SystemProvider>
  );
}
