import { serializeDefaultAvatarConfig } from '../shared/avatar-config';
import { parseAvatarConfig } from '../shared/avatar-config';
import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import { assertUuid } from '@pkgs/uuid';
import type { SqlClient } from '@pkgs/sql-client/interface';

type ProfileRow = Record<string, unknown>;

function profileLooksPresent(
  row: ProfileRow | undefined,
  expectedId: string
): boolean {
  if (row === undefined) return false;
  return (
    row[ProfileCol.id] === expectedId &&
    typeof row[ProfileCol.createdAt] === 'string'
  );
}

function hasAvatarConfig(row: ProfileRow | undefined): boolean {
  if (row === undefined) return false;
  return parseAvatarConfig(row[ProfileCol.avatarConfig]) !== null;
}

/**
 * Ensures a local `profiles` row exists for `myId` (install id when anonymous,
 * account id when signed in). Username is assigned online via
 * `POST /profile/ensure` — this only seeds id / avatar for the sync path.
 */
export async function ensureProfile(
  sql: SqlClient,
  myId: string
): Promise<void> {
  assertUuid(myId, 'ensureProfile myId');
  const rows = await sql.query<ProfileRow>(
    `SELECT * FROM ${PROFILES_TABLE.tableName} WHERE ${ProfileCol.id} = ? LIMIT 1`,
    [myId]
  );
  const existing = rows[0];
  if (profileLooksPresent(existing, myId)) {
    if (hasAvatarConfig(existing)) return;
    await sql.run(
      `UPDATE ${PROFILES_TABLE.tableName}
       SET ${ProfileCol.avatarConfig} = ?
       WHERE ${ProfileCol.id} = ?`,
      [serializeDefaultAvatarConfig(myId), myId]
    );
    return;
  }
  const now = new Date().toISOString();
  await sql.run(
    `INSERT INTO ${PROFILES_TABLE.tableName}
     (${ProfileCol.id}, ${ProfileCol.createdAt}, ${ProfileCol.username}, ${ProfileCol.avatarConfig})
     VALUES (?, ?, ?, ?)`,
    [myId, now, '', serializeDefaultAvatarConfig(myId)]
  );
}
