import { AuthSyncBridge } from '@libs/auth/root/client/auth-sync-bridge';
import { ProfileProvider } from '@libs/profile/root/client/profile-provider';
import { ComposeProviders } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { DeviceEntityBootstrap } from './local-database/device-bootstrap';
import { SyncLocalDataActions } from './local-database/local-data-actions';
import { SyncEngineBoot } from './local-database/sync-engine-boot';
import { MutationClientProvider } from './mutation-client-provider';

const localDatabaseProviders = [
  SyncEngineBoot,
  AuthSyncBridge,
  MutationClientProvider,
  SyncLocalDataActions,
  DeviceEntityBootstrap,
  ProfileProvider,
];

/**
 * Local sync umbrella: expo-sqlite boot (web uses iframe owner + in-process
 * wipe), auth identity bridge, wipe actions, device bootstrap, profile bootstrap.
 * SQLite open/corruption recovery is encapsulated in `@pkgs/sql-client`.
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
