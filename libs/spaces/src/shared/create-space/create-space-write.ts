import {
  SPACE_MEMBERSHIPS_TABLE,
  SpaceCol,
  SpaceMembershipCol,
  SPACES_TABLE,
} from '@libs/db/shared/space-tables';
import {
  resolveSpaceMemberId,
  spaceMembershipEntityId,
} from '@libs/spaces/shared/participation/participation-ids';
import {
  isSpaceVisibility,
  type SpaceVisibility,
} from '@libs/spaces/shared/space-visibility';
import { raw, sql } from '@pkgs/sql';
import { fail, ok } from '@pkgs/write/shared/write-result';
import { defineWrite } from '@pkgs/write/shared/define-write';

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
    await db.run(sql`INSERT INTO ${raw(SPACES_TABLE.tableName)}
       (${raw(SpaceCol.id)}, ${raw(SpaceCol.hostId)}, ${raw(SpaceCol.createdAt)},
        ${raw(SpaceCol.visibility)}, ${raw(SpaceCol.hostAccountId)},
        ${raw(SpaceCol.hostMemberId)}, ${raw(SpaceCol.activeMemberCount)})
       VALUES (${input.spaceId}, ${ctx.deviceId}, ${now}, ${input.visibility}, ${accountId.value}, ${memberId}, 1)`);
    const membershipId = spaceMembershipEntityId(memberId, input.spaceId);
    await db.run(sql`INSERT INTO ${raw(SPACE_MEMBERSHIPS_TABLE.tableName)}
       (${raw(SpaceMembershipCol.id)}, ${raw(SpaceMembershipCol.memberId)},
        ${raw(SpaceMembershipCol.spaceId)}, ${raw(SpaceMembershipCol.joinedAt)},
        ${raw(SpaceMembershipCol.leftAt)}, ${raw(SpaceMembershipCol.profileId)})
       VALUES (${membershipId}, ${memberId}, ${input.spaceId}, ${now}, NULL, ${memberId})`);
    return ok(undefined);
  },
});
