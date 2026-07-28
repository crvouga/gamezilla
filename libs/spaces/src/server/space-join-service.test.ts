import { beforeEach, describe, expect, test } from 'bun:test';

import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';
import type { SqlClient } from '@pkgs/sql-client/interface';

import {
  SpaceCol,
  SpaceInviteCol,
  SpaceMembershipCol,
  SPACES_TABLE,
  SPACE_INVITES_TABLE,
  SPACE_MEMBERSHIPS_TABLE,
} from '@libs/db/shared/space-tables';

import { joinSpaceServer } from './join-space/join-space-service';
import { spaceMembershipEntityId } from '../shared/membership-key';

const SPACE_ID = 'space-1';
const DEVICE_A = 'device-aaaaaaaa-0000';
const DEVICE_B = 'device-bbbbbbbb-1111';
const ACCOUNT_A = 'account-aaaaaaaa-0000';
const ACCOUNT_B = 'account-bbbbbbbb-1111';
const TOKEN = 'invite-token-123';

function openSql(): SqlClientImplBunSqlite {
  const db = SqlClientImplBunSqlite.open(':memory:');
  return db;
}

async function migrate(sql: SqlClient): Promise<void> {
  await sql.run(
    `CREATE TABLE ${SPACES_TABLE.tableName} (
      ${SpaceCol.id} TEXT PRIMARY KEY,
      ${SpaceCol.title} TEXT,
      ${SpaceCol.hostId} TEXT,
      ${SpaceCol.createdAt} TEXT,
      ${SpaceCol.endedAt} TEXT,
      ${SpaceCol.visibility} TEXT,
      ${SpaceCol.hostAccountId} TEXT,
      ${SpaceCol.hostMemberId} TEXT,
      ${SpaceCol.activeMemberCount} INTEGER NOT NULL DEFAULT 0
    )`
  );
  await sql.run(
    `CREATE TABLE ${SPACE_MEMBERSHIPS_TABLE.tableName} (
      ${SpaceMembershipCol.id} TEXT PRIMARY KEY,
      ${SpaceMembershipCol.memberId} TEXT,
      ${SpaceMembershipCol.spaceId} TEXT,
      ${SpaceMembershipCol.joinedAt} TEXT,
      ${SpaceMembershipCol.leftAt} TEXT,
      ${SpaceMembershipCol.profileId} TEXT
    )`
  );
  await sql.run(
    `CREATE TABLE ${SPACE_INVITES_TABLE.tableName} (
      ${SpaceInviteCol.id} TEXT PRIMARY KEY,
      ${SpaceInviteCol.spaceId} TEXT,
      ${SpaceInviteCol.kind} TEXT,
      ${SpaceInviteCol.token} TEXT,
      ${SpaceInviteCol.code} TEXT,
      ${SpaceInviteCol.createdByAccountId} TEXT,
      ${SpaceInviteCol.inviteeAccountId} TEXT,
      ${SpaceInviteCol.expiresAt} TEXT,
      ${SpaceInviteCol.revokedAt} TEXT,
      ${SpaceInviteCol.acceptedAt} TEXT,
      ${SpaceInviteCol.maxUses} INTEGER NOT NULL,
      ${SpaceInviteCol.useCount} INTEGER NOT NULL DEFAULT 0,
      ${SpaceInviteCol.createdAt} TEXT
    )`
  );
}

async function seedPrivateSpace(sql: SqlClient): Promise<void> {
  await sql.run(
    `INSERT INTO ${SPACES_TABLE.tableName}
     (${SpaceCol.id}, ${SpaceCol.hostId}, ${SpaceCol.hostMemberId},
      ${SpaceCol.visibility}, ${SpaceCol.activeMemberCount})
     VALUES (?, ?, ?, 'private', 0)`,
    [SPACE_ID, 'host-device', 'host-device']
  );
}

