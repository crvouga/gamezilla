import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import type { SqlClient } from '@pkgs/sql-client/interface';

/**
 * Updates display name and/or avatar on the profile row at `profileId`.
 */
export async function updateProfile(
  sql: SqlClient,
  profileId: string,
  args: {
    displayName?: string;
    avatarConfig?: string;
  }
): Promise<void> {
  const updates: Record<string, string> = {};
  if (args.displayName !== undefined) {
    updates[ProfileCol.displayName] = args.displayName;
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
