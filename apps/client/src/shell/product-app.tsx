/** @jsxImportSource solid-js */
/**
 * Product client root — `ClientEnvProvider` is applied by `createClient`.
 * Rendered as the router `root`, so `props.children` is the route outlet.
 * Production and sims mount the same component; embedded hosts (multi-App
 * playground) get a `MemoryRouter` from `createClient` instead of the URL.
 */

import { OriginAvailabilityProvider } from '@pkgs/http-client/solid';
import { AppFrame, AppFrameChromeProvider, AppRouterProvider } from '@pkgs/ui';
import { type JSX, onCleanup, onMount } from 'solid-js';

import { AppHeaderGlobalMenu } from '../chrome/app-header-global-menu';
import { AppHeaderIslandHost } from '../chrome/app-header-island';
import { OfflineIndicator } from '../chrome/offline-indicator';
import { BootPaintGate } from './boot/boot-paint-gate';
import { useClientEnv } from './client-env-context';
import { originAvailabilityFor } from './origin-availability-for-env';
import { AppProviders } from './providers/app-providers';
import { RootErrorBoundary } from './root-error-boundary';

export type ProductAppProps = {
  /** Multi-App playground: in-memory router, no document-level shortcuts. */
  readonly embedded: boolean;
  /** Router outlet. */
  readonly children: JSX.Element;
};

export function ProductApp(props: ProductAppProps): JSX.Element {
  const env = useClientEnv();
  const availability = originAvailabilityFor(env);
  onMount(() => {
    availability.start();
    onCleanup(() => availability.stop());
  });
  return (
    <OriginAvailabilityProvider value={availability}>
      <RootErrorBoundary>
        <AppRouterProvider>
          <AppProviders embedded={props.embedded}>
            <AppFrameChromeProvider globalTrailing={<AppHeaderGlobalMenu />}>
              <BootPaintGate>
                <AppFrame header={<AppHeaderIslandHost />}>
                  <OfflineIndicator />
                  {props.children}
                </AppFrame>
              </BootPaintGate>
            </AppFrameChromeProvider>
          </AppProviders>
        </AppRouterProvider>
      </RootErrorBoundary>
    </OriginAvailabilityProvider>
  );
}
