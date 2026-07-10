import { serializeDefaultAvatarConfig } from '../shared/avatar-config';
import { generateRandomDisplayName } from '../shared/display-name-generator';
import { parseAvatarConfig } from '../shared/avatar-config';
import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import { assertUuid } from '@pkgs/uuid';
import type { SqlClient } from '@pkgs/sql-client/interface';

type ProfileRow = Record<string, unknown>;

function profileLooksPresent(row: ProfileRow | undefined, expectedId: string): boolean {
  if (row === undefined) return false;
  return row[ProfileCol.id] === expectedId && typeof row[ProfileCol.createdAt] === 'string';
}

function hasDisplayName(row: ProfileRow | undefined): boolean {
  if (row === undefined) return false;
  const v = row[ProfileCol.displayName];
  return typeof v === 'string' && v.trim().length > 0;
}

function hasAvatarConfig(row: ProfileRow | undefined): boolean {
  if (row === undefined) return false;
  return parseAvatarConfig(row[ProfileCol.avatarConfig]) !== null;
}

/**
 * Ensures a `profiles` row exists for `myId` (install id when anonymous,
 * account id when signed in). Display names are seeded deterministically from
 * `myId` so independent web tabs bootstrap the same profile for one identity.
 */
export async function ensureProfile(sql: SqlClient, myId: string): Promise<void> {
  assertUuid(myId, 'ensureProfile myId');
  const rows = await sql.query<ProfileRow>(
    `SELECT * FROM ${PROFILES_TABLE.tableName} WHERE ${ProfileCol.id} = ? LIMIT 1`,
    [myId]
  );
  const existing = rows[0];
  if (profileLooksPresent(existing, myId)) {
    const updates: Record<string, string> = {};
    if (!hasDisplayName(existing)) {
      updates[ProfileCol.displayName] = generateRandomDisplayName(myId);
    }
    if (!hasAvatarConfig(existing)) {
      updates[ProfileCol.avatarConfig] = serializeDefaultAvatarConfig(myId);
    }
    if (Object.keys(updates).length === 0) return;
    const entries = Object.entries(updates);
    const sets = entries.map(([col]) => `${col} = ?`).join(', ');
    await sql.run(
      `UPDATE ${PROFILES_TABLE.tableName} SET ${sets} WHERE ${ProfileCol.id} = ?`,
      [...entries.map(([, v]) => v), myId]
    );
    return;
  }
  const now = new Date().toISOString();
  await sql.run(
    `INSERT INTO ${PROFILES_TABLE.tableName}
     (${ProfileCol.id}, ${ProfileCol.createdAt}, ${ProfileCol.displayName}, ${ProfileCol.avatarConfig})
     VALUES (?, ?, ?, ?)`,
    [myId, now, generateRandomDisplayName(myId), serializeDefaultAvatarConfig(myId)]
  );
}
