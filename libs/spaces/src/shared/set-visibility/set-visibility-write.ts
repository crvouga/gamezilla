import { SpaceCol, SPACES_TABLE } from '@libs/db/shared/space-tables';
import { resolveSpaceMemberId } from '@libs/spaces/shared/participation/participation-ids';
import {
  isSpaceVisibility,
  type SpaceVisibility,
} from '@libs/spaces/shared/space-visibility';
import { fail, ok } from '@pkgs/write/shared/write-result';
import { defineWrite } from '@pkgs/write/shared/define-write';

import {
  asObjectRecord,
  authorizeSpaceHost,
  requireAccountId,
  requireNonEmptyString,
} from '../space-write-helpers';

export type SetSpaceVisibilityInput = {
  readonly spaceId: string;
  readonly visibility: SpaceVisibility;
};

function parseSetSpaceVisibilityInput(
  raw: unknown
): ReturnType<typeof ok<SetSpaceVisibilityInput>> | ReturnType<typeof fail> {
  const record = asObjectRecord(raw, 'set visibility input');
  if (!record.ok) return record;
  const spaceId = requireNonEmptyString(record.value['spaceId'], 'spaceId');
  if (!spaceId.ok) return spaceId;
  const visibility = record.value['visibility'];
  if (!isSpaceVisibility(visibility)) {
    return fail('INVALID_INPUT', 'visibility is required');
  }
  return ok({ spaceId: spaceId.value, visibility });
}

export const setSpaceVisibilityWrite = defineWrite<
  SetSpaceVisibilityInput,
  void
>({
  name: 'spaces.setVisibility',
  parseInput: parseSetSpaceVisibilityInput,
  authorize: async (ctx, input, sql) => {
    const host = await authorizeSpaceHost(
      ctx,
      sql,
      input.spaceId,
      'Only the host can change visibility'
    );
    if (!host.ok) return host;
    if (input.visibility !== 'private' && ctx.accountId === null) {
      return fail(
        'SIGN_IN_REQUIRED',
        'Sign in to make a space public or friends-only'
      );
    }
    return ok(undefined);
  },
  execute: async (ctx, input, sql) => {
    const accountId = requireAccountId(ctx);
    if (!accountId.ok) return accountId;
    const memberId = resolveSpaceMemberId(accountId.value);
    await sql.run(
      `UPDATE ${SPACES_TABLE.tableName}
       SET ${SpaceCol.visibility} = ?,
           ${SpaceCol.hostId} = ?,
           ${SpaceCol.hostMemberId} = ?
       WHERE ${SpaceCol.id} = ?`,
      [input.visibility, ctx.deviceId, memberId, input.spaceId]
    );
    return ok(undefined);
  },
});
