/** @jsxImportSource solid-js */
/**
 * Product client root — `ClientEnvProvider` is applied by `createClient`.
 * Rendered as the router `root`, so `props.children` is the route outlet.
 * Production and harnesses mount the same component; embedded hosts (multi-App
 * product-harness) get a `MemoryRouter` from `createClient` instead of the URL.
 *
 * Paint order (low-end Android): AppFrame chrome → session/SQLite. Nothing
 * gates the frame: fonts swap in (`font-display: swap`) and sync boot shows
 * {@link BootLoadingShell} inside it (see README.md). Anything a
 * sub needs painted above the SQLite gate — an unread-count root, a game
 * registry — is its `chrome` contribution, mounted by `AppProvidersSession`.
 */

import { openAppAt } from '@libs/app-root-shared-ts/reload-app';
import { OriginAvailabilityProvider } from '@pkgs/http-client-client-ts/solid';
import { AppFrame } from '@pkgs/ui-root-client-ts/app-frame';
import { AppFrameChromeProvider } from '@pkgs/ui-root-client-ts/app-frame-chrome';
import { AppRouterProvider } from '@pkgs/ui-root-client-ts/app-router';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { useNavigate } from '@solidjs/router';
import { type JSX, onCleanup, onMount, Show, Suspense } from 'solid-js';
import { AppHeaderGlobalMenu } from './app-header-global-menu';
import { AppHeaderIslandHost } from './app-header-island';
import { AppProvidersOuter, AppProvidersSession } from './app-providers';
import { useAppSubs } from './app-subs-context';
import { AppThemeProvider } from './app-theme-provider';
import { useClientEnv } from './client-env-context';
import { ConnectionNotice } from './connection-notice';
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
  const navigate = useNavigate();
  // A fresh page leaves the crash behind. Embedded Apps share one page, so
  // they move their own in-memory router and re-render instead.
  const goToSpaces = (reset: () => void): void => {
    if (!props.embedded) {
      openAppAt('/');
      return;
    }
    navigate('/');
    reset();
  };
  onMount(() => {
    availability.start();
    onCleanup(() => availability.stop());
  });
  return (
    <OriginAvailabilityProvider value={availability}>
      <AppThemeProvider kv={env.kv} motion={env.motion}>
        <RootErrorBoundary
          copyError={env.clipboard.writeText}
          goToSpaces={goToSpaces}
        >
          <AppRouterProvider>
            <AppProvidersOuter embedded={props.embedded}>
              <Show when={props.embedded}>
                <EmbeddedHrefPersistence />
              </Show>
              <SyncStatusRoot>
                <GlobalMenuIdentityRoot>
                  <subs.Chrome>
                    <AppFrameChromeProvider
                      screenNavigation
                      globalTrailing={
                        <StackHorizontal align="center" gap="sm">
                          <WorkOfflineStatus />
                          <ConnectionNotice />
                          <AppHeaderGlobalMenu />
                        </StackHorizontal>
                      }
                    >
                      <AppFrame header={<AppHeaderIslandHost />}>
                        <AppProvidersSession>
                          {/* Lazy routes load their chunk behind one loading state. */}
                          <Suspense fallback={<LoadingState size="lg" />}>
                            {props.children}
                          </Suspense>
                        </AppProvidersSession>
                      </AppFrame>
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
