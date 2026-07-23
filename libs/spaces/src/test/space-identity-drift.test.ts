import { beforeEach, describe, expect, test } from 'bun:test';

import {
  SPACE_MEMBERSHIPS_TABLE,
  SPACE_PARTICIPATIONS_TABLE,
  SpaceCol,
  SpaceMembershipCol,
  SpaceParticipationCol,
  SPACES_TABLE,
} from '@libs/db/shared/space-tables';
import {
  spaceMembershipEntityId,
  spaceParticipationEntityId,
} from '@libs/spaces/shared/participation/participation-ids';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/impl-bun-sqlite';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { WriteContext } from '@pkgs/write/shared/write-context';

import {
  authorizeClaimSpaceParticipations,
  executeClaimSpaceParticipations,
} from '../shared/claim-space-participations/claim-space-participations-write';
import {
  authorizeJoinSpace,
  executeJoinSpace,
} from '../shared/join-space/join-space-write';
import {
  authorizeLeaveSpaceEverywhere,
  executeLeaveSpaceEverywhere,
} from '../shared/leave-space/leave-space-everywhere-write';
import {
  authorizeLeaveSpace,
  executeLeaveSpace,
} from '../shared/leave-space/leave-space-write';
import { SPACE_ROW_BINDINGS } from '../shared/row-bindings';

const SPACE_ID = 'space-1';
const DEVICE_ID = 'device-aaaaaaaa-0000';
const ACCOUNT_ID = 'account-bbbbbbbb-1111';
const GUEST_DEVICE_ID = 'device-guest-cccc-2222';
const GUEST_ACCOUNT_ID = 'account-guest-dddd-3333';

function openSql(): SqlClientImplBunSqlite {
  return SqlClientImplBunSqlite.open(':memory:');
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
      ${SpaceCol.hostUsername} TEXT,
      ${SpaceCol.hostAvatarConfig} TEXT,
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
    `CREATE TABLE ${SPACE_PARTICIPATIONS_TABLE.tableName} (
      ${SpaceParticipationCol.id} TEXT PRIMARY KEY,
      ${SpaceParticipationCol.spaceId} TEXT,
      ${SpaceParticipationCol.memberId} TEXT,
      ${SpaceParticipationCol.deviceId} TEXT,
      ${SpaceParticipationCol.deviceLabel} TEXT,
      ${SpaceParticipationCol.joinedAt} TEXT,
      ${SpaceParticipationCol.leftAt} TEXT
    )`
  );
}

function ctx(args: {
  readonly deviceId: string;
  readonly accountId: string | null;
}): WriteContext {
  const myId = args.accountId ?? args.deviceId;
  return {
    subjectId: myId,
    deviceId: args.deviceId,
    accountId: args.accountId,
    myId,
    isAnonymous: args.accountId === null,
    memberOfSpaceIds: [],
  };
}

async function seedAnonSeat(sql: SqlClient): Promise<void> {
  const now = new Date().toISOString();
  await sql.run(
    `INSERT INTO ${SPACES_TABLE.tableName}
     (${SpaceCol.id}, ${SpaceCol.hostId}, ${SpaceCol.hostMemberId},
      ${SpaceCol.visibility}, ${SpaceCol.activeMemberCount})
     VALUES (?, ?, ?, 'private', 1)`,
    [SPACE_ID, DEVICE_ID, DEVICE_ID]
  );
  await sql.run(
    `INSERT INTO ${SPACE_MEMBERSHIPS_TABLE.tableName}
     (${SpaceMembershipCol.id}, ${SpaceMembershipCol.memberId},
      ${SpaceMembershipCol.spaceId}, ${SpaceMembershipCol.joinedAt},
      ${SpaceMembershipCol.leftAt}, ${SpaceMembershipCol.profileId})
     VALUES (?, ?, ?, ?, NULL, ?)`,
    [
      spaceMembershipEntityId(DEVICE_ID, SPACE_ID),
      DEVICE_ID,
      SPACE_ID,
      now,
      DEVICE_ID,
    ]
  );
  await sql.run(
    `INSERT INTO ${SPACE_PARTICIPATIONS_TABLE.tableName}
     (${SpaceParticipationCol.id}, ${SpaceParticipationCol.spaceId},
      ${SpaceParticipationCol.memberId}, ${SpaceParticipationCol.deviceId},
      ${SpaceParticipationCol.deviceLabel}, ${SpaceParticipationCol.joinedAt},
      ${SpaceParticipationCol.leftAt})
     VALUES (?, ?, ?, ?, 'Phone', ?, NULL)`,
    [
      spaceParticipationEntityId(DEVICE_ID, SPACE_ID),
      SPACE_ID,
      DEVICE_ID,
      DEVICE_ID,
      now,
    ]
  );
}

