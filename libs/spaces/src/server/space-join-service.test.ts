import { beforeEach, describe, expect, test } from 'bun:test';

import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { raw, sql } from '@pkgs/sql';

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

async function migrate(db: SqlClient): Promise<void> {
  await db.run(sql`CREATE TABLE ${raw(SPACES_TABLE.tableName)} (
      ${raw(SpaceCol.id)} TEXT PRIMARY KEY,
      ${raw(SpaceCol.title)} TEXT,
      ${raw(SpaceCol.hostId)} TEXT,
      ${raw(SpaceCol.createdAt)} TEXT,
      ${raw(SpaceCol.endedAt)} TEXT,
      ${raw(SpaceCol.visibility)} TEXT,
      ${raw(SpaceCol.hostAccountId)} TEXT,
      ${raw(SpaceCol.hostMemberId)} TEXT,
      ${raw(SpaceCol.activeMemberCount)} INTEGER NOT NULL DEFAULT 0
    )`);
  await db.run(sql`CREATE TABLE ${raw(SPACE_MEMBERSHIPS_TABLE.tableName)} (
      ${raw(SpaceMembershipCol.id)} TEXT PRIMARY KEY,
      ${raw(SpaceMembershipCol.memberId)} TEXT,
      ${raw(SpaceMembershipCol.spaceId)} TEXT,
      ${raw(SpaceMembershipCol.joinedAt)} TEXT,
      ${raw(SpaceMembershipCol.leftAt)} TEXT,
      ${raw(SpaceMembershipCol.profileId)} TEXT
    )`);
  await db.run(sql`CREATE TABLE ${raw(SPACE_INVITES_TABLE.tableName)} (
      ${raw(SpaceInviteCol.id)} TEXT PRIMARY KEY,
      ${raw(SpaceInviteCol.spaceId)} TEXT,
      ${raw(SpaceInviteCol.kind)} TEXT,
      ${raw(SpaceInviteCol.token)} TEXT,
      ${raw(SpaceInviteCol.code)} TEXT,
      ${raw(SpaceInviteCol.createdByAccountId)} TEXT,
      ${raw(SpaceInviteCol.inviteeAccountId)} TEXT,
      ${raw(SpaceInviteCol.expiresAt)} TEXT,
      ${raw(SpaceInviteCol.revokedAt)} TEXT,
      ${raw(SpaceInviteCol.acceptedAt)} TEXT,
      ${raw(SpaceInviteCol.maxUses)} INTEGER NOT NULL,
      ${raw(SpaceInviteCol.useCount)} INTEGER NOT NULL DEFAULT 0,
      ${raw(SpaceInviteCol.createdAt)} TEXT
    )`);
}

async function seedPrivateSpace(db: SqlClient): Promise<void> {
  await db.run(sql`INSERT INTO ${raw(SPACES_TABLE.tableName)}
     (${raw(SpaceCol.id)}, ${raw(SpaceCol.hostId)}, ${raw(SpaceCol.hostMemberId)},
      ${raw(SpaceCol.visibility)}, ${raw(SpaceCol.activeMemberCount)})
     VALUES (${SPACE_ID}, ${'host-device'}, ${'host-device'}, 'private', 0)`);
}

async function seedLinkInvite(db: SqlClient, maxUses: number): Promise<void> {
  await db.run(sql`INSERT INTO ${raw(SPACE_INVITES_TABLE.tableName)}
     (${raw(SpaceInviteCol.id)}, ${raw(SpaceInviteCol.spaceId)}, ${raw(SpaceInviteCol.kind)},
      ${raw(SpaceInviteCol.token)}, ${raw(SpaceInviteCol.maxUses)},
      ${raw(SpaceInviteCol.useCount)})
     VALUES (${'invite-1'}, ${SPACE_ID}, 'link', ${TOKEN}, ${maxUses}, 0)`);
}

async function readInviteUseCount(db: SqlClient): Promise<number> {
  const rows = await db.query<{ use_count: number }>(
    sql`SELECT ${raw(SpaceInviteCol.useCount)} AS use_count
     FROM ${raw(SPACE_INVITES_TABLE.tableName)} WHERE ${raw(SpaceInviteCol.id)} = ${'invite-1'}`
  );
  return Number(rows[0]?.use_count ?? -1);
}

async function readActiveMemberCount(db: SqlClient): Promise<number> {
  const rows = await db.query<{ count: number }>(
    sql`SELECT ${raw(SpaceCol.activeMemberCount)} AS count
     FROM ${raw(SPACES_TABLE.tableName)} WHERE ${raw(SpaceCol.id)} = ${SPACE_ID}`
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
  let db: SqlClientImplBunSqlite;

  beforeEach(async () => {
    db = openSql();
    await migrate(db);
    await seedPrivateSpace(db);
  });

  test('idempotent re-join by an active member does not burn an invite use', async () => {
    await seedLinkInvite(db, 10);

    await joinSpaceServer(
      db,
      joinInput({ deviceId: DEVICE_A, accountId: ACCOUNT_A })
    );
    expect(await readInviteUseCount(db)).toBe(1);
    expect(await readActiveMemberCount(db)).toBe(1);

    await joinSpaceServer(
      db,
      joinInput({ deviceId: DEVICE_A, accountId: ACCOUNT_A })
    );
    expect(await readInviteUseCount(db)).toBe(1);
    expect(await readActiveMemberCount(db)).toBe(1);
  });

  test('reactivating a left membership consumes a fresh invite use', async () => {
    await seedLinkInvite(db, 10);

    await joinSpaceServer(
      db,
      joinInput({ deviceId: DEVICE_A, accountId: ACCOUNT_A })
    );
    const membershipId = spaceMembershipEntityId(ACCOUNT_A, SPACE_ID);
    const now = new Date().toISOString();
    await db.run(sql`UPDATE ${raw(SPACE_MEMBERSHIPS_TABLE.tableName)}
       SET ${raw(SpaceMembershipCol.leftAt)} = ${now}
       WHERE ${raw(SpaceMembershipCol.id)} = ${membershipId}`);

    await joinSpaceServer(
      db,
      joinInput({ deviceId: DEVICE_A, accountId: ACCOUNT_A })
    );
    expect(await readInviteUseCount(db)).toBe(2);
  });

  test('single-use link invite cannot be over-consumed and never exceeds max', async () => {
    await seedLinkInvite(db, 1);

    await joinSpaceServer(
      db,
      joinInput({ deviceId: DEVICE_A, accountId: ACCOUNT_A })
    );
    expect(await readInviteUseCount(db)).toBe(1);

    await expect(
      joinSpaceServer(
        db,
        joinInput({ deviceId: DEVICE_B, accountId: ACCOUNT_B })
      )
    ).rejects.toThrow();
    expect(await readInviteUseCount(db)).toBe(1);
  });

  test('anonymous join is rejected', async () => {
    await seedLinkInvite(db, 10);
    await expect(
      joinSpaceServer(db, {
        spaceId: SPACE_ID,
        deviceId: DEVICE_A,
        accountId: null,
        profileId: DEVICE_A,
        inviteToken: TOKEN,
      })
    ).rejects.toThrow();
  });
});
