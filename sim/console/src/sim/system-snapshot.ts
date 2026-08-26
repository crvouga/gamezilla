/**
 * Portable logical World snapshot capture / restore for createSim.
 */

import type { Client } from '@apps/client/product/create-client';
import { migrateSimClientSqlite } from '@apps/server/sim/migrate-sim-sqlite';
import {
  appSchema,
  LOCAL_DOMAIN_TABLE_NAMES,
} from '@libs/runtime/root/app-schema';
import type { SimSystemSnapshot } from '@pkgs/sim-console/shared/sim-system-snapshot';
import { dumpData, loadData } from '@pkgs/sql-client/interface';
import type { SqlDataDump } from '@pkgs/sql-client/sql-data-snapshot/types';
import { getLocalSchemaTargetVersion } from '@pkgs/sync-engine/client';
import { FRAMEWORK_CACHE_TABLE_NAMES } from '@pkgs/sync-engine/shared';
import {
  dumpPlaygroundClientDurable,
  restorePlaygroundClientDurable,
} from '@sim/console/playground/playground-checkpoint-durable';
import {
  applyCheckpointFaults,
  collectRooms,
  resetSimClock,
} from '@sim/console/playground/playground-checkpoint-state';
import {
  awaitPlaygroundMutationDrain,
  reconcileServerProfilesFromClients,
} from '@sim/console/playground/playground-snapshot-sync';
import { type Sim, simClientNamespace } from '@sim/console/sim/create-sim';
import {
  openFreshSimClientSql,
  type SimSqlHandle,
} from '@sim/console/sim/sim-sql';

export type SystemSnapshotCtx = {
  readonly sim: Sim;
  readonly clientIds: readonly string[];
  readonly liveClients: ReadonlyMap<string, Client>;
  readonly clientSqlByAddress: Map<string, SimSqlHandle>;
  readonly getClockPaused?: () => boolean;
  readonly setClockPaused?: (paused: boolean) => void;
};

function drainCtx(ctx: SystemSnapshotCtx) {
  return {
    clock: ctx.sim.clock,
    serverHandle: ctx.sim.serverSql,
    sim: ctx.sim,
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
): Promise<SimSqlHandle> {
  const existing =
    ctx.clientSqlByAddress.get(clientId) ?? ctx.sim.clientSql(clientId);
  if (existing !== undefined) return existing;
  await ctx.sim.client(clientId).openSqlClient();
  const handle = ctx.sim.clientSql(clientId);
  if (handle !== undefined) {
    ctx.clientSqlByAddress.set(clientId, handle);
    return handle;
  }
  const opened = await openFreshSimClientSql(
    `sim_client_${clientId}`,
    ctx.sim.clock
  );
  ctx.clientSqlByAddress.set(clientId, opened);
  return opened;
}

const CLIENT_RESTORE_SKIP_TABLES = new Set<string>([
  ...FRAMEWORK_CACHE_TABLE_NAMES,
]);

function shouldSkipClientRestoreTable(name: string): boolean {
  if (CLIENT_RESTORE_SKIP_TABLES.has(name)) return true;
  if (name.startsWith('auth_')) return false;
  return LOCAL_DOMAIN_TABLE_NAMES.includes(name);
}

/** Domain + sync cache re-hydrate from server; keep auth/durable rows. */
function clientTablesForRestore(dump: SqlDataDump): SqlDataDump {
  const tables: SqlDataDump['tables'] = {};
  for (const [name, slice] of Object.entries(dump.tables)) {
    if (shouldSkipClientRestoreTable(name)) continue;
    tables[name] = slice;
  }
  return { ...dump, tables };
}

export async function captureSystemSnapshot(
  ctx: SystemSnapshotCtx
): Promise<SimSystemSnapshot> {
  const clientIds = [...ctx.clientIds];
  const roomTopics = [...ctx.sim.roomNode.listTopics()];
  await awaitPlaygroundMutationDrain(drainCtx(ctx), clientIds);

  const server = await dumpData(ctx.sim.serverSql.sqlClient);
  const clients: SimSystemSnapshot['clients'] = {};

  for (const clientId of clientIds) {
    const handle = await ensureClientSqlHandle(ctx, clientId);
    clients[clientId] = {
      tables: await dumpData(handle.sqlClient),
      kv: dumpPlaygroundClientDurable(simClientNamespace(clientId)),
    };
  }

  const capturedAtMs = ctx.sim.clock.now();

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
        sim: ctx.sim,
        clock: ctx.sim.clock,
        roomNode: ctx.sim.roomNode,
        serverHandle: ctx.sim.serverSql,
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
        spawnClient: async () => ({ id: 'noop' }),
        detachClientsForSnapshotLoad: async () => undefined,
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
  snapshot: SimSystemSnapshot
): Promise<void> {
  if (snapshot.version !== 1) {
    throw new Error(
      `restoreSystemSnapshot: unsupported version ${String(snapshot.version)}`
    );
  }
  const required = getLocalSchemaTargetVersion();
  if (snapshot.localSchemaVersion !== required) {
    throw new Error(
      `restoreSystemSnapshot: schema v${String(required)} required, snapshot v${String(snapshot.localSchemaVersion)} — run bun run --filter @sim/test snapshot`
    );
  }

  for (const id of [...ctx.sim.clientIds()]) {
    await ctx.sim.dropClient(id);
  }

  await loadData(ctx.sim.serverSql.sqlClient, snapshot.server);

  for (const clientId of snapshot.clientIds) {
    const slice = snapshot.clients[clientId];
    if (slice === undefined) continue;
    restorePlaygroundClientDurable(simClientNamespace(clientId), {
      ...slice.kv,
    });
    const handle = await ensureClientSqlHandle(ctx, clientId);
    await migrateSimClientSqlite({
      sqlClient: handle.sqlClient,
      now: () => ctx.sim.clock.now(),
    });
    // Client domain/sync cache re-hydrates from server; auth + durable SQL restored.
    await loadData(handle.sqlClient, slice.tables);
  }

  await reconcileServerProfilesFromClients(drainCtx(ctx), snapshot.clientIds);

  await restoreSystemSnapshotRooms(ctx, snapshot);
  resetSimClock(ctx.sim.clock, snapshot.clockMs);
  ctx.setClockPaused?.(snapshot.clockPaused);
  applyCheckpointFaults(ctx.sim, {
    label: '',
    capturedAtMs: snapshot.clockMs,
    clockMs: snapshot.clockMs,
    clockPaused: snapshot.clockPaused,
    localSchemaVersion: snapshot.localSchemaVersion,
    clientIds: snapshot.clientIds,
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
  snapshot: SimSystemSnapshot
): Promise<void> {
  const keep = new Set(snapshot.roomTopics);
  for (const topic of ctx.sim.roomNode.listTopics()) {
    if (!keep.has(topic)) ctx.sim.roomNode.dropTopic(topic);
  }
  for (const topic of snapshot.roomTopics) {
    const room = snapshot.rooms[topic];
    if (room === undefined) continue;
    await ctx.sim.roomNode.replaceTopic(topic, {
      entries: room.entries as never,
      dedup: room.dedup as never,
    });
  }
}
