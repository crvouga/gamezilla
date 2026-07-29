import { SpaceCol, SPACES_TABLE } from '@libs/db/shared/space-tables';
import { resolveSpaceMemberId } from '@libs/spaces/shared/participation/participation-ids';
import { clearSpacePresenceLatch } from '@libs/spaces/shared/space-presence-latch-store';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { honey } from '@pkgs/sql';
import { ok, type WriteResult } from '@pkgs/write/shared/write-result';
import type { WriteContext } from '@pkgs/write/shared/write-context';

import { isoNow, requireAccountId } from '../space-write-helpers';

export type EndSpaceInput = {
  readonly spaceId: string;
};

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
 * End a live space. Shared by explicit End and host Leave (I4: host leave = end).
 * Seats live in room state — no membership soft-leave.
 */
export async function executeEndSpace(
  ctx: WriteContext,
  input: EndSpaceInput,
  db: SqlClient
): Promise<WriteResult<void>> {
  clearSpacePresenceLatch(input.spaceId);
  return stampSpaceEnded(ctx, db, input.spaceId);
}
