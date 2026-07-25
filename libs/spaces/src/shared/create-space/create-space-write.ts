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
  execute: async (ctx, input, sql) => {
    const accountId = requireAccountId(ctx);
    if (!accountId.ok) return accountId;
    const now = isoNow();
    const memberId = resolveSpaceMemberId(accountId.value);
    await sql.run(
      `INSERT INTO ${SPACES_TABLE.tableName}
       (${SpaceCol.id}, ${SpaceCol.hostId}, ${SpaceCol.createdAt},
        ${SpaceCol.visibility}, ${SpaceCol.hostAccountId},
        ${SpaceCol.hostMemberId}, ${SpaceCol.activeMemberCount})
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [
        input.spaceId,
        ctx.deviceId,
        now,
        input.visibility,
        accountId.value,
        memberId,
      ]
    );
    const membershipId = spaceMembershipEntityId(memberId, input.spaceId);
    await sql.run(
      `INSERT INTO ${SPACE_MEMBERSHIPS_TABLE.tableName}
       (${SpaceMembershipCol.id}, ${SpaceMembershipCol.memberId},
        ${SpaceMembershipCol.spaceId}, ${SpaceMembershipCol.joinedAt},
        ${SpaceMembershipCol.leftAt}, ${SpaceMembershipCol.profileId})
       VALUES (?, ?, ?, ?, NULL, ?)`,
      [membershipId, memberId, input.spaceId, now, memberId]
    );
    return ok(undefined);
  },
});
