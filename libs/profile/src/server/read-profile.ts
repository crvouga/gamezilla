import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import { honey } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { ProfileCard } from '../shared/profile-card';

export type { ProfileCard };

function readProfileCard(row: Record<string, unknown>): ProfileCard | null {
  const userId = row[ProfileCol.id];
  if (typeof userId !== 'string' || userId.length === 0) return null;
  const username = row[ProfileCol.username];
  const avatarRaw = row[ProfileCol.avatarConfig];
  return {
    userId,
    username: typeof username === 'string' ? username : '',
    avatarConfig:
      typeof avatarRaw === 'string'
        ? avatarRaw
        : avatarRaw === null || avatarRaw === undefined
          ? null
          : JSON.stringify(avatarRaw),
  };
}

export async function readProfileCardById(
  db: SqlClient,
  profileId: string
): Promise<ProfileCard | null> {
  const rows = await db.query<Record<string, unknown>>(
    honey({
      select: [ProfileCol.id, ProfileCol.username, ProfileCol.avatarConfig],
      from: PROFILES_TABLE.tableName,
      where: ['=', ProfileCol.id, profileId],
      limit: 1,
    })
  );
  const row = rows[0];
  if (row === undefined) return null;
  return readProfileCard(row);
}

export async function readProfileCardsByIds(
  db: SqlClient,
  profileIds: readonly string[]
): Promise<readonly ProfileCard[]> {
  if (profileIds.length === 0) return [];
  const rows = await db.query<Record<string, unknown>>(
    honey({
      select: [ProfileCol.id, ProfileCol.username, ProfileCol.avatarConfig],
      from: PROFILES_TABLE.tableName,
      where: ['in', ProfileCol.id, profileIds],
    })
  );
  return rows
    .map((row) => readProfileCard(row))
    .filter((card): card is ProfileCard => card !== null);
}
