import { describe, expect, test } from 'bun:test';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared/reconcile-sqlite-schema';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared/impl-mockingbird-sqlite';
import { createSyncApp } from '@pkgs/sync-engine-server/create-sync-app';
import { defineMutation } from '@pkgs/sync-engine-shared/define-mutation';
import { mutationRegistry } from '@pkgs/sync-engine-shared/mutations-registry';
import type {
  Mutation,
  MutationAuthorize,
  MutationEnv,
} from '@pkgs/sync-engine-shared/mutations-types';
import { MutationError } from '@pkgs/sync-engine-shared/mutations-types';
import { syncEngineServerSchema } from '@pkgs/sync-engine-shared/tables';
import {
  SYNC_PROTOCOL_HEADER,
  SYNC_PROTOCOL_VERSION,
} from '@pkgs/sync-engine-shared/v2';
import { z } from 'zod';

const SERVER_NOW = Date.parse('2026-09-19T12:00:00.000Z');
const CLIENT_AT = '2026-09-19T08:00:00.000Z';

type Verdict = { readonly status: string; readonly code?: string };

async function openHost(
  authorize?: MutationAuthorize,
  contentRulesTime?: Mutation<unknown>['contentRulesTime']
) {
  const db = SqlClientImplMockingbirdSqlite.open();
  await db.connect();
  await reconcileSqliteSchema(db, syncEngineServerSchema, {
    ownership: 'declared-only',
  });
  const ran: Array<{ readonly args: unknown; readonly env: MutationEnv }> = [];
  const ping = defineMutation<{ readonly n: number }>({
    name: 'ping',
    args: z.object({ n: z.number() }),
    ...(contentRulesTime === undefined ? {} : { contentRulesTime }),
    async run({ env }, args) {
      if (
        env.contentRules?.checkWrite('note', 'changed rule').allowed === false
      )
        throw new MutationError(
          'not_allowed',
          'This note is no longer allowed.'
        );
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
    contentRulesAt: (atMs) => ({
      checkWrite: () => ({ allowed: atMs < SERVER_NOW }),
    }),
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
  test('a queued choice can require the rules at replay while keeping its original timestamp', async () => {
    const host = await openHost(undefined, 'replayed');
    expect(await host.send('ping', { n: 1 })).toMatchObject({
      status: 'rejected',
      code: 'not_allowed',
    });
    expect(host.ran).toEqual([]);
  });

  test('writes judged at their creation retain the rules that accepted them', async () => {
    const host = await openHost(undefined, 'created');
    expect((await host.send('ping', { n: 1 })).status).toBe('applied');
    expect(host.ran[0]?.env.now().toISOString()).toBe(CLIENT_AT);
  });

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
    // regression: sync-server-clock-missing-from-body
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
    expect(host.ran[0]?.env.serverNow?.().getTime()).toBe(SERVER_NOW);
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
