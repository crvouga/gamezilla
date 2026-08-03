import { resolveSpaceMemberId } from '@libs/spaces/shared/participation/participation-ids';
import { clearSpacePresenceLatch } from '@libs/spaces/shared/space-presence-latch-store';
import type { AppRulesAuth } from '@libs/auth/shared/app-rules-auth';
import { sql } from '@pkgs/sql';

import type { SqlClient } from '@pkgs/sql-client/interface';

import { isoNow, requireAccountId } from '../space-write-helpers';

export type EndSpaceInput = {
  readonly spaceId: string;
};

/** Stamp `ended_at` on a live space; realign host identity to the ending actor. */
export async function stampSpaceEnded(
  auth: AppRulesAuth,
  db: SqlClient,
  spaceId: string
): Promise<void> {
  const accountId = requireAccountId(auth);
  const memberId = resolveSpaceMemberId(accountId);
  await db.run(sql<void>`
    UPDATE spaces
    SET ended_at = ${isoNow()},
        host_id = ${auth.deviceId},
        host_member_id = ${memberId},
        host_account_id = ${accountId}
    WHERE id = ${spaceId} AND ended_at IS NULL
  `);
}

/**
 * End a live space. Shared by explicit End and host Leave (I4: host leave = end).
 * Presence latch must be cleared at the call site (not inside rules).
 */
export async function executeEndSpace(
  auth: AppRulesAuth,
  input: EndSpaceInput,
  db: SqlClient
): Promise<void> {
  clearSpacePresenceLatch(input.spaceId);
  await stampSpaceEnded(auth, db, input.spaceId);
}
