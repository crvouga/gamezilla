/**
 * Portable logical system snapshot capture / restore for createHarness.
 */

import type { Client } from '@libs/app-root-client/create-client';
import type {
  HarnessSystemSnapshot,
  HarnessSystemSnapshotClientSlice,
} from '@pkgs/harness-console-shared/system-snapshot';
import { dumpData, loadData } from '@pkgs/sql-client-root-shared/port';
import type {
  SqlDataDump,
  SqlTableDump,
} from '@pkgs/sql-client-root-shared/types';
import { getLocalSchemaTargetVersion } from '@pkgs/sync-engine-client/local-schema-migrate';
import { FRAMEWORK_CACHE_TABLE_NAMES } from '@pkgs/sync-engine-shared/framework-server-ddl';
import {
  applyCheckpointFaults,
  collectRooms,
  resetHarnessClock,
} from './checkpoint-state';
import {
  dumpProductHarnessClientDurable,
  restoreProductHarnessClientDurable,
} from './client-durable';
import type { Harness } from './create-harness';
import { migrateCompositionClientSqlite } from './migrate-composition';
import {
  awaitProductHarnessMutationDrain,
  reconcileServerProfilesFromClients,
} from './snapshot-sync';
import { openFreshHarnessClientSql } from './sql';
import type { HarnessSql } from './sql-types';

export type SystemSnapshotCtx = {
  readonly harness: Harness;
  readonly clientIds: readonly string[];
  readonly liveClients: ReadonlyMap<string, Client>;
  readonly clientSqlByAddress: Map<string, HarnessSql>;
  readonly getClockPaused?: () => boolean;
  readonly setClockPaused?: (paused: boolean) => void;
};

function drainCtx(ctx: SystemSnapshotCtx) {
  return {
    clock: ctx.harness.clock,
    scheduler: ctx.harness.scheduler,
    serverHandle: ctx.harness.serverSql,
    harness: ctx.harness,
    clientSqlByAddress: ctx.clientSqlByAddress,
    maps: {
      lives: {
        get: (id: string) => ctx.liveClients.get(id),
        values: () => ctx.liveClients.values(),
      },
    },
  };
}

async function ensureClientSqlHandle(
  ctx: SystemSnapshotCtx,
  clientId: string
): Promise<HarnessSql> {
  const existing =
    ctx.clientSqlByAddress.get(clientId) ?? ctx.harness.clientSql(clientId);
  if (existing !== undefined) return existing;
  await (await ctx.harness.client(clientId)).openSqlClient();
  const handle = ctx.harness.clientSql(clientId);
  if (handle !== undefined) {
    ctx.clientSqlByAddress.set(clientId, handle);
    return handle;
  }
  const opened = await openFreshHarnessClientSql(
    `harness_client_${clientId}`,
    ctx.harness.clock
  );
  ctx.clientSqlByAddress.set(clientId, opened);
  return opened;
}

const CLIENT_RESTORE_SKIP_TABLES = new Set<string>([
  ...FRAMEWORK_CACHE_TABLE_NAMES,
]);

function shouldSkipClientRestoreTable(
  name: string,
  domainTables: readonly string[]
): boolean {
  if (CLIENT_RESTORE_SKIP_TABLES.has(name)) return true;
  if (name.startsWith('auth_')) return false;
  return domainTables.includes(name);
}

/** Domain + sync cache re-hydrate from server; keep auth/durable rows. */
function clientTablesForRestore(
  dump: SqlDataDump,
  domainTables: readonly string[]
): SqlDataDump {
  const tables: Record<string, SqlTableDump> = {};
  for (const [name, slice] of Object.entries(dump.tables)) {
    if (shouldSkipClientRestoreTable(name, domainTables)) continue;
    tables[name] = slice;
  }
  return { ...dump, tables };
}

