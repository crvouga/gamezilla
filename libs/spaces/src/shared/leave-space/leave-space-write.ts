import {
  SPACE_MEMBERSHIPS_TABLE,
  SpaceCol,
  SpaceMembershipCol,
  SPACES_TABLE,
} from '@libs/db/shared/space-tables';
import { spaceDeviceMembershipEntityId } from '@libs/spaces/shared/membership-key';
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

export type LeaveSpaceInput = {
  readonly spaceId: string;
};

function parseLeaveSpaceInput(
  raw: unknown
): ReturnType<typeof ok<LeaveSpaceInput>> | ReturnType<typeof fail> {
  const record = asObjectRecord(raw, 'leave space input');
  if (!record.ok) return record;
  const spaceId = requireNonEmptyString(record.value['spaceId'], 'spaceId');
  if (!spaceId.ok) return spaceId;
  return ok({ spaceId: spaceId.value });
}

export async function authorizeLeaveSpace(
  ctx: WriteContext,
  input: LeaveSpaceInput,
  sql: SqlClient
): Promise<ReturnType<typeof ok<void>> | ReturnType<typeof fail>> {
  const row = await readMembershipForLeave(sql, ctx.deviceId, input.spaceId);
  if (row === null || row.leftAt !== null) {
    return ok(undefined);
  }
  if (row.guestId !== ctx.deviceId) {
    return fail(
      'SPACE_MEMBERSHIP_GUEST_MISMATCH',
      'Only this device can leave its membership'
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

export async function executeLeaveSpace(
  ctx: WriteContext,
  input: LeaveSpaceInput,
  sql: SqlClient
): Promise<ReturnType<typeof ok<void>>> {
  const row = await readMembershipForLeave(sql, ctx.deviceId, input.spaceId);
  if (row === null || row.leftAt !== null) {
    return ok(undefined);
  }
  clearSpacePresenceLatch(input.spaceId);
  const membershipId = spaceDeviceMembershipEntityId(
    ctx.deviceId,
    input.spaceId
  );
  await sql.run(
    `UPDATE ${SPACE_MEMBERSHIPS_TABLE.tableName}
     SET ${SpaceMembershipCol.leftAt} = ?
     WHERE ${SpaceMembershipCol.id} = ?`,
    [isoNow(), membershipId]
  );
  await decrementActiveMemberCount(sql, input.spaceId);
  return ok(undefined);
}

export const leaveSpaceWrite = defineWrite<LeaveSpaceInput, void>({
  name: 'spaces.leave',
  parseInput: parseLeaveSpaceInput,
  authorize: authorizeLeaveSpace,
  execute: executeLeaveSpace,
});
