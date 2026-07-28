import {
  FRIENDSHIPS_TABLE,
  FriendshipCol,
} from '@libs/db/shared/friends-tables';
import {
  SPACE_INVITES_TABLE,
  SPACE_MEMBERSHIPS_TABLE,
  SpaceCol,
  SpaceInviteCol,
  SpaceMembershipCol,
  SPACES_TABLE,
} from '@libs/db/shared/space-tables';
import { canonicalUserPair } from '@libs/spaces/shared/canonical-user-pair';
import {
  resolveSpaceMemberId,
  spaceMembershipEntityId,
} from '@libs/spaces/shared/participation/participation-ids';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { raw, sql } from '@pkgs/sql';
import { parseSpaceVisibility } from '@libs/spaces/shared/space-visibility';
import { decideSpaceJoinAccess } from './decide-space-join-access';
import { fail, ok, type WriteResult } from '@pkgs/write/shared/write-result';
import type { WriteContext } from '@pkgs/write/shared/write-context';
import { requireAccountId } from '../space-write-helpers';

export type JoinSpaceRow = {
  readonly hostId: string;
  readonly hostMemberId: string;
  readonly endedAt: string | null;
  readonly visibility: string;
  readonly hostAccountId: string | null;
};

export type ValidInviteRow = {
  readonly inviteId: string;
  readonly inviteeAccountId: string | null;
};

export async function readSpaceRowForJoin(
  db: SqlClient,
  spaceId: string
): Promise<WriteResult<JoinSpaceRow>> {
  const rows = await db.query<{
    readonly host_id: string | null;
    readonly host_member_id: string | null;
    readonly ended_at: string | null;
    readonly visibility: string | null;
    readonly host_account_id: string | null;
  }>(sql`SELECT ${raw(SpaceCol.hostId)} AS host_id,
            ${raw(SpaceCol.hostMemberId)} AS host_member_id,
            ${raw(SpaceCol.endedAt)} AS ended_at,
            ${raw(SpaceCol.visibility)} AS visibility,
            ${raw(SpaceCol.hostAccountId)} AS host_account_id
     FROM ${raw(SPACES_TABLE.tableName)}
     WHERE ${raw(SpaceCol.id)} = ${spaceId}
     LIMIT 1`);
  const row = rows[0];
  if (row === undefined || row.host_id === null || row.host_id.length === 0) {
    return fail('SPACE_NOT_FOUND', 'Space not found');
  }
  const hostMemberId = row.host_member_id ?? row.host_account_id ?? row.host_id;
  return ok({
    hostId: row.host_id,
    hostMemberId,
    endedAt: row.ended_at,
    visibility: row.visibility ?? 'private',
    hostAccountId: row.host_account_id,
  });
}

export async function areAccountsFriendsInStore(
  db: SqlClient,
  accountA: string,
  accountB: string
): Promise<boolean> {
  if (accountA.length === 0 || accountB.length === 0) return false;
  if (accountA === accountB) return true;
  const { userLow, userHigh } = canonicalUserPair(accountA, accountB);
  const rows = await db.query<{ readonly id: string }>(
    sql`SELECT ${raw(FriendshipCol.id)} AS id
     FROM ${raw(FRIENDSHIPS_TABLE.tableName)}
     WHERE ${raw(FriendshipCol.userLow)} = ${userLow} AND ${raw(FriendshipCol.userHigh)} = ${userHigh}
     LIMIT 1`
  );
  return rows[0] !== undefined;
}

