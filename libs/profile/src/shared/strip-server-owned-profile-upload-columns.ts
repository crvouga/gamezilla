import { PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import type { UploadRow } from '@pkgs/sync-engine/shared/upload-batch';

/**
 * Username assignment is server-owned (`POST /profile/ensure`,
 * `PUT /profile/username`). Client local fills (e.g. `applyEnsuredUsername`)
 * still emit PowerSync PATCH ops with those columns — strip them before
 * apply so upload does not fight the server copy.
 */
export function stripServerOwnedProfileUploadColumns(
  row: UploadRow
): UploadRow {
  if (row.table !== PROFILES_TABLE.tableName || row.values === undefined) {
    return row;
  }
  const values = { ...row.values };
  delete values['username'];
  delete values['username_changed_at'];
  return { ...row, values };
}
