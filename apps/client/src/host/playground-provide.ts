/**
 * Browser playground provide map for `@pkgs/system` createWorld.
 *
 * Live SQL is **in-memory AlaSQL** (no OPFS / SharedWorker). Expo-sqlite web
 * workers race under Strict Mode remounts and hang playground boot; snapshots
 * via ObjectStore remain the only durable playground state.
 */

import type { OpenRequestDb } from '@apps/api/db/open-request-db';
import { attachSimOpenRequestDb } from '@apps/api/system/sim-open-request-db';
import { createInMemoryStripe } from '@libs/stripe/in-memory-stripe';
import type { Timers } from '@pkgs/clock';
import { KvImplInMemory } from '@pkgs/kv/impl-in-memory';
import type { Kv } from '@pkgs/kv/interface';
import { InMemoryLlmProvider } from '@pkgs/llm/server';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import type { ObjectStore } from '@pkgs/object-store/interface';
import { createNoopObservability } from '@pkgs/observability/impl-noop/impl-noop';
import type { PubSub } from '@pkgs/pubsub/interface';
import {
  createInMemoryPubSub,
  type InMemoryBus,
} from '@pkgs/pubsub/testing/in-memory';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplAlaSql } from '@pkgs/sql-client/sqlite/impl-alasql';
import { decoratePort, type ProviderSpec, stubPort } from '@pkgs/system';
import { InMemoryTtsProvider } from '@pkgs/tts/server';

export type PlaygroundSqlHandle = {
  readonly sqlClient: SqlClient;
  readonly databaseName: string;
  disconnect(): Promise<void>;
  reset(): Promise<void>;
  exportBytes(): Promise<Uint8Array>;
  importBytes(bytes: Uint8Array): Promise<void>;
};

let playgroundSqlSeq = 0;

function uniqueAlaSqlName(base: string): string {
  playgroundSqlSeq += 1;
  // AlaSQL identifiers: keep alphanumeric + underscore.
  const safe = base.replace(/[^a-zA-Z0-9_]/g, '_');
  return `${safe}_${playgroundSqlSeq}`;
}

function openAlaSqlHandle(logicalName: string): PlaygroundSqlHandle {
  let databaseName = uniqueAlaSqlName(logicalName);
  let live = SqlClientImplAlaSql.open(databaseName);
  const handle: PlaygroundSqlHandle = {
    get sqlClient() {
      return live;
    },
    get databaseName() {
      return databaseName;
    },
    disconnect: () => live.disconnect(),
    reset: async () => {
      await live.disconnect();
      databaseName = uniqueAlaSqlName(logicalName);
      live = SqlClientImplAlaSql.open(databaseName);
      await live.connect();
    },
    exportBytes: async () => live.exportDatabaseBytes(),
    importBytes: async (bytes) => {
      live.importDatabaseBytes(bytes);
    },
  };
  return handle;
}

export async function openPlaygroundSql(
  databaseName: string,
  _timers: Timers
): Promise<PlaygroundSqlHandle> {
  const handle = openAlaSqlHandle(databaseName);
  await handle.sqlClient.connect();
  return handle;
}

/**
 * Open a fresh ephemeral DB. AlaSQL names are unique per call — no OPFS reset.
 */
export async function openFreshPlaygroundSql(
  databaseName: string,
  timers: Timers
): Promise<PlaygroundSqlHandle> {
  return openPlaygroundSql(databaseName, timers);
}

/** Ignore request-middleware disconnect on shared process-lifetime DBs. */
export function sharedRequestSqlClient(sqlClient: SqlClient): SqlClient {
  return {
    connect: async () => undefined,
    disconnect: async () => undefined,
    query: (query) => sqlClient.query(query),
    run: (query) => sqlClient.run(query),
    prepare: (query) => sqlClient.prepare(query),
    transaction: <T>(fn: (tx: SqlClient) => Promise<T>) =>
      sqlClient.transaction(fn),
  };
}

export function sessionOwnedSqlClient(sqlClient: SqlClient): SqlClient {
  return sharedRequestSqlClient(sqlClient);
}

/**
 * Always forward to the handle's current AlaSQL client. Snapshot reload
 * {@link PlaygroundSqlHandle.reset}s in place — SyncEngines that captured a
 * raw AlaSQL instance see "database is closed"; handle-bound clients do not.
 */
