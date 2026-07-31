import { SpaceCol, SPACES_TABLE } from '@libs/db/shared/space-tables';
import { resolveSpaceMemberId } from '@libs/spaces/shared/participation/participation-ids';
import { sqlMap } from '@pkgs/sql';
import { defineWrite } from '@pkgs/write/shared/define-write';
import { fail, ok } from '@pkgs/write/shared/write-result';

import {
  asObjectRecord,
  authorizeSpaceHost,
  requireAccountId,
  requireNonEmptyString,
} from '../space-write-helpers';

export type RenameSpaceInput = {
  readonly spaceId: string;
  readonly title: string;
};

function parseRenameSpaceInput(
  raw: unknown
): ReturnType<typeof ok<RenameSpaceInput>> | ReturnType<typeof fail> {
  const record = asObjectRecord(raw, 'rename space input');
  if (!record.ok) return record;
  const spaceId = requireNonEmptyString(record.value['spaceId'], 'spaceId');
  if (!spaceId.ok) return spaceId;
  const title = record.value['title'];
  if (typeof title !== 'string') {
    return fail('INVALID_INPUT', 'title is required');
  }
  return ok({ spaceId: spaceId.value, title });
}

export const renameSpaceWrite = defineWrite<RenameSpaceInput, void>({
  name: 'spaces.rename',
  parseInput: parseRenameSpaceInput,
  authorize: async (ctx, input, db) =>
    authorizeSpaceHost(
      ctx,
      db,
      input.spaceId,
      'Only the host can rename this space'
    ),
  execute: async (ctx, input, db) => {
    const accountId = requireAccountId(ctx);
    if (!accountId.ok) return accountId;
    const trimmed = input.title.trim();
    const memberId = resolveSpaceMemberId(accountId.value);
    await db.run(
      sqlMap({
        update: SPACES_TABLE.tableName,
        set: {
          [SpaceCol.title]: trimmed.length > 0 ? trimmed : null,
          [SpaceCol.hostId]: ctx.deviceId,
          [SpaceCol.hostMemberId]: memberId,
        },
        where: ['=', SpaceCol.id, input.spaceId],
      })
    );
    return ok(undefined);
  },
});
