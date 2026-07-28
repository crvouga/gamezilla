import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import { sql, type Sql, ident } from '@pkgs/sql';

/** Canonical profile row SELECT — shared by {@link useProfileRow} and column hooks. */
export function profileRowByIdSql(profileId: string): Sql {
  return sql`
    SELECT ${ident(ProfileCol.id)}, ${ident(ProfileCol.createdAt)},
           ${ident(ProfileCol.username)}, ${ident(ProfileCol.usernameChangedAt)}, ${ident(ProfileCol.avatarConfig)}
    FROM ${ident(PROFILES_TABLE.tableName)}
    WHERE ${ident(ProfileCol.id)} = ${profileId}
  `;
}
