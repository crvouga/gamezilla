import {
  SPACE_ALLOWLIST_TABLE,
  SpaceAllowlistCol,
  spaceAllowlistEntityId,
} from '@libs/db/shared/space-tables';
import { honey } from '@pkgs/sql';
import { fail, ok, type WriteResult } from '@pkgs/write/shared/write-result';
import { defineWrite } from '@pkgs/write/shared/define-write';

import {
  asObjectRecord,
  authorizeSpaceHost,
  isoNow,
  requireAccountId,
  requireNonEmptyString,
} from '../space-write-helpers';

export type AddSpaceAllowlistInput = {
  readonly spaceId: string;
  readonly userId: string;
};

function parseAddSpaceAllowlistInput(
  raw: unknown
): WriteResult<AddSpaceAllowlistInput> {
  const record = asObjectRecord(raw, 'add allowlist input');
  if (!record.ok) return record;
  const spaceId = requireNonEmptyString(record.value['spaceId'], 'spaceId');
  if (!spaceId.ok) return spaceId;
  const userId = requireNonEmptyString(record.value['userId'], 'userId');
  if (!userId.ok) return userId;
  return ok({ spaceId: spaceId.value, userId: userId.value });
}

export const addSpaceAllowlistWrite = defineWrite<
  AddSpaceAllowlistInput,
  void
>({
  name: 'spaces.allowlist.add',
  parseInput: parseAddSpaceAllowlistInput,
  authorize: async (ctx, input, db) => {
    const host = await authorizeSpaceHost(
      ctx,
      db,
      input.spaceId,
      'Only the host can manage the allow list'
    );
    if (!host.ok) return host;
    if (input.userId === ctx.accountId) {
      return fail('SPACE_INVALID_INPUT', 'Host is already allowed');
    }
    return ok(undefined);
  },
  execute: async (ctx, input, db) => {
    const accountId = requireAccountId(ctx);
    if (!accountId.ok) return accountId;
    const id = spaceAllowlistEntityId(input.spaceId, input.userId);
    await db.run(
      honey({
        insertInto: SPACE_ALLOWLIST_TABLE.tableName,
        values: {
          [SpaceAllowlistCol.id]: id,
          [SpaceAllowlistCol.spaceId]: input.spaceId,
          [SpaceAllowlistCol.userId]: input.userId,
          [SpaceAllowlistCol.createdAt]: isoNow(),
          [SpaceAllowlistCol.createdByAccountId]: accountId.value,
        },
        onConflict: {
          target: [SpaceAllowlistCol.id],
          doNothing: true,
        },
      })
    );
    return ok(undefined);
  },
});
