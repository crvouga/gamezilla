import { sql } from '@pkgs/sql';

import type { SqlClient } from '@pkgs/sql-client/interface';

export type ProfilePatchInput = {
  readonly profileId: string;
  readonly avatarConfig?: string;
};

export async function patchProfileAvatar(
  db: SqlClient,
  input: ProfilePatchInput
): Promise<void> {
  if (input.avatarConfig === undefined) {
    return;
  }
  await db.run(sql<void>`
    UPDATE profiles
    SET avatar_config = ${input.avatarConfig}
    WHERE id = ${input.profileId}
  `);
}