async function readParticipation(sql: SqlClient): Promise<{
  readonly leftAt: string | null;
  readonly memberId: string;
} | null> {
  const id = spaceParticipationEntityId(DEVICE_ID, SPACE_ID);
  const rows = await sql.query<{
    readonly left_at: string | null;
    readonly member_id: string;
  }>(
    `SELECT ${SpaceParticipationCol.leftAt} AS left_at,
            ${SpaceParticipationCol.memberId} AS member_id
     FROM ${SPACE_PARTICIPATIONS_TABLE.tableName}
     WHERE ${SpaceParticipationCol.id} = ?`,
    [id]
  );
  const row = rows[0];
  if (row === undefined) return null;
  return { leftAt: row.left_at, memberId: row.member_id };
}

async function readMembership(
  sql: SqlClient,
  memberId: string
): Promise<{ readonly leftAt: string | null } | null> {
  const id = spaceMembershipEntityId(memberId, SPACE_ID);
  const rows = await sql.query<{ readonly left_at: string | null }>(
    `SELECT ${SpaceMembershipCol.leftAt} AS left_at
     FROM ${SPACE_MEMBERSHIPS_TABLE.tableName}
     WHERE ${SpaceMembershipCol.id} = ?`,
    [id]
  );
  const row = rows[0];
  if (row === undefined) return null;
  return { leftAt: row.left_at };
}

async function readSpaceHost(sql: SqlClient): Promise<{
  readonly hostMemberId: string | null;
  readonly hostAccountId: string | null;
  readonly activeMemberCount: number;
  readonly endedAt: string | null;
}> {
  const rows = await sql.query<{
    readonly host_member_id: string | null;
    readonly host_account_id: string | null;
    readonly active_member_count: number;
    readonly ended_at: string | null;
  }>(
    `SELECT ${SpaceCol.hostMemberId} AS host_member_id,
            ${SpaceCol.hostAccountId} AS host_account_id,
            ${SpaceCol.activeMemberCount} AS active_member_count,
            ${SpaceCol.endedAt} AS ended_at
     FROM ${SPACES_TABLE.tableName}
     WHERE ${SpaceCol.id} = ?`,
    [SPACE_ID]
  );
  const row = rows[0]!;
  return {
    hostMemberId: row.host_member_id,
    hostAccountId: row.host_account_id,
    activeMemberCount: Number(row.active_member_count),
    endedAt: row.ended_at,
  };
}

