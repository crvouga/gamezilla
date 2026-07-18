import {
  SPACE_MEMBERSHIPS_TABLE,
  SPACE_PARTICIPATIONS_TABLE,
  SpaceCol,
  SpaceMembershipCol,
  SpaceParticipationCol,
  SPACES_TABLE,
} from '@libs/db/shared/space-tables';
import {
  resolveSpaceMemberId,
  spaceMembershipEntityId,
  spaceParticipationEntityId,
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
    const memberId = resolveSpaceMemberId({
      accountId: ctx.accountId,
      deviceId: ctx.deviceId,
    });
    await sql.run(
      `INSERT INTO ${SPACES_TABLE.tableName}
       (${SpaceCol.id}, ${SpaceCol.hostId}, ${SpaceCol.createdAt},
        ${SpaceCol.visibility}, ${SpaceCol.hostAccountId},
        ${SpaceCol.hostMemberId}, ${SpaceCol.hostUsername},
        ${SpaceCol.hostAvatarConfig}, ${SpaceCol.activeMemberCount})
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        input.spaceId,
        ctx.deviceId,
        now,
        visibility,
        ctx.accountId,
        memberId,
        input.hostUsername,
        input.hostAvatarConfig,
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
    const participationId = spaceParticipationEntityId(
      ctx.deviceId,
      input.spaceId
    );
    await sql.run(
      `INSERT INTO ${SPACE_PARTICIPATIONS_TABLE.tableName}
       (${SpaceParticipationCol.id}, ${SpaceParticipationCol.spaceId},
        ${SpaceParticipationCol.memberId}, ${SpaceParticipationCol.deviceId},
        ${SpaceParticipationCol.deviceLabel}, ${SpaceParticipationCol.joinedAt},
        ${SpaceParticipationCol.leftAt})
       VALUES (?, ?, ?, ?, ?, ?, NULL)`,
      [
        participationId,
        input.spaceId,
        memberId,
        ctx.deviceId,
        input.deviceLabel,
        now,
      ]
    );
    return ok(undefined);
  },
});
