import { describe, expect, test } from 'bun:test';
import sql, { unsafe } from '@pkgs/sql-shared/sql';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-shared/impl-mockingbird-sqlite';
import { createSyncApp } from '@pkgs/sync-engine-server/create-sync-app';
import { defineQuery } from '@pkgs/sync-engine-shared/define-query';
import { mutationRegistry } from '@pkgs/sync-engine-shared/mutations-registry';
import type { QueryResponse } from '@pkgs/sync-engine-shared/v2';
import { queryRegistry } from '@pkgs/sync-engine-shared/queries-registry';
import { SYNC_PROTOCOL_HEADER, SYNC_PROTOCOL_VERSION } from '@pkgs/sync-engine-shared/v2';
import { z } from 'zod';

type NoteRow = {
  readonly id: string;
  readonly body: string;
  readonly deleted_at: string | null;
  readonly extra?: string;
};

function makeRows(order: 'a-first' | 'b-first'): NoteRow[] {
  const a: NoteRow = {
    id: 'a',
    body: 'one',
    deleted_at: null,
    extra: 'x',
  };
  const b: NoteRow = { id: 'b', body: 'two', deleted_at: null };
  return order === 'a-first' ? [a, b] : [b, a];
}

const snapshotQuery = defineQuery({
  name: 'publicApiSnapshot',
  limit: 100,
  params: z.object({
    order: z.enum(['a-first', 'b-first']).default('a-first'),
  }),
  async run(_ctx, params) {
    const order = params.order;
    const notes = makeRows(order).map((row) => {
      // Column key order varies; hash must stay reorder-stable.
      if (order === 'b-first') {
        return {
          deleted_at: row.deleted_at,
          body: row.body,
          id: row.id,
          ...(row.extra !== undefined ? { extra: row.extra } : {}),
        };
      }
      return row;
    });
    return { notes };
  },
});

/**
 * The same row as a Postgres driver returns it (`Date`) and as the client
 * holds it after the wire (ISO string).
 */
const timestampQuery = defineQuery({
  name: 'publicApiTimestamp',
  limit: 100,
  params: z.object({ as: z.enum(['date', 'iso']) }),
  async run(_ctx, params) {
    const iso = '2026-09-28T04:04:33.306Z';
    const createdAt = params.as === 'date' ? new Date(iso) : iso;
    return { notes: [{ id: 'a', created_at: createdAt, deleted_at: null }] };
  },
});

const PROFILE_ID = 'p1';
const AVATAR = { seed: 's', style: 'funEmoji', options: {} };

const GRACE_MS = 604_800_000;

/**
 * Rows as the server's Postgres returns them (a boolean, jsonb objects and
 * scalars) and as the client's SQLite returns them after merge (`1`, JSON
 * text, and a jsonb scalar in a TEXT column read back as text). The client
 * re-runs the query on its SQLite to check its rows against the hash.
 */
const storedTypesQuery = defineQuery({
  name: 'publicApiStoredTypes',
  limit: 100,
  params: z.object({ from: z.enum(['postgres', 'sqlite']) }),
  async run(ctx, params) {
    if (params.from === 'sqlite') {
      return {
        profiles: await ctx.db.query(
          sql`SELECT id, is_anon, avatar_config, deleted_at FROM profiles`
        ),
        settings: await ctx.db.query(sql`SELECT id, value FROM settings`),
      };
    }
    return {
      profiles: [
        {
          id: PROFILE_ID,
          is_anon: true,
          avatar_config: AVATAR,
          deleted_at: null,
        },
      ],
      settings: [
        { id: 'enabled', value: true },
        { id: 'grace_ms', value: GRACE_MS },
      ],
    };
  },
});

async function postQuery(
  app: ReturnType<typeof createSyncApp>,
  body: unknown
): Promise<{ status: number; json: { responses: QueryResponse[] } }> {
  const res = await app.request('http://test/query', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [SYNC_PROTOCOL_HEADER]: String(SYNC_PROTOCOL_VERSION),
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as never };
}

