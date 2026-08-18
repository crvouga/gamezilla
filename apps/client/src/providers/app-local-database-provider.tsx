import { AuthSyncBridge } from '@libs/auth/root/client/auth-sync-bridge';
import { ProfileProvider } from '@libs/profile/root/client/profile-provider';
import { ComposeProviders } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { DeviceEntityBootstrap } from './local-database/device-bootstrap';
import { SyncLocalDataActions } from './local-database/local-data-actions';
import { SqliteRecoveryGate } from './local-database/sqlite-recovery-gate';
import { SyncEngineBoot } from './local-database/sync-engine-boot';
import { MutationClientProvider } from './mutation-client-provider';

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
 * Local sync umbrella: recovery gate, expo-sqlite boot, auth identity bridge,
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
