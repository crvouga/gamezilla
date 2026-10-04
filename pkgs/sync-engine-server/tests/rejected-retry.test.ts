import { expect, test } from 'bun:test';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared/reconcile-sqlite-schema';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-shared/impl-mockingbird-sqlite';
import { createSyncApp } from '@pkgs/sync-engine-server/create-sync-app';
import { syncEngineServerSchema } from '@pkgs/sync-engine-shared/tables';
import { defineMutation } from '@pkgs/sync-engine-shared/define-mutation';
import { MutationError } from '@pkgs/sync-engine-shared/mutations-types';
import { mutationRegistry } from '@pkgs/sync-engine-shared/mutations-registry';
import { SYNC_PROTOCOL_HEADER, SYNC_PROTOCOL_VERSION } from '@pkgs/sync-engine-shared/v2';
import { z } from 'zod';

// regression: sync-rejected-retry-verdict
// Literal input: a permanently denied mutation, followed by the identical upload
// after its first rejection response was lost.
test('an identical retry retains the permanent rejection verdict', async () => {
  const db = SqlClientImplMockingbirdSqlite.open();
  await db.connect();
  try {
    await reconcileSqliteSchema(db, syncEngineServerSchema, {
      ownership: 'declared-only',
    });
    let runs = 0;
    let ids = 0;
    const deny = defineMutation({
      name: 'deniedChange',
      args: z.object({ value: z.number() }),
      async run() {
        runs += 1;
        throw new MutationError('not_granted', 'This change is not allowed.');
      },
    });
    const app = createSyncApp({
      resolveAuth: async () => ({
        actorId: 'alice',
        deviceId: 'alice-phone',
        accountId: 'alice',
        isAnon: false,
      }),
      getSql: () => db,
      queries: {},
      mutations: mutationRegistry([deny]),
      now: () => 1_790_000_000_000,
      createId: () => `rejection-${++ids}`,
    });
    const input = {
      mutations: [
        {
          id: 'denied-offline-edit',
          name: 'deniedChange',
          args: '{"value":2}',
          clientId: 'alice-phone',
          seq: 1,
          createdAt: '2026-09-01T12:00:00.000Z',
          originTraceparent: null,
        },
      ],
    };
    const post = async () => {
      const response = await app.request('http://example.test/mutations', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [SYNC_PROTOCOL_HEADER]: String(SYNC_PROTOCOL_VERSION),
        },
        body: JSON.stringify(input),
      });
      expect(response.status).toBe(200);
      return response.json() as Promise<{ verdicts: unknown[] }>;
    };
    const first = await post();
    expect(first.verdicts[0]).toMatchObject({
      status: 'rejected',
      code: 'not_granted',
    });
    const repeated = await post();
    expect(repeated.verdicts).toEqual(first.verdicts);
    expect(runs).toBe(1);
  } finally {
    await db.disconnect();
  }
});
