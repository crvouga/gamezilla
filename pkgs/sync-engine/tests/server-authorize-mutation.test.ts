import { describe, expect, test } from 'bun:test';
import { applySqliteSchema } from '@pkgs/db-schema-sqlite';
import { SqlClientImplSqliteMem } from '@pkgs/sql-client-sqlite/impl-sqlite-mem';
import {
  createSyncApp,
  syncEngineServerSchema,
} from '@pkgs/sync-engine/server';
import {
  defineMutation,
  type MutationAuthorize,
  type MutationEnv,
  MutationError,
  mutationRegistry,
  SYNC_PROTOCOL_HEADER,
  SYNC_PROTOCOL_VERSION,
} from '@pkgs/sync-engine/shared';
import { z } from 'zod';

const SERVER_NOW = Date.parse('2026-09-19T12:00:00.000Z');
const CLIENT_AT = '2026-09-19T08:00:00.000Z';

type Verdict = { readonly status: string; readonly code?: string };

async function openHost(authorize?: MutationAuthorize) {
  const db = SqlClientImplSqliteMem.open();
  await db.connect();
  await applySqliteSchema(db, syncEngineServerSchema, {
    ownership: 'declared-only',
  });
  const ran: Array<{ readonly args: unknown; readonly env: MutationEnv }> = [];
  const ping = defineMutation<{ readonly n: number }>({
    name: 'ping',
    args: z.object({ n: z.number() }),
    async run({ env }, args) {
      ran.push({ args, env });
    },
  });
  let seq = 0;
  let id = 0;
  const app = createSyncApp({
    resolveAuth: async () => ({
      actorId: 'actor',
      deviceId: 'device',
      accountId: null,
      isAnon: true,
    }),
    getSql: () => db,
    queries: {},
    mutations: mutationRegistry([ping]),
    now: () => SERVER_NOW,
    createId: () => `id-${++id}`,
    ...(authorize === undefined ? {} : { authorizeMutation: authorize }),
  });
  async function send(name: string, args: unknown): Promise<Verdict> {
    seq += 1;
    const res = await app.request('http://test/mutations', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [SYNC_PROTOCOL_HEADER]: String(SYNC_PROTOCOL_VERSION),
      },
      body: JSON.stringify({
        mutations: [
          {
            id: `m-${seq}`,
            name,
            args: JSON.stringify(args),
            clientId: 'client',
            seq,
            createdAt: CLIENT_AT,
            originTraceparent: null,
          },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { verdicts: Verdict[] };
    return body.verdicts[0] ?? { status: 'missing' };
  }
  return { send, ran };
}

describe('createSyncApp authorizeMutation', () => {
  test('without a hook every product mutation replays', async () => {
    const host = await openHost();
    expect((await host.send('ping', { n: 1 })).status).toBe('applied');
    expect(host.ran).toHaveLength(1);
  });

  test('a MutationError from the hook rejects before the body runs', async () => {
    const seen: string[] = [];
    const host = await openHost(async ({ name, args }) => {
      seen.push(`${name}:${JSON.stringify(args)}`);
      if ((args as { n: number }).n > 1) {
        throw new MutationError('not_granted', 'denied by policy');
      }
    });
    expect((await host.send('ping', { n: 1 })).status).toBe('applied');
    expect(await host.send('ping', { n: 2 })).toMatchObject({
      status: 'rejected',
      code: 'not_granted',
    });
    expect(seen).toEqual(['ping:{"n":1}', 'ping:{"n":2}']);
    expect(host.ran.map((r) => r.args)).toEqual([{ n: 1 }]);
  });

  test('the hook sees the client timestamp on env and the host clock as serverNow', async () => {
    const seen: Array<{ readonly client: string; readonly server: number }> =
      [];
    const host = await openHost(async ({ env, serverNow }) => {
      seen.push({
        client: env.now().toISOString(),
        server: serverNow().getTime(),
      });
    });
    await host.send('ping', { n: 1 });
    expect(seen).toEqual([{ client: CLIENT_AT, server: SERVER_NOW }]);
    // The body's env is unchanged by the hook: still pinned to the client.
    expect(host.ran[0]?.env.now().toISOString()).toBe(CLIENT_AT);
  });

  test('framework bookkeeping mutations skip the hook', async () => {
    const seen: string[] = [];
    const host = await openHost(async ({ name }) => {
      seen.push(name);
      throw new MutationError('not_granted', 'deny everything');
    });
    const verdict = await host.send('acknowledgeWriteRejection', {
      mutationId: 'missing',
    });
    expect(seen).toEqual([]);
    expect(verdict.code).not.toBe('not_granted');
  });
});
