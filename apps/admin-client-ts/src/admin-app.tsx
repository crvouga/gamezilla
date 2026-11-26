import type { ClientEnv } from '@libs/app-env-client-ts/client-env';
import { ClientEnvProvider } from '@libs/app-env-client-ts/client-env-context';
import type { AppSyncEnginePool } from '@libs/app-env-client-ts/sync-engine-pool';
import { AppAuthProvider } from '@libs/app-root-client-ts/app-auth-provider';
import { AppInfrastructureProvider } from '@libs/app-root-client-ts/app-infrastructure-provider';
import { AppShellProvider } from '@libs/app-root-client-ts/app-shell-provider';
import { AppCompositionProvider } from '@libs/app-root-client-ts/app-subs-context';
import { AppThemeProvider } from '@libs/app-root-client-ts/app-theme-provider';
import { AppUiPortals } from '@libs/app-root-client-ts/app-ui-portals';
import { originAvailabilityFor } from '@libs/app-root-client-ts/origin-availability-for-env';
import SsoCallback from '@libs/app-root-client-ts/sso-callback';
import { OBSERVATORY_CLIENT } from '@libs/observatory-client-ts/sub-client';
import { composeSubClients } from '@libs/sub-client-ts/compose-client';
import { createSyntheticPopulationClient } from '@libs/synthetic-population-client-ts/sub-client';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { AppFrame } from '@pkgs/ui-root-client-ts/app-frame';
import { AppFrameChromeProvider } from '@pkgs/ui-root-client-ts/app-frame-chrome';
import { AppRouterProvider } from '@pkgs/ui-root-client-ts/app-router';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { createRouter, useLocation } from '@solidjs/router';
import type { JSX } from '@solidjs/web';
import { Errored, Loading, lazy, onSettled, Show, untrack } from 'solid-js';
import { AdminAccess } from './admin-access';
import { AdminDashboard, AdminNotFound } from './admin-dashboard';
import { AdminSignInMethods } from './admin-sign-in-methods';

export const loadAdminData = async () =>
  (await import('@libs/runtime-shared-ts/admin-subs')).ADMIN_APP;

const clients = composeSubClients([
  OBSERVATORY_CLIENT,
  createSyntheticPopulationClient({
    loadGames: async () =>
      (await import('@libs/games-client-ts/game-plugins.client'))
        .GAME_CLIENT_DEFINITIONS,
  }),
]);

const routes = [
  { path: '/', component: AdminDashboard },
  ...clients.routes,
  {
    path: '/puzzles',
    component: lazy(async () => ({
      default: (
        await import('@libs/chess-puzzle-client-ts/puzzle-management-screen')
      ).PuzzleManagementScreen,
    })),
  },
  { path: '/sso-callback', component: SsoCallback },
  { path: '/*all', component: AdminNotFound },
];

function AdminShell(props: { readonly children: JSX.Element }): JSX.Element {
  const location = useLocation();
  return (
    <AppRouterProvider>
      <AppShellProvider>
        <AppInfrastructureProvider>
          <AppAuthProvider>
            <AppUiPortals>
              <AppFrameChromeProvider>
                <AppFrame>
                  <Errored
                    fallback={(_error, reset) => (
                      <ErrorState
                        title={<Trans>Administration could not open</Trans>}
                        body={<Trans>Try opening this page again.</Trans>}
                        retry={{ onClick: reset }}
                      />
                    )}
                  >
                    <Loading fallback={<LoadingState />}>
                      <AdminSignInMethods>
                        <Show
                          when={location.pathname === '/sso-callback'}
                          fallback={<AdminAccess>{props.children}</AdminAccess>}
                        >
                          {props.children}
                        </Show>
                      </AdminSignInMethods>
                    </Loading>
                  </Errored>
                </AppFrame>
              </AppFrameChromeProvider>
            </AppUiPortals>
          </AppAuthProvider>
        </AppInfrastructureProvider>
      </AppShellProvider>
    </AppRouterProvider>
  );
}

export function AdminApp(props: {
  readonly env: ClientEnv;
  readonly pool: AppSyncEnginePool;
}): JSX.Element {
  const availability = originAvailabilityFor(untrack(() => props.env));
  onSettled(() => {
    availability.start();
    return () => availability.stop();
  });
  const Router = createRouter({ routes, scrollRestoration: false });
  return (
    <ClientEnvProvider env={props.env} syncEnginePool={props.pool}>
      <AppCompositionProvider value={{ clients, loadApp: loadAdminData }}>
        <AppThemeProvider kv={props.env.kv} motion={props.env.motion}>
          <Router>
            {(route) => <AdminShell>{route.children}</AdminShell>}
          </Router>
        </AppThemeProvider>
      </AppCompositionProvider>
    </ClientEnvProvider>
  );
}
