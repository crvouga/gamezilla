/** @jsxImportSource solid-js */
/**
 * Local sync umbrella: identity-scoped SQLite boot + sync engine + mutation
 * client (`shell/sync/sync-engine-boot.tsx`).
 *
 * Deferred lib bridges (each arrives with its first Solid screen):
 * `AuthSyncBridge` (sign-in modal), `SyncLocalDataActions` (`/more/sync`),
 * `DeviceEntityBootstrap` (`/more/account/devices`), `ProfileProvider`
 * (`/profile`), `AppObservabilityFromClientConfig` /
 * `SyncEmqxPushFromClientConfig` (`/more/client-config`).
 */

import { ProfileProvider } from '@libs/profile/root/client/profile-provider';
import type { JSX } from 'solid-js';
import { SyncEngineBoot } from '../sync/sync-engine-boot';
import { DeviceEntityBootstrap } from './device-bootstrap';
import { SyncLocalDataActions } from './local-data-actions';

export function AppLocalDatabaseProvider(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    <SyncEngineBoot>
      <SyncLocalDataActions>
        <DeviceEntityBootstrap>
          <ProfileProvider>{props.children}</ProfileProvider>
        </DeviceEntityBootstrap>
      </SyncLocalDataActions>
    </SyncEngineBoot>
  );
}