async function seedLinkInvite(sql: SqlClient, maxUses: number): Promise<void> {
  await sql.run(
    `INSERT INTO ${SPACE_INVITES_TABLE.tableName}
     (${SpaceInviteCol.id}, ${SpaceInviteCol.spaceId}, ${SpaceInviteCol.kind},
      ${SpaceInviteCol.token}, ${SpaceInviteCol.maxUses},
      ${SpaceInviteCol.useCount})
     VALUES (?, ?, 'link', ?, ?, 0)`,
    ['invite-1', SPACE_ID, TOKEN, maxUses]
  );
}

async function readInviteUseCount(sql: SqlClient): Promise<number> {
  const rows = await sql.query<{ use_count: number }>(
    `SELECT ${SpaceInviteCol.useCount} AS use_count
     FROM ${SPACE_INVITES_TABLE.tableName} WHERE ${SpaceInviteCol.id} = ?`,
    ['invite-1']
  );
  return Number(rows[0]?.use_count ?? -1);
}

async function readActiveMemberCount(sql: SqlClient): Promise<number> {
  const rows = await sql.query<{ count: number }>(
    `SELECT ${SpaceCol.activeMemberCount} AS count
     FROM ${SPACES_TABLE.tableName} WHERE ${SpaceCol.id} = ?`,
    [SPACE_ID]
  );
  return Number(rows[0]?.count ?? -1);
}

function joinInput(args: {
  readonly deviceId: string;
  readonly accountId: string;
}) {
  return {
    spaceId: SPACE_ID,
    deviceId: args.deviceId,
    accountId: args.accountId,
    profileId: args.accountId,
    inviteToken: TOKEN,
  };
}

describe('joinSpaceServer invite consumption', () => {
  let sql: SqlClientImplBunSqlite;

  beforeEach(async () => {
    sql = openSql();
    await migrate(sql);
    await seedPrivateSpace(sql);
  });

  test('idempotent re-join by an active member does not burn an invite use', async () => {
    await seedLinkInvite(sql, 10);

    await joinSpaceServer(
      sql,
      joinInput({ deviceId: DEVICE_A, accountId: ACCOUNT_A })
    );
    expect(await readInviteUseCount(sql)).toBe(1);
    expect(await readActiveMemberCount(sql)).toBe(1);

    await joinSpaceServer(
      sql,
      joinInput({ deviceId: DEVICE_A, accountId: ACCOUNT_A })
    );
    expect(await readInviteUseCount(sql)).toBe(1);
    expect(await readActiveMemberCount(sql)).toBe(1);
  });

  test('reactivating a left membership consumes a fresh invite use', async () => {
    await seedLinkInvite(sql, 10);

    await joinSpaceServer(
      sql,
      joinInput({ deviceId: DEVICE_A, accountId: ACCOUNT_A })
    );
    const membershipId = spaceMembershipEntityId(ACCOUNT_A, SPACE_ID);
    const now = new Date().toISOString();
    await sql.run(
      `UPDATE ${SPACE_MEMBERSHIPS_TABLE.tableName}
       SET ${SpaceMembershipCol.leftAt} = ?
       WHERE ${SpaceMembershipCol.id} = ?`,
      [now, membershipId]
    );

    await joinSpaceServer(
      sql,
      joinInput({ deviceId: DEVICE_A, accountId: ACCOUNT_A })
    );
    expect(await readInviteUseCount(sql)).toBe(2);
  });

  test('single-use link invite cannot be over-consumed and never exceeds max', async () => {
    await seedLinkInvite(sql, 1);

    await joinSpaceServer(
      sql,
      joinInput({ deviceId: DEVICE_A, accountId: ACCOUNT_A })
    );
    expect(await readInviteUseCount(sql)).toBe(1);

    await expect(
      joinSpaceServer(
        sql,
        joinInput({ deviceId: DEVICE_B, accountId: ACCOUNT_B })
      )
    ).rejects.toThrow();
    expect(await readInviteUseCount(sql)).toBe(1);
  });

  test('anonymous join is rejected', async () => {
    await seedLinkInvite(sql, 10);
    await expect(
      joinSpaceServer(sql, {
        spaceId: SPACE_ID,
        deviceId: DEVICE_A,
        accountId: null,
        profileId: DEVICE_A,
        inviteToken: TOKEN,
      })
    ).rejects.toThrow();
  });
});
