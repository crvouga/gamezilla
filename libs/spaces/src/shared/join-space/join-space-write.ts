import {
  SPACE_INVITES_TABLE,
  SpaceCol,
  SpaceInviteCol,
  SPACES_TABLE,
} from '@libs/db/shared/space-tables';
import {
  resolveSpaceMemberId,
  spaceMembershipEntityId,
  spaceParticipationEntityId,
} from '@libs/spaces/shared/participation/participation-ids';
import {
  isSpaceHostActor,
  shouldBumpMemberCountOnJoin,
  shouldConsumeInviteOnJoin,
} from '@libs/spaces/shared/participation/space-participation-policy';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { defineWrite } from '@pkgs/write/shared/define-write';
import { fail, ok, type WriteResult } from '@pkgs/write/shared/write-result';
import type { WriteContext } from '@pkgs/write/shared/write-context';

import {
  authorizeJoinSpaceAccess,
  findValidInviteInStore,
  readSpaceRowForJoin,
} from './join-space-access';
import {
  upsertSpaceMembershipRow,
  upsertSpaceParticipationRow,
} from '../space-row-upsert';
import {
  asObjectRecord,
  isoNow,
  migrateHostIdentity,
  requireNonEmptyString,
  wasMembershipInactive,
} from '../space-write-helpers';

export type JoinSpaceInput = {
  readonly spaceId: string;
  readonly deviceLabel: string;
  readonly inviteToken: string | null;
};

function parseOptionalInviteToken(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseJoinSpaceInput(raw: unknown): WriteResult<JoinSpaceInput> {
  const record = asObjectRecord(raw, 'join space input');
  if (!record.ok) return record;
  const spaceId = requireNonEmptyString(record.value['spaceId'], 'spaceId');
  if (!spaceId.ok) return spaceId;
  const deviceLabelRaw = record.value['deviceLabel'];
  if (
    typeof deviceLabelRaw !== 'string' ||
    deviceLabelRaw.trim().length === 0
  ) {
    return fail('INVALID_INPUT', 'deviceLabel is required');
  }
  return ok({
    spaceId: spaceId.value,
    deviceLabel: deviceLabelRaw.trim(),
    inviteToken: parseOptionalInviteToken(record.value['inviteToken']),
  });
}

async function upsertJoinMembership(
  input: JoinSpaceInput,
  sql: SqlClient,
  memberId: string
): Promise<{ readonly reactivated: boolean }> {
  return upsertSpaceMembershipRow({
    sql,
    membershipId: spaceMembershipEntityId(memberId, input.spaceId),
    memberId,
    spaceId: input.spaceId,
    now: isoNow(),
  });
}

async function upsertJoinParticipation(
  ctx: WriteContext,
  input: JoinSpaceInput,
  sql: SqlClient,
  memberId: string
): Promise<void> {
  await upsertSpaceParticipationRow({
    sql,
    participationId: spaceParticipationEntityId(ctx.deviceId, input.spaceId),
    spaceId: input.spaceId,
    memberId,
    deviceId: ctx.deviceId,
    deviceLabel: input.deviceLabel,
    now: isoNow(),
  });
}

async function bumpActiveMemberCount(
  sql: SqlClient,
  spaceId: string
): Promise<void> {
  await sql.run(
    `UPDATE ${SPACES_TABLE.tableName}
     SET ${SpaceCol.activeMemberCount} = ${SpaceCol.activeMemberCount} + 1
     WHERE ${SpaceCol.id} = ?`,
    [spaceId]
  );
}

async function consumeInviteUse(
  sql: SqlClient,
  inviteId: string
): Promise<boolean> {
  const now = isoNow();
  const result = await sql.run(
    `UPDATE ${SPACE_INVITES_TABLE.tableName}
     SET ${SpaceInviteCol.useCount} = ${SpaceInviteCol.useCount} + 1,
         ${SpaceInviteCol.acceptedAt} = COALESCE(${SpaceInviteCol.acceptedAt}, ?)
     WHERE ${SpaceInviteCol.id} = ?
       AND ${SpaceInviteCol.useCount} < ${SpaceInviteCol.maxUses}`,
    [now, inviteId]
  );
  return result.changes > 0;
}

async function consumeInviteForJoinIfNeeded(args: {
  readonly sql: SqlClient;
  readonly spaceId: string;
  readonly inviteToken: string | null;
  readonly membershipWasInactive: boolean;
}): Promise<WriteResult<void>> {
  if (
    !shouldConsumeInviteOnJoin({
      membershipWasInactive: args.membershipWasInactive,
      hasInviteToken: args.inviteToken !== null && args.inviteToken.length > 0,
    })
  ) {
    return ok(undefined);
  }
  const invite = await findValidInviteInStore(
    args.sql,
    args.inviteToken!,
    args.spaceId
  );
  if (invite === null) {
    return fail('SPACE_INVITE_EXHAUSTED', 'Invite has already been used up');
  }
  const consumed = await consumeInviteUse(args.sql, invite.inviteId);
  if (!consumed) {
    return fail('SPACE_INVITE_EXHAUSTED', 'Invite has already been used up');
  }
  return ok(undefined);
}

export async function authorizeJoinSpace(
  ctx: WriteContext,
  input: JoinSpaceInput,
  sql: SqlClient
): Promise<WriteResult<void>> {
  return authorizeJoinSpaceAccess(ctx, sql, input.spaceId, input.inviteToken);
}

export async function executeJoinSpace(
  ctx: WriteContext,
  input: JoinSpaceInput,
  sql: SqlClient
): Promise<WriteResult<void>> {
  const memberId = resolveSpaceMemberId({
    accountId: ctx.accountId,
    deviceId: ctx.deviceId,
  });
  const membershipId = spaceMembershipEntityId(memberId, input.spaceId);
  const membershipWasInactive = await wasMembershipInactive(sql, membershipId);
  const inviteResult = await consumeInviteForJoinIfNeeded({
    sql,
    spaceId: input.spaceId,
    inviteToken: input.inviteToken,
    membershipWasInactive,
  });
  if (!inviteResult.ok) return inviteResult;
  const { reactivated } = await upsertJoinMembership(input, sql, memberId);
  await upsertJoinParticipation(ctx, input, sql, memberId);
  if (shouldBumpMemberCountOnJoin({ membershipWasInactive: reactivated })) {
    await bumpActiveMemberCount(sql, input.spaceId);
  }
  const space = await readSpaceRowForJoin(sql, input.spaceId);
  if (
    space.ok &&
    isSpaceHostActor({
      hostId: space.value.hostId,
      hostMemberId: space.value.hostMemberId,
      hostAccountId: space.value.hostAccountId,
      memberId,
      accountId: ctx.accountId,
      deviceId: ctx.deviceId,
    })
  ) {
    await migrateHostIdentity({
      sql,
      spaceId: input.spaceId,
      deviceId: ctx.deviceId,
      newMemberId: memberId,
      accountId: ctx.accountId,
    });
  }
  return ok(undefined);
}

export const joinSpaceWrite = defineWrite<JoinSpaceInput, void>({
  name: 'spaces.join',
  parseInput: parseJoinSpaceInput,
  authorize: authorizeJoinSpace,
  execute: executeJoinSpace,
});
