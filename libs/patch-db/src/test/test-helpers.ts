import { createLogger } from '@gamezilla/lib/logger';
import { InMemoryPubSub } from '@gamezilla/lib/pub-sub/impl-in-memory';
import { SqlClientImplBunPostgres } from '@gamezilla/lib/sql-client/impl-bun-postgres';
import { SqlClientImplBunSqlite } from '@gamezilla/lib/sql-client/impl-bun-sqlite';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { PatchDbImplPostgres } from '../impl-postgres/impl-postgres';
import { PatchDbImplSqlite } from '../impl-sqlite/impl-sqlite';
import {
  SyncPatchesDb,
  type SyncPatchesDbOptions,
  type SyncPatchesDbScheduler,
} from '../impl-sync';
import type { PatchesDb, PatchInput } from '../interface';

export type DbFactory = () => Promise<{
  db: PatchesDb;
  teardown: () => Promise<void>;
}>;

export async function createSqliteFactory(): Promise<{
  db: PatchesDb;
  teardown: () => Promise<void>;
}> {
  const client: SqlClient = SqlClientImplBunSqlite.open(':memory:');
  await client.connect();
  const db = new PatchDbImplSqlite(client);
  await db.migrate();
  return { db, teardown: () => client.disconnect() };
}

export async function createPostgresFactory(): Promise<{
  db: PatchesDb;
  teardown: () => Promise<void>;
}> {
  const url = process.env['DB_URL'];
  if (url === undefined || url === '') {
    throw new Error('createPostgresFactory: set DB_URL for Postgres tests');
  }
  const client: SqlClient = SqlClientImplBunPostgres.connect(url);
  await client.connect();
  const logger = createLogger({ name: 'patch-db-test', level: 'silent' });
  await PatchDbImplPostgres.migrateUp({ sqlClient: client, logger });
  const db = new PatchDbImplPostgres(client);
  return { db, teardown: () => client.disconnect() };
}

export const implementations: { name: string; factory: DbFactory }[] = [
  { name: 'PatchDbImplSqlite', factory: createSqliteFactory },
  // { name: 'PatchDbImplPostgres', factory: createPostgresFactory },
];

export type SyncDbFixture = {
  syncDb: SyncPatchesDb;
  local: PatchesDb;
  remote: PatchesDb;
  pubSub: InMemoryPubSub;
  teardown: () => Promise<void>;
};

export type CreateSyncDbFactoryOptions = {
  pushIntervalMs?: number;
  pushDriver?: 'interval' | 'manual';
  pollDriver?: 'interval' | 'manual';
  scheduler?: SyncPatchesDbScheduler;
  maxPushBatchSize?: number;
};

function buildSyncOptions(
  options: CreateSyncDbFactoryOptions | undefined,
): SyncPatchesDbOptions {
  const opts = options ?? {};
  const syncOptions: SyncPatchesDbOptions = {
    pushIntervalMs: opts.pushIntervalMs ?? 10,
    pushDriver: opts.pushDriver ?? 'interval',
    pollDriver: opts.pollDriver ?? 'manual',
  };
  if (opts.scheduler !== undefined) {
    syncOptions.scheduler = opts.scheduler;
  }
  if (opts.maxPushBatchSize !== undefined) {
    syncOptions.maxPushBatchSize = opts.maxPushBatchSize;
  }
  return syncOptions;
}

export async function createSyncDbFactory(
  options?: CreateSyncDbFactoryOptions,
): Promise<SyncDbFixture> {
  const localClient: SqlClient = SqlClientImplBunSqlite.open(':memory:');
  const remoteClient: SqlClient = SqlClientImplBunSqlite.open(':memory:');
  await localClient.connect();
  await remoteClient.connect();

  const local = new PatchDbImplSqlite(localClient);
  const remote = new PatchDbImplSqlite(remoteClient);
  await local.migrate();
  await remote.migrate();

  const pubSub = new InMemoryPubSub();
  const syncDb = new SyncPatchesDb(
    local,
    remote,
    pubSub,
    buildSyncOptions(options),
  );

  return {
    syncDb,
    local,
    remote,
    pubSub,
    teardown: async () => {
      syncDb.destroy();
      await localClient.disconnect();
      await remoteClient.disconnect();
    },
  };
}

/** Fixture data for where-clause tests: t1 (score 10, tag a), t2 (20, b), t3 (30, a), t4 (40, no tag) */
export const whereClauseFixtures: PatchInput[] = [
  {
    entityId: 't1',
    entityType: 'item',
    attributes: {
      'item/name': 'Alpha Widget',
      'item/score': 10,
      'item/tag': 'a',
    },
  },
  {
    entityId: 't2',
    entityType: 'item',
    attributes: {
      'item/name': 'Beta Gadget',
      'item/score': 20,
      'item/tag': 'b',
    },
  },
  {
    entityId: 't3',
    entityType: 'item',
    attributes: {
      'item/name': 'Gamma Tool',
      'item/score': 30,
      'item/tag': 'a',
    },
  },
  {
    entityId: 't4',
    entityType: 'item',
    attributes: { 'item/name': 'Delta Device', 'item/score': 40 },
  },
];
