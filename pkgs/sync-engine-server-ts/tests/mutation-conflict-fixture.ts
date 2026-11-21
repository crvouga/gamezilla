import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared-ts/impl-mockingbird-sqlite';
import { createSyncApp } from '@pkgs/sync-engine-server-ts/create-sync-app';
import { defineMutation } from '@pkgs/sync-engine-shared-ts/define-mutation';
import { mutationRegistry } from '@pkgs/sync-engine-shared-ts/mutations-registry';
import { syncEngineServerSchema } from '@pkgs/sync-engine-shared-ts/tables';
import {
  SYNC_PROTOCOL_HEADER,
  SYNC_PROTOCOL_VERSION,
} from '@pkgs/sync-engine-shared-ts/v2';
import { z } from 'zod';

const AT = '2026-11-15T16:33:00.605Z';
const UPLOAD = {
  mutations: [
    {
      id: 'save-1',
      name: 'save',
      args: '{}',
      clientId: 'phone',
      seq: 1,
      createdAt: AT,
      originTraceparent: null,
    },
  ],
};

export async function conflictHost(
  failures: readonly unknown[],
  afterCommit?: () => Promise<void>
) {
  const db = SqlClientImplMockingbirdSqlite.open();
  await db.connect();
  await reconcileSqliteSchema(db, syncEngineServerSchema, {
    ownership: 'declared-only',
  });
  let attempts = 0;
  let committed = 0;
  let ids = 0;
  const wrapper: SqlClient = {
    connect: () => db.connect(),
    disconnect: () => db.disconnect(),
    query: (q) => db.query(q),
    run: (q) => db.run(q),
    prepare: (q) => db.prepare(q),
    transaction: (fn) =>
      db.transaction(async (tx) => {
        const attempt = attempts++;
        const value = await fn(tx);
        // Model a SERIALIZABLE conflict discovered at commit: the entire
        // attempt, including its idempotency marker, is rolled back.
        if (attempt < failures.length) throw failures[attempt];
        return value;
      }),
  };
  const app = createSyncApp({
    resolveAuth: async () => ({
      actorId: 'alice',
      deviceId: 'phone',
      accountId: 'alice',
      isAnon: false,
    }),
    getSql: () => wrapper,
    queries: {},
    mutations: mutationRegistry([
      defineMutation({ name: 'save', args: z.object({}), async run() {} }),
    ]),
    now: () => Date.parse(AT),
    createId: () => `id-${++ids}`,
    onCommittedMutations: async () => {
      committed++;
      await afterCommit?.();
    },
  });
  return {
    db,
    attempts: () => attempts,
    committed: () => committed,
    post: () =>
      app.request('http://example.test/mutations', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [SYNC_PROTOCOL_HEADER]: String(SYNC_PROTOCOL_VERSION),
        },
        body: JSON.stringify(UPLOAD),
      }),
  };
}
