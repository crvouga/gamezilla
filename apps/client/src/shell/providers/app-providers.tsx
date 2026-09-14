/** @jsxImportSource solid-js */
/**
 * App-wide provider stack (outermost → innermost). Must sit under
 * `ClientEnvProvider` (`createClient(env)`).
 *
 * Split so `ProductApp` can paint `AppFrame` + `BootPaintGate` **outside**
 * the SQLite boot gate: shell chrome and first paint must not wait on WASM.
 *
 * - {@link AppProvidersOuter}: shell → infrastructure → auth → services →
 *   overlay/surface portals (so `AppFrame` chrome can open menus before SQLite)
 * - {@link AppProvidersSession}: games bootstrap → local database
 *
 * Games bootstrap must wrap the sync ready tree: `AppSpaceRoomsProvider`
 * opens rooms that call `useSpaceModule`. Space rooms / leave-end modals /
 * notifications still mount inside `sync-engine-ready-tree.tsx` so mutation /
 * avatar graphs stay off the initial entry chunk
 * (see docs/low-end-android-perf.md).
 */

import type { JSX } from 'solid-js';
import { EmbeddedAppProvider } from '../embedded-app-context';
import { AppAuthProvider } from './app-auth-provider';
import { AppGamesProvider } from './app-games-provider';
import { AppInfrastructureProvider } from './app-infrastructure-provider';
import { AppLocalDatabaseProvider } from './app-local-database-provider';
import { AppServicesProvider } from './app-services-provider';
import { AppShellProvider } from './app-shell-provider';
import { AppUiPortals } from './app-ui-portals';

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
  return (
    <AppGamesProvider>
      <AppLocalDatabaseProvider>{props.children}</AppLocalDatabaseProvider>
    </AppGamesProvider>
  );
}

/** Full stack (tests / hosts that do not need a paint split). */
export function AppProviders(props: {
  readonly children: JSX.Element;
  readonly embedded?: boolean | undefined;
}): JSX.Element {
  return (
    <AppProvidersOuter embedded={props.embedded}>
      <AppProvidersSession>{props.children}</AppProvidersSession>
    </AppProvidersOuter>
  );
}
