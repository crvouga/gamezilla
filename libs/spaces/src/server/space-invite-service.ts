import {
  SpaceCol,
  SpaceInviteCol,
  SPACE_INVITES_TABLE,
  SPACES_TABLE,
} from '@libs/db/shared/space-tables';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { generateInviteToken } from '../shared/generate-invite-secrets';
import {
  SPACE_INVITE_DEFAULT_TTL_MS,
  type SpaceInviteKind,
} from '../shared/space-invite-types';
import { SpacesError } from '../shared/spaces-errors';
import { loadSpacePeekRow } from './join-space/space-peek';
import { publishSpaceInviteInteraction } from './spaces-inbox-publish';

export type SpaceInviteRecord = {
  readonly id: string;
  readonly spaceId: string;
  readonly kind: SpaceInviteKind;
  readonly token: string;
  readonly code: string | null;
  readonly expiresAt: string | null;
  readonly inviteeAccountId: string | null;
};

async function assertHostCanInvite(
  sql: SqlClient,
  spaceId: string,
  accountId: string,
  deviceId: string
): Promise<void> {
  const row = await loadSpacePeekRow(sql, spaceId);
  if (row === null) {
    throw new SpacesError('SPACE_NOT_FOUND', 'Space not found');
  }
  if (row.ended_at !== null) {
    throw new SpacesError('SPACE_ENDED', 'Space has ended');
  }
  const isHostDevice = row.host_id === deviceId;
  const isHostAccount =
    row.host_account_id !== null && row.host_account_id === accountId;
  if (!isHostDevice && !isHostAccount) {
    throw new SpacesError(
      'SPACE_FORBIDDEN',
      'Only the host can create invites'
    );
  }
}

function defaultExpiryIso(): string {
  return new Date(Date.now() + SPACE_INVITE_DEFAULT_TTL_MS).toISOString();
}

async function insertInvite(
  sql: SqlClient,
  args: {
    readonly spaceId: string;
    readonly kind: SpaceInviteKind;
    readonly createdByAccountId: string;
    readonly inviteeAccountId: string | null;
    readonly code: string | null;
    readonly maxUses: number;
    readonly expiresAt: string | null;
  }
): Promise<SpaceInviteRecord> {
  const id = crypto.randomUUID();
  const token = generateInviteToken();
  const createdAt = new Date().toISOString();
  await sql.run(
    `INSERT INTO ${SPACE_INVITES_TABLE.tableName}
     (${SpaceInviteCol.id}, ${SpaceInviteCol.spaceId}, ${SpaceInviteCol.kind},
      ${SpaceInviteCol.token}, ${SpaceInviteCol.code},
      ${SpaceInviteCol.createdByAccountId}, ${SpaceInviteCol.inviteeAccountId},
      ${SpaceInviteCol.expiresAt}, ${SpaceInviteCol.revokedAt},
      ${SpaceInviteCol.acceptedAt}, ${SpaceInviteCol.maxUses},
      ${SpaceInviteCol.useCount}, ${SpaceInviteCol.createdAt})
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, 0, ?)`,
    [
      id,
      args.spaceId,
      args.kind,
      token,
      args.code,
      args.createdByAccountId,
      args.inviteeAccountId,
      args.expiresAt,
      args.maxUses,
      createdAt,
    ]
  );
  return {
    id,
    spaceId: args.spaceId,
    kind: args.kind,
    token,
    code: args.code,
    expiresAt: args.expiresAt,
    inviteeAccountId: args.inviteeAccountId,
  };
}

