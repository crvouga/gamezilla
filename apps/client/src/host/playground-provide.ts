/**
 * Browser playground provide map for `@pkgs/system` createWorld.
 *
 * Live SQL is **in-memory sqlite-mem** (no OPFS / SharedWorker). Expo-sqlite web
 * workers race under Strict Mode remounts and hang playground boot; snapshots
 * via ObjectStore remain the only durable playground state.
 */

import type { OpenRequestDb } from '@apps/api/db/open-request-db';
import { attachSimOpenRequestDb } from '@apps/api/system/sim-open-request-db';
import { createInMemoryStripe } from '@libs/stripe/root/in-memory-stripe';
import type { Clock } from '@pkgs/clock';
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
import { SqlClientImplSqliteMem } from '@pkgs/sql-client/sqlite/impl-sqlite-mem';
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

function uniquePlaygroundDbName(base: string): string {
  playgroundSqlSeq += 1;
  const safe = base.replace(/[^a-zA-Z0-9_]/g, '_');
  return `${safe}_${playgroundSqlSeq}`;
}

function openSqliteMem(clock: Clock): SqlClientImplSqliteMem {
  return SqlClientImplSqliteMem.open({
    seed: 1,
    now: () => new Date(clock.now()),
  });
}

function openSqliteMemHandle(
  logicalName: string,
  clock: Clock
): PlaygroundSqlHandle {
  let databaseName = uniquePlaygroundDbName(logicalName);
  let live = openSqliteMem(clock);
  const handle: PlaygroundSqlHandle = {
    get sqlClient() {
      return live;
    },
    get databaseName() {
      return databaseName;
    },
    disconnect: () => live.disconnect(),
    reset: async () => {
      // Open the replacement first so handle-bound clients never observe a
      // closed sqlite-mem instance mid-reset (DB pane soft-poll / in-flight queries).
      const prev = live;
      databaseName = uniquePlaygroundDbName(logicalName);
      live = openSqliteMem(clock);
      await live.connect();
      await prev.disconnect();
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
  clock: Clock
): Promise<PlaygroundSqlHandle> {
  const handle = openSqliteMemHandle(databaseName, clock);
  await handle.sqlClient.connect();
  return handle;
}

/**
 * Open a fresh ephemeral DB. Each sqlite-mem instance is isolated — no OPFS reset.
 */
export async function openFreshPlaygroundSql(
  databaseName: string,
  clock: Clock
): Promise<PlaygroundSqlHandle> {
  return openPlaygroundSql(databaseName, clock);
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
 * Always forward to the handle's current sqlite-mem client. Snapshot reload /
 * fault wipe {@link PlaygroundSqlHandle.reset}s in place — SyncEngines or DB
 * panes that captured a raw sqlite-mem instance see "database is closed";
 * handle-bound clients do not.
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
  readonly clock: Clock;
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
        handles.clock
      );
      handles.clientSqlByAddress.set(address, handle);
      return handleBoundSqlClient(handle);
    },
    {
      async wipe(_instance, address) {
        // Reset in place — same PlaygroundSqlHandle object. Snapshot detach and
        // fault wipe must not drop the handle: handleBoundSqlClient + UI DB pane
        // keep wrapping it across restore (disconnect+delete → "database is closed").
        const handle = handles.clientSqlByAddress.get(address);
        if (handle === undefined) return;
        await handle.reset();
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
