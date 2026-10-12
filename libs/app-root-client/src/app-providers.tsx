/** @jsxImportSource solid-js */
/**
 * App-wide provider stack (outermost → innermost). Must sit under
 * `ClientEnvProvider` (`createClient(env)`).
 *
 * Split so `ProductApp` can paint `AppFrame` **outside** the SQLite boot
 * gate: shell chrome and first paint must not wait on WASM.
 *
 * `AppThemeProvider` stays above root crash recovery in `ProductApp`.
 * - {@link AppProvidersOuter}: shell → infrastructure → auth → services →
 *   overlay/surface portals (so `AppFrame` chrome can open menus before SQLite)
 * - {@link AppProvidersSession}: local database
 *
 * Sub *chrome* mounts higher still, in `ProductApp`, above the frame —
 * the header badge and the global menu read it, and they paint before SQLite.
 * Sub *session* providers mount inside `sync-engine-ready-tree.tsx`, so
 * mutation / avatar graphs stay off the initial entry chunk
 * (see README.md).
 */

import type { JSX } from 'solid-js';
import { AppAuthProvider } from './app-auth-provider';
import { AppInfrastructureProvider } from './app-infrastructure-provider';
import { AppLocalDatabaseProvider } from './app-local-database-provider';
import { AppServicesProvider } from './app-services-provider';
import { AppShellProvider } from './app-shell-provider';
import { AppThemeProvider } from './app-theme-provider';
import { AppUiPortals } from './app-ui-portals';
import { useClientEnv } from './client-env-context';
import { EmbeddedAppProvider } from './embedded-app-context';

export function AppProvidersOuter(props: {
  readonly children: JSX.Element;
  readonly embedded?: boolean | undefined;
}): JSX.Element {
  return (
    <EmbeddedAppProvider embedded={props.embedded ?? false}>
      <AppShellProvider>
        <AppInfrastructureProvider>
          <AppAuthProvider>
            <AppServicesProvider>
              <AppUiPortals>{props.children}</AppUiPortals>
            </AppServicesProvider>
          </AppAuthProvider>
        </AppInfrastructureProvider>
      </AppShellProvider>
    </EmbeddedAppProvider>
  );
}

export function AppProvidersSession(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  return <AppLocalDatabaseProvider>{props.children}</AppLocalDatabaseProvider>;
}

/** Full stack (tests / hosts that do not need a paint split). */
export function AppProviders(props: {
  readonly children: JSX.Element;
  readonly embedded?: boolean | undefined;
}): JSX.Element {
  const env = useClientEnv();
  return (
    <AppThemeProvider kv={env.kv} motion={env.motion}>
      <AppProvidersOuter embedded={props.embedded}>
        <AppProvidersSession>{props.children}</AppProvidersSession>
      </AppProvidersOuter>
    </AppThemeProvider>
  );
}
