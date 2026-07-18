import { SpaceCol, SPACES_TABLE } from '@libs/db/shared/space-tables';
import { resolveSpaceMemberId } from '@libs/spaces/shared/participation/participation-ids';
import { clearSpacePresenceLatch } from '@libs/spaces/shared/space-presence-latch-store';
import { ok } from '@pkgs/write/shared/write-result';
import { defineWrite } from '@pkgs/write/shared/define-write';
import type { WriteResult } from '@pkgs/write/shared/write-result';

import { executeLeaveSpaceEverywhere } from '../leave-space/leave-space-everywhere-write';
import {
  asObjectRecord,
  authorizeSpaceHost,
  isoNow,
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
  authorize: async (ctx, input, sql) =>
    authorizeSpaceHost(
      ctx,
      sql,
      input.spaceId,
      'Only the host can end this space'
    ),
  execute: async (ctx, input, sql) => {
    clearSpacePresenceLatch(input.spaceId);
    const memberId = resolveSpaceMemberId({
      accountId: ctx.accountId,
      deviceId: ctx.deviceId,
    });
    await sql.run(
      `UPDATE ${SPACES_TABLE.tableName}
       SET ${SpaceCol.endedAt} = ?,
           ${SpaceCol.hostId} = ?,
           ${SpaceCol.hostMemberId} = ?
       WHERE ${SpaceCol.id} = ?`,
      [isoNow(), ctx.deviceId, memberId, input.spaceId]
    );
    // Drop this member everywhere so miniplayer / presence do not wait on
    // auto-leave watching ended_at.
    return executeLeaveSpaceEverywhere(ctx, input, sql);
  },
});