export async function captureSystemSnapshot(
  ctx: SystemSnapshotCtx
): Promise<HarnessSystemSnapshot> {
  const clientIds = [...ctx.clientIds];
  const roomTopics = [...ctx.harness.roomNode.listTopics()];
  await awaitProductHarnessMutationDrain(drainCtx(ctx), clientIds);

  const server = await dumpData(ctx.harness.serverSql.sqlClient);
  const clients: Record<string, HarnessSystemSnapshotClientSlice> = {};

  for (const clientId of clientIds) {
    const handle = await ensureClientSqlHandle(ctx, clientId);
    clients[clientId] = {
      tables: await dumpData(handle.sqlClient),
      kv: dumpProductHarnessClientDurable(
        ctx.harness.clientNamespace(clientId)
      ),
    };
  }

  const capturedAtMs = ctx.harness.clock.now();

  return {
    version: 1,
    localSchemaVersion: getLocalSchemaTargetVersion(),
    clockMs: capturedAtMs,
    clockPaused: ctx.getClockPaused?.() ?? false,
    clientIds,
    roomTopics,
    partitions: [],
    skewByAddress: {},
    downAddresses: [],
    evictedAddresses: [],
    server,
    clients,
    rooms: collectRooms(
      {
        harness: ctx.harness,
        clock: ctx.harness.clock,
        scheduler: ctx.harness.scheduler,
        serverHandle: ctx.harness.serverSql,
        clientSqlByAddress: ctx.clientSqlByAddress,
        maps: {
          clients: {
            keys: () => clientIds[Symbol.iterator](),
            values: () => clientIds.map((id) => ({ id }))[Symbol.iterator](),
            size: clientIds.length,
          },
          lives: {
            get: (id: string) => ctx.liveClients.get(id),
            values: () => ctx.liveClients.values(),
          },
        },
        getClockPaused: () => ctx.getClockPaused?.() ?? false,
        setClockPaused: () => undefined,
        spawnClient: () => Promise.resolve({ id: 'noop' }),
        refreshServers: () => undefined,
        detachClientsForSnapshotLoad: () => Promise.resolve(),
        notify: () => undefined,
        endSnapshotRestoring: () => undefined,
        runQuiet: async (fn) => fn(),
      },
      roomTopics
    ),
  };
}

export async function restoreSystemSnapshot(
  ctx: SystemSnapshotCtx,
  snapshot: HarnessSystemSnapshot
): Promise<void> {
  // Snapshots are parsed from disk; the literal type is not a runtime guarantee.
  const version: number = snapshot.version;
  if (version !== 1) {
    throw new Error(
      `restoreSystemSnapshot: unsupported version ${String(version)}`
    );
  }
  const required = getLocalSchemaTargetVersion();
  if (snapshot.localSchemaVersion !== required) {
    throw new Error(
      `restoreSystemSnapshot: schema v${String(required)} required, snapshot v${String(snapshot.localSchemaVersion)} — run bun run --filter @apps/product snapshot`
    );
  }

  for (const id of [...ctx.harness.clientIds()]) {
    await ctx.harness.dropClient(id);
  }

  await loadData(ctx.harness.serverSql.sqlClient, snapshot.server);

  for (const clientId of snapshot.clientIds) {
    const slice = snapshot.clients[clientId];
    if (slice === undefined) continue;
    restoreProductHarnessClientDurable(ctx.harness.clientNamespace(clientId), {
      ...slice.kv,
    });
    const handle = await ensureClientSqlHandle(ctx, clientId);
    await migrateCompositionClientSqlite(ctx.harness.composition.app, {
      sqlClient: handle.sqlClient,
      now: () => ctx.harness.clock.now(),
    });
    // Client domain/sync cache re-hydrates from server; auth + durable SQL restored.
    await loadData(
      handle.sqlClient,
      clientTablesForRestore(
        slice.tables,
        ctx.harness.composition.app.tableNames
      )
    );
  }

  await reconcileServerProfilesFromClients(drainCtx(ctx), snapshot.clientIds);

  await restoreSystemSnapshotRooms(ctx, snapshot);
  resetHarnessClock(ctx.harness.scheduler, snapshot.clockMs);
  ctx.setClockPaused?.(snapshot.clockPaused);
  applyCheckpointFaults(ctx.harness, {
    label: '',
    capturedAtMs: snapshot.clockMs,
    clockMs: snapshot.clockMs,
    clockPaused: snapshot.clockPaused,
    localSchemaVersion: snapshot.localSchemaVersion,
    clientIds: snapshot.clientIds,
    serverIds: [...ctx.harness.serverIds()],
    roomTopics: snapshot.roomTopics,
    partitions: snapshot.partitions,
    skewByAddress: snapshot.skewByAddress,
    downAddresses: snapshot.downAddresses,
    evictedAddresses: snapshot.evictedAddresses,
    sqlFormat: 'mixed-pgmm-sqlm',
    serverSql: new Uint8Array(),
    clientSql: {},
    clientKv: {},
    rooms: snapshot.rooms,
  });
}

async function restoreSystemSnapshotRooms(
  ctx: SystemSnapshotCtx,
  snapshot: HarnessSystemSnapshot
): Promise<void> {
  const keep = new Set(snapshot.roomTopics);
  for (const topic of ctx.harness.roomNode.listTopics()) {
    if (!keep.has(topic)) ctx.harness.roomNode.dropTopic(topic);
  }
  for (const topic of snapshot.roomTopics) {
    const room = snapshot.rooms[topic];
    if (room === undefined) continue;
    await ctx.harness.roomNode.replaceTopic(topic, {
      entries: room.entries as never,
      dedup: room.dedup as never,
    });
  }
}
