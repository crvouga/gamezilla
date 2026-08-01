import { resolveSpaceMemberId } from '@libs/spaces/shared/participation/participation-ids';
import { isSpaceHostActor } from '@libs/spaces/shared/participation/space-participation-policy';
import { clearSpacePresenceLatch } from '@libs/spaces/shared/space-presence-latch-store';
import { fail } from '@pkgs/rules/core/fail';
import { throwRulesReject } from '@pkgs/rules/core/rules-reject';
import type { AppRulesAuth } from '@libs/auth/shared/app-rules-auth';
import { SPACE_WRITE_DENIED } from '@libs/spaces/shared/rules/codes';
import type { UploadBatch } from '@pkgs/sync-engine/shared/upload-batch';
import { SPACES_TABLE } from '@libs/db/shared/space-tables';
import type { SqlClient } from '@pkgs/sql-client/interface';

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
   * Stamps `ended_at` for the last remaining collaborator.
   */
  readonly endIfLastSeat?: boolean;
};

export function parseLeaveSpaceInput(raw: unknown): LeaveSpaceInput {
  const record = asObjectRecord(raw, 'leave space input');
  const spaceId = requireNonEmptyString(record['spaceId'], 'spaceId');
  const endIfLastSeat = record['endIfLastSeat'] === true;
  return { spaceId, endIfLastSeat };
}

/**
 * Guest leave is local + room only (no DB) unless `endIfLastSeat`.
 * Host leave ends the space (I4).
 */
export async function authorizeLeaveSpace(
  auth: AppRulesAuth,
  input: LeaveSpaceInput,
  db: SqlClient
): Promise<void> {
  const accountId = requireAccountId(auth);
  if (!input.endIfLastSeat) return;
  const hasAcl = await isSpaceUserInStore(db, input.spaceId, accountId);
  if (hasAcl) return;
  const space = await readSpaceHostEnded(db, input.spaceId);
  const memberId = resolveSpaceMemberId(accountId);
  const isHost = isSpaceHostActor({
    hostId: space.hostId,
    hostMemberId: space.hostMemberId,
    hostAccountId: space.hostAccountId,
    memberId,
    accountId,
    deviceId: auth.deviceId,
  });
  if (!isHost) {
    throwRulesReject([
      fail(SPACE_WRITE_DENIED, {
        params: { message: 'Not allowed to end this space' },
      }),
    ]);
  }
}

export async function actorIsSpaceHost(
  auth: AppRulesAuth,
  db: SqlClient,
  spaceId: string
): Promise<boolean> {
  try {
    const space = await readSpaceHostEnded(db, spaceId);
    if (space.endedAt !== null) return false;
    const accountId = requireAccountId(auth);
    const memberId = resolveSpaceMemberId(accountId);
    return isSpaceHostActor({
      hostId: space.hostId,
      hostMemberId: space.hostMemberId,
      hostAccountId: space.hostAccountId,
      memberId,
      accountId,
      deviceId: auth.deviceId,
    });
  } catch {
    return false;
  }
}

export function leaveSpaceBeforeBatch(
  auth: AppRulesAuth,
  input: LeaveSpaceInput,
  willWrite: boolean
): UploadBatch | undefined {
  if (!willWrite) return undefined;
  requireAccountId(auth);
  return {
    rows: [
      {
        op: 'patch',
        table: SPACES_TABLE.tableName,
        id: input.spaceId,
        values: { ended_at: 'pending' },
      },
    ],
  };
}

export async function executeLeaveSpace(
  auth: AppRulesAuth,
  input: LeaveSpaceInput,
  db: SqlClient
): Promise<void> {
  requireAccountId(auth);
  if (await actorIsSpaceHost(auth, db, input.spaceId)) {
    await executeEndSpace(auth, input, db);
    return;
  }
  clearSpacePresenceLatch(input.spaceId);
  if (input.endIfLastSeat) {
    await stampSpaceEnded(auth, db, input.spaceId);
  }
}
