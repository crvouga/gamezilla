import { expect, test } from 'bun:test';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared-ts/impl-mockingbird-sqlite';
import sql, { raw } from '@pkgs/sql-root-shared-ts/sql';
import {
  type MergeApplierDeps,
  withMergeSingleFlight,
} from '@pkgs/sync-engine-client-ts/merge';
import {
  applySweepResponses,
  type SubscriptionSweepContext,
  type SweepEntry,
} from '@pkgs/sync-engine-client-ts/subscription-runtime-sweep';
import { createTableChangeBus } from '@pkgs/sync-engine-client-ts/table-change-bus';
import { syncEngineLocalSchema } from '@pkgs/sync-engine-shared-ts/tables';

// regression: sync-ack-fence-lost-while-merge-queued
test.each(['merge', 'database'] as const)(
  'an acknowledgement invalidates a response waiting for the %s queue',
  async (gate) => {
    const db = SqlClientImplMockingbirdSqlite.open({ seed: 1 });
    const release = Promise.withResolvers<void>();
    const held = Promise.withResolvers<void>();
    const queued = Promise.withResolvers<void>();
    let blocker: Promise<void> | undefined;
    let response: Promise<void> | undefined;
    try {
      await reconcileSqliteSchema(db, syncEngineLocalSchema);
      await db.run(
        raw(
          'CREATE TABLE example_position (id TEXT PRIMARY KEY, n INTEGER NOT NULL, created_at TEXT, updated_at TEXT, deleted_at TEXT)'
        )
      );
      await db.run(
        sql`INSERT INTO example_position (id, n) VALUES (${'position'}, ${31})`
      );
      const deps: MergeApplierDeps = {
        db,
        registry: {},
        bus: createTableChangeBus(),
        clientId: 'device',
        env: {
          actorId: 'alice',
          deviceId: 'device',
          accountId: null,
          isAnon: true,
          now: () => new Date(0),
          createId: () => 'fixture-id',
        },
      };
      let confirmed = 0;
      const ctx: SubscriptionSweepContext = {
        db,
        postQueries: async () => {
          throw new Error('No second request belongs to this example');
        },
        getMergeDeps: () => {
          queued.resolve();
          return deps;
        },
        onError: (error) => {
          throw error;
        },
        onSynced: () => {
          confirmed += 1;
        },
        ensureBusWatch: () => {},
        cleanScopes: new Set(),
        isRunning: () => true,
      };
      const entry: SweepEntry = {
        spec: { name: 'example', params: {} },
        scope: 'example',
        firstSync: Promise.resolve(),
        resolveFirst: () => {},
        firstDone: false,
        refs: 1,
        generation: 0,
        stopped: false,
      };
      const hold = async () => {
        held.resolve();
        await release.promise;
      };
      blocker =
        gate === 'merge'
          ? withMergeSingleFlight(db, hold)
          : db.transaction(hold);
      await held.promise;
      response = applySweepResponses({
        ctx,
        active: [entry],
        gens: new Map([[entry.scope, 0]]),
        responses: [
          {
            status: 'ok',
            checkpoint: '1',
            hash: 'earlier',
            tables: {
              example_position: [
                {
                  id: 'position',
                  n: 4,
                  created_at: '1970-01-01T00:00:00.000Z',
                  updated_at: '1970-01-01T00:00:00.000Z',
                  deleted_at: null,
                },
              ],
            },
          },
        ],
      });
      await queued.promise;
      entry.generation += 1;
      release.resolve();
      await Promise.all([blocker, response]);
      expect(
        await db.query(
          sql<{
            n: number;
          }>`SELECT n FROM example_position WHERE id = ${'position'}`
        )
      ).toEqual([{ n: 31 }]);
      expect(confirmed).toBe(0);
      expect(entry.firstDone).toBe(false);
      expect(ctx.cleanScopes.size).toBe(0);
    } finally {
      release.resolve();
      await Promise.allSettled([blocker, response]);
      await db.disconnect();
    }
  }
);
