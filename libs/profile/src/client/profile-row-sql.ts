import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import { raw, sql, type Sql } from '@pkgs/sql';

/** Canonical profile row SELECT — shared by {@link useProfileRow} and column hooks. */
export function profileRowByIdSql(profileId: string): Sql {
  return sql`
    SELECT ${raw(ProfileCol.id)}, ${raw(ProfileCol.createdAt)},
           ${raw(ProfileCol.username)}, ${raw(ProfileCol.usernameChangedAt)}, ${raw(ProfileCol.avatarConfig)}
    FROM ${raw(PROFILES_TABLE.tableName)}
    WHERE ${raw(ProfileCol.id)} = ${profileId}
  `;
}
