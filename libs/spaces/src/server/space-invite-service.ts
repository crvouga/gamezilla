import {
  SpaceCol,
  SpaceInviteCol,
  SPACE_INVITES_TABLE,
  SPACES_TABLE,
} from '@libs/db/shared/space-tables';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { raw, sql } from '@pkgs/sql';

import { generateInviteToken } from '../shared/generate-invite-secrets';
import {
  SPACE_INVITE_DEFAULT_TTL_MS,
  type SpaceInviteKind,
} from '../shared/space-invite-types';
import { SpacesError } from '../shared/spaces-errors';
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

type SpaceInviteHostRow = {
  readonly id: string;
  readonly title: string | null;
  readonly host_id: string;
  readonly host_member_id: string | null;
  readonly ended_at: string | null;
  readonly host_account_id: string | null;
};

async function loadSpaceRowForInvite(
  db: SqlClient,
  spaceId: string
): Promise<SpaceInviteHostRow | null> {
  const rows = await db.query<SpaceInviteHostRow>(
    sql`SELECT ${raw(SpaceCol.id)} AS id,
            ${raw(SpaceCol.title)} AS title,
            ${raw(SpaceCol.hostId)} AS host_id,
            ${raw(SpaceCol.hostMemberId)} AS host_member_id,
            ${raw(SpaceCol.endedAt)} AS ended_at,
            ${raw(SpaceCol.hostAccountId)} AS host_account_id
     FROM ${raw(SPACES_TABLE.tableName)}
     WHERE ${raw(SpaceCol.id)} = ${spaceId}
     LIMIT 1`
  );
  return rows[0] ?? null;
}

async function assertHostCanInvite(
  db: SqlClient,
  spaceId: string,
  accountId: string,
  deviceId: string
): Promise<void> {
  const row = await loadSpaceRowForInvite(db, spaceId);
  if (row === null) {
    throw new SpacesError('SPACE_NOT_FOUND', 'Space not found');
  }
  if (row.ended_at !== null) {
    throw new SpacesError('SPACE_ENDED', 'Space has ended');
  }
  const isHostMember =
    (row.host_member_id !== null && row.host_member_id === accountId) ||
    (row.host_account_id !== null && row.host_account_id === accountId) ||
    row.host_id === deviceId;
  if (!isHostMember) {
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
  db: SqlClient,
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
  await db.run(sql`INSERT INTO ${raw(SPACE_INVITES_TABLE.tableName)}
     (${raw(SpaceInviteCol.id)}, ${raw(SpaceInviteCol.spaceId)}, ${raw(SpaceInviteCol.kind)},
      ${raw(SpaceInviteCol.token)}, ${raw(SpaceInviteCol.code)},
      ${raw(SpaceInviteCol.createdByAccountId)}, ${raw(SpaceInviteCol.inviteeAccountId)},
      ${raw(SpaceInviteCol.expiresAt)}, ${raw(SpaceInviteCol.revokedAt)},
      ${raw(SpaceInviteCol.acceptedAt)}, ${raw(SpaceInviteCol.maxUses)},
      ${raw(SpaceInviteCol.useCount)}, ${raw(SpaceInviteCol.createdAt)})
     VALUES (${id}, ${args.spaceId}, ${args.kind}, ${token}, ${args.code},
             ${args.createdByAccountId}, ${args.inviteeAccountId},
             ${args.expiresAt}, NULL, NULL, ${args.maxUses}, 0, ${createdAt})`);
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
  }>(sql`SELECT ${raw(SpaceInviteCol.id)} AS id,
            ${raw(SpaceInviteCol.token)} AS token,
            ${raw(SpaceInviteCol.code)} AS code,
            ${raw(SpaceInviteCol.expiresAt)} AS expires_at,
            ${raw(SpaceInviteCol.inviteeAccountId)} AS invitee_account_id
     FROM ${raw(SPACE_INVITES_TABLE.tableName)}
     WHERE ${raw(SpaceInviteCol.spaceId)} = ${args.spaceId}
       AND ${raw(SpaceInviteCol.kind)} = 'link'
       AND ${raw(SpaceInviteCol.revokedAt)} IS NULL
       AND (${raw(SpaceInviteCol.expiresAt)} IS NULL OR ${raw(SpaceInviteCol.expiresAt)} > NOW())
     ORDER BY ${raw(SpaceInviteCol.createdAt)} DESC
     LIMIT 1`);
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
  const space = await loadSpaceRowForInvite(args.sql, args.spaceId);
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
  }>(sql`SELECT ${raw(SpaceInviteCol.spaceId)} AS space_id,
            ${raw(SpaceInviteCol.createdByAccountId)} AS created_by_account_id
     FROM ${raw(SPACE_INVITES_TABLE.tableName)}
     WHERE ${raw(SpaceInviteCol.id)} = ${args.inviteId}
     LIMIT 1`);
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
  await args.sql.run(sql`UPDATE ${raw(SPACE_INVITES_TABLE.tableName)}
     SET ${raw(SpaceInviteCol.revokedAt)} = ${now}
     WHERE ${raw(SpaceInviteCol.id)} = ${args.inviteId}`);
}

export async function revokeOpenInvitesForSpace(
  db: SqlClient,
  spaceId: string
): Promise<void> {
  const now = new Date().toISOString();
  await db.run(sql`UPDATE ${raw(SPACE_INVITES_TABLE.tableName)}
     SET ${raw(SpaceInviteCol.revokedAt)} = ${now}
     WHERE ${raw(SpaceInviteCol.spaceId)} = ${spaceId}
       AND ${raw(SpaceInviteCol.revokedAt)} IS NULL`);
}

export async function loadHostAccountIdForSpace(
  db: SqlClient,
  spaceId: string
): Promise<string | null> {
  const rows = await db.query<{ readonly host_account_id: string | null }>(
    sql`SELECT ${raw(SpaceCol.hostAccountId)} AS host_account_id
     FROM ${raw(SPACES_TABLE.tableName)}
     WHERE ${raw(SpaceCol.id)} = ${spaceId}
     LIMIT 1`
  );
  return rows[0]?.host_account_id ?? null;
}
