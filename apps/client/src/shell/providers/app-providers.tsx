/** @jsxImportSource solid-js */
/**
 * App-wide provider stack (outermost → innermost). Must sit under
 * `ClientEnvProvider` (`createClient(env)`).
 *
 * Same order as the RN stack (`apps/client/src/providers/app-providers.tsx`):
 * shell → infrastructure → auth → services → local database → space rooms.
 * The games stage (`AppGamesProvider`) joins with the Spaces screen port
 * and the notifications stage (`AppNotificationsProvider`) with the
 * Notifications screen port — neither is stubbed here.
 *
 * UI hosts (`AppUiProvider`: surface stack, overlays, command palette) and
 * the sign-in modal (`AppSignInCapabilities` + `AuthModalsProvider`) mount
 * inside the identity-scoped sync engine tree (`sync-engine-ready-tree.tsx`):
 * the modal reads synced `client_config` and must render under
 * `SurfaceStackProvider`.
 *
 * Boot paint gating lives in `ProductApp` under `AppFrameChromeProvider` so
 * the global action menu stays mounted while the gate is up.
 */

import { EndSpaceModalProvider } from '@libs/spaces/root/client/end-space/end-space-modal-provider';
import { LeaveSpaceModalProvider } from '@libs/spaces/root/client/leave-space/leave-space-modal-provider';
import type { JSX } from 'solid-js';
import { EmbeddedAppProvider } from '../embedded-app-context';
import { AppAuthProvider } from './app-auth-provider';
import { AppGamesProvider } from './app-games-provider';
import { AppInfrastructureProvider } from './app-infrastructure-provider';
import { AppLocalDatabaseProvider } from './app-local-database-provider';
import { AppNotificationsProvider } from './app-notifications-provider';
import { AppServicesProvider } from './app-services-provider';
import { AppShellProvider } from './app-shell-provider';
import { AppSpaceRoomsProvider } from './app-space-rooms-provider';

export function AppProviders(props: {
  readonly children: JSX.Element;
  readonly embedded?: boolean | undefined;
}): JSX.Element {
  return (
    <EmbeddedAppProvider embedded={props.embedded ?? false}>
      <AppShellProvider>
        <AppInfrastructureProvider>
          <AppAuthProvider>
            <AppServicesProvider>
              <AppLocalDatabaseProvider>
                <AppGamesProvider>
                  <AppSpaceRoomsProvider>
                    <EndSpaceModalProvider>
                      <LeaveSpaceModalProvider>
                        <AppNotificationsProvider>
                          {props.children}
                        </AppNotificationsProvider>
                      </LeaveSpaceModalProvider>
                    </EndSpaceModalProvider>
                  </AppSpaceRoomsProvider>
                </AppGamesProvider>
              </AppLocalDatabaseProvider>
            </AppServicesProvider>
          </AppAuthProvider>
        </AppInfrastructureProvider>
      </AppShellProvider>
    </EmbeddedAppProvider>
  );
}