describe('public API: createSyncApp query not_modified', () => {
  test('identical snapshot → not_modified; row/column reorder is hash-stable', async () => {
    const db = SqlClientImplMockingbirdSqlite.open();
    await db.connect();
    let cp = 0;
    const app = createSyncApp({
      resolveAuth: async () => ({
        actorId: 'actor',
        deviceId: 'device',
        accountId: 'acct',
        isAnon: false,
      }),
      getSql: () => db,
      queries: queryRegistry([snapshotQuery, timestampQuery, storedTypesQuery]),
      mutations: mutationRegistry([]),
      now: () => 1_700_000_000_000,
      createId: () => 'id-1',
      nextCheckpoint: () => String(++cp),
    });

    const first = await postQuery(app, {
      queries: [{ name: 'publicApiSnapshot', params: { order: 'a-first' } }],
    });
    expect(first.status).toBe(200);
    expect(first.json.responses).toHaveLength(1);
    const ok = first.json.responses[0];
    expect(ok?.status).toBe('ok');
    if (ok?.status !== 'ok') throw new Error('expected ok');

    const same = await postQuery(app, {
      queries: [
        {
          name: 'publicApiSnapshot',
          params: { order: 'a-first' },
          lastHash: ok.hash,
        },
      ],
    });
    expect(same.json.responses[0]?.status).toBe('not_modified');

    const reordered = await postQuery(app, {
      queries: [
        {
          name: 'publicApiSnapshot',
          params: { order: 'b-first' },
          lastHash: ok.hash,
        },
      ],
    });
    expect(reordered.json.responses[0]?.status).toBe('not_modified');
  });

  test('a Date column hashes as its wire value, so the client stays in sync', async () => {
    const db = SqlClientImplMockingbirdSqlite.open();
    await db.connect();
    let cp = 0;
    const app = createSyncApp({
      resolveAuth: async () => ({
        actorId: 'actor',
        deviceId: 'device',
        accountId: 'acct',
        isAnon: false,
      }),
      getSql: () => db,
      queries: queryRegistry([snapshotQuery, timestampQuery, storedTypesQuery]),
      mutations: mutationRegistry([]),
      now: () => 1_700_000_000_000,
      createId: () => 'id-1',
      nextCheckpoint: () => String(++cp),
    });

    const asIso = await postQuery(app, {
      queries: [{ name: 'publicApiTimestamp', params: { as: 'iso' } }],
    });
    const iso = asIso.json.responses[0];
    if (iso?.status !== 'ok') throw new Error('expected ok');

    const asDate = await postQuery(app, {
      queries: [
        {
          name: 'publicApiTimestamp',
          params: { as: 'date' },
          lastHash: iso.hash,
        },
      ],
    });
    expect(asDate.json.responses[0]?.status).toBe('not_modified');
  });

  // regression: sync-hash-sqlite-stored-types
  test('booleans and JSON hash as the client stores them, so the client stays in sync', async () => {
    const db = SqlClientImplMockingbirdSqlite.open();
    await db.connect();
    await db.run(
      unsafe(
        'CREATE TABLE profiles (id TEXT PRIMARY KEY, is_anon INTEGER, avatar_config TEXT, deleted_at TEXT)'
      )
    );
    await db.run(
      sql`INSERT INTO profiles (id, is_anon, avatar_config, deleted_at) VALUES (${PROFILE_ID}, ${1}, ${JSON.stringify(AVATAR)}, ${null})`
    );
    await db.run(
      unsafe('CREATE TABLE settings (id TEXT PRIMARY KEY, value TEXT)')
    );
    await db.run(
      sql`INSERT INTO settings (id, value) VALUES (${'enabled'}, ${1}), (${'grace_ms'}, ${GRACE_MS})`
    );
    let cp = 0;
    const app = createSyncApp({
      resolveAuth: async () => ({
        actorId: 'actor',
        deviceId: 'device',
        accountId: 'acct',
        isAnon: false,
      }),
      getSql: () => db,
      queries: queryRegistry([snapshotQuery, timestampQuery, storedTypesQuery]),
      mutations: mutationRegistry([]),
      now: () => 1_700_000_000_000,
      createId: () => 'id-1',
      nextCheckpoint: () => String(++cp),
    });

    const fromPostgres = await postQuery(app, {
      queries: [{ name: 'publicApiStoredTypes', params: { from: 'postgres' } }],
    });
    const served = fromPostgres.json.responses[0];
    if (served?.status !== 'ok') throw new Error('expected ok');

    const fromSqlite = await postQuery(app, {
      queries: [
        {
          name: 'publicApiStoredTypes',
          params: { from: 'sqlite' },
          lastHash: served.hash,
        },
      ],
    });
    expect(fromSqlite.json.responses[0]?.status).toBe('not_modified');
  });
});
