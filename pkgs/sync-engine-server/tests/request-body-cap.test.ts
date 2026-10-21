import { describe, expect, test } from 'bun:test';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared/impl-mockingbird-sqlite';
import { createSyncApp } from '@pkgs/sync-engine-server/create-sync-app';
import { mutationRegistry } from '@pkgs/sync-engine-shared/mutations-registry';
import { queryRegistry } from '@pkgs/sync-engine-shared/queries-registry';
import {
  MAX_MUTATIONS_BODY_BYTES,
  MAX_QUERY_BODY_BYTES,
  SYNC_PROTOCOL_HEADER,
  SYNC_PROTOCOL_VERSION,
} from '@pkgs/sync-engine-shared/v2';

async function syncApp() {
  const db = SqlClientImplMockingbirdSqlite.open();
  await db.connect();
  let authResolved = 0;
  const app = createSyncApp({
    resolveAuth: async () => {
      authResolved += 1;
      return {
        actorId: 'actor',
        deviceId: 'device',
        accountId: 'acct',
        isAnon: false,
      };
    },
    getSql: () => db,
    queries: queryRegistry([]),
    mutations: mutationRegistry([]),
    now: () => 1_700_000_000_000,
    createId: () => 'id-1',
    nextCheckpoint: () => '1',
  });
  return { app, authResolved: () => authResolved };
}

function post(
  app: Awaited<ReturnType<typeof syncApp>>['app'],
  path: string,
  body: string
) {
  return app.request(`http://test${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [SYNC_PROTOCOL_HEADER]: String(SYNC_PROTOCOL_VERSION),
    },
    body,
  });
}

/** A body of exactly `bytes` bytes carrying an empty batch. */
function padded(key: string, bytes: number): string {
  const frame = JSON.stringify({ [key]: [], pad: '' });
  return JSON.stringify({ [key]: [], pad: 'x'.repeat(bytes - frame.length) });
}

describe('sync request bodies', () => {
  // regression: mutation-body-unbounded
  test('a mutation upload over its byte cap is refused before it is read or authorized', async () => {
    const { app, authResolved } = await syncApp();
    const res = await post(
      app,
      '/mutations',
      padded('mutations', MAX_MUTATIONS_BODY_BYTES + 1)
    );
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({
      error: 'payload_too_large',
      maxBytes: MAX_MUTATIONS_BODY_BYTES,
    });
    expect(authResolved()).toBe(0);
  });

  test('a mutation upload at its byte cap is read', async () => {
    const { app } = await syncApp();
    const res = await post(
      app,
      '/mutations',
      padded('mutations', MAX_MUTATIONS_BODY_BYTES)
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, verdicts: [] });
  });

  // regression: query-body-unbounded
  test('a query batch over its byte cap is refused before it is read or authorized', async () => {
    const { app, authResolved } = await syncApp();
    const res = await post(
      app,
      '/query',
      padded('queries', MAX_QUERY_BODY_BYTES + 1)
    );
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({
      error: 'payload_too_large',
      maxBytes: MAX_QUERY_BODY_BYTES,
    });
    expect(authResolved()).toBe(0);
  });

  test('a query batch at its byte cap is read', async () => {
    const { app } = await syncApp();
    const res = await post(
      app,
      '/query',
      padded('queries', MAX_QUERY_BODY_BYTES)
    );
    expect(res.status).toBe(400);
  });
});
