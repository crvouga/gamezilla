import { InMemoryPubSub } from '@gamezilla/shared/pub-sub/impl-in-memory';
import type { Unsubscribe } from '@gamezilla/shared/pub-sub/interface';
import { SqlClientImplBunPostgres } from '@gamezilla/shared/sql-client/impl-bun-postgres';
import { SqlClientImplBunSqlite } from '@gamezilla/shared/sql-client/impl-bun-sqlite';
import type { SqlClient } from '@gamezilla/shared/sql-client/interface';
import { PatchDbImplPostgres } from '../impl-postgres/impl-postgres';
import { PatchDbImplSqlite } from '../impl-sqlite/impl-sqlite';
import {
  SyncPatchesDb,
  type RemoteInvalidationSource,
  type SyncPatchesDbOptions,
  type SyncPatchesDbPushScheduler,
} from '../impl-sync';
import type { PatchesDb, PatchInput } from '../interface';

/** Creates a RemoteInvalidationSource that tests can trigger manually via invalidate(). */
export function createManualRemoteInvalidationSource(): RemoteInvalidationSource & {
  invalidate: () => void;
} {
  const callbacks: (() => void)[] = [];
  return {
    subscribe(callback: () => void): Unsubscribe {
      callbacks.push(callback);
      return () => {
        const i = callbacks.indexOf(callback);
        if (i >= 0) callbacks.splice(i, 1);
      };
    },
    invalidate() {
      callbacks.forEach((c) => c());
    },
  };
}

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
  await client.run('PRAGMA foreign_keys = ON');
  const db = new PatchDbImplSqlite(client);
  await db.migrate();
  return { db, teardown: () => client.disconnect() };
}

export async function createPostgresFactory(): Promise<{
  db: PatchesDb;
  teardown: () => Promise<void>;
}> {
  const url = process.env['DATABASE_URL'];
  if (url === undefined || url === '') {
    throw new Error('createPostgresFactory: DATABASE_URL must be set');
  }
  const client: SqlClient = SqlClientImplBunPostgres.connect(url);
  await client.connect();
  const db = new PatchDbImplPostgres(client);
  await db.migrate();
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
  /** Call to trigger a poll (simulates remote invalidation). */
  invalidateRemote: () => void;
  teardown: () => Promise<void>;
};

export async function createSyncDbFactory(options?: {
  pushIntervalMs?: number;
  pushDriver?: 'interval' | 'manual';
  pollDriver?: 'remote-invalidation' | 'manual';
  pushScheduler?: SyncPatchesDbPushScheduler;
}): Promise<SyncDbFixture> {
  const localClient: SqlClient = SqlClientImplBunSqlite.open(':memory:');
  const remoteClient: SqlClient = SqlClientImplBunSqlite.open(':memory:');
  await localClient.connect();
  await remoteClient.connect();

  const local = new PatchDbImplSqlite(localClient);
  const remote = new PatchDbImplSqlite(remoteClient);
  await local.migrate();
  await remote.migrate();

  const pubSub = new InMemoryPubSub();
  const remoteInvalidationSource = createManualRemoteInvalidationSource();
  const syncOptions: SyncPatchesDbOptions = {
    pushIntervalMs: options?.pushIntervalMs ?? 10,
    pushDriver: options?.pushDriver ?? 'interval',
    pollDriver: options?.pollDriver ?? 'remote-invalidation',
    remoteInvalidationSource,
  };
  if (options?.pushScheduler !== undefined) {
    syncOptions.pushScheduler = options.pushScheduler;
  }
  const syncDb = new SyncPatchesDb(local, remote, pubSub, syncOptions);

  return {
    syncDb,
    local,
    remote,
    pubSub,
    invalidateRemote: () => remoteInvalidationSource.invalidate(),
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
