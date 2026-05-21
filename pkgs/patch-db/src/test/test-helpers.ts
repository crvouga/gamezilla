import { createLogger } from '@pkgs/logger';
import { InMemoryPubSub } from '@pkgs/pub-sub/impl-in-memory';
import { SqlClientImplBunPostgres } from '@pkgs/sql-client/impl-bun-postgres';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/impl-bun-sqlite';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { PatchDbImplClientTransport } from '../impl-client-transport';
import { PatchDbImplPostgres } from '../impl-postgres/impl-postgres';
import { PatchDbImplSqlite } from '../impl-sqlite/impl-sqlite';
import {
  SyncPatchDb,
  type SyncPatchDbOptions,
  type SyncPatchDbScheduler,
} from '../impl-sync';
import { toAttributeState, type PatchDb, type PatchInput } from '../interface';
import { PatchDbTransportInProcess } from '../transport/impl-in-process';
import { PatchDbImplSyncHost } from '../transport/impl-sync-host';

export type DbFactory = () => Promise<{
  db: PatchDb;
  teardown: () => Promise<void>;
}>;

export async function createSqliteFactory(): Promise<{
  db: PatchDb;
  teardown: () => Promise<void>;
}> {
  const client: SqlClient = SqlClientImplBunSqlite.open(':memory:');
  await client.connect();
  const db = new PatchDbImplSqlite(client);
  await db.migrate();
  return { db, teardown: () => client.disconnect() };
}

export async function createPostgresFactory(): Promise<{
  db: PatchDb;
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
  // Set `DB_URL` to a reachable Postgres (e.g. PGlite socket / `bun run --filter @pkgs/pg dev`) to enable:
  // { name: 'PatchDbImplPostgres', factory: createPostgresFactory },
];

export type SyncDbFixture = {
  syncDb: SyncPatchDb;
  local: PatchDb;
  /** Authority backing DB (direct read/write for test setup). */
  remote: PatchDb;
  /** Same instance passed to {@link SyncPatchDb} as `remote` (HTTP-shaped facade). */
  syncRemote: PatchDbImplClientTransport;
  pubSub: InMemoryPubSub;
  teardown: () => Promise<void>;
};

export type CreateSyncDbFactoryOptions = {
  pushIntervalMs?: number;
  pushDriver?: 'interval' | 'manual';
  pollDriver?: 'interval' | 'manual';
  scheduler?: SyncPatchDbScheduler;
  maxPushBatchSize?: number;
};

function buildSyncOptions(
  options: CreateSyncDbFactoryOptions | undefined
): SyncPatchDbOptions {
  const opts = options ?? {};
  const syncOptions: SyncPatchDbOptions = {
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
  options?: CreateSyncDbFactoryOptions
): Promise<SyncDbFixture> {
  const localClient: SqlClient = SqlClientImplBunSqlite.open(':memory:');
  const remoteClient: SqlClient = SqlClientImplBunSqlite.open(':memory:');
  await localClient.connect();
  await remoteClient.connect();

  const local = new PatchDbImplSqlite(localClient);
  const remoteBacking = new PatchDbImplSqlite(remoteClient);
  await local.migrate();
  await remoteBacking.migrate();

  const remoteHostPubSub = new InMemoryPubSub();
  const remoteHost = new PatchDbImplSyncHost(remoteBacking, remoteHostPubSub);
  const remoteTransport = new PatchDbTransportInProcess(remoteHost);
  const syncRemote = new PatchDbImplClientTransport(remoteTransport);

  const pubSub = new InMemoryPubSub();
  const syncDb = new SyncPatchDb(
    local,
    syncRemote,
    pubSub,
    buildSyncOptions(options)
  );

  return {
    syncDb,
    local,
    remote: remoteBacking,
    syncRemote,
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
    attributes: toAttributeState({
      'item/name': 'Alpha Widget',
      'item/score': 10,
      'item/tag': 'a',
    }),
  },
  {
    entityId: 't2',
    entityType: 'item',
    attributes: toAttributeState({
      'item/name': 'Beta Gadget',
      'item/score': 20,
      'item/tag': 'b',
    }),
  },
  {
    entityId: 't3',
    entityType: 'item',
    attributes: toAttributeState({
      'item/name': 'Gamma Tool',
      'item/score': 30,
      'item/tag': 'a',
    }),
  },
  {
    entityId: 't4',
    entityType: 'item',
    attributes: toAttributeState({
      'item/name': 'Delta Device',
      'item/score': 40,
    }),
  },
];
