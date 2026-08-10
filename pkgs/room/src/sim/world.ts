import { createSimIo, type SimIo } from '@pkgs/io';

import { InMemoryClientStorage } from '../client/adapters/storage/memory';
import { Room } from '../client/core/room';
import { RoomMetaAttr } from '../client/core/room-meta';
import { InMemoryRoomStorage } from '../server/adapters/memory';
import { RoomServer } from '../server/core/room-server';
import type {
  RoomCommandPayload,
  RoomEvent,
  RoomModule,
  RoomState,
} from '../types';

import {
  MILD_ROOM_FAULTS,
  type RoomNetSetArg,
  type SimRoomNetHandle,
  SimRoomNetwork,
} from './network';
import { SerialQueue } from './serial-queue';
import {
  assertRoomConverged,
  clientDomainHash,
  drainRoomSim,
  type RoomSimClientSlot,
} from './settle';
import { SimLoopbackRoomTransport } from './sim-loopback-transport';
import {
  type NeverOpts,
  runWorldNever,
  runWorldUntil,
  type UntilOpts,
  type UntilTarget,
} from './until';
import type {
  OpenRoomSimWorldArgs,
  RoomSimClientHandle,
  RoomSimNodeHandle,
  RoomSimWorld,
} from './world-api';

function resolveSeed(seed: number | bigint | string): bigint {
  if (typeof seed === 'bigint') return seed === 0n ? 1n : seed;
  if (typeof seed === 'string') {
    let h = 0xcbf29ce484222325n;
    for (let i = 0; i < seed.length; i += 1) {
      h ^= BigInt(seed.charCodeAt(i));
      h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
    }
    return h === 0n ? 1n : h;
  }
  const asInt = BigInt(Math.floor(Math.abs(seed))) & 0xffffffffffffffffn;
  return asInt === 0n ? 1n : asInt;
}

type WorldKernel<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
> = {
  readonly seed: bigint;
  readonly topic: string;
  readonly module: RoomModule<S, C, E, string>;
  readonly io: SimIo;
  readonly storage: InMemoryRoomStorage;
  readonly server: RoomServer<S, C, E, string>;
  readonly network: SimRoomNetwork;
  readonly serverQueue: SerialQueue;
  readonly slots: Map<string, RoomSimClientSlot<S, C, E>>;
  readonly handles: Map<string, RoomSimClientHandle<S, C, E>>;
};

async function attachClient<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(k: WorldKernel<S, C, E>, slot: RoomSimClientSlot<S, C, E>): Promise<void> {
  if (slot.room !== null) return;
  const connectionId = `conn-${slot.key}-${k.io.createId()}`;
  slot.connectionId = connectionId;
  const transport = new SimLoopbackRoomTransport<S, C, E>({
    server: k.server,
    connectionId,
    identity: slot.identity,
    clientKey: slot.key,
    network: k.network,
    serverQueue: k.serverQueue,
  });
  k.server.registerConnection(
    connectionId,
    (msg) => {
      transport.enqueueFromServer(msg);
    },
    { id: slot.identity, clientId: slot.clientId }
  );
  const room = await Room.open<S, C, E, string>({
    topic: k.topic,
    module: k.module,
    storage: new InMemoryClientStorage(),
    transport,
    identity: slot.identity,
    clock: k.io.clock,
    timers: k.io.timers,
    createId: k.io.createId,
  });
  slot.transport = transport;
  slot.room = room;
  await drainRoomSim({
    seed: k.seed,
    now: () => k.io.clock.now(),
    network: k.network,
    serverQueue: k.serverQueue,
    clockAdvance: (ms) => k.io.clock.advance(ms),
    clients: k.slots,
  });
}

async function softDisconnectClient<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(k: WorldKernel<S, C, E>, slot: RoomSimClientSlot<S, C, E>): Promise<void> {
  const transport = slot.transport;
  if (transport === null || slot.room === null) return;
  const connectionId = slot.connectionId;
  transport.softDisconnect();
  if (connectionId.length > 0) {
    k.server.unregisterConnection(connectionId);
    slot.connectionId = '';
  }
  slot.room.getSnapshot();
  // onClose already notified; isConnected reads transport.
  await drainRoomSim({
    seed: k.seed,
    now: () => k.io.clock.now(),
    network: k.network,
    serverQueue: k.serverQueue,
    clockAdvance: (ms) => k.io.clock.advance(ms),
    clients: k.slots,
  });
}

