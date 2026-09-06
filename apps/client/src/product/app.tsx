/**
 * Product client root — ClientEnvProvider is applied by {@link createClient}.
 * Production and DST mount the same component.
 * Embedded hosts (multi-App playground) pass `embedded` for an isolated nav tree.
 */

import { AppProviders } from '@apps/client/providers/app-providers';
import { RootErrorBoundary } from '@apps/client/providers/root-error-boundary';
import { BootPaintGate } from '@apps/client/providers/shell/boot-paint-gate';
import { AppHeaderGlobalMenu } from '@apps/client/ui/app-header/app-header-global-menu';
import { AppHeaderIslandHost } from '@apps/client/ui/app-header/app-header-island';
import { OriginAvailabilityProvider } from '@pkgs/http-client';
import {
  AppFrame,
  AppFrameChromeProvider,
  type AppNavigationRef,
  NavigationRefProvider,
  navigationRef,
  setAppLinkingConfig,
} from '@pkgs/ui-rn';
import {
  NavigationContainer,
  NavigationIndependentTree,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { type ReactNode, useEffect } from 'react';

import { RootNavigator } from '../navigation/root-navigator';
import { appLinking } from '../navigation/types';
import { useClientEnv } from './client-env-provider';
import { originAvailabilityFor } from './origin-availability-for-env';

setAppLinkingConfig(appLinking.config as never);

export type ProductAppProps = {
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

/** Isolated product App (not the Expo composition root). */
export function ProductApp(props: ProductAppProps): ReactNode {
  const env = useClientEnv();
  const availability = originAvailabilityFor(env);
  useEffect(() => {
    availability.start();
    return () => {
      availability.stop();
    };
  }, [availability]);
  const embedded = props.embedded === true;
  return (
    <OriginAvailabilityProvider availability={availability}>
      <RootErrorBoundary>
        <AppNavigation embedded={embedded}>
          <AppProviders embedded={embedded}>
            <AppFrameChromeProvider globalTrailing={<AppHeaderGlobalMenu />}>
              <BootPaintGate>
                <AppFrame header={<AppHeaderIslandHost />}>
                  <RootNavigator />
                </AppFrame>
              </BootPaintGate>
            </AppFrameChromeProvider>
          </AppProviders>
        </AppNavigation>
      </RootErrorBoundary>
    </OriginAvailabilityProvider>
  );
}
