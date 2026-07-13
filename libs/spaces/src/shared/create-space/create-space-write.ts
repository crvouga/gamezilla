import {
  SPACE_MEMBERSHIPS_TABLE,
  SpaceCol,
  SpaceMembershipCol,
  SPACES_TABLE,
} from '@libs/db/shared/space-tables';
import { spaceDeviceMembershipEntityId } from '@libs/spaces/shared/membership-key';
import {
  isSpaceVisibility,
  type SpaceVisibility,
} from '@libs/spaces/shared/space-visibility';
import { fail, ok } from '@pkgs/write/shared/write-result';
import { defineWrite } from '@pkgs/write/shared/define-write';

import {
  asObjectRecord,
  isoNow,
  requireNonEmptyString,
} from '../space-write-helpers';

export type CreateSpaceInput = {
  readonly spaceId: string;
  readonly visibility: SpaceVisibility;
  readonly deviceLabel: string;
  readonly hostUsername: string | null;
  readonly hostAvatarConfig: string | null;
};

function parseNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  return value;
}

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
  const deviceLabelRaw = record.value['deviceLabel'];
  if (typeof deviceLabelRaw !== 'string' || deviceLabelRaw.trim().length === 0) {
    return fail('INVALID_INPUT', 'deviceLabel is required');
  }
  return ok({
    spaceId: spaceId.value,
    visibility: visibilityRaw,
    deviceLabel: deviceLabelRaw.trim(),
    hostUsername: parseNullableString(record.value['hostUsername']),
    hostAvatarConfig: parseNullableString(record.value['hostAvatarConfig']),
  });
}

function resolveCreateVisibility(
  accountId: string | null,
  visibility: SpaceVisibility
): SpaceVisibility {
  if (accountId === null && visibility !== 'private') {
    return 'private';
  }
  return visibility;
}

export const createSpaceWrite = defineWrite<CreateSpaceInput, void>({
  name: 'spaces.create',
  parseInput: parseCreateSpaceInput,
  authorize: async () => ok(undefined),
  execute: async (ctx, input, sql) => {
    const now = isoNow();
    const visibility = resolveCreateVisibility(ctx.accountId, input.visibility);
    await sql.run(
      `INSERT INTO ${SPACES_TABLE.tableName}
       (${SpaceCol.id}, ${SpaceCol.hostId}, ${SpaceCol.createdAt},
        ${SpaceCol.visibility}, ${SpaceCol.hostAccountId},
        ${SpaceCol.hostUsername}, ${SpaceCol.hostAvatarConfig},
        ${SpaceCol.activeMemberCount})
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        input.spaceId,
        ctx.deviceId,
        now,
        visibility,
        ctx.accountId,
        input.hostUsername,
        input.hostAvatarConfig,
      ]
    );
    const membershipId = spaceDeviceMembershipEntityId(
      ctx.deviceId,
      input.spaceId
    );
    await sql.run(
      `INSERT INTO ${SPACE_MEMBERSHIPS_TABLE.tableName}
       (${SpaceMembershipCol.id}, ${SpaceMembershipCol.guestId},
        ${SpaceMembershipCol.spaceId}, ${SpaceMembershipCol.joinedAt},
        ${SpaceMembershipCol.leftAt}, ${SpaceMembershipCol.profileId},
        ${SpaceMembershipCol.deviceLabel})
       VALUES (?, ?, ?, ?, NULL, ?, ?)`,
      [
        membershipId,
        ctx.deviceId,
        input.spaceId,
        now,
        ctx.myId,
        input.deviceLabel,
      ]
    );
    return ok(undefined);
  },
});