describe('leave-space identity drift', () => {
  let sql: SqlClientImplBunSqlite;

  beforeEach(async () => {
    sql = openSql();
    await migrate(sql);
    await seedAnonSeat(sql);
  });

  test('signed-in leave clears anon-stamped seat', async () => {
    const signedIn = ctx({ deviceId: DEVICE_ID, accountId: ACCOUNT_ID });
    const auth = await authorizeLeaveSpace(signedIn, { spaceId: SPACE_ID }, sql);
    expect(auth.ok).toBe(true);
    const exec = await executeLeaveSpace(signedIn, { spaceId: SPACE_ID }, sql);
    expect(exec.ok).toBe(true);
    const participation = await readParticipation(sql);
    expect(participation?.leftAt).not.toBeNull();
    const anonMembership = await readMembership(sql, DEVICE_ID);
    expect(anonMembership?.leftAt).not.toBeNull();
    const space = await readSpaceHost(sql);
    expect(space.activeMemberCount).toBe(0);
    expect(space.endedAt).not.toBeNull();
  });

  test('signed-out leave clears account-stamped seat', async () => {
    const now = new Date().toISOString();
    await sql.run(
      `UPDATE ${SPACE_PARTICIPATIONS_TABLE.tableName}
       SET ${SpaceParticipationCol.memberId} = ?`,
      [ACCOUNT_ID]
    );
    await sql.run(
      `INSERT INTO ${SPACE_MEMBERSHIPS_TABLE.tableName}
       (${SpaceMembershipCol.id}, ${SpaceMembershipCol.memberId},
        ${SpaceMembershipCol.spaceId}, ${SpaceMembershipCol.joinedAt},
        ${SpaceMembershipCol.leftAt}, ${SpaceMembershipCol.profileId})
       VALUES (?, ?, ?, ?, NULL, ?)`,
      [
        spaceMembershipEntityId(ACCOUNT_ID, SPACE_ID),
        ACCOUNT_ID,
        SPACE_ID,
        now,
        ACCOUNT_ID,
      ]
    );
    await sql.run(
      `UPDATE ${SPACE_MEMBERSHIPS_TABLE.tableName}
       SET ${SpaceMembershipCol.leftAt} = ?
       WHERE ${SpaceMembershipCol.id} = ?`,
      [now, spaceMembershipEntityId(DEVICE_ID, SPACE_ID)]
    );
    const anon = ctx({ deviceId: DEVICE_ID, accountId: null });
    const auth = await authorizeLeaveSpace(anon, { spaceId: SPACE_ID }, sql);
    expect(auth.ok).toBe(true);
    await executeLeaveSpace(anon, { spaceId: SPACE_ID }, sql);
    expect((await readParticipation(sql))?.leftAt).not.toBeNull();
    expect((await readMembership(sql, ACCOUNT_ID))?.leftAt).not.toBeNull();
  });

  test('host leave with guest remaining keeps space live', async () => {
    const now = new Date().toISOString();
    await sql.run(
      `INSERT INTO ${SPACE_MEMBERSHIPS_TABLE.tableName}
       (${SpaceMembershipCol.id}, ${SpaceMembershipCol.memberId},
        ${SpaceMembershipCol.spaceId}, ${SpaceMembershipCol.joinedAt},
        ${SpaceMembershipCol.leftAt}, ${SpaceMembershipCol.profileId})
       VALUES (?, ?, ?, ?, NULL, ?)`,
      [
        spaceMembershipEntityId(GUEST_ACCOUNT_ID, SPACE_ID),
        GUEST_ACCOUNT_ID,
        SPACE_ID,
        now,
        GUEST_ACCOUNT_ID,
      ]
    );
    await sql.run(
      `INSERT INTO ${SPACE_PARTICIPATIONS_TABLE.tableName}
       (${SpaceParticipationCol.id}, ${SpaceParticipationCol.spaceId},
        ${SpaceParticipationCol.memberId}, ${SpaceParticipationCol.deviceId},
        ${SpaceParticipationCol.deviceLabel}, ${SpaceParticipationCol.joinedAt},
        ${SpaceParticipationCol.leftAt})
       VALUES (?, ?, ?, ?, 'Guest', ?, NULL)`,
      [
        spaceParticipationEntityId(GUEST_DEVICE_ID, SPACE_ID),
        SPACE_ID,
        GUEST_ACCOUNT_ID,
        GUEST_DEVICE_ID,
        now,
      ]
    );
    await sql.run(
      `UPDATE ${SPACES_TABLE.tableName}
       SET ${SpaceCol.activeMemberCount} = 2`
    );
    const signedIn = ctx({ deviceId: DEVICE_ID, accountId: ACCOUNT_ID });
    await executeLeaveSpace(signedIn, { spaceId: SPACE_ID }, sql);
    expect((await readParticipation(sql))?.leftAt).not.toBeNull();
    expect((await readSpaceHost(sql)).endedAt).toBeNull();
  });

  test('orphaned host can rejoin private space and heal identity', async () => {
    const signedIn = ctx({ deviceId: DEVICE_ID, accountId: ACCOUNT_ID });
    await executeLeaveSpace(signedIn, { spaceId: SPACE_ID }, sql);
    expect((await readSpaceHost(sql)).endedAt).not.toBeNull();

    // Re-seed a live orphan: host fields still match creating device, no seat.
    await sql.run(
      `UPDATE ${SPACES_TABLE.tableName}
       SET ${SpaceCol.endedAt} = NULL,
           ${SpaceCol.hostMemberId} = ?,
           ${SpaceCol.hostAccountId} = NULL,
           ${SpaceCol.activeMemberCount} = 0`,
      [DEVICE_ID]
    );
    const auth = await authorizeJoinSpace(
      signedIn,
      { spaceId: SPACE_ID, deviceLabel: 'Phone', inviteToken: null },
      sql
    );
    expect(auth.ok).toBe(true);
    const exec = await executeJoinSpace(
      signedIn,
      { spaceId: SPACE_ID, deviceLabel: 'Phone', inviteToken: null },
      sql
    );
    expect(exec.ok).toBe(true);
    const participation = await readParticipation(sql);
    expect(participation?.leftAt).toBeNull();
    expect(participation?.memberId).toBe(ACCOUNT_ID);
    const space = await readSpaceHost(sql);
    expect(space.hostMemberId).toBe(ACCOUNT_ID);
    expect(space.hostAccountId).toBe(ACCOUNT_ID);
    expect(space.endedAt).toBeNull();
  });
});

