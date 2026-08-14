// @io-wall-ok
/**
 * Product client root — SystemProvider + providers + React Navigation.
 * Production and DST mount the same component.
 * Embedded hosts (multi-App playground) pass `embedded` for an isolated nav tree.
 */

import { AppProviders } from '@apps/client/providers/app-providers';
import type { ClientSystemResources } from '@apps/client/providers/client-system-resources';
import { RootErrorBoundary } from '@apps/client/providers/root-error-boundary';
import type { Io } from '@pkgs/io';
import { wallIo } from '@pkgs/io';
import { SystemProvider } from '@pkgs/system/react';
import {
  type AppNavigationRef,
  NavigationRefProvider,
  navigationRef,
  setAppLinkingConfig,
} from '@pkgs/ui';
import {
  NavigationContainer,
  NavigationIndependentTree,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { type ReactNode, useMemo } from 'react';

import { RootNavigator } from './navigation/root-navigator';
import { appLinking } from './navigation/types';

setAppLinkingConfig(appLinking.config as never);

export type AppProps = {
  readonly io?: Io;
  readonly resources?: ClientSystemResources;
  /**
   * When true, this App owns an isolated navigation tree (no URL linking /
   * document title) so multiple product Apps can mount in one page.
   */
  readonly embedded?: boolean;
};

function AppNavigation(props: {
  readonly embedded: boolean;
  readonly children: ReactNode;
}): ReactNode {
  const embeddedRef = useNavigationContainerRef();
  if (!props.embedded) {
    return (
      <NavigationRefProvider navigationRef={navigationRef}>
        <NavigationContainer ref={navigationRef} linking={appLinking as never}>
          {props.children}
        </NavigationContainer>
      </NavigationRefProvider>
    );
  }
  const ref = embeddedRef as unknown as AppNavigationRef;
  return (
    <NavigationIndependentTree>
      <NavigationRefProvider navigationRef={ref}>
        <NavigationContainer
          ref={embeddedRef}
          documentTitle={{ enabled: false }}
        >
          {props.children}
        </NavigationContainer>
      </NavigationRefProvider>
    </NavigationIndependentTree>
  );
}

export function App(props: AppProps): ReactNode {
  const io = useMemo(() => props.io ?? wallIo(), [props.io]);
  const embedded = props.embedded === true;
  return (
    <SystemProvider
      io={io}
      {...(props.resources !== undefined ? { resources: props.resources } : {})}
    >
      <RootErrorBoundary>
        <AppNavigation embedded={embedded}>
          <AppProviders embedded={embedded}>
            <RootNavigator />
          </AppProviders>
        </AppNavigation>
      </RootErrorBoundary>
    </SystemProvider>
  );
}
