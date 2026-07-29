import type { SqlClient } from '@pkgs/sql-client/interface';
import { defineWrite } from '@pkgs/write/shared/define-write';
import type { WriteContext } from '@pkgs/write/shared/write-context';
import { fail, ok } from '@pkgs/write/shared/write-result';

import { resolveSpaceMemberId } from '@libs/spaces/shared/participation/participation-ids';
import { isSpaceHostActor } from '@libs/spaces/shared/participation/space-participation-policy';
import { clearSpacePresenceLatch } from '@libs/spaces/shared/space-presence-latch-store';
import {
  executeEndSpace,
  softLeaveMembership,
} from '../end-space/execute-end-space';
import {
  asObjectRecord,
  maybeAutoEndEmptyHostSpace,
  readMembershipForLeave,
  readSpaceHostEnded,
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
 * Host leave ends the space (I4).
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

async function actorIsSpaceHost(
  ctx: WriteContext,
  db: SqlClient,
  spaceId: string
): Promise<boolean> {
  const space = await readSpaceHostEnded(db, spaceId);
  if (!space.ok || space.value.endedAt !== null) return false;
  const accountId = requireAccountId(ctx);
  if (!accountId.ok) return false;
  const memberId = resolveSpaceMemberId(accountId.value);
  return isSpaceHostActor({
    hostId: space.value.hostId,
    hostMemberId: space.value.hostMemberId,
    hostAccountId: space.value.hostAccountId,
    memberId,
    accountId: accountId.value,
    deviceId: ctx.deviceId,
  });
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
  if (await actorIsSpaceHost(ctx, db, input.spaceId)) {
    return executeEndSpace(ctx, input, db);
  }
  clearSpacePresenceLatch(input.spaceId);
  const left = await softLeaveMembership(ctx, db, input.spaceId);
  if (!left.ok) return left;
  await maybeAutoEndEmptyHostSpace(ctx, db, input.spaceId);
  return ok(undefined);
}

export const leaveSpaceWrite = defineWrite<LeaveSpaceInput, void>({
  name: 'spaces.leave',
  parseInput: parseLeaveSpaceInput,
  authorize: authorizeLeaveSpace,
  execute: executeLeaveSpace,
});