describe('leave-everywhere identity drift', () => {
  let sql: SqlClientImplBunSqlite;

  beforeEach(async () => {
    sql = openSql();
    await migrate(sql);
    await seedAnonSeat(sql);
  });

  test('finds device seat under old member and clears it', async () => {
    const signedIn = ctx({ deviceId: DEVICE_ID, accountId: ACCOUNT_ID });
    const auth = await authorizeLeaveSpaceEverywhere(
      signedIn,
      { spaceId: SPACE_ID },
      sql
    );
    expect(auth.ok).toBe(true);
    await executeLeaveSpaceEverywhere(signedIn, { spaceId: SPACE_ID }, sql);
    expect((await readParticipation(sql))?.leftAt).not.toBeNull();
    expect((await readMembership(sql, DEVICE_ID))?.leftAt).not.toBeNull();
    expect((await readSpaceHost(sql)).endedAt).not.toBeNull();
  });
});

describe('claim-space-participations', () => {
  let sql: SqlClientImplBunSqlite;

  beforeEach(async () => {
    sql = openSql();
    await migrate(sql);
    await seedAnonSeat(sql);
  });

  test('rebinds anon seat to account and migrates host', async () => {
    const signedIn = ctx({ deviceId: DEVICE_ID, accountId: ACCOUNT_ID });
    const auth = await authorizeClaimSpaceParticipations(signedIn, {}, sql);
    expect(auth.ok).toBe(true);
    await executeClaimSpaceParticipations(signedIn, {}, sql);
    const participation = await readParticipation(sql);
    expect(participation?.leftAt).toBeNull();
    expect(participation?.memberId).toBe(ACCOUNT_ID);
    expect((await readMembership(sql, DEVICE_ID))?.leftAt).not.toBeNull();
    expect((await readMembership(sql, ACCOUNT_ID))?.leftAt).toBeNull();
    const space = await readSpaceHost(sql);
    expect(space.hostMemberId).toBe(ACCOUNT_ID);
    expect(space.hostAccountId).toBe(ACCOUNT_ID);
    expect(space.activeMemberCount).toBe(1);
  });
});

describe('membership leave upload auth', () => {
  let sql: SqlClientImplBunSqlite;

  beforeEach(async () => {
    sql = openSql();
    await migrate(sql);
    await seedAnonSeat(sql);
  });

  test('allows leave-shaped orphan membership when device held seat', async () => {
    const signedIn = ctx({ deviceId: DEVICE_ID, accountId: ACCOUNT_ID });
    const binding = SPACE_ROW_BINDINGS[SPACE_MEMBERSHIPS_TABLE.tableName]!;
    const result = await binding.write.authorize(
      signedIn,
      {
        op: 'patch',
        table: SPACE_MEMBERSHIPS_TABLE.tableName,
        id: spaceMembershipEntityId(DEVICE_ID, SPACE_ID),
        values: {
          [SpaceMembershipCol.memberId]: DEVICE_ID,
          [SpaceMembershipCol.spaceId]: SPACE_ID,
          [SpaceMembershipCol.leftAt]: new Date().toISOString(),
        },
      },
      sql
    );
    expect(result.ok).toBe(true);
  });

  test('rejects leave-shaped membership for unrelated member', async () => {
    const signedIn = ctx({ deviceId: DEVICE_ID, accountId: ACCOUNT_ID });
    const other = 'other-member-cccc';
    const binding = SPACE_ROW_BINDINGS[SPACE_MEMBERSHIPS_TABLE.tableName]!;
    const result = await binding.write.authorize(
      signedIn,
      {
        op: 'patch',
        table: SPACE_MEMBERSHIPS_TABLE.tableName,
        id: spaceMembershipEntityId(other, SPACE_ID),
        values: {
          [SpaceMembershipCol.memberId]: other,
          [SpaceMembershipCol.spaceId]: SPACE_ID,
          [SpaceMembershipCol.leftAt]: new Date().toISOString(),
        },
      },
      sql
    );
    expect(result.ok).toBe(false);
  });
});
