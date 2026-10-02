import { type Sql, sql } from '@pkgs/sql';

export type ProfileRow = {
  readonly id: string;
  readonly created_at: string | null;
  readonly username: string | null;
  readonly username_changed_at: string | null;
  readonly avatar_config: string | null;
};

/** Canonical profile row SELECT — shared by {@link useProfileRow} and column hooks. */
export function profileRowByIdSql(profileId: string): Sql<ProfileRow> {
  return sql<ProfileRow>`
    SELECT id, created_at, username, username_changed_at, avatar_config
    FROM profile
    WHERE id = ${profileId} AND deleted_at IS NULL
  `;
}
