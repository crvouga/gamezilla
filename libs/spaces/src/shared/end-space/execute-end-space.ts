import {
  SPACE_MEMBERSHIPS_TABLE,
  SpaceCol,
  SpaceMembershipCol,
  SPACES_TABLE,
} from '@libs/db/shared/space-tables';
import {
  resolveSpaceMemberId,
  spaceMembershipEntityId,
} from '@libs/spaces/shared/participation/participation-ids';
import { clearSpacePresenceLatch } from '@libs/spaces/shared/space-presence-latch-store';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { honey } from '@pkgs/sql';
import { ok, type WriteResult } from '@pkgs/write/shared/write-result';
import type { WriteContext } from '@pkgs/write/shared/write-context';

import {
  isoNow,
  readMembershipForLeave,
  requireAccountId,
} from '../space-write-helpers';

export type EndSpaceInput = {
  readonly spaceId: string;
};

async function decrementActiveMemberCount(
  db: SqlClient,
  spaceId: string
): Promise<void> {
  await db.run(
    honey({
      update: SPACES_TABLE.tableName,
      set: {
        [SpaceCol.activeMemberCount]: [
          'case',
          [
            [
              ['>', SpaceCol.activeMemberCount, 0],
              ['-', SpaceCol.activeMemberCount, 1],
            ],
          ],
          0,
        ],
      },
      where: ['=', SpaceCol.id, spaceId],
    })
  );
}

/**
 * Soft-leave this account's membership when still active.
 * Returns whether a leave was applied.
 */
export async function softLeaveMembership(
  ctx: WriteContext,
  db: SqlClient,
  spaceId: string
): Promise<WriteResult<boolean>> {
  const accountId = requireAccountId(ctx);
  if (!accountId.ok) return accountId;
  const memberId = resolveSpaceMemberId(accountId.value);
  const row = await readMembershipForLeave(db, memberId, spaceId);
  if (row === null || row.leftAt !== null) {
    return ok(false);
  }
  const now = isoNow();
  const membershipId = spaceMembershipEntityId(memberId, spaceId);
  await db.run(
    honey({
      update: SPACE_MEMBERSHIPS_TABLE.tableName,
      set: { [SpaceMembershipCol.leftAt]: now },
      where: [
        'and',
        ['=', SpaceMembershipCol.id, membershipId],
        ['is-null', SpaceMembershipCol.leftAt],
      ],
    })
  );
  await decrementActiveMemberCount(db, spaceId);
  return ok(true);
}

/** Stamp `ended_at` on a live space; realign host identity to the ending actor. */
export async function stampSpaceEnded(
  ctx: WriteContext,
  db: SqlClient,
  spaceId: string
): Promise<WriteResult<void>> {
  const accountId = requireAccountId(ctx);
  if (!accountId.ok) return accountId;
  const memberId = resolveSpaceMemberId(accountId.value);
  await db.run(
    honey({
      update: SPACES_TABLE.tableName,
      set: {
        [SpaceCol.endedAt]: isoNow(),
        [SpaceCol.hostId]: ctx.deviceId,
        [SpaceCol.hostMemberId]: memberId,
        [SpaceCol.hostAccountId]: accountId.value,
      },
      where: [
        'and',
        ['=', SpaceCol.id, spaceId],
        ['is-null', SpaceCol.endedAt],
      ],
    })
  );
  return ok(undefined);
}

/**
 * End a live space and soft-leave the actor's membership.
 * Shared by explicit End and host Leave (I4: host leave = end space).
 */
export async function executeEndSpace(
  ctx: WriteContext,
  input: EndSpaceInput,
  db: SqlClient
): Promise<WriteResult<void>> {
  clearSpacePresenceLatch(input.spaceId);
  const stamped = await stampSpaceEnded(ctx, db, input.spaceId);
  if (!stamped.ok) return stamped;
  const left = await softLeaveMembership(ctx, db, input.spaceId);
  if (!left.ok) return left;
  return ok(undefined);
}
