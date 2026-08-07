import { Database } from 'bun:sqlite';
import { describe, expect, mock, test } from 'bun:test';
import type { PubSub, Topic } from '@pkgs/pubsub/interface';
import { createInMemoryPubSub } from '@pkgs/pubsub/testing';
import { sql, unsafe } from '@pkgs/sql';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';
import { z } from 'zod';
import { createSyncApp } from '../../server/create-sync-app';
import { notifyChannels } from '../../server/notify-channels';
import { defineMutation } from '../core/define-mutation';
import { mutationRegistry } from '../core/registry';
import { MutationError } from '../core/types';

const DDL = `
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  body TEXT NOT NULL DEFAULT ''
);
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
CREATE TABLE _sync_topic_seq (
  topic TEXT PRIMARY KEY,
  n INTEGER NOT NULL
);
`;

async function openDb() {
  const raw = new Database(':memory:');
  const db = new SqlClientImplBunSqlite(raw);
  await db.connect();
  for (const stmt of DDL.split(';')
    .map((s) => s.trim())
    .filter(Boolean)) {
    await db.run(unsafe(stmt));
  }
  return db;
}

const setNote = defineMutation({
  name: 'setNotePush',
  args: z.object({ id: z.string(), body: z.string() }),
  declaredWrites: ['notes'],
  invalidates: (_args, env) => [`user:${env.actorId}`],
  async run({ tx }, { id, body }) {
    await tx.run(sql`
      INSERT INTO notes (id, body) VALUES (${id}, ${body})
      ON CONFLICT (id) DO UPDATE SET body = excluded.body
    `);
  },
});

const failNote = defineMutation({
  name: 'failNotePush',
  args: z.object({ id: z.string() }),
  declaredWrites: ['notes'],
  invalidates: (_args, env) => [`user:${env.actorId}`],
  async run() {
    throw new MutationError('NOPE', 'rejected');
  },
});

describe('replay push publish', () => {
  test('replay-publishes-invalidates', async () => {
    const db = await openDb();
    const published: Array<{ topic: Topic; data: unknown }> = [];
    const pubsub: PubSub = {
      ...createInMemoryPubSub(),
      publish: async (topic, data) => {
        published.push({ topic, data });
      },
    };
    const app = createSyncApp({
      resolveAuth: async () => ({
        actorId: 'actor1',
        deviceId: 'd1',
        accountId: null,
        isAnon: true,
      }),
      getSql: () => db,
      queries: {},
      mutations: mutationRegistry([setNote, failNote]),
      pubsub,
    });

    const res = await app.request('/mutations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mutations: [
          {
            id: 'm1',
            name: 'setNotePush',
            args: JSON.stringify({ id: 'n1', body: 'hi' }),
            clientId: 'c1',
            seq: 1,
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    });
    expect(res.status).toBe(200);
    await Promise.resolve();
    await Promise.resolve();
    expect(published.length).toBe(1);
    expect(published[0]?.topic).toBe('user:actor1');
    expect((published[0]?.data as { pushSeq?: string }).pushSeq).toBeDefined();
  });

  test('rejected-replay-publishes-nothing', async () => {
    const db = await openDb();
    const published: unknown[] = [];
    const pubsub: PubSub = {
      ...createInMemoryPubSub(),
      publish: async (topic, data) => {
        published.push({ topic, data });
      },
    };
    const app = createSyncApp({
      resolveAuth: async () => ({
        actorId: 'actor1',
        deviceId: 'd1',
        accountId: null,
        isAnon: true,
      }),
      getSql: () => db,
      queries: {},
      mutations: mutationRegistry([setNote, failNote]),
      pubsub,
    });

    const res = await app.request('/mutations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mutations: [
          {
            id: 'm2',
            name: 'failNotePush',
            args: JSON.stringify({ id: 'n1' }),
            clientId: 'c1',
            seq: 1,
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      verdicts: Array<{ status: string }>;
    };
    expect(body.verdicts[0]?.status).toBe('rejected');
    await Promise.resolve();
    await Promise.resolve();
    expect(published.length).toBe(0);
  });

  test('publish-failure-does-not-fail-upload', async () => {
    const db = await openDb();
    const warn = mock(() => undefined);
    const originalWarn = console.warn;
    console.warn = warn as typeof console.warn;
    try {
      const pubsub: PubSub = {
        ...createInMemoryPubSub(),
        publish: async () => {
          throw new Error('broker down');
        },
      };
      const app = createSyncApp({
        resolveAuth: async () => ({
          actorId: 'actor1',
          deviceId: 'd1',
          accountId: null,
          isAnon: true,
        }),
        getSql: () => db,
        queries: {},
        mutations: mutationRegistry([setNote]),
        pubsub,
      });

      const res = await app.request('/mutations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mutations: [
            {
              id: 'm3',
              name: 'setNotePush',
              args: JSON.stringify({ id: 'n1', body: 'x' }),
              clientId: 'c1',
              seq: 1,
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean };
      expect(body.ok).toBe(true);
      await Promise.resolve();
      await Promise.resolve();
      expect(warn).toHaveBeenCalled();
    } finally {
      console.warn = originalWarn;
    }
  });

  test('notifyChannels dedupes topics', async () => {
    const published: Topic[] = [];
    const pubsub: PubSub = {
      ...createInMemoryPubSub(),
      publish: async (topic) => {
        published.push(topic);
      },
    };
    notifyChannels({
      pubsub,
      topics: ['user:a', 'user:a', 'room:b'],
      pushSeq: '1',
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(published.sort()).toEqual(['room:b', 'user:a']);
  });
});