export async function findValidInviteInStore(
  db: SqlClient,
  token: string,
  spaceId: string
): Promise<ValidInviteRow | null> {
  if (token.length === 0) return null;
  const rows = await db.query<{
    readonly id: string;
    readonly invitee_account_id: string | null;
    readonly expires_at: string | null;
    readonly revoked_at: string | null;
    readonly max_uses: number | string;
    readonly use_count: number | string;
  }>(sql`SELECT ${raw(SpaceInviteCol.id)} AS id,
            ${raw(SpaceInviteCol.inviteeAccountId)} AS invitee_account_id,
            ${raw(SpaceInviteCol.expiresAt)} AS expires_at,
            ${raw(SpaceInviteCol.revokedAt)} AS revoked_at,
            ${raw(SpaceInviteCol.maxUses)} AS max_uses,
            ${raw(SpaceInviteCol.useCount)} AS use_count
     FROM ${raw(SPACE_INVITES_TABLE.tableName)}
     WHERE ${raw(SpaceInviteCol.token)} = ${token}
       AND ${raw(SpaceInviteCol.spaceId)} = ${spaceId}
     LIMIT 1`);
  const row = rows[0];
  if (row === undefined) return null;
  if (row.revoked_at !== null) return null;
  if (row.expires_at !== null && Date.parse(row.expires_at) <= Date.now()) {
    return null;
  }
  const maxUses = Number(row.max_uses);
  const useCount = Number(row.use_count);
  if (Number.isFinite(maxUses) && useCount >= maxUses) return null;
  return { inviteId: row.id, inviteeAccountId: row.invitee_account_id };
}

function inviteForViewer(
  invite: ValidInviteRow,
  viewerAccountId: string
): WriteResult<ValidInviteRow> {
  if (
    invite.inviteeAccountId !== null &&
    invite.inviteeAccountId !== viewerAccountId
  ) {
    return fail('SPACE_INVITE_INVALID', 'Invite is not for this account');
  }
  return ok(invite);
}

export async function resolveInviteForJoinAuthorize(
  db: SqlClient,
  spaceId: string,
  inviteToken: string | null,
  viewerAccountId: string
): Promise<WriteResult<ValidInviteRow | null>> {
  if (inviteToken === null || inviteToken.length === 0) {
    return ok(null);
  }
  const found = await findValidInviteInStore(db, inviteToken, spaceId);
  if (found === null) {
    return fail('SPACE_INVITE_INVALID', 'Invite token is invalid');
  }
  return inviteForViewer(found, viewerAccountId);
}

async function isActiveMembership(
  db: SqlClient,
  memberId: string,
  spaceId: string
): Promise<boolean> {
  const id = spaceMembershipEntityId(memberId, spaceId);
  const rows = await db.query<{ readonly left_at: string | null }>(
    sql`SELECT ${raw(SpaceMembershipCol.leftAt)} AS left_at
     FROM ${raw(SPACE_MEMBERSHIPS_TABLE.tableName)}
     WHERE ${raw(SpaceMembershipCol.id)} = ${id}
     LIMIT 1`
  );
  const row = rows[0];
  return row !== undefined && row.left_at === null;
}

export async function authorizeJoinSpaceAccess(
  ctx: WriteContext,
  db: SqlClient,
  spaceId: string,
  inviteToken: string | null
): Promise<WriteResult<void>> {
  const accountId = requireAccountId(ctx);
  if (!accountId.ok) return accountId;
  const space = await readSpaceRowForJoin(db, spaceId);
  if (!space.ok) return space;
  if (space.value.endedAt !== null) {
    return fail('SPACE_ENDED', 'Space has ended');
  }
  const inviteResult = await resolveInviteForJoinAuthorize(
    db,
    spaceId,
    inviteToken,
    accountId.value
  );
  if (!inviteResult.ok) return inviteResult;
  const viewerMemberId = resolveSpaceMemberId(accountId.value);
  const alreadyMember = await isActiveMembership(db, viewerMemberId, spaceId);
  const isFriend =
    space.value.hostAccountId !== null
      ? await areAccountsFriendsInStore(
          db,
          accountId.value,
          space.value.hostAccountId
        )
      : false;
  const decision = decideSpaceJoinAccess({
    visibility: parseSpaceVisibility(space.value.visibility),
    hostId: space.value.hostId,
    hostAccountId: space.value.hostAccountId,
    hostMemberId: space.value.hostMemberId,
    viewerAccountId: accountId.value,
    viewerDeviceId: ctx.deviceId,
    viewerMemberId,
    isFriendOfHost: isFriend,
    hasValidInvite: inviteResult.value !== null,
    alreadyMember,
  });
  if (!decision.allowed) {
    return fail(decision.code, 'Not allowed to join this space');
  }
  return ok(undefined);
}
