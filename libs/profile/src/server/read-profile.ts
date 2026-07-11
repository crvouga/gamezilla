import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import type { SqlClient } from '@pkgs/sql-client/interface';

export type ProfileCard = {
  readonly userId: string;
  readonly username: string;
  readonly displayName: string;
  readonly avatarConfig: string | null;
};

function readProfileCard(row: Record<string, unknown>): ProfileCard | null {
  const userId = row[ProfileCol.id];
  if (typeof userId !== 'string' || userId.length === 0) return null;
  const username = row[ProfileCol.username];
  const displayName = row[ProfileCol.displayName];
  const avatarRaw = row[ProfileCol.avatarConfig];
  return {
    userId,
    username: typeof username === 'string' ? username : '',
    displayName: typeof displayName === 'string' ? displayName : '',
    avatarConfig:
      typeof avatarRaw === 'string'
        ? avatarRaw
        : avatarRaw === null || avatarRaw === undefined
          ? null
          : JSON.stringify(avatarRaw),
  };
}

export async function readProfileCardById(
  sql: SqlClient,
  profileId: string
): Promise<ProfileCard | null> {
  const rows = await sql.query<Record<string, unknown>>(
    `SELECT ${ProfileCol.id}, ${ProfileCol.username}, ${ProfileCol.displayName}, ${ProfileCol.avatarConfig}
     FROM ${PROFILES_TABLE.tableName}
     WHERE ${ProfileCol.id} = ?
     LIMIT 1`,
    [profileId]
  );
  const row = rows[0];
  if (row === undefined) return null;
  return readProfileCard(row);
}

export async function readProfileCardsByIds(
  sql: SqlClient,
  profileIds: readonly string[]
): Promise<readonly ProfileCard[]> {
  if (profileIds.length === 0) return [];
  const placeholders = profileIds.map(() => '?').join(', ');
  const rows = await sql.query<Record<string, unknown>>(
    `SELECT ${ProfileCol.id}, ${ProfileCol.username}, ${ProfileCol.displayName}, ${ProfileCol.avatarConfig}
     FROM ${PROFILES_TABLE.tableName}
     WHERE ${ProfileCol.id} IN (${placeholders})`,
    [...profileIds]
  );
  return rows
    .map((row) => readProfileCard(row))
    .filter((card): card is ProfileCard => card !== null);
}
