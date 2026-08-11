import { createSimIo } from '@pkgs/io';

import { InMemoryRoomStorage } from '../server/adapters/memory';
import { RoomServer } from '../server/core/room-server';
import type { RoomCommandPayload, RoomEvent, RoomState } from '../types';

import {
  MILD_ROOM_FAULTS,
  type RoomNetSetArg,
  type SimRoomNetHandle,
  SimRoomNetwork,
} from './network';
import { SerialQueue } from './serial-queue';
import {
  assertRoomConverged,
  drainRoomSim,
  foldServerDomainState,
  type RoomSimClientSlot,
  serverDomainHash,
} from './settle';
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
  RoomSimWorld,
} from './world-api';
import {
  attachClient,
  buildClientHandle,
  buildNodeHandle,
  destroyClient,
  type WorldKernel,
} from './world-clients';

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
  const storage = args.storage ?? new InMemoryRoomStorage();
  const server = new RoomServer<S, C, E, string>({
    topic,
    module: args.module,
    storage,
    clock: io.clock,
    ...(args.authorize !== undefined ? { authorize: args.authorize } : {}),
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
  args: {
    readonly id: string;
    readonly identity?: string;
    readonly clientId?: string;
  }
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
    clientId: args.clientId ?? args.id,
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
    storage: k.storage,
    server: k.server,
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
    serverSnapshot: () =>
      foldServerDomainState({
        module: k.module,
        storage: k.storage,
        topic: k.topic,
      }),
    serverHash: () =>
      serverDomainHash({
        module: k.module,
        storage: k.storage,
        topic: k.topic,
      }),
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
