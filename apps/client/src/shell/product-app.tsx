/** @jsxImportSource solid-js */
/**
 * Product client root — `ClientEnvProvider` is applied by `createClient`.
 * Rendered as the router `root`, so `props.children` is the route outlet.
 * Production and sims mount the same component; embedded hosts (multi-App
 * product-simulator) get a `MemoryRouter` from `createClient` instead of the URL.
 *
 * Paint order (low-end Android): fonts gate → AppFrame chrome → session/SQLite.
 * Sync boot may still show {@link BootLoadingShell} inside the frame; it must
 * not block the frame itself (see docs/low-end-android-perf.md).
 */

import { OriginAvailabilityProvider } from '@pkgs/http-client/solid';
import { AppFrame, AppFrameChromeProvider, AppRouterProvider } from '@pkgs/ui';
import { type JSX, onCleanup, onMount } from 'solid-js';

import { AppHeaderGlobalMenu } from '../chrome/app-header-global-menu';
import { AppHeaderIslandHost } from '../chrome/app-header-island';
import { BootPaintGate } from './boot/boot-paint-gate';
import { useClientEnv } from './client-env-context';
import { originAvailabilityFor } from './origin-availability-for-env';
import {
  AppProvidersOuter,
  AppProvidersSession,
} from './providers/app-providers';
import { RootErrorBoundary } from './root-error-boundary';
import { SyncStatusRoot } from './sync/sync-status-context';

export type ProductAppProps = {
  /** Multi-App product-simulator: in-memory router, no document-level shortcuts. */
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
          <AppProvidersOuter embedded={props.embedded}>
            <SyncStatusRoot>
              <AppFrameChromeProvider globalTrailing={<AppHeaderGlobalMenu />}>
                <BootPaintGate>
                  <AppFrame header={<AppHeaderIslandHost />}>
                    <AppProvidersSession>{props.children}</AppProvidersSession>
                  </AppFrame>
                </BootPaintGate>
              </AppFrameChromeProvider>
            </SyncStatusRoot>
          </AppProvidersOuter>
        </AppRouterProvider>
      </RootErrorBoundary>
    </OriginAvailabilityProvider>
  );
}
