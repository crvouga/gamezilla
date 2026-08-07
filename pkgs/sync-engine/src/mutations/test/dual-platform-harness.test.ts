import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';
import { sql, unsafe } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { createPgMemSqlClient } from '@pkgs/sql-client/postgres/impl-pg-mem';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';
import { z } from 'zod';
import { createMutationClient } from '../client/create-mutation-client';
import { defineMutation } from '../core/define-mutation';
import { registry } from '../core/registry';
import { MutationError } from '../core/types';
import { mapConstraintError } from '../server/map-constraint-error';
import { processUploadWithMutations } from '../server/process-upload-with-mutations';
import { replayMutation } from '../server/replay-mutation';

const FIXTURE_DDL_SQLITE = `
CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX profiles_username_unique ON profiles (username)
  WHERE username <> '';
CREATE TABLE _mutations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  args TEXT NOT NULL,
  client_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  epoch INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  acked_epoch INTEGER
);
CREATE TABLE _upload_state (
  id TEXT PRIMARY KEY,
  last_acked_seq INTEGER NOT NULL DEFAULT 0,
  handoff_complete INTEGER NOT NULL DEFAULT 0,
  next_seq INTEGER NOT NULL DEFAULT 1,
  write_epoch INTEGER NOT NULL DEFAULT 0
);
INSERT INTO _upload_state (id, last_acked_seq, handoff_complete, next_seq, write_epoch)
  VALUES ('singleton', 0, 0, 1, 0);
CREATE TABLE _mutations_applied (
  mutation_id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  status TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE write_rejections (
  id TEXT PRIMARY KEY,
  mutation_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  code TEXT NOT NULL,
  message TEXT NOT NULL,
  meta TEXT,
  created_at TEXT NOT NULL,
  acknowledged INTEGER NOT NULL DEFAULT 0
);
`;

const FIXTURE_DDL_PG = `
CREATE TABLE profiles (
  id text PRIMARY KEY,
  username text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX profiles_username_unique ON profiles (username)
  WHERE (username <> '');
CREATE TABLE _mutations (
  id text PRIMARY KEY,
  name text NOT NULL,
  args text NOT NULL,
  client_id text NOT NULL,
  seq bigint NOT NULL,
  created_at timestamptz NOT NULL,
  epoch bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  acked_epoch bigint
);
CREATE TABLE _upload_state (
  id text PRIMARY KEY,
  last_acked_seq bigint NOT NULL DEFAULT 0,
  handoff_complete integer NOT NULL DEFAULT 0,
  next_seq bigint NOT NULL DEFAULT 1,
  write_epoch bigint NOT NULL DEFAULT 0
);
INSERT INTO _upload_state (id, last_acked_seq, handoff_complete, next_seq, write_epoch)
  VALUES ('singleton', 0, 0, 1, 0);
CREATE TABLE _mutations_applied (
  mutation_id text PRIMARY KEY,
  client_id text NOT NULL,
  seq bigint NOT NULL,
  status text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE write_rejections (
  id text PRIMARY KEY,
  mutation_id text NOT NULL,
  client_id text NOT NULL,
  code text NOT NULL,
  message text NOT NULL,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  acknowledged boolean NOT NULL DEFAULT false
);
`;

export const testSetNote = defineMutation({
  name: 'testSetNote',
  args: z.object({
    profileId: z.string(),
    note: z.string(),
  }),
  writes: ['profiles'],
  async run({ tx, env }, { profileId, note }) {
    if (profileId !== env.actorId) {
      throw new MutationError('FORBIDDEN', 'Not your profile.');
    }
    await tx.run(sql`
      INSERT INTO profiles (id, username, note)
      VALUES (${profileId}, ${''}, ${note})
      ON CONFLICT (id) DO UPDATE SET note = excluded.note
    `);
  },
});

export const testClaimUsername = defineMutation({
  name: 'testClaimUsername',
  args: z.object({ username: z.string().min(1) }),
  writes: ['profiles'],
  constraintErrors: {
    profiles_username_unique: {
      code: 'USERNAME_TAKEN',
      message: 'That username is already taken.',
    },
  },
  async run({ tx, env }, { username }) {
    const taken = await tx.query(sql<{ id: string }>`
      SELECT id FROM profiles
      WHERE username = ${username} AND id != ${env.actorId}
    `);
    if (taken.length > 0) {
      throw new MutationError(
        'USERNAME_TAKEN',
        'That username is already taken.'
      );
    }
    await tx.run(sql`
      INSERT INTO profiles (id, username, note)
      VALUES (${env.actorId}, ${username}, ${''})
      ON CONFLICT (id) DO UPDATE SET username = excluded.username
    `);
  },
});

export const TEST_MUTATIONS = registry([testSetNote, testClaimUsername]);

function openSqlite(): SqlClient {
  const db = new Database(':memory:');
  db.exec(FIXTURE_DDL_SQLITE);
  return new SqlClientImplBunSqlite(db);
}

async function openPostgres(): Promise<SqlClient> {
  const { sqlClient } = createPgMemSqlClient();
  await sqlClient.connect();
  for (const stmt of FIXTURE_DDL_PG.split(';')
    .map((s) => s.trim())
    .filter(Boolean)) {
    await sqlClient.run(unsafe(stmt));
  }
  return sqlClient;
}

async function seedProfile(
  db: SqlClient,
  id: string,
  username = ''
): Promise<void> {
  await db.run(sql`
    INSERT INTO profiles (id, username, note) VALUES (${id}, ${username}, ${''})
    ON CONFLICT (id) DO NOTHING
  `);
}

