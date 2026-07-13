import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';

/** Canonical profile row SELECT — shared by {@link useProfileRow} and column hooks. */
export const PROFILE_ROW_BY_ID_SQL = `SELECT ${ProfileCol.id}, ${ProfileCol.createdAt},
            ${ProfileCol.username}, ${ProfileCol.usernameChangedAt}, ${ProfileCol.avatarConfig}
     FROM ${PROFILES_TABLE.tableName}
     WHERE ${ProfileCol.id} = ?`;
