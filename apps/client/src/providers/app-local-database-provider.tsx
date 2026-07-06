import { ProfileProvider } from '@libs/profile/client/profile-provider';
import { AuthPatchDbBridge } from '@libs/auth/client/auth-patch-db-bridge';
import { ComposeProviders } from '@pkgs/ui';
import type { ReactNode } from 'react';

import { DeviceEntityBootstrap } from './local-database/device-bootstrap';
import { PatchDbLocalDataActions } from './local-database/local-data-actions';
import { PatchDbBoot } from './local-database/patch-db';
import { SqlClientBoot } from './local-database/sql-client';
import { SqliteRecoveryGate } from './local-database/sqlite-recovery-gate';

const localDatabaseProviders = [
  SqliteRecoveryGate,
  SqlClientBoot,
  PatchDbBoot,
  AuthPatchDbBridge,
  PatchDbLocalDataActions,
  DeviceEntityBootstrap,
  ProfileProvider,
];

/**
 * Single SQLite umbrella: recovery gate, SQL client boot, patch-db boot,
 * local-data actions, device entity bootstrap, and profile bootstrap.
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
