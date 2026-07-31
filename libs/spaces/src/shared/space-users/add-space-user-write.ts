import { fail, ok, type WriteResult } from '@pkgs/write/shared/write-result';
import { defineWrite } from '@pkgs/write/shared/define-write';

import {
  asObjectRecord,
  authorizeSpaceHost,
  requireAccountId,
  requireNonEmptyString,
  upsertSpaceUserRow,
} from '../space-write-helpers';

export type AddSpaceUserInput = {
  readonly spaceId: string;
  readonly userId: string;
};

function parseAddSpaceUserInput(raw: unknown): WriteResult<AddSpaceUserInput> {
  const record = asObjectRecord(raw, 'add space user input');
  if (!record.ok) return record;
  const spaceId = requireNonEmptyString(record.value['spaceId'], 'spaceId');
  if (!spaceId.ok) return spaceId;
  const userId = requireNonEmptyString(record.value['userId'], 'userId');
  if (!userId.ok) return userId;
  return ok({ spaceId: spaceId.value, userId: userId.value });
}

export const addSpaceUserWrite = defineWrite<AddSpaceUserInput, void>({
  name: 'spaces.users.add',
  parseInput: parseAddSpaceUserInput,
  authorize: async (ctx, input, db) => {
    const host = await authorizeSpaceHost(
      ctx,
      db,
      input.spaceId,
      'Only the host can manage space users'
    );
    if (!host.ok) return host;
    if (input.userId === ctx.accountId) {
      return fail('SPACE_INVALID_INPUT', 'Host is already a space user');
    }
    return ok(undefined);
  },
  execute: async (ctx, input, db) => {
    const accountId = requireAccountId(ctx);
    if (!accountId.ok) return accountId;
    await upsertSpaceUserRow({
      db,
      spaceId: input.spaceId,
      userId: input.userId,
      createdByAccountId: accountId.value,
    });
    return ok(undefined);
  },
});
