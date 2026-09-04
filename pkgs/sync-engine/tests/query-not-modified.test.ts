import { describe, expect, test } from 'bun:test';
import { SqlClientImplSqliteMem } from '@pkgs/sql-client-sqlite/impl-sqlite-mem';
import { createSyncApp } from '@pkgs/sync-engine/server';
import {
  defineQuery,
  mutationRegistry,
  type QueryResponse,
  queryRegistry,
  SYNC_PROTOCOL_HEADER,
  SYNC_PROTOCOL_VERSION,
} from '@pkgs/sync-engine/shared';
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
    const db = SqlClientImplSqliteMem.open();
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
      queries: queryRegistry([snapshotQuery]),
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
});
