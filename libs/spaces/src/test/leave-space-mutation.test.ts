import { beforeEach, describe, expect, test } from 'bun:test';
import { registerTables } from '@pkgs/db-schema';
import { applySqliteSchema } from '@pkgs/db-schema/sqlite';
import { sql } from '@pkgs/sql';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';
import type { MutationEnv } from '@pkgs/sync-engine/shared';
import { SPACES_TABLES } from '../public/schema';
import { spaceOpenSessionEntityId } from '../shared/space/participation/participation-ids';
import { createSpaceMutation } from '../use-cases/create-space/shared/create-space-mutation';
import { joinSpaceMutation } from '../use-cases/join-space/shared/join-space-mutation';
import { leaveSpaceMutation } from '../use-cases/leave-space/shared/leave-space-mutation';

const SPACE_ID = 'space-1';
const ALICE_DEVICE = 'device-alice';
const BOB_DEVICE = 'device-bob';
const ALICE_ACCOUNT = 'account-alice';
const BOB_ACCOUNT = 'account-bob';
const NOW = () => new Date('2026-01-01T00:00:00.000Z');

function env(args: { deviceId: string; accountId: string }): MutationEnv {
  return {
    actorId: args.accountId,
    deviceId: args.deviceId,
    accountId: args.accountId,
    isAnon: false,
    now: NOW,
    createId: () => 'unused',
  };
}

async function migrate(db: SqlClientImplBunSqlite): Promise<void> {
  await applySqliteSchema(db, registerTables([...SPACES_TABLES]));
}

describe('leaveSpaceMutation', () => {
  let db: SqlClientImplBunSqlite;

  beforeEach(async () => {
    db = SqlClientImplBunSqlite.open(':memory:');
    await migrate(db);
  });

  test('guest leave tombstones membership and closes this device open session', async () => {
    await createSpaceMutation.run(
      {
        tx: db,
        env: env({ deviceId: ALICE_DEVICE, accountId: ALICE_ACCOUNT }),
      },
      { spaceId: SPACE_ID, visibility: 'public' }
    );
    await joinSpaceMutation.run(
      { tx: db, env: env({ deviceId: BOB_DEVICE, accountId: BOB_ACCOUNT }) },
      { spaceId: SPACE_ID }
    );

    const openBefore = await db.query(sql<{
      readonly deleted_at: string | null;
    }>`
      SELECT deleted_at FROM spaces_open_sessions
      WHERE id = ${spaceOpenSessionEntityId(BOB_DEVICE, SPACE_ID)}
    `);
    expect(openBefore[0]?.deleted_at).toBeNull();

    await leaveSpaceMutation.run(
      { tx: db, env: env({ deviceId: BOB_DEVICE, accountId: BOB_ACCOUNT }) },
      { spaceId: SPACE_ID }
    );

    const openAfter = await db.query(sql<{
      readonly deleted_at: string | null;
    }>`
      SELECT deleted_at FROM spaces_open_sessions
      WHERE id = ${spaceOpenSessionEntityId(BOB_DEVICE, SPACE_ID)}
    `);
    expect(openAfter[0]?.deleted_at).not.toBeNull();

    const memberAfter = await db.query(sql<{
      readonly deleted_at: string | null;
    }>`
      SELECT deleted_at FROM spaces_users
      WHERE space_id = ${SPACE_ID} AND user_id = ${BOB_ACCOUNT}
    `);
    expect(memberAfter[0]?.deleted_at).not.toBeNull();
  });
});
