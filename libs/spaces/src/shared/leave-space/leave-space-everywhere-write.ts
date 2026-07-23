import {
  SPACE_MEMBERSHIPS_TABLE,
  SPACE_PARTICIPATIONS_TABLE,
  SpaceCol,
  SpaceMembershipCol,
  SpaceParticipationCol,
  SPACES_TABLE,
} from '@libs/db/shared/space-tables';
import { spaceMembershipEntityId } from '@libs/spaces/shared/participation/participation-ids';
import { decideLeaveEverywhere } from '@libs/spaces/shared/participation/space-participation-policy';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { clearSpacePresenceLatch } from '@libs/spaces/shared/space-presence-latch-store';
import { fail, ok } from '@pkgs/write/shared/write-result';
import { defineWrite } from '@pkgs/write/shared/define-write';
import type { WriteContext } from '@pkgs/write/shared/write-context';

import {
  asObjectRecord,
  isoNow,
  maybeAutoEndEmptyHostSpace,
  memberIdFromContext,
  readMembershipForLeave,
  readParticipationForLeave,
  requireNonEmptyString,
  resolveLeaveEverywhereMemberId,
} from '../space-write-helpers';

export type LeaveSpaceEverywhereInput = {
  readonly spaceId: string;
};

function parseLeaveSpaceEverywhereInput(
  raw: unknown
): ReturnType<typeof ok<LeaveSpaceEverywhereInput>> | ReturnType<typeof fail> {
  const record = asObjectRecord(raw, 'leave space everywhere input');
  if (!record.ok) return record;
  const spaceId = requireNonEmptyString(record.value['spaceId'], 'spaceId');
  if (!spaceId.ok) return spaceId;
  return ok({ spaceId: spaceId.value });
}

/**
 * Allow leave-everywhere when this device owns an active seat in the space,
 * or when the current identity still has an active membership. Identity drift
 * (seat `member_id` ≠ current auth) is allowed so orphans can clear.
 */
export async function authorizeLeaveSpaceEverywhere(
  ctx: WriteContext,
  input: LeaveSpaceEverywhereInput,
  sql: SqlClient
): Promise<ReturnType<typeof ok<void>> | ReturnType<typeof fail>> {
  const participation = await readParticipationForLeave(
    sql,
    ctx.deviceId,
    input.spaceId
  );
  if (participation !== null && participation.leftAt === null) {
    if (participation.deviceId !== ctx.deviceId) {
      return fail(
        'SPACE_MEMBERSHIP_GUEST_MISMATCH',
        'Only this device can leave everywhere'
      );
    }
    return ok(undefined);
  }
  const currentMemberId = memberIdFromContext(ctx);
  const membership = await readMembershipForLeave(
    sql,
    currentMemberId,
    input.spaceId
  );
  if (membership === null || membership.leftAt !== null) {
    return ok(undefined);
  }
  if (membership.memberId !== currentMemberId) {
    return fail(
      'SPACE_MEMBERSHIP_GUEST_MISMATCH',
      'Only this member can leave everywhere'
    );
  }
  return ok(undefined);
}

async function decrementActiveMemberCount(
  sql: SqlClient,
  spaceId: string
): Promise<void> {
  await sql.run(
    `UPDATE ${SPACES_TABLE.tableName}
     SET ${SpaceCol.activeMemberCount} = CASE
       WHEN ${SpaceCol.activeMemberCount} > 0
       THEN ${SpaceCol.activeMemberCount} - 1
       ELSE 0 END
     WHERE ${SpaceCol.id} = ?`,
    [spaceId]
  );
}

async function softLeaveMemberEverywhere(
  sql: SqlClient,
  memberId: string,
  spaceId: string,
  now: string
): Promise<void> {
  await sql.run(
    `UPDATE ${SPACE_PARTICIPATIONS_TABLE.tableName}
     SET ${SpaceParticipationCol.leftAt} = ?
     WHERE ${SpaceParticipationCol.spaceId} = ?
       AND ${SpaceParticipationCol.memberId} = ?
       AND ${SpaceParticipationCol.leftAt} IS NULL`,
    [now, spaceId, memberId]
  );
  const membershipId = spaceMembershipEntityId(memberId, spaceId);
  const result = await sql.run(
    `UPDATE ${SPACE_MEMBERSHIPS_TABLE.tableName}
     SET ${SpaceMembershipCol.leftAt} = ?
     WHERE ${SpaceMembershipCol.id} = ?
       AND ${SpaceMembershipCol.leftAt} IS NULL`,
    [now, membershipId]
  );
  if (result.changes > 0) {
    await decrementActiveMemberCount(sql, spaceId);
  }
}

export async function executeLeaveSpaceEverywhere(
  ctx: WriteContext,
  input: LeaveSpaceEverywhereInput,
  sql: SqlClient
): Promise<ReturnType<typeof ok<void>>> {
  const memberId = await resolveLeaveEverywhereMemberId(
    ctx,
    sql,
    input.spaceId
  );
  const membership = await readMembershipForLeave(sql, memberId, input.spaceId);
  const participation = await readParticipationForLeave(
    sql,
    ctx.deviceId,
    input.spaceId
  );
  const hasActiveParticipation =
    participation !== null && participation.leftAt === null;
  const hasActiveMembership =
    membership !== null && membership.leftAt === null;
  if (!hasActiveMembership && !hasActiveParticipation) {
    return ok(undefined);
  }
  decideLeaveEverywhere();
  clearSpacePresenceLatch(input.spaceId);
  await softLeaveMemberEverywhere(sql, memberId, input.spaceId, isoNow());
  await maybeAutoEndEmptyHostSpace(ctx, sql, input.spaceId);
  return ok(undefined);
}

export const leaveSpaceEverywhereWrite = defineWrite<
  LeaveSpaceEverywhereInput,
  void
>({
  name: 'spaces.leaveEverywhere',
  parseInput: parseLeaveSpaceEverywhereInput,
  authorize: authorizeLeaveSpaceEverywhere,
  execute: executeLeaveSpaceEverywhere,
});
