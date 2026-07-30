import type { SqlClient } from '@pkgs/sql-client/interface';
import { defineWrite } from '@pkgs/write/shared/define-write';
import type { WriteContext } from '@pkgs/write/shared/write-context';
import { fail, ok } from '@pkgs/write/shared/write-result';

import { resolveSpaceMemberId } from '@libs/spaces/shared/participation/participation-ids';
import { isSpaceHostActor } from '@libs/spaces/shared/participation/space-participation-policy';
import { clearSpacePresenceLatch } from '@libs/spaces/shared/space-presence-latch-store';
import {
  executeEndSpace,
  stampSpaceEnded,
} from '../end-space/execute-end-space';
import {
  asObjectRecord,
  isSpaceUserInStore,
  readSpaceHostEnded,
  requireAccountId,
  requireNonEmptyString,
} from '../space-write-helpers';

export type LeaveSpaceInput = {
  readonly spaceId: string;
  /**
   * Client observed that room seats would be empty after this leave.
   * Stamps `ended_at` for the last remaining collaborator (replaces membership-count auto-end).
   */
  readonly endIfLastSeat?: boolean;
};

function parseLeaveSpaceInput(
  raw: unknown
): ReturnType<typeof ok<LeaveSpaceInput>> | ReturnType<typeof fail> {
  const record = asObjectRecord(raw, 'leave space input');
  if (!record.ok) return record;
  const spaceId = requireNonEmptyString(record.value['spaceId'], 'spaceId');
  if (!spaceId.ok) return spaceId;
  const endIfLastSeat = record.value['endIfLastSeat'] === true;
  return ok({ spaceId: spaceId.value, endIfLastSeat });
}

/**
 * Guest leave is local + room only (no DB) unless `endIfLastSeat`.
 * Host leave ends the space (I4).
 */
export async function authorizeLeaveSpace(
  ctx: WriteContext,
  input: LeaveSpaceInput,
  db: SqlClient
): Promise<ReturnType<typeof ok<void>> | ReturnType<typeof fail>> {
  const accountId = requireAccountId(ctx);
  if (!accountId.ok) return accountId;
  if (input.endIfLastSeat) {
    const hasAcl = await isSpaceUserInStore(db, input.spaceId, accountId.value);
    if (!hasAcl) {
      const space = await readSpaceHostEnded(db, input.spaceId);
      if (!space.ok) return space;
      const memberId = resolveSpaceMemberId(accountId.value);
      const isHost = isSpaceHostActor({
        hostId: space.value.hostId,
        hostMemberId: space.value.hostMemberId,
        hostAccountId: space.value.hostAccountId,
        memberId,
        accountId: accountId.value,
        deviceId: ctx.deviceId,
      });
      if (!isHost) {
        return fail('SPACE_WRITE_DENIED', 'Not allowed to end this space');
      }
    }
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
  if (await actorIsSpaceHost(ctx, db, input.spaceId)) {
    return executeEndSpace(ctx, input, db);
  }
  clearSpacePresenceLatch(input.spaceId);
  if (input.endIfLastSeat) {
    return stampSpaceEnded(ctx, db, input.spaceId);
  }
  return ok(undefined);
}

export const leaveSpaceWrite = defineWrite<LeaveSpaceInput, void>({
  name: 'spaces.leave',
  parseInput: parseLeaveSpaceInput,
  authorize: authorizeLeaveSpace,
  execute: executeLeaveSpace,
});
