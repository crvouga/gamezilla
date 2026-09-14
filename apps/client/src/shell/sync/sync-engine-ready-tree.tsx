/** @jsxImportSource solid-js */
/**
 * Provider tree mounted once the identity-scoped engine is ready. Loaded
 * lazily by `sync-engine-boot.tsx` (with the engine) because
 * `@pkgs/sync-engine/solid` pulls the mutation client and its SQL AST parser,
 * which must stay out of the initial chunk.
 *
 * Space rooms + leave/end modals + notifications live here (not in the outer
 * shell) so the entry graph does not static-import mutation hubs / dicebear.
 */

import { AuthModalsProvider } from '@libs/auth/public/auth-modals-provider';
import { MutationClientProvider } from '@libs/auth/public/mutation-client-provider';
import { AuthSyncBridge } from '@libs/auth/root/client/auth-sync-bridge';
import { ProfileProvider } from '@libs/profile/root/client/profile-provider';
import { EndSpaceModalProvider } from '@libs/spaces/root/client/end-space/end-space-modal-provider';
import { LeaveSpaceModalProvider } from '@libs/spaces/root/client/leave-space/leave-space-modal-provider';
import { SqlClientProvider } from '@pkgs/sql-client/solid';
import {
  SyncEnginePaintGateProvider,
  SyncEngineProvider,
  useSyncEngine,
} from '@pkgs/sync-engine/solid';
import { type JSX, untrack } from 'solid-js';
import { GlobalMenuIdentityLiveBridge } from '../../chrome/global-menu-identity-bridge';
import { AppClientConfig } from '../providers/app-client-config';
import { AppNotificationsProvider } from '../providers/app-notifications-provider';
import { AppSignInCapabilities } from '../providers/app-sign-in-capabilities';
import { AppSpaceRoomsProvider } from '../providers/app-space-rooms-provider';
import { AppUiProvider } from '../providers/app-ui-provider';
import { DeviceEntityBootstrap } from '../providers/device-bootstrap';
import { SyncLocalDataActions } from '../providers/local-data-actions';
import type { ReadySyncEngine } from './create-sync-engine-boot-state';
import { SyncStatusLiveBridge } from './sync-status-context';

function SyncStatusBridge(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const engine = useSyncEngine();
  return (
    <SyncStatusLiveBridge status={engine.status}>
      {props.children}
    </SyncStatusLiveBridge>
  );
}

function SessionFeatureProviders(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    <SyncLocalDataActions>
      <DeviceEntityBootstrap>
        <ProfileProvider>
          <AppSpaceRoomsProvider>
            <EndSpaceModalProvider>
              <LeaveSpaceModalProvider>
                <AppNotificationsProvider>
                  {props.children}
                </AppNotificationsProvider>
              </LeaveSpaceModalProvider>
            </EndSpaceModalProvider>
          </AppSpaceRoomsProvider>
        </ProfileProvider>
      </DeviceEntityBootstrap>
    </SyncLocalDataActions>
  );
}

export type ReadyEngineTreeProps = {
  readonly ready: ReadySyncEngine;
  readonly userId: string;
  readonly deviceId: string;
  readonly paintReady: () => boolean;
  readonly children: JSX.Element;
};

export default function ReadyEngineTree(
  props: ReadyEngineTreeProps
): JSX.Element {
  // Keyed per engine by the parent `<Match keyed>`: static for this instance.
  const ready = untrack(() => props.ready);
  return (
    <SyncEnginePaintGateProvider ready={props.paintReady}>
      <SyncEngineProvider value={ready.engine}>
        <SyncStatusBridge>
          <GlobalMenuIdentityLiveBridge>
            <SqlClientProvider value={ready.engine.db}>
              <AuthSyncBridge>
                <MutationClientProvider registry={ready.registry}>
                  <AppSignInCapabilities>
                    {/* UI hosts (surface stack, overlays, command palette) must
                        wrap the sign-in modal: surfaces throw without
                        SurfaceStackProvider. */}
                    <AppUiProvider>
                      <AuthModalsProvider>
                        <AppClientConfig>
                          <SessionFeatureProviders>
                            {props.children}
                          </SessionFeatureProviders>
                        </AppClientConfig>
                      </AuthModalsProvider>
                    </AppUiProvider>
                  </AppSignInCapabilities>
                </MutationClientProvider>
              </AuthSyncBridge>
            </SqlClientProvider>
          </GlobalMenuIdentityLiveBridge>
        </SyncStatusBridge>
      </SyncEngineProvider>
    </SyncEnginePaintGateProvider>
  );
}
