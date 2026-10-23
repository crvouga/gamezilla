import { expect, test } from 'bun:test';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared-ts/impl-mockingbird-sqlite';
import sql, { unsafe } from '@pkgs/sql-root-shared-ts/sql';
import { createSyncApp } from '@pkgs/sync-engine-server-ts/create-sync-app';
import type { QueryTruncation } from '@pkgs/sync-engine-server-ts/run-query';
import { defineQuery } from '@pkgs/sync-engine-shared-ts/define-query';
import { mutationRegistry } from '@pkgs/sync-engine-shared-ts/mutations-registry';
import { queryRegistry } from '@pkgs/sync-engine-shared-ts/queries-registry';
import type { QueryResponse } from '@pkgs/sync-engine-shared-ts/v2';
import {
  SYNC_PROTOCOL_HEADER,
  SYNC_PROTOCOL_VERSION,
} from '@pkgs/sync-engine-shared-ts/v2';
import { z } from 'zod';

const notes = defineQuery({
  name: 'truncationNotes',
  limit: 2,
  params: z.object({}),
  async run(ctx) {
    return {
      notes: await ctx.db.query(sql`SELECT * FROM notes ORDER BY id`),
    };
  },
});

async function snapshotOf(rows: number) {
  const db = SqlClientImplMockingbirdSqlite.open();
  await db.connect();
  await db.run(
    unsafe('CREATE TABLE notes (id TEXT PRIMARY KEY, deleted_at TEXT)')
  );
  for (let i = 1; i <= rows; i += 1)
    await db.run(
      sql`INSERT INTO notes (id, deleted_at) VALUES (${`n${i}`}, ${null})`
    );
  const clips: QueryTruncation[] = [];
  const app = createSyncApp({
    resolveAuth: async () => ({
      actorId: 'actor',
      deviceId: 'device',
      accountId: 'acct',
      isAnon: false,
    }),
    getSql: () => db,
    queries: queryRegistry([notes]),
    mutations: mutationRegistry([]),
    now: () => 1_700_000_000_000,
    createId: () => 'id-1',
    nextCheckpoint: () => '1',
    onQueryTruncated: (clip) => clips.push(clip),
  });
  const res = await app.request('http://test/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [SYNC_PROTOCOL_HEADER]: String(SYNC_PROTOCOL_VERSION),
    },
    body: JSON.stringify({
      queries: [{ name: 'truncationNotes', params: {} }],
    }),
  });
  const body = (await res.json()) as { responses: QueryResponse[] };
  const [response] = body.responses;
  if (response?.status !== 'ok') throw new Error('expected ok');
  return { ids: response.tables['notes']?.map((row) => row['id']), clips };
}

// regression: query-truncation-silent
test('a snapshot clipped to its limit is reported without its rows', async () => {
  expect(await snapshotOf(3)).toEqual({
    ids: ['n1', 'n2'],
    clips: [{ queryName: 'truncationNotes', limit: 2 }],
  });
});

test('a snapshot that exactly fills its limit is not reported', async () => {
  expect(await snapshotOf(2)).toEqual({ ids: ['n1', 'n2'], clips: [] });
});
