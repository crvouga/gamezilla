import { createSqlWriteStore } from '@pkgs/write/client/create-sql-write-store';
import { runClientWrite } from '@pkgs/write/client/run-client-write';
import type { WriteContext } from '@pkgs/write/shared/write-context';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { profilePatchWrite } from '../shared/writes/profile-patch-write';

/**
 * Updates display name, username, and/or avatar on the profile row at `profileId`.
 */
export async function updateProfile(
  sql: SqlClient,
  writeContext: WriteContext,
  profileId: string,
  args: {
    displayName?: string;
    username?: string;
    usernameChangedAt?: string;
    avatarConfig?: string;
  }
): Promise<void> {
  await runClientWrite(
    profilePatchWrite,
    writeContext,
    { profileId, ...args },
    createSqlWriteStore(sql)
  );
}
