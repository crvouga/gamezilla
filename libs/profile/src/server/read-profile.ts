import { join, sql } from '@pkgs/sql';

import type { SqlClient } from '@pkgs/sql-client/interface';

import type { ProfileCard } from '../shared/profile-card';

export type { ProfileCard };

function readProfileCard(row: Record<string, unknown>): ProfileCard | null {
  const userId = row['id'];
  if (typeof userId !== 'string' || userId.length === 0) return null;
  const username = row['username'];
  const avatarRaw = row['avatar_config'];
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

export class ProfileReadRepository {
  constructor(private readonly db: SqlClient) {}

  async readCardById(profileId: string): Promise<ProfileCard | null> {
    const rows = await this.db.query(sql<Record<string, unknown>>`
      SELECT id, username, avatar_config
      FROM profiles
      WHERE id = ${profileId}
      LIMIT 1
    `);
    const row = rows[0];
    if (row === undefined) return null;
    return readProfileCard(row);
  }

  async readCardsByIds(
    profileIds: readonly string[]
  ): Promise<readonly ProfileCard[]> {
    if (profileIds.length === 0) return [];
    const rows = await this.db.query(sql<Record<string, unknown>>`
      SELECT id, username, avatar_config
      FROM profiles
      WHERE id IN (${join([...profileIds])})
    `);
    return rows
      .map((row) => readProfileCard(row))
      .filter((card): card is ProfileCard => card !== null);
  }
}
