import { SpaceCol, SPACES_TABLE } from '@libs/db/shared/space-tables';
import { resolveSpaceMemberId } from '@libs/spaces/shared/participation/participation-ids';
import { clearSpacePresenceLatch } from '@libs/spaces/shared/space-presence-latch-store';
import { honey } from '@pkgs/sql';
import { ok } from '@pkgs/write/shared/write-result';
import { defineWrite } from '@pkgs/write/shared/define-write';
import type { WriteResult } from '@pkgs/write/shared/write-result';

import { executeLeaveSpace } from '../leave-space/leave-space-write';
import {
  asObjectRecord,
  authorizeSpaceHost,
  isoNow,
  requireAccountId,
  requireNonEmptyString,
} from '../space-write-helpers';

export type EndSpaceInput = {
  readonly spaceId: string;
};

function parseEndSpaceInput(raw: unknown): WriteResult<EndSpaceInput> {
  const record = asObjectRecord(raw, 'end space input');
  if (!record.ok) return record;
  const spaceId = requireNonEmptyString(record.value['spaceId'], 'spaceId');
  if (!spaceId.ok) return spaceId;
  return ok({ spaceId: spaceId.value });
}

export const endSpaceWrite = defineWrite<EndSpaceInput, void>({
  name: 'spaces.end',
  parseInput: parseEndSpaceInput,
  authorize: async (ctx, input, db) =>
    authorizeSpaceHost(
      ctx,
      db,
      input.spaceId,
      'Only the host can end this space'
    ),
  execute: async (ctx, input, db) => {
    clearSpacePresenceLatch(input.spaceId);
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
        },
        where: ['=', SpaceCol.id, input.spaceId],
      })
    );
    return executeLeaveSpace(ctx, input, db);
  },
});
