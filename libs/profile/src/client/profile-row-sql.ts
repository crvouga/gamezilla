import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import { sqlMap, type Sql } from '@pkgs/sql';

/** Canonical profile row SELECT — shared by {@link useProfileRow} and column hooks. */
export function profileRowByIdSql(profileId: string): Sql {
  return sqlMap({
    select: [
      ProfileCol.id,
      ProfileCol.createdAt,
      ProfileCol.username,
      ProfileCol.usernameChangedAt,
      ProfileCol.avatarConfig,
    ],
    from: PROFILES_TABLE.tableName,
    where: ['=', ProfileCol.id, profileId],
  });
}
