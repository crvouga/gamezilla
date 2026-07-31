import {
  SPACE_USERS_TABLE,
  SpaceCol,
  SPACES_TABLE,
  SpaceUserCol,
  spaceUserEntityId,
} from '@libs/db/shared/space-tables';
import { resolveSpaceMemberId } from '@libs/spaces/shared/participation/participation-ids';
import {
  isSpaceVisibility,
  type SpaceVisibility,
} from '@libs/spaces/shared/space-visibility';
import { sqlMap } from '@pkgs/sql';
import { defineWrite } from '@pkgs/write/shared/define-write';
import { fail, ok } from '@pkgs/write/shared/write-result';

import {
  asObjectRecord,
  isoNow,
  requireAccountId,
  requireNonEmptyString,
} from '../space-write-helpers';

export type CreateSpaceInput = {
  readonly spaceId: string;
  readonly visibility: SpaceVisibility;
};

function parseCreateSpaceInput(
  raw: unknown
): ReturnType<typeof ok<CreateSpaceInput>> | ReturnType<typeof fail> {
  const record = asObjectRecord(raw, 'create space input');
  if (!record.ok) return record;
  const spaceId = requireNonEmptyString(record.value['spaceId'], 'spaceId');
  if (!spaceId.ok) return spaceId;
  const visibilityRaw = record.value['visibility'];
  if (!isSpaceVisibility(visibilityRaw)) {
    return fail('INVALID_INPUT', 'visibility is required');
  }
  return ok({
    spaceId: spaceId.value,
    visibility: visibilityRaw,
  });
}

export const createSpaceWrite = defineWrite<CreateSpaceInput, void>({
  name: 'spaces.create',
  parseInput: parseCreateSpaceInput,
  authorize: async (ctx) => {
    const accountId = requireAccountId(ctx);
    if (!accountId.ok) return accountId;
    return ok(undefined);
  },
  execute: async (ctx, input, db) => {
    const accountId = requireAccountId(ctx);
    if (!accountId.ok) return accountId;
    const now = isoNow();
    const memberId = resolveSpaceMemberId(accountId.value);
    // One PowerSync writeTransaction → one CRUD upload (spaces + space_users).
    // Separate db.run calls each become their own ~multi-second upload to Postgres.
    await db.transaction(async (tx) => {
      await tx.run(
        sqlMap({
          insertInto: SPACES_TABLE.tableName,
          values: {
            [SpaceCol.id]: input.spaceId,
            [SpaceCol.hostId]: ctx.deviceId,
            [SpaceCol.createdAt]: now,
            [SpaceCol.visibility]: input.visibility,
            [SpaceCol.hostAccountId]: accountId.value,
            [SpaceCol.hostMemberId]: memberId,
          },
        })
      );
      await tx.run(
        sqlMap({
          insertInto: SPACE_USERS_TABLE.tableName,
          values: {
            [SpaceUserCol.id]: spaceUserEntityId(input.spaceId, memberId),
            [SpaceUserCol.spaceId]: input.spaceId,
            [SpaceUserCol.userId]: memberId,
            [SpaceUserCol.createdAt]: now,
            [SpaceUserCol.createdByAccountId]: accountId.value,
          },
        })
      );
    });
    return ok(undefined);
  },
});