async function softReconnectClient<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(k: WorldKernel<S, C, E>, slot: RoomSimClientSlot<S, C, E>): Promise<void> {
  if (slot.room === null || slot.transport === null) {
    await attachClient(k, slot);
    return;
  }
  const connectionId = `conn-${slot.key}-${k.io.createId()}`;
  slot.connectionId = connectionId;
  const transport = slot.transport;
  transport.setConnectionId(connectionId);
  k.server.registerConnection(
    connectionId,
    (msg) => {
      transport.enqueueFromServer(msg);
    },
    { id: slot.identity, clientId: slot.clientId }
  );
  transport.softReconnect();
  await drainRoomSim({
    seed: k.seed,
    now: () => k.io.clock.now(),
    network: k.network,
    serverQueue: k.serverQueue,
    clockAdvance: (ms) => k.io.clock.advance(ms),
    clients: k.slots,
  });
}

async function destroyClient<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(k: WorldKernel<S, C, E>, slot: RoomSimClientSlot<S, C, E>): Promise<void> {
  const room = slot.room;
  const transport = slot.transport;
  const connectionId = slot.connectionId;
  slot.room = null;
  slot.transport = null;
  room?.destroy();
  transport?.destroy();
  if (connectionId.length > 0) {
    k.server.unregisterConnection(connectionId);
  }
  await drainRoomSim({
    seed: k.seed,
    now: () => k.io.clock.now(),
    network: k.network,
    serverQueue: k.serverQueue,
    clockAdvance: (ms) => k.io.clock.advance(ms),
    clients: k.slots,
  });
}

function buildClientHandle<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(
  k: WorldKernel<S, C, E>,
  slot: RoomSimClientSlot<S, C, E>
): RoomSimClientHandle<S, C, E> {
  return {
    id: slot.key,
    identity: slot.identity,
    clientId: slot.clientId,
    dispatch: (payload) => {
      if (slot.room === null) {
        throw new Error(`dispatch: client ${slot.key} is disconnected`);
      }
      slot.room.dispatch(payload);
    },
    snapshot: () => {
      if (slot.room === null) {
        throw new Error(`snapshot: client ${slot.key} is disconnected`);
      }
      return slot.room.getSnapshot();
    },
    hash: () => {
      if (slot.room === null) {
        throw new Error(`hash: client ${slot.key} is disconnected`);
      }
      return clientDomainHash(k.module, slot.room);
    },
    isSynced: () => {
      if (slot.room === null) return false;
      return RoomMetaAttr.isSynced.from(slot.room.getSnapshot());
    },
    isConnected: () => {
      if (slot.room === null || slot.transport === null) return false;
      return RoomMetaAttr.isConnected.from(slot.room.getSnapshot());
    },
    room: () => slot.room,
    disconnect: async () => {
      await softDisconnectClient(k, slot);
    },
    connect: async () => {
      await softReconnectClient(k, slot);
    },
  };
}

function buildNodeHandle<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(k: WorldKernel<S, C, E>, key: string): RoomSimNodeHandle {
  return {
    now: () => k.io.clock.now(),
    disconnect: async () => {
      const slot = k.slots.get(key);
      if (slot === undefined) {
        throw new Error(`node.disconnect: unknown client ${key}`);
      }
      await softDisconnectClient(k, slot);
    },
    reconnect: async () => {
      const slot = k.slots.get(key);
      if (slot === undefined) {
        throw new Error(`node.reconnect: unknown client ${key}`);
      }
      await softReconnectClient(k, slot);
    },
  };
}

