import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared-ts/impl-mockingbird-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { createLocalSyncEngine } from '@pkgs/sync-engine-client-ts/create-local-sync-engine';
import {
  type LocalMigratePhase,
  migrateLocalSchema,
} from '@pkgs/sync-engine-client-ts/local-schema-migrate';
import { exampleLocalSchema } from '@pkgs/sync-engine-harness-ts/local-schema';
import { setNote } from '@pkgs/sync-engine-harness-ts/mutations';
import fc from 'fast-check';

const kinds = [
  { name: 'SQLite', open: () => SqlClientImplBunSqlite.openMemory() },
  { name: 'simulation', open: () => SqlClientImplMockingbirdSqlite.open() },
];

function openOffline(
  db: SqlClient,
  onPhase?: (phase: LocalMigratePhase) => void
) {
  const time = createHarnessClock({
    startMs: Date.parse('2026-11-01T09:00:01Z'),
  });
  const createId = () => 'id';
  return createLocalSyncEngine({
    db,
    schemaEpoch: 13,
    localSchema: exampleLocalSchema,
    mutationRegistry: { setNote },
    getMutationEnv: () => ({
      actorId: 'alice',
      deviceId: 'device',
      accountId: 'alice',
      isAnon: false,
      now: () => new Date(time.clock.now()),
      createId,
    }),
    getClientId: () => 'device',
    sessionQueries: [],
    postQueries: async () => {
      throw new Error('offline');
    },
    postMutations: async () => {
      throw new Error('offline');
    },
    isAuthRevoked: () => false,
    deleteDatabase: async () => undefined,
    now: time.clock.now,
    timers: time.timers,
    createId,
    ...(onPhase === undefined ? {} : { onLocalMigratePhase: onPhase }),
  });
}

// Persisted queue DDL from before the replay marker existed.
async function useLegacyQueue(db: SqlClient): Promise<void> {
  await db.run(sql`DROP TABLE sync_engine_mutations`);
  await db.run(sql`CREATE TABLE sync_engine_mutations (
    id TEXT PRIMARY KEY, created_at TEXT, updated_at TEXT, deleted_at TEXT,
    name TEXT, args TEXT, client_id TEXT, seq INTEGER,
    origin_traceparent TEXT, origin_session_id TEXT, origin_build_sha TEXT
  ) STRICT`);
}

for (const adapter of kinds) {
  // regression: sync-offline-replay-interrupted-boot
  test.each(['epoch bump', 'missing table'] as const)(
    `${adapter.name} restores an unsent note offline after a crash during %s`,
    async (repair) => {
      const db = adapter.open();
      await db.connect();
      try {
        await migrateLocalSchema(db, exampleLocalSchema, {
          schemaEpoch: repair === 'epoch bump' ? 12 : 13,
        });
        await useLegacyQueue(db);
        await db.run(sql`INSERT INTO sync_engine_mutations (id, name, args, client_id, seq, created_at)
          VALUES ('m1', 'setNote', '{"id":"n1","body":"milk"}', 'device', 1, '2026-11-01T08:59:59Z')`);
        await db.run(sql`INSERT INTO notes (id, body) VALUES ('n1', 'milk')`);
        if (repair === 'missing table') await db.run(sql`DROP TABLE notes`);
        await expect(
          openOffline(db, (phase) => {
            if (phase === 'done') throw new Error('power lost');
          })
        ).rejects.toThrow('power lost');
        const engine = await openOffline(db);
        try {
          expect(
            await db.query(
              sql<{
                body: string;
                created_at: string;
              }>`SELECT body, created_at FROM notes WHERE id = 'n1'`
            )
          ).toEqual([{ body: 'milk', created_at: '2026-11-01T08:59:59.000Z' }]);
          expect(
            await db.query(
              sql<{
                id: string;
              }>`SELECT id FROM sync_engine_mutations WHERE deleted_at IS NULL`
            )
          ).toEqual([{ id: 'm1' }]);
        } finally {
          await engine.disconnect();
        }
      } finally {
        await db.disconnect();
      }
    }
  );

  // regression: sync-epoch-downgrade-wipes-cache
  test(`${adapter.name} keeps cached notes across an epoch 13 → 12 → 13 round trip`, async () => {
    const db = adapter.open();
    await db.connect();
    try {
      await migrateLocalSchema(db, exampleLocalSchema, { schemaEpoch: 13 });
      await db.run(
        sql`INSERT INTO notes (id, body) VALUES ('cached', 'train times')`
      );
      await migrateLocalSchema(db, exampleLocalSchema, { schemaEpoch: 12 });
      await migrateLocalSchema(db, exampleLocalSchema, { schemaEpoch: 13 });
      expect(
        await db.query(
          sql<{ body: string }>`SELECT body FROM notes WHERE id = 'cached'`
        )
      ).toEqual([{ body: 'train times' }]);
    } finally {
      await db.disconnect();
    }
  });
}

test('opening supported older epochs cannot erase a newer offline cache', async () => {
  await assertProperty(
    'repeated app rollbacks preserve cached notes',
    fc.asyncProperty(
      fc.array(fc.integer({ min: 1, max: 13 }), { minLength: 1, maxLength: 6 }),
      async (epochs) => {
        const db = SqlClientImplBunSqlite.openMemory();
        try {
          await migrateLocalSchema(db, exampleLocalSchema, { schemaEpoch: 13 });
          await db.run(
            sql`INSERT INTO notes (id, body) VALUES ('cached', 'train times')`
          );
          for (const schemaEpoch of [...epochs, 13]) {
            await migrateLocalSchema(db, exampleLocalSchema, { schemaEpoch });
            expect(
              await db.query(
                sql<{
                  body: string;
                }>`SELECT body FROM notes WHERE id = 'cached'`
              )
            ).toEqual([{ body: 'train times' }]);
          }
        } finally {
          await db.disconnect();
        }
      }
    )
  );
});

// regression: sync-cache-wipe-restores-staged-rows
test('an epoch wipe discards an interrupted rebuild of a cache table', async () => {
  const db = SqlClientImplBunSqlite.openMemory();
  try {
    await migrateLocalSchema(db, exampleLocalSchema, { schemaEpoch: 12 });
    await db.run(
      sql`INSERT INTO notes (id, body) VALUES ('stale', 'cached before reset')`
    );
    await db.run(sql`ALTER TABLE notes RENAME TO _old_notes`);
    await migrateLocalSchema(db, exampleLocalSchema, { schemaEpoch: 13 });
    expect(await db.query(sql<{ id: string }>`SELECT id FROM notes`)).toEqual(
      []
    );
  } finally {
    await db.disconnect();
  }
});
