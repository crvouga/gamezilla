import {
  SPACE_ALLOWLIST_TABLE,
  SpaceAllowlistCol,
  spaceAllowlistEntityId,
} from '@libs/db/shared/space-tables';
import { honey } from '@pkgs/sql';
import { ok, type WriteResult } from '@pkgs/write/shared/write-result';
import { defineWrite } from '@pkgs/write/shared/define-write';

import {
  asObjectRecord,
  authorizeSpaceHost,
  requireNonEmptyString,
} from '../space-write-helpers';

export type RemoveSpaceAllowlistInput = {
  readonly spaceId: string;
  readonly userId: string;
};

function parseRemoveSpaceAllowlistInput(
  raw: unknown
): WriteResult<RemoveSpaceAllowlistInput> {
  const record = asObjectRecord(raw, 'remove allowlist input');
  if (!record.ok) return record;
  const spaceId = requireNonEmptyString(record.value['spaceId'], 'spaceId');
  if (!spaceId.ok) return spaceId;
  const userId = requireNonEmptyString(record.value['userId'], 'userId');
  if (!userId.ok) return userId;
  return ok({ spaceId: spaceId.value, userId: userId.value });
}

export const removeSpaceAllowlistWrite = defineWrite<
  RemoveSpaceAllowlistInput,
  void
>({
  name: 'spaces.allowlist.remove',
  parseInput: parseRemoveSpaceAllowlistInput,
  authorize: async (ctx, input, db) => {
    return authorizeSpaceHost(
      ctx,
      db,
      input.spaceId,
      'Only the host can manage the allow list'
    );
  },
  execute: async (_ctx, input, db) => {
    const id = spaceAllowlistEntityId(input.spaceId, input.userId);
    await db.run(
      honey({
        deleteFrom: SPACE_ALLOWLIST_TABLE.tableName,
        where: ['=', SpaceAllowlistCol.id, id],
      })
    );
    return ok(undefined);
  },
});