async function profileRows(db: SqlClient) {
  return db.query(sql<{ id: string; username: string; note: string }>`
    SELECT id, username, note FROM profiles ORDER BY id
  `);
}

const AUTH = {
  actorId: 'user-a',
  deviceId: 'device-a',
  accountId: 'user-a',
  isAnon: false,
};

describe('mutations dual-platform harness', () => {
  test('parity: same fixture + mutation → identical rows on sqlite and postgres', async () => {
    const sqlite = openSqlite();
    const pg = await openPostgres();
    await seedProfile(sqlite, 'user-a');
    await seedProfile(pg, 'user-a');

    const env = {
      ...AUTH,
      now: () => new Date('2026-01-01T00:00:00.000Z'),
    };
    let seq = 0;
    const ids = { clientId: 'device-a', nextSeq: () => ++seq };
    const online = { isOnline: () => true };

    const clientSqlite = createMutationClient({
      db: sqlite,
      registry: TEST_MUTATIONS,
      env,
      ids,
      connectivity: online,
    });
    const clientPg = createMutationClient({
      db: pg,
      registry: TEST_MUTATIONS,
      env,
      ids: { clientId: 'device-a', nextSeq: () => ++seq },
      connectivity: online,
    });

    const r1 = await clientSqlite.mutate(testSetNote, {
      profileId: 'user-a',
      note: 'hello',
    });
    const r2 = await clientPg.mutate(testSetNote, {
      profileId: 'user-a',
      note: 'hello',
    });
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(await profileRows(sqlite)).toEqual(await profileRows(pg));
  });

  test('idempotency: replay twice applies once', async () => {
    const pg = await openPostgres();
    await seedProfile(pg, 'user-a');
    const row = {
      id: 'mut-1',
      name: 'testSetNote',
      args: JSON.stringify({ profileId: 'user-a', note: 'once' }),
      clientId: 'device-a',
      seq: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    await replayMutation(
      { serverDb: pg, registry: TEST_MUTATIONS, auth: AUTH },
      row
    );
    await replayMutation(
      { serverDb: pg, registry: TEST_MUTATIONS, auth: AUTH },
      row
    );
    const applied = await pg.query(sql<{ status: string }>`
      SELECT status FROM _mutations_applied WHERE mutation_id = ${'mut-1'}
    `);
    expect(applied).toEqual([{ status: 'applied' }]);
    const profiles = await profileRows(pg);
    expect(profiles).toEqual([{ id: 'user-a', username: '', note: 'once' }]);
  });

  test('divergence: optimistic A then replay against B', async () => {
    const sqlite = openSqlite();
    const pg = await openPostgres();
    await seedProfile(sqlite, 'user-a');
    await seedProfile(pg, 'user-a');

    const env = {
      ...AUTH,
      now: () => new Date('2026-01-01T00:00:00.000Z'),
    };
    let seq = 0;
    const client = createMutationClient({
      db: sqlite,
      registry: TEST_MUTATIONS,
      env,
      ids: { clientId: 'device-a', nextSeq: () => ++seq },
      connectivity: { isOnline: () => true },
    });
    const local = await client.mutate(testSetNote, {
      profileId: 'user-a',
      note: 'optimistic',
    });
    expect(local.ok).toBe(true);

    // Server state diverged: note already set differently.
    await pg.run(sql`
      UPDATE profiles SET note = ${'server-wins'} WHERE id = ${'user-a'}
    `);

    await replayMutation(
      { serverDb: pg, registry: TEST_MUTATIONS, auth: AUTH },
      {
        id: local.ok ? local.mutationId : 'x',
        name: 'testSetNote',
        args: JSON.stringify({ profileId: 'user-a', note: 'optimistic' }),
        clientId: 'device-a',
        seq: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
      }
    );

    // Replay re-applies mutation body against B → note becomes optimistic.
    expect(await profileRows(pg)).toEqual([
      { id: 'user-a', username: '', note: 'optimistic' },
    ]);
  });

  test('constraint mapping: unique violation → business code', async () => {
    const mapped = mapConstraintError(
      { code: '23505', constraint: 'profiles_username_unique' },
      testClaimUsername.constraintErrors
    );
    expect(mapped?.code).toBe('USERNAME_TAKEN');

    const pg = await openPostgres();
    await seedProfile(pg, 'user-a');
    await seedProfile(pg, 'user-b', 'taken');

    await replayMutation(
      { serverDb: pg, registry: TEST_MUTATIONS, auth: AUTH },
      {
        id: 'mut-claim',
        name: 'testClaimUsername',
        args: JSON.stringify({ username: 'taken' }),
        clientId: 'device-a',
        seq: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
      }
    );

    const rejections = await pg.query(sql<{ code: string }>`
      SELECT code FROM write_rejections WHERE mutation_id = ${'mut-claim'}
    `);
    expect(rejections[0]?.code).toBe('USERNAME_TAKEN');
  });

  test('processUpload: DOMAIN without mutation row is rejected', async () => {
    const pg = await openPostgres();
    await processUploadWithMutations({
      serverDb: pg,
      registry: TEST_MUTATIONS,
      auth: AUTH,
      transactionId: 'txn-1',
      tablePolicyFor: (t) =>
        t === 'profiles'
          ? 'DOMAIN'
          : t === '_mutations'
            ? 'FRAMEWORK'
            : undefined,
      crud: [
        {
          table: 'profiles',
          op: 'PUT',
          id: 'user-a',
          data: { id: 'user-a', note: 'bypass' },
        },
      ],
    });
    const rejections = await pg.query(sql<{ code: string }>`
      SELECT code FROM write_rejections
    `);
    expect(rejections.some((r) => r.code === 'POLICY_VIOLATION')).toBe(true);
  });
});
