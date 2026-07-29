import {
  SPACE_USERS_TABLE,
  SpaceUserCol,
  spaceUserEntityId,
} from '@libs/db/shared/space-tables';
import { honey } from '@pkgs/sql';
import { ok, type WriteResult } from '@pkgs/write/shared/write-result';
import { defineWrite } from '@pkgs/write/shared/define-write';

import {
  asObjectRecord,
  authorizeSpaceHost,
  requireNonEmptyString,
} from '../space-write-helpers';

export type RemoveSpaceUserInput = {
  readonly spaceId: string;
  readonly userId: string;
};

function parseRemoveSpaceUserInput(
  raw: unknown
): WriteResult<RemoveSpaceUserInput> {
  const record = asObjectRecord(raw, 'remove space user input');
  if (!record.ok) return record;
  const spaceId = requireNonEmptyString(record.value['spaceId'], 'spaceId');
  if (!spaceId.ok) return spaceId;
  const userId = requireNonEmptyString(record.value['userId'], 'userId');
  if (!userId.ok) return userId;
  return ok({ spaceId: spaceId.value, userId: userId.value });
}

export const removeSpaceUserWrite = defineWrite<RemoveSpaceUserInput, void>({
  name: 'spaces.users.remove',
  parseInput: parseRemoveSpaceUserInput,
  authorize: async (ctx, input, db) => {
    return authorizeSpaceHost(
      ctx,
      db,
      input.spaceId,
      'Only the host can manage space users'
    );
  },
  execute: async (_ctx, input, db) => {
    const id = spaceUserEntityId(input.spaceId, input.userId);
    await db.run(
      honey({
        deleteFrom: SPACE_USERS_TABLE.tableName,
        where: ['=', SpaceUserCol.id, id],
      })
    );
    return ok(undefined);
  },
});
