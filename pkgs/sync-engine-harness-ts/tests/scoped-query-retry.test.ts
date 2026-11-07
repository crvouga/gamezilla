import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { createLocalSyncEngine } from '@pkgs/sync-engine-client-ts/create-local-sync-engine';
import { createSyncHttpClient } from '@pkgs/sync-engine-client-ts/sync-http-client';
import { exampleLocalSchema } from '@pkgs/sync-engine-harness-ts/local-schema';
import { createSyncApp } from '@pkgs/sync-engine-server-ts/create-sync-app';
import { defineQuery } from '@pkgs/sync-engine-shared-ts/define-query';
import { queryRegistry } from '@pkgs/sync-engine-shared-ts/queries-registry';
import {
  type QueryRetryNotice,
  RetryableQueryError,
} from '@pkgs/sync-engine-shared-ts/retryable-query-error';
import { z } from 'zod';

async function settle(): Promise<void> {
  for (let i = 0; i < 200; i += 1) await Promise.resolve();
}

function note(id: string, title: string) {
  return {
    id,
    title,
    body: '',
    folder_id: '',
    space_id: '',
    owner_id: 'alice',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
  };
}

const CACHED = { id: 'cached', title: 'Already saved' };
const SIBLING = { id: 'sibling', title: 'Arrived while lookup waits' };
const LOOKUP = { id: 'lookup', title: 'Lookup recovered' };

async function open() {
  const db = SqlClientImplBunSqlite.openMemory();
  const time = createHarnessClock();
  let attempts = 0;
  let siblingAttempts = 0;
  const lookup = defineQuery({
    name: 'lookup',
    params: z.object({}),
    sampleParams: {},
    run: async () => {
      attempts += 1;
      if (attempts === 1)
        throw new RetryableQueryError('lookup_busy', 1000, 'Please wait');
      return { notes: [note(LOOKUP.id, LOOKUP.title)] };
    },
  });
  const notes = defineQuery({
    name: 'notes',
    params: z.object({}),
    sampleParams: {},
    run: async () => {
      siblingAttempts += 1;
      return { notes: [note(SIBLING.id, SIBLING.title)] };
    },
  });
  const app = createSyncApp({
    getSql: () => db,
    queries: queryRegistry([lookup, notes]),
    mutations: {},
    resolveAuth: async () => ({
      actorId: 'alice',
      deviceId: 'phone',
      accountId: 'alice',
      isAnon: false,
    }),
    now: time.clock.now,
    createId: () => 'id',
    nextCheckpoint: () => '1',
  });
  const http = createSyncHttpClient({
    getBaseUrl: () => 'https://test',
    paths: { query: '/query', mutations: '/mutations' },
    auth: {
      getAccountId: () => 'alice',
      getDeviceId: () => 'phone',
      getSessionToken: () => 'token',
    },
    fetchFn: async (url, init) => app.request(new Request(url, init)),
    now: time.clock.now,
    timers: time.timers,
  });
  const engine = await createLocalSyncEngine({
    db,
    localSchema: exampleLocalSchema,
    mutationRegistry: {},
    getMutationEnv: () => ({
      actorId: 'alice',
      deviceId: 'phone',
      accountId: 'alice',
      isAnon: false,
      now: () => new Date(time.clock.now()),
      createId: () => 'id',
    }),
    getClientId: () => 'phone',
    sessionQueries: [{ name: 'notes', params: {} }],
    postQueries: http.postQueries,
    postMutations: async () => ({
      ok: true,
      serverTimeMs: 0,
      verdicts: [],
      ackSeq: 0,
    }),
    isAuthRevoked: () => false,
    deleteDatabase: async () => {},
    now: time.clock.now,
    timers: time.timers,
    createId: () => 'id',
    reconcileIntervalMs: 0,
    enableMutationUpload: false,
  });
  await db.run(sql`INSERT INTO notes (id, title, body, owner_id, folder_id, space_id, created_at, updated_at, deleted_at)
    VALUES (${CACHED.id}, ${CACHED.title}, ${''}, ${'alice'}, ${''}, ${''}, ${'2026-01-01T00:00:00.000Z'}, ${'2026-01-01T00:00:00.000Z'}, ${null})`);
  const notices: Array<QueryRetryNotice | null> = [];
  const sub = engine.subscribeQuery(
    'lookup',
    {},
    { onQueryNotice: (notice) => notices.push(notice) }
  );
  let answered = false;
  void sub.waitForFirstSync().then(() => {
    answered = true;
  });
  app.onError(() => Response.json({ error: 'unexpected' }, { status: 500 }));
  return {
    app,
    engine,
    sub,
    time,
    notices,
    answered: () => answered,
    attempts: () => attempts,
    siblingAttempts: () => siblingAttempts,
    rows: () =>
      db.query(
        sql<{
          id: string;
          title: string;
        }>`SELECT id, title FROM notes ORDER BY id`
      ),
    close: async () => {
      sub.unsubscribe();
      await engine.disconnect();
      await db.disconnect();
    },
  };
}

// regression: search-rate-limit-disconnects-sync
test('one temporarily refused query preserves the connection and other queries, then retries only its scope', async () => {
  const fixture = await open();
  try {
    expect(await fixture.rows()).toEqual([CACHED]);
    await fixture.engine.connect();
    await settle();
    expect(await fixture.rows()).toEqual([CACHED, SIBLING]);
    expect(fixture.engine.status.getSnapshot().lastError).toBeNull();
    expect(fixture.engine.status.getSnapshot().online).toBe(true);
    expect(fixture.answered()).toBe(false);
    expect(fixture.notices.at(-1)).toEqual({
      code: 'lookup_busy',
      retryAfterMs: 1000,
    });
    fixture.time.clock.advance(999);
    await settle();
    expect(fixture.attempts()).toBe(1);
    fixture.time.clock.advance(1);
    await settle();
    expect(fixture.attempts()).toBe(2);
    expect(fixture.answered()).toBe(true);
    expect(fixture.notices.at(-1)).toBeNull();
    expect(await fixture.rows()).toEqual([CACHED, LOOKUP, SIBLING]);
    expect(fixture.siblingAttempts()).toBe(1);
  } finally {
    await fixture.close();
  }
  expect(fixture.time.clock.pendingOneShotCount()).toBe(0);
});

test('disconnect cancels a scoped retry without losing cached rows, and reconnect completes the lookup', async () => {
  const fixture = await open();
  try {
    await fixture.engine.connect();
    await settle();
    expect(await fixture.rows()).toEqual([CACHED, SIBLING]);
    await fixture.engine.disconnect();
    fixture.time.clock.advance(1000);
    await settle();
    expect(fixture.attempts()).toBe(1);
    expect(fixture.time.clock.pendingOneShotCount()).toBe(0);
    expect(await fixture.rows()).toEqual([CACHED, SIBLING]);
    await fixture.engine.connect();
    await settle();
    expect(fixture.answered()).toBe(true);
    expect(await fixture.rows()).toEqual([CACHED, LOOKUP, SIBLING]);
  } finally {
    await fixture.close();
  }
});

test('clients without the scoped-error capability retain the existing failure envelope', async () => {
  const fixture = await open();
  try {
    const response = await fixture.app.request('https://test/query', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-sync-protocol': '3' },
      body: JSON.stringify({ queries: [{ name: 'lookup', params: {} }] }),
    });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'unexpected' });
  } finally {
    await fixture.close();
  }
});
