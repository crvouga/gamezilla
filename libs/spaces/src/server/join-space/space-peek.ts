import {
  SpaceCol,
  SpaceInviteCol,
  SPACE_INVITES_TABLE,
  SPACES_TABLE,
} from '@libs/db/shared/space-tables';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { decideSpaceJoinAccess } from '../../shared/join-space/decide-space-join-access';
import { resolveSpaceMemberId } from '../../shared/participation/participation-ids';
import { parseSpaceVisibility } from '../../shared/space-visibility';
import { SpacesError } from '../../shared/spaces-errors';
import { areAccountsFriends } from './are-accounts-friends';

export type SpacePeekRow = {
  readonly id: string;
  readonly title: string | null;
  readonly host_id: string;
  readonly host_member_id: string | null;
  readonly ended_at: string | null;
  readonly visibility: string;
  readonly host_account_id: string | null;
  readonly host_username: string | null;
  readonly host_avatar_config: string | null;
  readonly active_member_count: number | string | null;
};

export type SpacePeekResult = {
  readonly spaceId: string;
  readonly title: string | null;
  readonly visibility: string;
  readonly ended: boolean;
  readonly hostAccountId: string | null;
  readonly hostUsername: string | null;
  readonly hostAvatarConfig: string | null;
  readonly activeMemberCount: number;
  readonly joinable: boolean;
  readonly joinDeniedCode: string | null;
  readonly requiresInvite: boolean;
};

export type InviteValidation = {
  readonly inviteId: string;
  readonly token: string;
  readonly kind: string;
  readonly inviteeAccountId: string | null;
};

function readMemberCount(raw: number | string | null): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, raw);
  if (typeof raw === 'string' && raw.length > 0) {
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(0, n) : 1;
  }
  return 1;
}

export async function loadSpacePeekRow(
  sql: SqlClient,
  spaceId: string
): Promise<SpacePeekRow | null> {
  const rows = await sql.query<SpacePeekRow>(
    `SELECT ${SpaceCol.id} AS id,
            ${SpaceCol.title} AS title,
            ${SpaceCol.hostId} AS host_id,
            ${SpaceCol.hostMemberId} AS host_member_id,
            ${SpaceCol.endedAt} AS ended_at,
            ${SpaceCol.visibility} AS visibility,
            ${SpaceCol.hostAccountId} AS host_account_id,
            ${SpaceCol.hostUsername} AS host_username,
            ${SpaceCol.hostAvatarConfig} AS host_avatar_config,
            ${SpaceCol.activeMemberCount} AS active_member_count
     FROM ${SPACES_TABLE.tableName}
     WHERE ${SpaceCol.id} = ?
     LIMIT 1`,
    [spaceId]
  );
  return rows[0] ?? null;
}

export async function findValidInviteByToken(
  sql: SqlClient,
  token: string,
  spaceId?: string
): Promise<InviteValidation | null> {
  if (token.length === 0) return null;
  const params: string[] = [token];
  let spaceClause = '';
  if (spaceId !== undefined && spaceId.length > 0) {
    spaceClause = ` AND ${SpaceInviteCol.spaceId} = ?`;
    params.push(spaceId);
  }
  const rows = await sql.query<{
    readonly id: string;
    readonly token: string;
    readonly kind: string;
    readonly invitee_account_id: string | null;
    readonly expires_at: string | null;
    readonly revoked_at: string | null;
    readonly max_uses: number | string;
    readonly use_count: number | string;
  }>(
    `SELECT ${SpaceInviteCol.id} AS id,
            ${SpaceInviteCol.token} AS token,
            ${SpaceInviteCol.kind} AS kind,
            ${SpaceInviteCol.inviteeAccountId} AS invitee_account_id,
            ${SpaceInviteCol.expiresAt} AS expires_at,
            ${SpaceInviteCol.revokedAt} AS revoked_at,
            ${SpaceInviteCol.maxUses} AS max_uses,
            ${SpaceInviteCol.useCount} AS use_count
     FROM ${SPACE_INVITES_TABLE.tableName}
     WHERE ${SpaceInviteCol.token} = ?${spaceClause}
     LIMIT 1`,
    params
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
  return {
    inviteId: row.id,
    token: row.token,
    kind: row.kind,
    inviteeAccountId: row.invitee_account_id,
  };
}

async function resolvePeekInvite(args: {
  readonly sql: SqlClient;
  readonly spaceId: string;
  readonly inviteToken: string | null;
  readonly viewerAccountId: string | null;
}): Promise<InviteValidation | null> {
  const invite = await findValidInviteByToken(
    args.sql,
    args.inviteToken ?? '',
    args.spaceId
  );
  if (
    invite !== null &&
    invite.inviteeAccountId !== null &&
    (args.viewerAccountId === null ||
      invite.inviteeAccountId !== args.viewerAccountId)
  ) {
    return null;
  }
  return invite;
}

export async function buildSpacePeek(args: {
  readonly sql: SqlClient;
  readonly spaceId: string;
  readonly viewerDeviceId: string | null;
  readonly viewerAccountId: string | null;
  readonly inviteToken: string | null;
}): Promise<SpacePeekResult> {
  const row = await loadSpacePeekRow(args.sql, args.spaceId);
  if (row === null) {
    throw new SpacesError('SPACE_NOT_FOUND', 'Space not found');
  }
  const visibility = parseSpaceVisibility(row.visibility);
  const ended = row.ended_at !== null;
  const invite = await resolvePeekInvite({
    sql: args.sql,
    spaceId: args.spaceId,
    inviteToken: args.inviteToken,
    viewerAccountId: args.viewerAccountId,
  });
  const isFriend =
    args.viewerAccountId !== null && row.host_account_id !== null
      ? await areAccountsFriends(
          args.sql,
          args.viewerAccountId,
          row.host_account_id
        )
      : false;
  const decision = ended
    ? ({ allowed: false, code: 'SPACE_ENDED' } as const)
    : decideSpaceJoinAccess({
        visibility,
        hostAccountId: row.host_account_id,
        hostMemberId: row.host_member_id ?? row.host_account_id ?? row.host_id,
        viewerAccountId: args.viewerAccountId,
        viewerMemberId: resolveSpaceMemberId({
          accountId: args.viewerAccountId,
          deviceId: args.viewerDeviceId ?? '',
        }),
        isFriendOfHost: isFriend,
        hasValidInvite: invite !== null,
      });
  return {
    spaceId: row.id,
    title: row.title,
    visibility,
    ended,
    hostAccountId: row.host_account_id,
    hostUsername: row.host_username,
    hostAvatarConfig: row.host_avatar_config,
    activeMemberCount: readMemberCount(row.active_member_count),
    joinable: decision.allowed,
    joinDeniedCode: decision.allowed ? null : decision.code,
    requiresInvite: visibility === 'private' && invite === null,
  };
}
