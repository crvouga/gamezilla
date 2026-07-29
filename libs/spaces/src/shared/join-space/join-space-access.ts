import {
  SPACE_ALLOWLIST_TABLE,
  SPACE_MEMBERSHIPS_TABLE,
  SpaceAllowlistCol,
  SpaceCol,
  SpaceMembershipCol,
  SPACES_TABLE,
  spaceAllowlistEntityId,
} from '@libs/db/shared/space-tables';
import {
  resolveSpaceMemberId,
  spaceMembershipEntityId,
} from '@libs/spaces/shared/participation/participation-ids';
import { parseSpaceVisibility } from '@libs/spaces/shared/space-visibility';
import { honey } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { WriteContext } from '@pkgs/write/shared/write-context';
import { fail, ok, type WriteResult } from '@pkgs/write/shared/write-result';
import { requireAccountId } from '../space-write-helpers';
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
): Promise<WriteResult<JoinSpaceRow>> {
  const rows = await db.query<{
    readonly host_id: string | null;
    readonly host_member_id: string | null;
    readonly ended_at: string | null;
    readonly visibility: string | null;
    readonly host_account_id: string | null;
  }>(
    honey({
      select: [
        SpaceCol.hostId,
        SpaceCol.hostMemberId,
        SpaceCol.endedAt,
        SpaceCol.visibility,
        SpaceCol.hostAccountId,
      ],
      from: SPACES_TABLE.tableName,
      where: ['=', SpaceCol.id, spaceId],
      limit: 1,
    })
  );
  const row = rows[0];
  if (row === undefined || row.host_id === null || row.host_id.length === 0) {
    return fail('SPACE_NOT_FOUND', 'Space not found');
  }
  const hostMemberId = row.host_member_id ?? row.host_account_id ?? row.host_id;
  return ok({
    hostId: row.host_id,
    hostMemberId,
    endedAt: row.ended_at,
    visibility: row.visibility ?? 'private',
    hostAccountId: row.host_account_id,
  });
}

export async function isUserAllowlistedInStore(
  db: SqlClient,
  spaceId: string,
  userId: string
): Promise<boolean> {
  if (spaceId.length === 0 || userId.length === 0) return false;
  const id = spaceAllowlistEntityId(spaceId, userId);
  const rows = await db.query<{ readonly id: string }>(
    honey({
      select: [SpaceAllowlistCol.id],
      from: SPACE_ALLOWLIST_TABLE.tableName,
      where: ['=', SpaceAllowlistCol.id, id],
      limit: 1,
    })
  );
  return rows[0] !== undefined;
}

async function isActiveMembership(
  db: SqlClient,
  memberId: string,
  spaceId: string
): Promise<boolean> {
  const id = spaceMembershipEntityId(memberId, spaceId);
  const rows = await db.query<{ readonly left_at: string | null }>(
    honey({
      select: [SpaceMembershipCol.leftAt],
      from: SPACE_MEMBERSHIPS_TABLE.tableName,
      where: ['=', SpaceMembershipCol.id, id],
      limit: 1,
    })
  );
  const row = rows[0];
  return row !== undefined && row.left_at === null;
}

export async function authorizeJoinSpaceAccess(
  ctx: WriteContext,
  db: SqlClient,
  spaceId: string
): Promise<WriteResult<void>> {
  const accountId = requireAccountId(ctx);
  if (!accountId.ok) return accountId;
  const space = await readSpaceRowForJoin(db, spaceId);
  if (!space.ok) return space;
  if (space.value.endedAt !== null) {
    return fail('SPACE_ENDED', 'Space has ended');
  }
  const viewerMemberId = resolveSpaceMemberId(accountId.value);
  const alreadyMember = await isActiveMembership(db, viewerMemberId, spaceId);
  const isAllowlisted = await isUserAllowlistedInStore(
    db,
    spaceId,
    accountId.value
  );
  const decision = decideSpaceJoinAccess({
    visibility: parseSpaceVisibility(space.value.visibility),
    hostId: space.value.hostId,
    hostAccountId: space.value.hostAccountId,
    hostMemberId: space.value.hostMemberId,
    viewerAccountId: accountId.value,
    viewerDeviceId: ctx.deviceId,
    viewerMemberId,
    isAllowlisted,
    alreadyMember,
  });
  if (!decision.allowed) {
    return fail(decision.code, 'Not allowed to join this space');
  }
  return ok(undefined);
}
