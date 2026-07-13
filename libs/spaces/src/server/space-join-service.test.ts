import { beforeEach, describe, expect, test } from 'bun:test';

import { SqlClientImplBunSqlite } from '@pkgs/sql-client/impl-bun-sqlite';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { DeviceCol, DEVICES_TABLE } from '@libs/db/shared/auth-tables';
import {
  SpaceCol,
  SpaceInviteCol,
  SpaceMembershipCol,
  SPACES_TABLE,
  SPACE_INVITES_TABLE,
  SPACE_MEMBERSHIPS_TABLE,
} from '@libs/db/shared/space-tables';

import { resolveDeviceLabelFromDb } from './resolve-device-label-from-db';
import { joinSpaceServer } from './space-join-service';
import { spaceDeviceMembershipEntityId } from '../shared/membership-key';

const SPACE_ID = 'space-1';
const DEVICE_A = 'device-aaaaaaaa-0000';
const DEVICE_B = 'device-bbbbbbbb-1111';
const PROFILE_A = 'profile-a';
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
      ${SpaceCol.hostUsername} TEXT,
      ${SpaceCol.hostAvatarConfig} TEXT,
      ${SpaceCol.activeMemberCount} INTEGER NOT NULL DEFAULT 0
    )`
  );
  await sql.run(
    `CREATE TABLE ${SPACE_MEMBERSHIPS_TABLE.tableName} (
      ${SpaceMembershipCol.id} TEXT PRIMARY KEY,
      ${SpaceMembershipCol.guestId} TEXT,
      ${SpaceMembershipCol.spaceId} TEXT,
      ${SpaceMembershipCol.joinedAt} TEXT,
      ${SpaceMembershipCol.leftAt} TEXT,
      ${SpaceMembershipCol.profileId} TEXT,
      ${SpaceMembershipCol.deviceLabel} TEXT
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
  await sql.run(
    `CREATE TABLE ${DEVICES_TABLE.tableName} (
      ${DeviceCol.id} TEXT PRIMARY KEY,
      ${DeviceCol.deviceName} TEXT,
      ${DeviceCol.deviceBrand} TEXT,
      ${DeviceCol.deviceModelName} TEXT
    )`
  );
}

async function seedPrivateSpace(sql: SqlClient): Promise<void> {
  // host_account_id left null so join access is decided purely by the invite.
  await sql.run(
    `INSERT INTO ${SPACES_TABLE.tableName}
     (${SpaceCol.id}, ${SpaceCol.hostId}, ${SpaceCol.visibility},
      ${SpaceCol.activeMemberCount})
     VALUES (?, ?, 'private', 0)`,
    [SPACE_ID, 'host-device']
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

function joinInput(deviceId: string) {
  return {
    spaceId: SPACE_ID,
    deviceId,
    accountId: null,
    profileId: PROFILE_A,
    deviceLabel: 'My Phone',
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

    await joinSpaceServer(sql, joinInput(DEVICE_A));
    expect(await readInviteUseCount(sql)).toBe(1);
    expect(await readActiveMemberCount(sql)).toBe(1);

    // Same device joins again while already active — must be a no-op for quota.
    await joinSpaceServer(sql, joinInput(DEVICE_A));
    expect(await readInviteUseCount(sql)).toBe(1);
    expect(await readActiveMemberCount(sql)).toBe(1);
  });

  test('reactivating a left membership consumes a fresh invite use', async () => {
    await seedLinkInvite(sql, 10);

    await joinSpaceServer(sql, joinInput(DEVICE_A));
    const membershipId = spaceDeviceMembershipEntityId(DEVICE_A, SPACE_ID);
    await sql.run(
      `UPDATE ${SPACE_MEMBERSHIPS_TABLE.tableName}
       SET ${SpaceMembershipCol.leftAt} = ?
       WHERE ${SpaceMembershipCol.id} = ?`,
      [new Date().toISOString(), membershipId]
    );

    await joinSpaceServer(sql, joinInput(DEVICE_A));
    expect(await readInviteUseCount(sql)).toBe(2);
  });

  test('single-use link invite cannot be over-consumed and never exceeds max', async () => {
    await seedLinkInvite(sql, 1);

    await joinSpaceServer(sql, joinInput(DEVICE_A));
    expect(await readInviteUseCount(sql)).toBe(1);

    await expect(joinSpaceServer(sql, joinInput(DEVICE_B))).rejects.toThrow();
    // Never incremented past the cap by the second attempt.
    expect(await readInviteUseCount(sql)).toBe(1);
  });
});

describe('resolveDeviceLabelFromDb', () => {
  let sql: SqlClientImplBunSqlite;

  beforeEach(async () => {
    sql = openSql();
    await migrate(sql);
  });

  async function insertDevice(args: {
    id: string;
    name?: string | null;
    brand?: string | null;
    model?: string | null;
  }): Promise<void> {
    await sql.run(
      `INSERT INTO ${DEVICES_TABLE.tableName}
       (${DeviceCol.id}, ${DeviceCol.deviceName}, ${DeviceCol.deviceBrand},
        ${DeviceCol.deviceModelName})
       VALUES (?, ?, ?, ?)`,
      [args.id, args.name ?? null, args.brand ?? null, args.model ?? null]
    );
  }

  test('prefers the device name', async () => {
    await insertDevice({ id: DEVICE_A, name: "Chris's iPhone", brand: 'Apple' });
    expect(await resolveDeviceLabelFromDb(sql, DEVICE_A)).toBe("Chris's iPhone");
  });

  test('falls back to brand + model when name is blank', async () => {
    await insertDevice({ id: DEVICE_A, name: '  ', brand: 'Google', model: 'Pixel 8' });
    expect(await resolveDeviceLabelFromDb(sql, DEVICE_A)).toBe('Google Pixel 8');
  });

  test('falls back to a short id when the device row is missing', async () => {
    expect(await resolveDeviceLabelFromDb(sql, DEVICE_A)).toBe(
      `Device ${DEVICE_A.slice(0, 8)}\u2026`
    );
  });
});
