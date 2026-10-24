import { reconcilePostgresSchema } from '@pkgs/db-schema-postgres-shared-ts/reconcile-postgres-schema';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import { SqlClientImplMockingbirdPostgres } from '@pkgs/sql-client-postgres-server-ts/impl-mockingbird-postgres';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { pendingNote } from '@pkgs/sync-engine-harness-ts/mutations';
import { exampleAppSchema } from '@pkgs/sync-engine-harness-ts/schema';
import { createSyncApp } from '@pkgs/sync-engine-server-ts/create-sync-app';
import type { MutationRow } from '@pkgs/sync-engine-server-ts/replay-mutation';
import { mutationRegistry } from '@pkgs/sync-engine-shared-ts/mutations-registry';
import { syncEngineServerSchema } from '@pkgs/sync-engine-shared-ts/tables';
import {
  SYNC_PROTOCOL_HEADER,
  SYNC_PROTOCOL_VERSION,
} from '@pkgs/sync-engine-shared-ts/v2';
import { observeFinalSavepointSql } from './final-savepoint-sql';

export const NOW = 1700000000000;
export const AUTH = {
  actorId: 'alice',
  deviceId: 'phone',
  accountId: 'alice',
  isAnon: false,
};

export function noteRow(body: string, seq: number): MutationRow {
  return {
    id: `change-${seq}`,
    name: pendingNote.name,
    args: JSON.stringify({ id: `note-${seq}`, body }),
    clientId: 'phone',
    seq,
    createdAt: new Date(NOW).toISOString(),
    originTraceparent: null,
  };
}

export async function openFinalSavepoint(
  driver: 'sqlite' | 'postgres' = 'sqlite'
) {
  const raw =
    driver === 'sqlite'
      ? SqlClientImplBunSqlite.open(':memory:')
      : SqlClientImplMockingbirdPostgres.open({ seed: 1 });
  await raw.connect();
  for (const schema of [syncEngineServerSchema, exampleAppSchema]) {
    if (raw instanceof SqlClientImplMockingbirdPostgres)
      await reconcilePostgresSchema(raw, schema, raw.dbScope);
    else
      await reconcileSqliteSchema(raw, schema, { ownership: 'declared-only' });
  }
  const observed = observeFinalSavepointSql(raw);
  let id = 0;
  const publications: unknown[] = [];
  const app = createSyncApp({
    resolveAuth: async () => AUTH,
    getSql: () => observed.db,
    queries: {},
    mutations: mutationRegistry([pendingNote]),
    now: () => NOW,
    createId: () => `id-${++id}`,
    pubsub: {
      publish: async (_topic: string, payload: unknown) => {
        publications.push(payload);
      },
    } as never,
    topicMap: { notes: { topics: () => ['user:alice'] } },
  });
  app.onError(() => new Response('Transaction failed', { status: 503 }));
  return {
    ...observed,
    publications,
    send: (mutations: readonly MutationRow[]) =>
      app.request('http://test/mutations', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [SYNC_PROTOCOL_HEADER]: String(SYNC_PROTOCOL_VERSION),
        },
        body: JSON.stringify({ mutations }),
      }),
    notes: () =>
      raw.query(
        sql<{
          id: string;
          body: string;
        }>`SELECT id, body FROM notes ORDER BY id`
      ),
    markers: () =>
      raw.query(
        sql<{
          mutation_id: string;
          status: string;
        }>`SELECT mutation_id, status FROM sync_engine_mutations_applied ORDER BY mutation_id`
      ),
    rejections: () =>
      raw.query(
        sql<{
          mutation_id: string;
          code: string;
        }>`SELECT mutation_id, code FROM sync_engine_write_rejections ORDER BY mutation_id`
      ),
    observations: () =>
      raw.query(
        sql<{
          mutation_id: string;
        }>`SELECT mutation_id FROM sync_engine_observability_events ORDER BY mutation_id`
      ),
  };
}
