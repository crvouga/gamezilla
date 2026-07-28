import { beforeEach, describe, expect, test } from 'bun:test';

import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { honey, sql, ident } from '@pkgs/sql';

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
  await db.run(sql`CREATE TABLE ${ident(SPACES_TABLE.tableName)} (
      ${ident(SpaceCol.id)} TEXT PRIMARY KEY,
      ${ident(SpaceCol.title)} TEXT,
      ${ident(SpaceCol.hostId)} TEXT,
      ${ident(SpaceCol.createdAt)} TEXT,
      ${ident(SpaceCol.endedAt)} TEXT,
      ${ident(SpaceCol.visibility)} TEXT,
      ${ident(SpaceCol.hostAccountId)} TEXT,
      ${ident(SpaceCol.hostMemberId)} TEXT,
      ${ident(SpaceCol.activeMemberCount)} INTEGER NOT NULL DEFAULT 0
    )`);
  await db.run(sql`CREATE TABLE ${ident(SPACE_MEMBERSHIPS_TABLE.tableName)} (
      ${ident(SpaceMembershipCol.id)} TEXT PRIMARY KEY,
      ${ident(SpaceMembershipCol.memberId)} TEXT,
      ${ident(SpaceMembershipCol.spaceId)} TEXT,
      ${ident(SpaceMembershipCol.joinedAt)} TEXT,
      ${ident(SpaceMembershipCol.leftAt)} TEXT,
      ${ident(SpaceMembershipCol.profileId)} TEXT
    )`);
  await db.run(sql`CREATE TABLE ${ident(SPACE_INVITES_TABLE.tableName)} (
      ${ident(SpaceInviteCol.id)} TEXT PRIMARY KEY,
      ${ident(SpaceInviteCol.spaceId)} TEXT,
      ${ident(SpaceInviteCol.kind)} TEXT,
      ${ident(SpaceInviteCol.token)} TEXT,
      ${ident(SpaceInviteCol.code)} TEXT,
      ${ident(SpaceInviteCol.createdByAccountId)} TEXT,
      ${ident(SpaceInviteCol.inviteeAccountId)} TEXT,
      ${ident(SpaceInviteCol.expiresAt)} TEXT,
      ${ident(SpaceInviteCol.revokedAt)} TEXT,
      ${ident(SpaceInviteCol.acceptedAt)} TEXT,
      ${ident(SpaceInviteCol.maxUses)} INTEGER NOT NULL,
      ${ident(SpaceInviteCol.useCount)} INTEGER NOT NULL DEFAULT 0,
      ${ident(SpaceInviteCol.createdAt)} TEXT
    )`);
}

async function seedPrivateSpace(db: SqlClient): Promise<void> {
  await db.run(
    honey({
      insertInto: SPACES_TABLE.tableName,
      values: {
        [SpaceCol.id]: SPACE_ID,
        [SpaceCol.hostId]: 'host-device',
        [SpaceCol.hostMemberId]: 'host-device',
        [SpaceCol.visibility]: 'private',
        [SpaceCol.activeMemberCount]: 0,
      },
    })
  );
}

async function seedLinkInvite(db: SqlClient, maxUses: number): Promise<void> {
  await db.run(
    honey({
      insertInto: SPACE_INVITES_TABLE.tableName,
      values: {
        [SpaceInviteCol.id]: 'invite-1',
        [SpaceInviteCol.spaceId]: SPACE_ID,
        [SpaceInviteCol.kind]: 'link',
        [SpaceInviteCol.token]: TOKEN,
        [SpaceInviteCol.maxUses]: maxUses,
        [SpaceInviteCol.useCount]: 0,
      },
    })
  );
}

async function readInviteUseCount(db: SqlClient): Promise<number> {
  const rows = await db.query<{ use_count: number }>(
    honey({
      select: [SpaceInviteCol.useCount],
      from: SPACE_INVITES_TABLE.tableName,
      where: ['=', SpaceInviteCol.id, 'invite-1'],
    })
  );
  return Number(rows[0]?.use_count ?? -1);
}

async function readActiveMemberCount(db: SqlClient): Promise<number> {
  const rows = await db.query<{ count: number }>(
    honey({
      select: [[SpaceCol.activeMemberCount, 'count']],
      from: SPACES_TABLE.tableName,
      where: ['=', SpaceCol.id, SPACE_ID],
    })
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
    await db.run(
      honey({
        update: SPACE_MEMBERSHIPS_TABLE.tableName,
        set: { [SpaceMembershipCol.leftAt]: now },
        where: ['=', SpaceMembershipCol.id, membershipId],
      })
    );

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