export function handleBoundSqlClient(handle: PlaygroundSqlHandle): SqlClient {
  return {
    connect: async () => undefined,
    disconnect: async () => undefined,
    query: (query) => handle.sqlClient.query(query),
    run: (query) => handle.sqlClient.run(query),
    prepare: (query) => handle.sqlClient.prepare(query),
    transaction: <T>(fn: (tx: SqlClient) => Promise<T>) =>
      handle.sqlClient.transaction(fn),
  };
}

export function clientDbName(instanceId: string): string {
  return `playground_client_${instanceId}`;
}

/**
 * Epoch bumps on each snapshot load so a dying client's AuthBridge cannot
 * overwrite restored tokens in the shared localStorage namespace.
 */
let playgroundDurableEpoch = 0;

export function bumpPlaygroundDurableEpoch(): number {
  playgroundDurableEpoch += 1;
  return playgroundDurableEpoch;
}

export function clientNamespace(instanceId: string): string {
  return `playground_client_${instanceId}_e${playgroundDurableEpoch}`;
}

/** Parse `client:alice.db` / `client:alice.kv` → `alice`. */
export function clientInstanceIdFromLeafAddress(address: string): string {
  const match = /^client:([^.]+)\./.exec(address);
  if (match?.[1] !== undefined) return match[1];
  const colon = address.indexOf(':');
  if (colon >= 0) {
    const rest = address.slice(colon + 1);
    const dot = rest.indexOf('.');
    return dot >= 0 ? rest.slice(0, dot) : rest;
  }
  return address;
}

function kvProvider(): ProviderSpec<Kv> {
  return decoratePort<Kv>(() => new KvImplInMemory(), {
    wipe(instance) {
      if (instance instanceof KvImplInMemory) instance.clearForTest();
    },
    corrupt(instance) {
      if (instance instanceof KvImplInMemory) {
        instance.armFault(new Error('kv corrupted'));
      }
    },
  });
}

function blobProvider(): ProviderSpec<ObjectStore> {
  return decoratePort<ObjectStore>(() => new ObjectStoreImplInMemory(), {
    corrupt(instance) {
      if (instance instanceof ObjectStoreImplInMemory) {
        instance.armFault(new Error('blob corrupted'));
      }
    },
  });
}

export type PlaygroundProvideHandles = {
  readonly serverSql: PlaygroundSqlClientBundle;
  readonly pubSubBus: InMemoryBus;
  readonly timers: Timers;
  /** Tracks opened client DB handles for wipe/dispose. */
  readonly clientSqlByAddress: Map<string, PlaygroundSqlHandle>;
};

export type PlaygroundSqlClientBundle = {
  readonly sqlClient: SqlClient;
  readonly openRequestDb: OpenRequestDb;
  readonly handle: PlaygroundSqlHandle;
};

export function createPlaygroundProvide(
  handles: PlaygroundProvideHandles
): Record<string, ProviderSpec> {
  const dbProvider = decoratePort<SqlClient>(async () => {
    return attachSimOpenRequestDb(
      handles.serverSql.sqlClient,
      handles.serverSql.openRequestDb
    );
  });

  const eventsProvider = decoratePort<PubSub>(async () => {
    return createInMemoryPubSub({ bus: handles.pubSubBus });
  });

  const clientDbProvider = decoratePort<SqlClient>(
    async (address) => {
      const existing = handles.clientSqlByAddress.get(address);
      if (existing !== undefined) return handleBoundSqlClient(existing);
      const instanceId = clientInstanceIdFromLeafAddress(address);
      const handle = await openFreshPlaygroundSql(
        clientDbName(instanceId),
        handles.timers
      );
      handles.clientSqlByAddress.set(address, handle);
      return handleBoundSqlClient(handle);
    },
    {
      async wipe(_instance, address) {
        const handle = handles.clientSqlByAddress.get(address);
        if (handle === undefined) return;
        await handle.disconnect();
        handles.clientSqlByAddress.delete(address);
      },
    }
  );

  return {
    db: dbProvider,
    events: eventsProvider,
    'api.kv': kvProvider(),
    'api.media': blobProvider(),
    'api.payments': stubPort(
      createInMemoryStripe({ baseUrl: 'http://sim.local' })
    ),
    'api.tts': stubPort(new InMemoryTtsProvider()),
    'api.llm': stubPort(new InMemoryLlmProvider()),
    'client.db': clientDbProvider,
    'client.kv': decoratePort<Kv>(() => new KvImplInMemory()),
    'client.observability': stubPort(
      createNoopObservability('playground-client')
    ),
    'room.storage': kvProvider(),
    'room:*.storage': kvProvider(),
  };
}
