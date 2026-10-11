/** @jsxImportSource solid-js */
/**
 * Product client root — `ClientEnvProvider` is applied by `createClient`.
 * Rendered as the router `root`, so `props.children` is the route outlet.
 * Production and harnesses mount the same component; embedded hosts (multi-App
 * product-harness) get a `MemoryRouter` from `createClient` instead of the URL.
 *
 * Paint order (low-end Android): fonts gate → AppFrame chrome → session/SQLite.
 * Sync boot may still show {@link BootLoadingShell} inside the frame; it must
 * not block the frame itself (see README.md). Anything a
 * sub needs painted above the SQLite gate — an unread-count root, a game
 * registry — is its `chrome` contribution, mounted by `AppProvidersSession`.
 */

import { OriginAvailabilityProvider } from '@pkgs/http-client-client/solid';
import { AppFrame } from '@pkgs/ui-root-client/app-frame';
import { AppFrameChromeProvider } from '@pkgs/ui-root-client/app-frame-chrome';
import { AppRouterProvider } from '@pkgs/ui-root-client/app-router';
import { type JSX, onCleanup, onMount, Show } from 'solid-js';
import { AppHeaderGlobalMenu } from './app-header-global-menu';
import { AppHeaderIslandHost } from './app-header-island';
import { AppProvidersOuter, AppProvidersSession } from './app-providers';
import { useAppSubs } from './app-subs-context';
import { AppThemeProvider } from './app-theme-provider';
import { BootPaintGate } from './boot-paint-gate';
import { useClientEnv } from './client-env-context';
import { EmbeddedHrefPersistence } from './embedded-href-persistence';
import { GlobalMenuIdentityRoot } from './global-menu-identity-context';
import { originAvailabilityFor } from './origin-availability-for-env';
import { RootErrorBoundary } from './root-error-boundary';
import { SyncStatusRoot } from './sync-status-context';
import { WorkOfflineStatus } from './work-offline-status';

export type ProductAppProps = {
  /** Multi-App product-harness: in-memory router, no document-level shortcuts. */
  readonly embedded: boolean;
  /** Router outlet. */
  readonly children: JSX.Element;
};

export function ProductApp(props: ProductAppProps): JSX.Element {
  const env = useClientEnv();
  const subs = useAppSubs();
  const availability = originAvailabilityFor(env);
  onMount(() => {
    availability.start();
    onCleanup(() => availability.stop());
  });
  return (
    <OriginAvailabilityProvider value={availability}>
      <AppThemeProvider kv={env.kv} motion={env.motion}>
        <RootErrorBoundary copyError={env.clipboard.writeText}>
          <AppRouterProvider>
            <AppProvidersOuter embedded={props.embedded}>
              <Show when={props.embedded}>
                <EmbeddedHrefPersistence />
              </Show>
              <SyncStatusRoot>
                <GlobalMenuIdentityRoot>
                  <subs.Chrome>
                    <AppFrameChromeProvider
                      globalTrailing={
                        <div class="flex items-center gap-2">
                          <WorkOfflineStatus />
                          <AppHeaderGlobalMenu />
                        </div>
                      }
                    >
                      <BootPaintGate>
                        <AppFrame header={<AppHeaderIslandHost />}>
                          <AppProvidersSession>
                            {props.children}
                          </AppProvidersSession>
                        </AppFrame>
                      </BootPaintGate>
                    </AppFrameChromeProvider>
                  </subs.Chrome>
                </GlobalMenuIdentityRoot>
              </SyncStatusRoot>
            </AppProvidersOuter>
          </AppRouterProvider>
        </RootErrorBoundary>
      </AppThemeProvider>
    </OriginAvailabilityProvider>
  );
}
