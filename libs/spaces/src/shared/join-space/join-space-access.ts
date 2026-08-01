import { resolveSpaceMemberId } from '@libs/spaces/shared/participation/participation-ids';
import { parseSpaceVisibility } from '@libs/spaces/shared/space-visibility';
import { fail } from '@pkgs/rules/core/fail';
import { throwRulesReject } from '@pkgs/rules/core/rules-reject';
import type { RulesAuth } from '@pkgs/rules/core/types';
import { SPACE_ENDED, SPACE_NOT_FOUND } from '@pkgs/rules/spaces/codes';
import sql from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { isSpaceUserInStore, requireAccountId } from '../space-write-helpers';
import { decideSpaceJoinAccess } from './decide-space-join-access';

export type JoinSpaceRow = {
  readonly hostId: string;
  readonly hostMemberId: string;
  readonly endedAt: string | null;
  readonly visibility: string;
  readonly hostAccountId: string | null;
};

export async function readSpaceRowForJoin(
  db: SqlClient,
  spaceId: string
): Promise<JoinSpaceRow> {
  const rows = await db.query<{
    readonly host_id: string | null;
    readonly host_member_id: string | null;
    readonly ended_at: string | null;
    readonly visibility: string | null;
    readonly host_account_id: string | null;
  }>(
    sql`
      SELECT
        host_id,
        host_member_id,
        ended_at,
        visibility,
        host_account_id
      FROM spaces
      WHERE id = ${spaceId}
      LIMIT 1
    `
  );
  const row = rows[0];
  if (row === undefined || row.host_id === null || row.host_id.length === 0) {
    throwRulesReject([fail(SPACE_NOT_FOUND)]);
  }
  const hostMemberId = row.host_member_id ?? row.host_account_id ?? row.host_id;
  return {
    hostId: row.host_id,
    hostMemberId,
    endedAt: row.ended_at,
    visibility: row.visibility ?? 'private',
    hostAccountId: row.host_account_id,
  };
}

/** @deprecated Prefer {@link isSpaceUserInStore}. */
export async function isUserAllowlistedInStore(
  db: SqlClient,
  spaceId: string,
  userId: string
): Promise<boolean> {
  return isSpaceUserInStore(db, spaceId, userId);
}

export async function authorizeJoinSpaceAccess(
  auth: RulesAuth,
  db: SqlClient,
  spaceId: string
): Promise<void> {
  const accountId = requireAccountId(auth);
  const space = await readSpaceRowForJoin(db, spaceId);
  if (space.endedAt !== null) {
    throwRulesReject([fail(SPACE_ENDED)]);
  }
  const viewerMemberId = resolveSpaceMemberId(accountId);
  const hasSpaceUser = await isSpaceUserInStore(db, spaceId, accountId);
  const decision = decideSpaceJoinAccess({
    visibility: parseSpaceVisibility(space.visibility),
    hostId: space.hostId,
    hostAccountId: space.hostAccountId,
    hostMemberId: space.hostMemberId,
    viewerAccountId: accountId,
    viewerDeviceId: auth.deviceId,
    viewerMemberId,
    hasSpaceUser,
  });
  if (!decision.allowed) {
    throwRulesReject([
      fail(decision.code, {
        params: { message: 'Not allowed to join this space' },
      }),
    ]);
  }
}
