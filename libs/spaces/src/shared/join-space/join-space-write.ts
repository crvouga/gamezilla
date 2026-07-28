import {
  SPACE_INVITES_TABLE,
  SpaceCol,
  SpaceInviteCol,
  SPACES_TABLE,
} from '@libs/db/shared/space-tables';
import {
  resolveSpaceMemberId,
  spaceMembershipEntityId,
} from '@libs/spaces/shared/participation/participation-ids';
import {
  isSpaceHostActor,
  shouldBumpMemberCountOnJoin,
  shouldConsumeInviteOnJoin,
} from '@libs/spaces/shared/participation/space-participation-policy';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { honey, col } from '@pkgs/sql';
import { defineWrite } from '@pkgs/write/shared/define-write';
import { fail, ok, type WriteResult } from '@pkgs/write/shared/write-result';
import type { WriteContext } from '@pkgs/write/shared/write-context';

import {
  authorizeJoinSpaceAccess,
  findValidInviteInStore,
  readSpaceRowForJoin,
} from './join-space-access';
import { upsertSpaceMembershipRow } from '../space-row-upsert';
import {
  asObjectRecord,
  isoNow,
  migrateHostIdentity,
  requireAccountId,
  requireNonEmptyString,
  wasMembershipInactive,
} from '../space-write-helpers';

export type JoinSpaceInput = {
  readonly spaceId: string;
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
  return ok({
    spaceId: spaceId.value,
    inviteToken: parseOptionalInviteToken(record.value['inviteToken']),
  });
}

async function upsertJoinMembership(
  input: JoinSpaceInput,
  db: SqlClient,
  memberId: string
): Promise<{ readonly reactivated: boolean }> {
  return upsertSpaceMembershipRow({
    sql: db,
    membershipId: spaceMembershipEntityId(memberId, input.spaceId),
    memberId,
    spaceId: input.spaceId,
    now: isoNow(),
  });
}

async function bumpActiveMemberCount(
  db: SqlClient,
  spaceId: string
): Promise<void> {
  await db.run(
    honey({
      update: SPACES_TABLE.tableName,
      set: {
        [SpaceCol.activeMemberCount]: [
          '+',
          SpaceCol.activeMemberCount,
          1,
        ],
      },
      where: ['=', SpaceCol.id, spaceId],
    })
  );
}

async function consumeInviteUse(
  db: SqlClient,
  inviteId: string
): Promise<boolean> {
  const now = isoNow();
  const result = await db.run(
    honey({
      update: SPACE_INVITES_TABLE.tableName,
      set: {
        [SpaceInviteCol.useCount]: ['+', SpaceInviteCol.useCount, 1],
        [SpaceInviteCol.acceptedAt]: [
          'coalesce',
          SpaceInviteCol.acceptedAt,
          ['param', now],
        ],
      },
      where: [
        'and',
        ['=', SpaceInviteCol.id, inviteId],
        ['<', SpaceInviteCol.useCount, col(SpaceInviteCol.maxUses)],
      ],
    })
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
  db: SqlClient
): Promise<WriteResult<void>> {
  return authorizeJoinSpaceAccess(ctx, db, input.spaceId, input.inviteToken);
}

export async function executeJoinSpace(
  ctx: WriteContext,
  input: JoinSpaceInput,
  db: SqlClient
): Promise<WriteResult<void>> {
  const accountId = requireAccountId(ctx);
  if (!accountId.ok) return accountId;
  const memberId = resolveSpaceMemberId(accountId.value);
  const membershipId = spaceMembershipEntityId(memberId, input.spaceId);
  const membershipWasInactive = await wasMembershipInactive(db, membershipId);
  const inviteResult = await consumeInviteForJoinIfNeeded({
    sql: db,
    spaceId: input.spaceId,
    inviteToken: input.inviteToken,
    membershipWasInactive,
  });
  if (!inviteResult.ok) return inviteResult;
  const { reactivated } = await upsertJoinMembership(input, db, memberId);
  if (shouldBumpMemberCountOnJoin({ membershipWasInactive: reactivated })) {
    await bumpActiveMemberCount(db, input.spaceId);
  }
  const space = await readSpaceRowForJoin(db, input.spaceId);
  if (
    space.ok &&
    isSpaceHostActor({
      hostId: space.value.hostId,
      hostMemberId: space.value.hostMemberId,
      hostAccountId: space.value.hostAccountId,
      memberId,
      accountId: accountId.value,
      deviceId: ctx.deviceId,
    })
  ) {
    await migrateHostIdentity({
      sql: db,
      spaceId: input.spaceId,
      deviceId: ctx.deviceId,
      newMemberId: memberId,
      accountId: accountId.value,
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
