import { sql, type Sql } from '@pkgs/sql';

/** Canonical profile row SELECT — shared by {@link useProfileRow} and column hooks. */
export function profileRowByIdSql(profileId: string): Sql {
  return sql`
    SELECT id, created_at, username, username_changed_at, avatar_config
    FROM profiles
    WHERE id = ${profileId}
  `;
}
