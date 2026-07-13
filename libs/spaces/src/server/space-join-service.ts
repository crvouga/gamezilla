import {
  SpaceCol,
  SpaceInviteCol,
  SpaceMembershipCol,
  SPACE_INVITES_TABLE,
  SPACE_MEMBERSHIPS_TABLE,
  SPACES_TABLE,
} from '@libs/db/shared/space-tables';
import { spaceDeviceMembershipEntityId } from '@libs/spaces/shared/membership-key';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { decideSpaceJoinAccess } from '../shared/decide-space-join-access';
import { parseSpaceVisibility } from '../shared/space-visibility';
import { SpacesError } from '../shared/spaces-errors';
import { areAccountsFriends } from './are-accounts-friends';
import {
  findValidInviteByToken,
  loadSpacePeekRow,
  type InviteValidation,
} from './space-peek';

export type JoinSpaceServerInput = {
  readonly spaceId: string;
  readonly deviceId: string;
  readonly accountId: string | null;
  readonly profileId: string;
  readonly deviceLabel: string;
  readonly inviteToken: string | null;
};

function assertInviteForViewer(
  invite: InviteValidation,
  viewerAccountId: string | null
): void {
  if (
    invite.inviteeAccountId !== null &&
    (viewerAccountId === null || invite.inviteeAccountId !== viewerAccountId)
  ) {
    throw new SpacesError(
      'SPACE_INVITE_INVALID',
      'Invite is not for this account'
    );
  }
}

async function resolveInviteForJoin(args: {
  readonly sql: SqlClient;
  readonly spaceId: string;
  readonly inviteToken: string | null;
  readonly viewerAccountId: string | null;
}): Promise<InviteValidation | null> {
  const { sql, spaceId, inviteToken, viewerAccountId } = args;
  if (inviteToken === null || inviteToken.length === 0) return null;
  const byToken = await findValidInviteByToken(sql, inviteToken, spaceId);
  if (byToken === null) {
    throw new SpacesError('SPACE_INVITE_INVALID', 'Invite token is invalid');
  }
  assertInviteForViewer(byToken, viewerAccountId);
  return byToken;
}

async function bumpInviteUse(sql: SqlClient, inviteId: string): Promise<void> {
  const now = new Date().toISOString();
  await sql.run(
    `UPDATE ${SPACE_INVITES_TABLE.tableName}
     SET ${SpaceInviteCol.useCount} = ${SpaceInviteCol.useCount} + 1,
         ${SpaceInviteCol.acceptedAt} = COALESCE(${SpaceInviteCol.acceptedAt}, ?)
     WHERE ${SpaceInviteCol.id} = ?`,
    [now, inviteId]
  );
}

async function upsertMembership(
  sql: SqlClient,
  args: {
    readonly deviceId: string;
    readonly spaceId: string;
    readonly profileId: string;
    readonly deviceLabel: string;
  }
): Promise<{ readonly reactivated: boolean }> {
  const membershipId = spaceDeviceMembershipEntityId(
    args.deviceId,
    args.spaceId
  );
  const existing = await sql.query<{ readonly left_at: string | null }>(
    `SELECT ${SpaceMembershipCol.leftAt} AS left_at
     FROM ${SPACE_MEMBERSHIPS_TABLE.tableName}
     WHERE ${SpaceMembershipCol.id} = ?
     LIMIT 1`,
    [membershipId]
  );
  const prev = existing[0];
  const wasActive = prev !== undefined && prev.left_at === null;
  const now = new Date().toISOString();
  await sql.run(
    `INSERT INTO ${SPACE_MEMBERSHIPS_TABLE.tableName}
     (${SpaceMembershipCol.id}, ${SpaceMembershipCol.guestId},
      ${SpaceMembershipCol.spaceId}, ${SpaceMembershipCol.joinedAt},
      ${SpaceMembershipCol.leftAt}, ${SpaceMembershipCol.profileId},
      ${SpaceMembershipCol.deviceLabel})
     VALUES (?, ?, ?, ?, NULL, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       left_at = NULL,
       joined_at = EXCLUDED.joined_at,
       profile_id = EXCLUDED.profile_id,
       device_label = EXCLUDED.device_label`,
    [
      membershipId,
      args.deviceId,
      args.spaceId,
      now,
      args.profileId,
      args.deviceLabel,
    ]
  );
  return { reactivated: !wasActive };
}

export async function joinSpaceServer(
  sql: SqlClient,
  input: JoinSpaceServerInput
): Promise<void> {
  const row = await loadSpacePeekRow(sql, input.spaceId);
  if (row === null) {
    throw new SpacesError('SPACE_NOT_FOUND', 'Space not found');
  }
  if (row.ended_at !== null) {
    throw new SpacesError('SPACE_ENDED', 'Space has ended');
  }
  const invite = await resolveInviteForJoin({
    sql,
    spaceId: input.spaceId,
    inviteToken: input.inviteToken,
    viewerAccountId: input.accountId,
  });
  const visibility = parseSpaceVisibility(row.visibility);
  const isFriend =
    input.accountId !== null && row.host_account_id !== null
      ? await areAccountsFriends(sql, input.accountId, row.host_account_id)
      : false;
  const decision = decideSpaceJoinAccess({
    visibility,
    hostAccountId: row.host_account_id,
    viewerAccountId: input.accountId,
    viewerIsHostDevice: input.deviceId === row.host_id,
    isFriendOfHost: isFriend,
    hasValidInvite: invite !== null,
  });
  if (!decision.allowed) {
    throw new SpacesError(decision.code, 'Not allowed to join this space');
  }
  const { reactivated } = await upsertMembership(sql, {
    deviceId: input.deviceId,
    spaceId: input.spaceId,
    profileId: input.profileId,
    deviceLabel: input.deviceLabel,
  });
  if (reactivated) {
    await sql.run(
      `UPDATE ${SPACES_TABLE.tableName}
       SET ${SpaceCol.activeMemberCount} = ${SpaceCol.activeMemberCount} + 1
       WHERE ${SpaceCol.id} = ?`,
      [input.spaceId]
    );
  }
  if (invite !== null) {
    await bumpInviteUse(sql, invite.inviteId);
  }
}
