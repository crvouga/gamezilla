import {
  SPACE_MEMBERSHIPS_TABLE,
  SPACE_PARTICIPATIONS_TABLE,
  SpaceCol,
  SpaceMembershipCol,
  SpaceParticipationCol,
  SPACES_TABLE,
} from '@libs/db/shared/space-tables';
import {
  resolveSpaceMemberId,
  spaceMembershipEntityId,
} from '@libs/spaces/shared/participation/participation-ids';
import { decideLeaveEverywhere } from '@libs/spaces/shared/participation/space-participation-policy';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { clearSpacePresenceLatch } from '@libs/spaces/shared/space-presence-latch-store';
import { fail, ok } from '@pkgs/write/shared/write-result';
import { defineWrite } from '@pkgs/write/shared/define-write';
import type { WriteContext } from '@pkgs/write/shared/write-context';

import {
  asObjectRecord,
  isoNow,
  readMembershipForLeave,
  requireNonEmptyString,
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

export async function authorizeLeaveSpaceEverywhere(
  ctx: WriteContext,
  input: LeaveSpaceEverywhereInput,
  sql: SqlClient
): Promise<ReturnType<typeof ok<void>> | ReturnType<typeof fail>> {
  const memberId = resolveSpaceMemberId({
    accountId: ctx.accountId,
    deviceId: ctx.deviceId,
  });
  const row = await readMembershipForLeave(sql, memberId, input.spaceId);
  if (row === null || row.leftAt !== null) {
    return ok(undefined);
  }
  if (row.memberId !== memberId) {
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

export async function executeLeaveSpaceEverywhere(
  ctx: WriteContext,
  input: LeaveSpaceEverywhereInput,
  sql: SqlClient
): Promise<ReturnType<typeof ok<void>>> {
  const memberId = resolveSpaceMemberId({
    accountId: ctx.accountId,
    deviceId: ctx.deviceId,
  });
  const row = await readMembershipForLeave(sql, memberId, input.spaceId);
  if (row === null || row.leftAt !== null) {
    return ok(undefined);
  }
  decideLeaveEverywhere();
  clearSpacePresenceLatch(input.spaceId);
  const now = isoNow();
  await sql.run(
    `UPDATE ${SPACE_PARTICIPATIONS_TABLE.tableName}
     SET ${SpaceParticipationCol.leftAt} = ?
     WHERE ${SpaceParticipationCol.spaceId} = ?
       AND ${SpaceParticipationCol.memberId} = ?
       AND ${SpaceParticipationCol.leftAt} IS NULL`,
    [now, input.spaceId, memberId]
  );
  const membershipId = spaceMembershipEntityId(memberId, input.spaceId);
  await sql.run(
    `UPDATE ${SPACE_MEMBERSHIPS_TABLE.tableName}
     SET ${SpaceMembershipCol.leftAt} = ?
     WHERE ${SpaceMembershipCol.id} = ?
       AND ${SpaceMembershipCol.leftAt} IS NULL`,
    [now, membershipId]
  );
  await decrementActiveMemberCount(sql, input.spaceId);
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
