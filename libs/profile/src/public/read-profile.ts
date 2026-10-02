import { join, sql } from '@pkgs/sql';
import type { SqlTx } from '@pkgs/sql-client/interface';

import type { ProfileCard } from '../shared/profile/profile-card';

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
  constructor(private readonly tx: SqlTx) {}

  async readCardById(profileId: string): Promise<ProfileCard | null> {
    const rows = await this.tx.query(sql<Record<string, unknown>>`
      SELECT id, username, avatar_config
      FROM profile
      WHERE id = ${profileId} AND deleted_at IS NULL
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
    const rows = await this.tx.query(sql<Record<string, unknown>>`
      SELECT id, username, avatar_config
      FROM profile
      WHERE id IN (${join([...profileIds])}) AND deleted_at IS NULL
    `);
    return rows
      .map((row) => readProfileCard(row))
      .filter((card): card is ProfileCard => card !== null);
  }
}
