import {
  FriendshipCol,
  FRIENDSHIPS_TABLE,
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
import { parseSpaceVisibility } from '@libs/spaces/shared/space-visibility';
import { honey } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { WriteContext } from '@pkgs/write/shared/write-context';
import { fail, ok, type WriteResult } from '@pkgs/write/shared/write-result';
import { requireAccountId } from '../space-write-helpers';
import { decideSpaceJoinAccess } from './decide-space-join-access';

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
  }>(
    honey({
      select: [
        SpaceCol.hostId,
        SpaceCol.hostMemberId,
        SpaceCol.endedAt,
        SpaceCol.visibility,
        SpaceCol.hostAccountId,
      ],
      from: SPACES_TABLE.tableName,
      where: ['=', SpaceCol.id, spaceId],
      limit: 1,
    })
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
  db: SqlClient,
  accountA: string,
  accountB: string
): Promise<boolean> {
  if (accountA.length === 0 || accountB.length === 0) return false;
  if (accountA === accountB) return true;
  const { userLow, userHigh } = canonicalUserPair(accountA, accountB);
  const rows = await db.query<{ readonly id: string }>(
    honey({
      select: [FriendshipCol.id],
      from: FRIENDSHIPS_TABLE.tableName,
      where: [
        'and',
        ['=', FriendshipCol.userLow, userLow],
        ['=', FriendshipCol.userHigh, userHigh],
      ],
      limit: 1,
    })
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
  }>(
    honey({
      select: [
        SpaceInviteCol.id,
        SpaceInviteCol.inviteeAccountId,
        SpaceInviteCol.expiresAt,
        SpaceInviteCol.revokedAt,
        SpaceInviteCol.maxUses,
        SpaceInviteCol.useCount,
      ],
      from: SPACE_INVITES_TABLE.tableName,
      where: [
        'and',
        ['=', SpaceInviteCol.token, token],
        ['=', SpaceInviteCol.spaceId, spaceId],
      ],
      limit: 1,
    })
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
    honey({
      select: [SpaceMembershipCol.leftAt],
      from: SPACE_MEMBERSHIPS_TABLE.tableName,
      where: ['=', SpaceMembershipCol.id, id],
      limit: 1,
    })
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
