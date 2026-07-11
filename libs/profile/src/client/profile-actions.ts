import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import type { SqlClient } from '@pkgs/sql-client/interface';

/**
 * Updates display name, username, and/or avatar on the profile row at `profileId`.
 */
export async function updateProfile(
  sql: SqlClient,
  profileId: string,
  args: {
    displayName?: string;
    username?: string;
    usernameChangedAt?: string;
    avatarConfig?: string;
  }
): Promise<void> {
  const updates: Record<string, string> = {};
  if (args.displayName !== undefined) {
    updates[ProfileCol.displayName] = args.displayName;
  }
  if (args.username !== undefined) {
    updates[ProfileCol.username] = args.username;
  }
  if (args.usernameChangedAt !== undefined) {
    updates[ProfileCol.usernameChangedAt] = args.usernameChangedAt;
  }
  if (args.avatarConfig !== undefined) {
    updates[ProfileCol.avatarConfig] = args.avatarConfig;
  }
  if (Object.keys(updates).length === 0) return;
  const entries = Object.entries(updates);
  const sets = entries.map(([col]) => `${col} = ?`).join(', ');
  await sql.run(
    `UPDATE ${PROFILES_TABLE.tableName} SET ${sets} WHERE ${ProfileCol.id} = ?`,
    [...entries.map(([, v]) => v), profileId]
  );
}
