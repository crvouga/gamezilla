import {
  FRIENDSHIPS_TABLE,
  FriendshipCol,
} from '@libs/db/shared/friends-tables';
import {
  SPACE_INVITES_TABLE,
  SPACE_MEMBERSHIPS_TABLE,
  SPACE_PARTICIPATIONS_TABLE,
  SpaceCol,
  SpaceInviteCol,
  SpaceMembershipCol,
  SpaceParticipationCol,
  SPACES_TABLE,
} from '@libs/db/shared/space-tables';
import { canonicalUserPair } from '@libs/spaces/shared/canonical-user-pair';
import {
  resolveSpaceMemberId,
  spaceMembershipEntityId,
  spaceParticipationEntityId,
} from '@libs/spaces/shared/participation/participation-ids';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { parseSpaceVisibility } from '@libs/spaces/shared/space-visibility';
import { decideSpaceJoinAccess } from './decide-space-join-access';
import { fail, ok, type WriteResult } from '@pkgs/write/shared/write-result';
import type { WriteContext } from '@pkgs/write/shared/write-context';

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
  sql: SqlClient,
  spaceId: string
): Promise<WriteResult<JoinSpaceRow>> {
  const rows = await sql.query<{
    readonly host_id: string | null;
    readonly host_member_id: string | null;
    readonly ended_at: string | null;
    readonly visibility: string | null;
    readonly host_account_id: string | null;
  }>(
    `SELECT ${SpaceCol.hostId} AS host_id,
            ${SpaceCol.hostMemberId} AS host_member_id,
            ${SpaceCol.endedAt} AS ended_at,
            ${SpaceCol.visibility} AS visibility,
            ${SpaceCol.hostAccountId} AS host_account_id
     FROM ${SPACES_TABLE.tableName}
     WHERE ${SpaceCol.id} = ?
     LIMIT 1`,
    [spaceId]
  );
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
  sql: SqlClient,
  accountA: string,
  accountB: string
): Promise<boolean> {
  if (accountA.length === 0 || accountB.length === 0) return false;
  if (accountA === accountB) return true;
  const { userLow, userHigh } = canonicalUserPair(accountA, accountB);
  const rows = await sql.query<{ readonly id: string }>(
    `SELECT ${FriendshipCol.id} AS id
     FROM ${FRIENDSHIPS_TABLE.tableName}
     WHERE ${FriendshipCol.userLow} = ? AND ${FriendshipCol.userHigh} = ?
     LIMIT 1`,
    [userLow, userHigh]
  );
  return rows[0] !== undefined;
}

export async function findValidInviteInStore(
  sql: SqlClient,
  token: string,
  spaceId: string
): Promise<ValidInviteRow | null> {
  if (token.length === 0) return null;
  const rows = await sql.query<{
    readonly id: string;
    readonly invitee_account_id: string | null;
    readonly expires_at: string | null;
    readonly revoked_at: string | null;
    readonly max_uses: number | string;
    readonly use_count: number | string;
  }>(
    `SELECT ${SpaceInviteCol.id} AS id,
            ${SpaceInviteCol.inviteeAccountId} AS invitee_account_id,
            ${SpaceInviteCol.expiresAt} AS expires_at,
            ${SpaceInviteCol.revokedAt} AS revoked_at,
            ${SpaceInviteCol.maxUses} AS max_uses,
            ${SpaceInviteCol.useCount} AS use_count
     FROM ${SPACE_INVITES_TABLE.tableName}
     WHERE ${SpaceInviteCol.token} = ?
       AND ${SpaceInviteCol.spaceId} = ?
     LIMIT 1`,
    [token, spaceId]
  );
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
  viewerAccountId: string | null
): WriteResult<ValidInviteRow> {
  if (
    invite.inviteeAccountId !== null &&
    (viewerAccountId === null || invite.inviteeAccountId !== viewerAccountId)
  ) {
    return fail('SPACE_INVITE_INVALID', 'Invite is not for this account');
  }
  return ok(invite);
}

export async function resolveInviteForJoinAuthorize(
  sql: SqlClient,
  spaceId: string,
  inviteToken: string | null,
  viewerAccountId: string | null
): Promise<WriteResult<ValidInviteRow | null>> {
  if (inviteToken === null || inviteToken.length === 0) {
    return ok(null);
  }
  const found = await findValidInviteInStore(sql, inviteToken, spaceId);
  if (found === null) {
    return fail('SPACE_INVITE_INVALID', 'Invite token is invalid');
  }
  return inviteForViewer(found, viewerAccountId);
}

async function isActiveMembership(
  sql: SqlClient,
  memberId: string,
  spaceId: string
): Promise<boolean> {
  const id = spaceMembershipEntityId(memberId, spaceId);
  const rows = await sql.query<{ readonly left_at: string | null }>(
    `SELECT ${SpaceMembershipCol.leftAt} AS left_at
     FROM ${SPACE_MEMBERSHIPS_TABLE.tableName}
     WHERE ${SpaceMembershipCol.id} = ?
     LIMIT 1`,
    [id]
  );
  const row = rows[0];
  return row !== undefined && row.left_at === null;
}

async function isActiveParticipation(
  sql: SqlClient,
  deviceId: string,
  spaceId: string
): Promise<boolean> {
  const id = spaceParticipationEntityId(deviceId, spaceId);
  const rows = await sql.query<{ readonly left_at: string | null }>(
    `SELECT ${SpaceParticipationCol.leftAt} AS left_at
     FROM ${SPACE_PARTICIPATIONS_TABLE.tableName}
     WHERE ${SpaceParticipationCol.id} = ?
     LIMIT 1`,
    [id]
  );
  const row = rows[0];
  return row !== undefined && row.left_at === null;
}

export async function authorizeJoinSpaceAccess(
  ctx: WriteContext,
  sql: SqlClient,
  spaceId: string,
  inviteToken: string | null
): Promise<WriteResult<void>> {
  const space = await readSpaceRowForJoin(sql, spaceId);
  if (!space.ok) return space;
  if (space.value.endedAt !== null) {
    return fail('SPACE_ENDED', 'Space has ended');
  }
  const inviteResult = await resolveInviteForJoinAuthorize(
    sql,
    spaceId,
    inviteToken,
    ctx.accountId
  );
  if (!inviteResult.ok) return inviteResult;
  const viewerMemberId = resolveSpaceMemberId({
    accountId: ctx.accountId,
    deviceId: ctx.deviceId,
  });
  const alreadyMember = await isActiveMembership(sql, viewerMemberId, spaceId);
  const alreadyParticipating = await isActiveParticipation(
    sql,
    ctx.deviceId,
    spaceId
  );
  const isFriend =
    ctx.accountId !== null && space.value.hostAccountId !== null
      ? await areAccountsFriendsInStore(
          sql,
          ctx.accountId,
          space.value.hostAccountId
        )
      : false;
  const decision = decideSpaceJoinAccess({
    visibility: parseSpaceVisibility(space.value.visibility),
    hostId: space.value.hostId,
    hostAccountId: space.value.hostAccountId,
    hostMemberId: space.value.hostMemberId,
    viewerAccountId: ctx.accountId,
    viewerDeviceId: ctx.deviceId,
    viewerMemberId,
    isFriendOfHost: isFriend,
    hasValidInvite: inviteResult.value !== null,
    alreadyMember,
    alreadyParticipating,
  });
  if (!decision.allowed) {
    return fail(decision.code, 'Not allowed to join this space');
  }
  return ok(undefined);
}
