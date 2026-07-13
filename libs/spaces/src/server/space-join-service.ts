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

import {
  decideSpaceJoinAccess,
  type SpaceAccessDecision,
} from '../shared/decide-space-join-access';
import { parseSpaceVisibility } from '../shared/space-visibility';
import { SpacesError } from '../shared/spaces-errors';
import { areAccountsFriends } from './are-accounts-friends';
import {
  findValidInviteByToken,
  loadSpacePeekRow,
  type InviteValidation,
  type SpacePeekRow,
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

/**
 * Atomically consume one invite use. The `use_count < max_uses` guard makes
 * this the single source of truth for the quota, so concurrent accepts of a
 * single-use invite cannot both succeed. Returns `false` when the invite is
 * already exhausted.
 */
async function consumeInviteUse(
  sql: SqlClient,
  inviteId: string
): Promise<boolean> {
  const now = new Date().toISOString();
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

async function readMembershipWasActive(
  sql: SqlClient,
  membershipId: string
): Promise<boolean> {
  const existing = await sql.query<{ readonly left_at: string | null }>(
    `SELECT ${SpaceMembershipCol.leftAt} AS left_at
     FROM ${SPACE_MEMBERSHIPS_TABLE.tableName}
     WHERE ${SpaceMembershipCol.id} = ?
     LIMIT 1`,
    [membershipId]
  );
  const prev = existing[0];
  return prev !== undefined && prev.left_at === null;
}

async function writeMembership(
  sql: SqlClient,
  args: {
    readonly membershipId: string;
    readonly deviceId: string;
    readonly spaceId: string;
    readonly profileId: string;
    readonly deviceLabel: string;
  }
): Promise<void> {
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
      args.membershipId,
      args.deviceId,
      args.spaceId,
      now,
      args.profileId,
      args.deviceLabel,
    ]
  );
}

async function resolveJoinDecision(
  sql: SqlClient,
  input: JoinSpaceServerInput,
  row: SpacePeekRow,
  invite: InviteValidation | null
): Promise<SpaceAccessDecision> {
  const isFriend =
    input.accountId !== null && row.host_account_id !== null
      ? await areAccountsFriends(sql, input.accountId, row.host_account_id)
      : false;
  return decideSpaceJoinAccess({
    visibility: parseSpaceVisibility(row.visibility),
    hostAccountId: row.host_account_id,
    viewerAccountId: input.accountId,
    viewerIsHostDevice: input.deviceId === row.host_id,
    isFriendOfHost: isFriend,
    hasValidInvite: invite !== null,
  });
}

/**
 * Consume a use only when the join relies on the invite and creates/reactivates
 * a seat — idempotent re-joins by an existing member must not burn quota.
 * Consume before writing membership so an exhausted invite blocks the join
 * rather than leaving a seat behind.
 */
async function consumeInviteForJoinIfNeeded(args: {
  readonly sql: SqlClient;
  readonly reliesOnInvite: boolean;
  readonly invite: InviteValidation | null;
}): Promise<void> {
  if (!args.reliesOnInvite || args.invite === null) return;
  const consumed = await consumeInviteUse(args.sql, args.invite.inviteId);
  if (!consumed) {
    throw new SpacesError(
      'SPACE_INVITE_INVALID',
      'Invite has already been used up'
    );
  }
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
  const decision = await resolveJoinDecision(sql, input, row, invite);
  if (!decision.allowed) {
    throw new SpacesError(decision.code, 'Not allowed to join this space');
  }
  const membershipId = spaceDeviceMembershipEntityId(
    input.deviceId,
    input.spaceId
  );
  const wasActive = await readMembershipWasActive(sql, membershipId);
  await consumeInviteForJoinIfNeeded({
    sql,
    reliesOnInvite: !wasActive && decision.reason === 'invite',
    invite,
  });
  await writeMembership(sql, {
    membershipId,
    deviceId: input.deviceId,
    spaceId: input.spaceId,
    profileId: input.profileId,
    deviceLabel: input.deviceLabel,
  });
  if (!wasActive) {
    await sql.run(
      `UPDATE ${SPACES_TABLE.tableName}
       SET ${SpaceCol.activeMemberCount} = ${SpaceCol.activeMemberCount} + 1
       WHERE ${SpaceCol.id} = ?`,
      [input.spaceId]
    );
  }
}
