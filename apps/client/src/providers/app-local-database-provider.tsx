import { AuthSyncBridge } from '@libs/auth/client/auth-sync-bridge';
import { ProfileProvider } from '@libs/profile/client/profile-provider';
import { ComposeProviders } from '@pkgs/ui';
import type { ReactNode } from 'react';

import { MutationClientProvider } from './mutation-client-provider';
import { DeviceEntityBootstrap } from './local-database/device-bootstrap';
import { SyncLocalDataActions } from './local-database/local-data-actions';
import { SyncEngineBoot } from './local-database/sync-engine-boot';
import { SqliteRecoveryGate } from './local-database/sqlite-recovery-gate';

const localDatabaseProviders = [
  SqliteRecoveryGate,
  SyncEngineBoot,
  AuthSyncBridge,
  MutationClientProvider,
  SyncLocalDataActions,
  DeviceEntityBootstrap,
  ProfileProvider,
];

/**
 * Local sync umbrella: recovery gate, PowerSync boot, auth identity bridge,
 * wipe actions, device bootstrap, and profile bootstrap.
 */
export function AppLocalDatabaseProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <ComposeProviders providers={localDatabaseProviders}>
      {children}
    </ComposeProviders>
  );
}
