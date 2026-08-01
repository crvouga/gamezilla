import { PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import { PROFILE_RULES } from '@pkgs/rules/profile/rules';
import type { RulesAuth } from '@pkgs/rules/core/types';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { validatedWrite } from '@pkgs/sync-engine-powersync/client/validated-write';
import { assertUuid } from '@pkgs/uuid';

import { ensureProfileLocal } from '../../shared/ensure-profile-local/ensure-profile-local-write';

/**
 * Ensures a local `profiles` row exists for `auth.myId` (install id
 * when anonymous, account id when signed in). Username is assigned online via
 * `POST /profile/ensure` — this only seeds id / avatar for the sync path.
 */
export async function ensureProfile(
  sql: SqlClient,
  auth: RulesAuth,
  profileId: string = auth.myId
): Promise<void> {
  assertUuid(profileId, 'ensureProfile profileId');
  await validatedWrite({
    sql,
    auth,
    rules: PROFILE_RULES,
    beforeBatch: {
      rows: [
        {
          op: 'put',
          table: PROFILES_TABLE.tableName,
          id: profileId,
          values: { id: profileId },
        },
      ],
    },
    fn: (tx) => ensureProfileLocal(tx, { profileId }),
  });
}

/**
 * Writes a server-assigned username into the local row when still empty so the
 * profile UI does not wait on PowerSync download after `POST /profile/ensure`.
 */
export async function applyEnsuredUsername(
  sql: SqlClient,
  auth: RulesAuth,
  args: { readonly profileId: string; readonly username: string }
): Promise<void> {
  assertUuid(args.profileId, 'applyEnsuredUsername profileId');
  if (args.username.length === 0) return;
  await validatedWrite({
    sql,
    auth,
    rules: PROFILE_RULES,
    beforeBatch: {
      rows: [
        {
          op: 'patch',
          table: PROFILES_TABLE.tableName,
          id: args.profileId,
          values: { id: args.profileId },
        },
      ],
    },
    fn: (tx) =>
      ensureProfileLocal(tx, {
        profileId: args.profileId,
        username: args.username,
      }),
  });
}
