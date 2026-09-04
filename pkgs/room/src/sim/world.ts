import { createSimAdapters } from '@pkgs/uuid';

import { InMemoryClientStorage } from '../client/adapters/storage/memory';
import { createTimerScheduleStack } from '../effects/timer-schedule-stack';
import { InMemoryRoomStorage } from '../server/adapters/memory';
import { RoomServer } from '../server/core/room-server';
import type { RoomCommandPayload, RoomEvent, RoomState } from '../types';

import {
  createRoomBoundaryFaultController,
  type RoomCrashEvent,
} from './boundary-faults';
import { checkRoomInvariants } from './invariants';
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
  RoomSimAuthorize,
  RoomSimClientHandle,
  RoomSimWorld,
} from './world-api';
import {
  attachClient,
  buildClientHandle,
  buildNodeHandle,
  crashClient,
  destroyClient,
  rebindLiveConnections,
  restartClient,
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

type KernelBootArgs<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
> = OpenRoomSimWorldArgs<S, C, E> & {
  readonly authorize?: RoomSimAuthorize;
};

async function createWorldKernel<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(args: KernelBootArgs<S, C, E>): Promise<WorldKernel<S, C, E>> {
  const seed = resolveSeed(args.seed);
  const adapters = createSimAdapters({
    seed: args.seed,
    startMs: args.startMs ?? 1_700_000_000_000,
  });
  const topic = args.topic ?? `sim:${adapters.createId()}`;
  const storage = args.storage ?? new InMemoryRoomStorage();
  const serverQueue = new SerialQueue();
  const boundary = createRoomBoundaryFaultController();
  // Holder so schedule wake can see the kernel before assignment completes.
  const holder: { k: WorldKernel<S, C, E> | null } = { k: null };
  const schedule = createTimerScheduleStack({
    clock: adapters.clock,
    timers: adapters.timers,
    createId: adapters.createId,
    topic,
    enqueueWake: (work) => {
      void serverQueue.enqueue(async () => {
        const kern = holder.k;
        if (kern !== null) {
          for (const slot of kern.slots.values()) {
            if (boundary.takeCrash(slot.key, 'onNextScheduleWake')) {
              kern.onBoundaryCrash?.(slot.key);
            }
          }
        }
        await work();
      });
    },
  });

  const makeServer = (): RoomServer<S, C, E, string> =>
    new RoomServer<S, C, E, string>({
      topic,
      module: args.module,
      storage,
      clock: adapters.clock,
      effectHandlers: [schedule.handler],
      ...(args.authorize !== undefined ? { authorize: args.authorize } : {}),
    });

  const server = makeServer();
  const bindScheduleInject = (s: RoomServer<S, C, E, string>): void => {
    schedule.bindInject((cmd) =>
      s.injectCommand({
        id: cmd.id,
        payload: cmd.payload as C,
        identity: cmd.identity,
      })
    );
  };
  bindScheduleInject(server);
  await server.hydrateFromStorage();
  const network = new SimRoomNetwork(
    () => adapters.clock.now(),
    adapters.rng.fork('net')
  );
  if (args.mildFaults === true) {
    network.setDefaultFaults(MILD_ROOM_FAULTS);
  }

  const k: WorldKernel<S, C, E> = {
    seed,
    topic,
    module: args.module,
    clock: adapters.clock,
    timers: adapters.timers,
    createId: adapters.createId,
    rng: adapters.rng,
    storage,
    server,
    network,
    serverQueue,
    slots: new Map(),
    handles: new Map(),
    boundary,
    serverCrashed: false,
    scheduleDispose: schedule.dispose,
    bindScheduleInject,
    onBoundaryCrash: undefined,
  };
  k.onBoundaryCrash = (clientKey) => {
    const slot = k.slots.get(clientKey);
    if (slot === undefined || slot.crashed) return;
    void crashClient(k, slot);
  };
  holder.k = k;
  return k;
}

function makeDrainCtx<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(k: WorldKernel<S, C, E>) {
  return () => ({
    seed: k.seed,
    now: () => k.clock.now(),
    network: k.network,
    serverQueue: k.serverQueue,
    clockAdvance: (ms: number) => k.clock.advance(ms),
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
    clientStorage: new InMemoryClientStorage(),
    connectionId: '',
    identity: args.identity ?? args.id,
    clientId: args.clientId ?? args.id,
    crashed: false,
  };
  k.slots.set(args.id, slot);
  await attachClient(k, slot);
  const handle = buildClientHandle(k, slot);
  k.handles.set(args.id, handle);
  return handle;
}

async function serverCrashImpl<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(k: WorldKernel<S, C, E>): Promise<void> {
  if (k.serverCrashed) return;
  for (const slot of k.slots.values()) {
    if (slot.connectionId.length > 0) {
      try {
        k.server.unregisterConnection(slot.connectionId);
      } catch {
        // Server may already be half-torn; ignore.
      }
    }
  }
  k.serverCrashed = true;
  await drainRoomSim(makeDrainCtx(k)());
}

function assembleRoomSimWorld<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(
  k: WorldKernel<S, C, E>,
  boot: KernelBootArgs<S, C, E>
): RoomSimWorld<S, C, E> {
  const drainCtx = makeDrainCtx(k);
  const step = async (ms: number): Promise<void> => {
    k.clock.advance(ms);
    await drainRoomSim(drainCtx());
  };
  const untilCtx = { clock: k.clock, seed: k.seed, step };

  let disposed = false;
  const dispose = async (): Promise<void> => {
    if (disposed) return;
    disposed = true;
    for (const slot of [...k.slots.values()]) {
      await destroyClient(k, slot);
    }
    k.slots.clear();
    k.handles.clear();
    k.scheduleDispose();
  };

  const recreateServer = async (): Promise<void> => {
    const schedule = createTimerScheduleStack({
      clock: k.clock,
      timers: k.timers,
      createId: k.createId,
      topic: k.topic,
      enqueueWake: (work) => {
        void k.serverQueue.enqueue(async () => {
          for (const slot of k.slots.values()) {
            if (k.boundary.takeCrash(slot.key, 'onNextScheduleWake')) {
              k.onBoundaryCrash?.(slot.key);
            }
          }
          await work();
        });
      },
    });
    k.scheduleDispose();
    k.scheduleDispose = schedule.dispose;
    const server = new RoomServer<S, C, E, string>({
      topic: k.topic,
      module: boot.module,
      storage: k.storage,
      clock: k.clock,
      effectHandlers: [schedule.handler],
      ...(boot.authorize !== undefined ? { authorize: boot.authorize } : {}),
    });
    k.bindScheduleInject = (s) => {
      schedule.bindInject((cmd) =>
        s.injectCommand({
          id: cmd.id,
          payload: cmd.payload as C,
          identity: cmd.identity,
        })
      );
    };
    k.bindScheduleInject(server);
    await server.hydrateFromStorage();
    k.server = server;
    k.serverCrashed = false;
    rebindLiveConnections(k);
  };

  const prepareForSettle = async (): Promise<void> => {
    k.boundary.clearCrashArms();
    if (k.serverCrashed) {
      await recreateServer();
    }
    for (const slot of k.slots.values()) {
      if (slot.crashed || slot.room === null) {
        await restartClient(k, slot);
      }
    }
  };

  const world: RoomSimWorld<S, C, E> = {
    seed: k.seed,
    topic: k.topic,
    module: k.module,
    rng: k.rng,
    clock: k.clock,
    storage: k.storage,
    get server() {
      return k.server;
    },
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
    checkInvariants: () =>
      checkRoomInvariants({
        module: k.module,
        storage: k.storage,
        topic: k.topic,
        server: k.server,
        clients: k.slots,
        seed: k.seed,
      }),
    armCrashAt: (clientId: string, event: RoomCrashEvent) => {
      k.boundary.armCrash(clientId, event);
    },
    clearBoundaryFaults: () => {
      k.boundary.clearCrashArms();
    },
    serverCrash: () => serverCrashImpl(k),
    serverRestart: async () => {
      await recreateServer();
      await drainRoomSim(drainCtx());
    },
    isServerCrashed: () => k.serverCrashed,
    assertConverged: async () => {
      await assertRoomConverged({
        ...drainCtx(),
        module: k.module,
        storage: k.storage,
        topic: k.topic,
        server: k.server,
        prepareForSettle,
        ensureConnected: async (key) => {
          const slot = k.slots.get(key);
          if (slot === undefined) return;
          if (slot.crashed || slot.room === null) {
            await restartClient(k, slot);
            return;
          }
          await attachClient(k, slot);
        },
      });
    },
    dispose,
    [Symbol.asyncDispose]: dispose,
  };
  return world;
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
  return assembleRoomSimWorld(k, args);
}