export async function ensureLinkInvite(args: {
  readonly sql: SqlClient;
  readonly spaceId: string;
  readonly accountId: string;
  readonly deviceId: string;
}): Promise<SpaceInviteRecord> {
  await assertHostCanInvite(
    args.sql,
    args.spaceId,
    args.accountId,
    args.deviceId
  );
  const existing = await args.sql.query<{
    readonly id: string;
    readonly token: string;
    readonly code: string | null;
    readonly expires_at: string | null;
    readonly invitee_account_id: string | null;
  }>(
    `SELECT ${SpaceInviteCol.id} AS id,
            ${SpaceInviteCol.token} AS token,
            ${SpaceInviteCol.code} AS code,
            ${SpaceInviteCol.expiresAt} AS expires_at,
            ${SpaceInviteCol.inviteeAccountId} AS invitee_account_id
     FROM ${SPACE_INVITES_TABLE.tableName}
     WHERE ${SpaceInviteCol.spaceId} = ?
       AND ${SpaceInviteCol.kind} = 'link'
       AND ${SpaceInviteCol.revokedAt} IS NULL
       AND (${SpaceInviteCol.expiresAt} IS NULL OR ${SpaceInviteCol.expiresAt} > NOW())
     ORDER BY ${SpaceInviteCol.createdAt} DESC
     LIMIT 1`,
    [args.spaceId]
  );
  const row = existing[0];
  if (row !== undefined) {
    return {
      id: row.id,
      spaceId: args.spaceId,
      kind: 'link',
      token: row.token,
      code: row.code,
      expiresAt: row.expires_at,
      inviteeAccountId: row.invitee_account_id,
    };
  }
  return insertInvite(args.sql, {
    spaceId: args.spaceId,
    kind: 'link',
    createdByAccountId: args.accountId,
    inviteeAccountId: null,
    code: null,
    maxUses: 10_000,
    expiresAt: defaultExpiryIso(),
  });
}

export async function createFriendInvite(args: {
  readonly sql: SqlClient;
  readonly spaceId: string;
  readonly accountId: string;
  readonly deviceId: string;
  readonly inviteeAccountId: string;
}): Promise<SpaceInviteRecord> {
  await assertHostCanInvite(
    args.sql,
    args.spaceId,
    args.accountId,
    args.deviceId
  );
  if (args.inviteeAccountId === args.accountId) {
    throw new SpacesError('SPACE_INVALID_INPUT', 'Cannot invite yourself');
  }
  const invite = await insertInvite(args.sql, {
    spaceId: args.spaceId,
    kind: 'friend',
    createdByAccountId: args.accountId,
    inviteeAccountId: args.inviteeAccountId,
    code: null,
    maxUses: 1,
    expiresAt: defaultExpiryIso(),
  });
  const space = await loadSpacePeekRow(args.sql, args.spaceId);
  await publishSpaceInviteInteraction(args.sql, {
    inviteId: invite.id,
    spaceId: args.spaceId,
    token: invite.token,
    inviteeAccountId: args.inviteeAccountId,
    hostAccountId: args.accountId,
    spaceTitle: space?.title ?? null,
  });
  return invite;
}

export async function revokeSpaceInvite(args: {
  readonly sql: SqlClient;
  readonly inviteId: string;
  readonly accountId: string;
  readonly deviceId: string;
}): Promise<void> {
  const rows = await args.sql.query<{
    readonly space_id: string;
    readonly created_by_account_id: string;
  }>(
    `SELECT ${SpaceInviteCol.spaceId} AS space_id,
            ${SpaceInviteCol.createdByAccountId} AS created_by_account_id
     FROM ${SPACE_INVITES_TABLE.tableName}
     WHERE ${SpaceInviteCol.id} = ?
     LIMIT 1`,
    [args.inviteId]
  );
  const row = rows[0];
  if (row === undefined) {
    throw new SpacesError('SPACE_INVITE_INVALID', 'Invite not found');
  }
  await assertHostCanInvite(
    args.sql,
    row.space_id,
    args.accountId,
    args.deviceId
  );
  const now = new Date().toISOString();
  await args.sql.run(
    `UPDATE ${SPACE_INVITES_TABLE.tableName}
     SET ${SpaceInviteCol.revokedAt} = ?
     WHERE ${SpaceInviteCol.id} = ?`,
    [now, args.inviteId]
  );
}

export async function revokeOpenInvitesForSpace(
  sql: SqlClient,
  spaceId: string
): Promise<void> {
  const now = new Date().toISOString();
  await sql.run(
    `UPDATE ${SPACE_INVITES_TABLE.tableName}
     SET ${SpaceInviteCol.revokedAt} = ?
     WHERE ${SpaceInviteCol.spaceId} = ?
       AND ${SpaceInviteCol.revokedAt} IS NULL`,
    [now, spaceId]
  );
}

export async function loadHostAccountIdForSpace(
  sql: SqlClient,
  spaceId: string
): Promise<string | null> {
  const rows = await sql.query<{ readonly host_account_id: string | null }>(
    `SELECT ${SpaceCol.hostAccountId} AS host_account_id
     FROM ${SPACES_TABLE.tableName}
     WHERE ${SpaceCol.id} = ?
     LIMIT 1`,
    [spaceId]
  );
  return rows[0]?.host_account_id ?? null;
}
