import {
  SpaceCol,
  SpaceMembershipCol,
  SPACES_TABLE,
  SPACE_MEMBERSHIPS_TABLE,
} from '../../shared/sync-tables';

export const SPACE_DEBUG_ROW_SQL = `SELECT * FROM ${SPACES_TABLE.tableName} WHERE ${SpaceCol.id} = ?`;

export const SPACE_DEBUG_MEMBERSHIPS_SQL = `SELECT * FROM ${SPACE_MEMBERSHIPS_TABLE.tableName}
 WHERE ${SpaceMembershipCol.spaceId} = ?`;
