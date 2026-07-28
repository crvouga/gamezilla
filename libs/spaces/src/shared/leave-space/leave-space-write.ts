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
import type { SqlClient } from '@pkgs/sql-client/interface';
import { raw, sql } from '@pkgs/sql';
import { clearSpacePresenceLatch } from '@libs/spaces/shared/space-presence-latch-store';
import { fail, ok } from '@pkgs/write/shared/write-result';
import { defineWrite } from '@pkgs/write/shared/define-write';
import type { WriteContext } from '@pkgs/write/shared/write-context';

import {
  asObjectRecord,
  isoNow,
  maybeAutoEndEmptyHostSpace,
  readMembershipForLeave,
  requireAccountId,
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

/**
 * Soft-leave this account's membership in the space.
 */
export async function authorizeLeaveSpace(
  ctx: WriteContext,
  input: LeaveSpaceInput,
  db: SqlClient
): Promise<ReturnType<typeof ok<void>> | ReturnType<typeof fail>> {
  const accountId = requireAccountId(ctx);
  if (!accountId.ok) return accountId;
  const memberId = resolveSpaceMemberId(accountId.value);
  const row = await readMembershipForLeave(db, memberId, input.spaceId);
  if (row === null || row.leftAt !== null) {
    return ok(undefined);
  }
  if (row.memberId !== memberId) {
    return fail(
      'SPACE_MEMBERSHIP_GUEST_MISMATCH',
      'Only this member can leave its membership'
    );
  }
  return ok(undefined);
}

async function decrementActiveMemberCount(
  db: SqlClient,
  spaceId: string
): Promise<void> {
  await db.run(sql`UPDATE ${raw(SPACES_TABLE.tableName)}
     SET ${raw(SpaceCol.activeMemberCount)} = CASE
       WHEN ${raw(SpaceCol.activeMemberCount)} > 0
       THEN ${raw(SpaceCol.activeMemberCount)} - 1
       ELSE 0 END
     WHERE ${raw(SpaceCol.id)} = ${spaceId}`);
}

export async function executeLeaveSpace(
  ctx: WriteContext,
  input: LeaveSpaceInput,
  db: SqlClient
): Promise<ReturnType<typeof ok<void>> | ReturnType<typeof fail>> {
  const accountId = requireAccountId(ctx);
  if (!accountId.ok) return accountId;
  const memberId = resolveSpaceMemberId(accountId.value);
  const row = await readMembershipForLeave(db, memberId, input.spaceId);
  if (row === null || row.leftAt !== null) {
    return ok(undefined);
  }
  clearSpacePresenceLatch(input.spaceId);
  const now = isoNow();
  const membershipId = spaceMembershipEntityId(memberId, input.spaceId);
  await db.run(sql`UPDATE ${raw(SPACE_MEMBERSHIPS_TABLE.tableName)}
     SET ${raw(SpaceMembershipCol.leftAt)} = ${now}
     WHERE ${raw(SpaceMembershipCol.id)} = ${membershipId}
       AND ${raw(SpaceMembershipCol.leftAt)} IS NULL`);
  await decrementActiveMemberCount(db, input.spaceId);
  await maybeAutoEndEmptyHostSpace(ctx, db, input.spaceId);
  return ok(undefined);
}

export const leaveSpaceWrite = defineWrite<LeaveSpaceInput, void>({
  name: 'spaces.leave',
  parseInput: parseLeaveSpaceInput,
  authorize: authorizeLeaveSpace,
  execute: executeLeaveSpace,
});
