import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import { sqlMap } from '@pkgs/sql-map';

import type { SqlClient } from '@pkgs/sql-client/interface';

export type ProfilePatchInput = {
  readonly profileId: string;
  readonly avatarConfig?: string;
};

export async function patchProfileAvatar(
  db: SqlClient,
  input: ProfilePatchInput
): Promise<void> {
  const updates: Record<string, string> = {};
  if (input.avatarConfig !== undefined) {
    updates[ProfileCol.avatarConfig] = input.avatarConfig;
  }
  if (Object.keys(updates).length === 0) {
    return;
  }
  await db.run(
    sqlMap({
      update: PROFILES_TABLE.tableName,
      set: updates,
      where: ['=', ProfileCol.id, input.profileId],
    })
  );
}