async function createWorldKernel<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(args: OpenRoomSimWorldArgs<S, C, E>): Promise<WorldKernel<S, C, E>> {
  const seed = resolveSeed(args.seed);
  const io = createSimIo({
    seed: args.seed,
    startMs: args.startMs ?? 1_700_000_000_000,
  });
  const topic = args.topic ?? `sim:${io.createId()}`;
  const storage = new InMemoryRoomStorage();
  const server = new RoomServer<S, C, E, string>({
    topic,
    module: args.module,
    storage,
    clock: io.clock,
  });
  await server.hydrateFromStorage();
  const network = new SimRoomNetwork(() => io.clock.now(), io.rng.fork('net'));
  if (args.mildFaults === true) {
    network.setDefaultFaults(MILD_ROOM_FAULTS);
  }
  return {
    seed,
    topic,
    module: args.module,
    io,
    storage,
    server,
    network,
    serverQueue: new SerialQueue(),
    slots: new Map(),
    handles: new Map(),
  };
}

function makeDrainCtx<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(k: WorldKernel<S, C, E>) {
  return () => ({
    seed: k.seed,
    now: () => k.io.clock.now(),
    network: k.network,
    serverQueue: k.serverQueue,
    clockAdvance: (ms: number) => k.io.clock.advance(ms),
    clients: k.slots,
  });
}

async function addWorldClient<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(
  k: WorldKernel<S, C, E>,
  args: { readonly id: string; readonly identity?: string }
): Promise<RoomSimClientHandle<S, C, E>> {
  if (k.handles.has(args.id)) {
    throw new Error(`addClient: duplicate id ${args.id}`);
  }
  const slot: RoomSimClientSlot<S, C, E> = {
    key: args.id,
    room: null,
    transport: null,
    connectionId: '',
    identity: args.identity ?? args.id,
    clientId: args.id,
  };
  k.slots.set(args.id, slot);
  await attachClient(k, slot);
  const handle = buildClientHandle(k, slot);
  k.handles.set(args.id, handle);
  return handle;
}

function assembleRoomSimWorld<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(k: WorldKernel<S, C, E>): RoomSimWorld<S, C, E> {
  const drainCtx = makeDrainCtx(k);
  const step = async (ms: number): Promise<void> => {
    k.io.clock.advance(ms);
    await drainRoomSim(drainCtx());
  };
  const untilCtx = { clock: k.io.clock, seed: k.seed, step };

  let disposed = false;
  const dispose = async (): Promise<void> => {
    if (disposed) return;
    disposed = true;
    for (const slot of [...k.slots.values()]) {
      await destroyClient(k, slot);
    }
    k.slots.clear();
    k.handles.clear();
  };

  return {
    seed: k.seed,
    topic: k.topic,
    module: k.module,
    io: k.io,
    clock: k.io.clock,
    clients: k.handles,
    addClient: (args) => addWorldClient(k, args),
    net: (clientId: string): SimRoomNetHandle => ({
      set: (next: RoomNetSetArg) => k.network.set(clientId, next),
    }),
    node: (clientId: string) => buildNodeHandle(k, clientId),
    runFor: async (ms: number) => {
      await step(ms);
    },
    until: (target: UntilTarget, opts?: UntilOpts) =>
      runWorldUntil(untilCtx, target, opts),
    never: (target: UntilTarget, opts: NeverOpts) =>
      runWorldNever(untilCtx, target, opts),
    drain: async () => {
      await drainRoomSim(drainCtx());
    },
    assertConverged: async () => {
      await assertRoomConverged({
        ...drainCtx(),
        module: k.module,
        storage: k.storage,
        topic: k.topic,
        server: k.server,
        ensureConnected: async (key) => {
          const slot = k.slots.get(key);
          if (slot === undefined) return;
          await attachClient(k, slot);
        },
      });
    },
    dispose,
    [Symbol.asyncDispose]: dispose,
  };
}

/**
 * Open a multi-client deterministic room world (TigerBeetle-style DST).
 * One seed → identical timeline. Use `await using` for cleanup.
 */
export async function openRoomSimWorld<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(args: OpenRoomSimWorldArgs<S, C, E>): Promise<RoomSimWorld<S, C, E>> {
  const k = await createWorldKernel(args);
  return assembleRoomSimWorld(k);
}
