import { SpaceCol, SPACES_TABLE } from '@libs/db/shared/space-tables';
import { resolveSpaceMemberId } from '@libs/spaces/shared/participation/participation-ids';
import {
  isSpaceVisibility,
  type SpaceVisibility,
} from '@libs/spaces/shared/space-visibility';
import { sql, ident } from '@pkgs/sql';
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
  authorize: async (ctx, input, db) => {
    const host = await authorizeSpaceHost(
      ctx,
      db,
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
  execute: async (ctx, input, db) => {
    const accountId = requireAccountId(ctx);
    if (!accountId.ok) return accountId;
    const memberId = resolveSpaceMemberId(accountId.value);
    await db.run(sql`UPDATE ${ident(SPACES_TABLE.tableName)}
       SET ${ident(SpaceCol.visibility)} = ${input.visibility},
           ${ident(SpaceCol.hostId)} = ${ctx.deviceId},
           ${ident(SpaceCol.hostMemberId)} = ${memberId}
       WHERE ${ident(SpaceCol.id)} = ${input.spaceId}`);
    return ok(undefined);
  },
});
