// @io-wall-ok — composition root: createSimIo + createWorld + durable OPFS SQLite.
/**
 * Boot a World-backed playground session: shared api/db/events, dynamic clients,
 * in-process room node, and wall-driven sim clock advance.
 */

import type { OpenRequestDb } from '@apps/api/db/open-request-db';
import { migrateSimSqlite } from '@apps/api/system/migrate-sim-sqlite';
import { createInProcessRoomNode } from '@apps/client/host/in-process-room-node';
import {
  createPlaygroundImpls,
  serializeFetch,
} from '@apps/client/host/playground-impls';
import { createPlaygroundSnapshotStore } from '@apps/client/host/playground-minio-store';
import {
  clientDbName,
  clientNamespace,
  createPlaygroundProvide,
  openPlaygroundSql,
  type PlaygroundSqlHandle,
  sharedRequestSqlClient,
} from '@apps/client/host/playground-provide';
import { buildPlaygroundSession } from '@apps/client/host/playground-session';
import type { ClientSystemResources } from '@apps/client/providers/client-system-resources';
import { system } from '@libs/runtime/shared/system';
import { createSimIo, type SimIo, wallIo } from '@pkgs/io';
import { createInMemoryBus } from '@pkgs/pubsub/testing/in-memory';
import type { Fetch } from '@pkgs/system';
import { createWorld } from '@pkgs/system';
import {
  createPlaygroundLogBuffer,
  type PlaygroundSession,
} from '@pkgs/system-console/client';

const PLAYGROUND_SERVER_DB = 'playground_server';

function startSimClockTick(io: SimIo): {
  readonly disposeTick: () => void;
  readonly getClockPaused: () => boolean;
  readonly setClockPaused: (paused: boolean) => void;
} {
  const wall = wallIo();
  let clockPaused = false;
  let lastWall = wall.clock.now();
  const tickHandle = wall.timers.setInterval(() => {
    if (clockPaused) {
      lastWall = wall.clock.now();
      return;
    }
    const now = wall.clock.now();
    const delta = now - lastWall;
    lastWall = now;
    if (delta > 0) io.clock.advance(delta);
  }, 16);
  return {
    disposeTick: () => wall.timers.clearInterval(tickHandle),
    getClockPaused: () => clockPaused,
    setClockPaused: (paused) => {
      clockPaused = paused;
    },
  };
}

/**
 * Durable OPFS/expo-sqlite clients + shared in-memory pubsub on createWorld.
 */
export async function bootPlaygroundSession(): Promise<
  PlaygroundSession<ClientSystemResources>
> {
  const wall = wallIo();
  const io: SimIo = createSimIo({ seed: 1, startMs: wall.clock.now() });
  const clock = startSimClockTick(io);
  const pubSubBus = createInMemoryBus();
  const serverLogs = createPlaygroundLogBuffer();
  const pubsubLogs = createPlaygroundLogBuffer();
  const roomLogs = createPlaygroundLogBuffer();
  const clientSqlByAddress = new Map<string, PlaygroundSqlHandle>();

  const serverHandle = await openPlaygroundSql(PLAYGROUND_SERVER_DB, io.timers);
  await migrateSimSqlite({ sqlClient: serverHandle.sqlClient, io });
  const shared = sharedRequestSqlClient(serverHandle.sqlClient);
  const openRequestDb: OpenRequestDb = async () => ({
    kind: 'sqlite',
    sqlClient: shared,
  });

  const roomNode = createInProcessRoomNode(io);
  let apiFetch: Fetch = async () => {
    throw new Error('playground api fetch not ready');
  };

  const world = createWorld(system, {
    seed: 1,
    startMs: io.clock.now(),
    timers: io.timers,
    clock: io.clock,
    createId: io.createId,
    random: io.random,
    impls: createPlaygroundImpls({
      pubSubBus,
      roomNode,
      serverLogs,
      getApiFetch: () => apiFetch,
    }),
    provide: createPlaygroundProvide({
      serverSql: {
        sqlClient: serverHandle.sqlClient,
        openRequestDb,
        handle: serverHandle,
      },
      pubSubBus,
      timers: io.timers,
      clientSqlByAddress,
    }),
  });

  apiFetch = serializeFetch((await world.spawn('api')) as Fetch);

  return buildPlaygroundSession({
    world,
    io,
    roomNode,
    pubSubBus,
    serverHandle,
    clientSqlByAddress,
    serverLogs,
    pubsubLogs,
    roomLogs,
    snapshotStore: createPlaygroundSnapshotStore(wall.timers),
    disposeTick: clock.disposeTick,
    getClockPaused: clock.getClockPaused,
    setClockPaused: clock.setClockPaused,
  });
}

/** @deprecated Use dynamic client ids via session.clients. */
export const PLAYGROUND_DB_NAMES = {
  server: PLAYGROUND_SERVER_DB,
  alice: clientDbName('alice'),
  bob: clientDbName('bob'),
} as const;

export const PLAYGROUND_ACTOR_NAMESPACES = {
  alice: clientNamespace('alice'),
  bob: clientNamespace('bob'),
} as const;
