import { createSimAdapters, type SeededRng } from '@pkgs/uuid';

import { InMemoryClientStorage } from '../client/adapters/storage/memory';
import { createTimerScheduleStack } from '../effects/timer-schedule-stack';
import { InMemoryRoomStorage } from '../server/adapters/memory';
import { RoomServer } from '../server/core/room-server';
import type { RoomCommandPayload, RoomEvent, RoomState } from '../types';

import { createRoomBoundaryFaultController } from './boundary-faults';
import type { RoomDstApp } from './dst/app';
import type { RoomWorldKnobs } from './dst/knobs';
import { checkRoomInvariants } from './invariants';
import { MILD_ROOM_FAULTS, SimRoomNetwork } from './network';
import { SerialQueue } from './serial-queue';
import {
  assertRoomConverged,
  drainRoomSim,
  foldServerDomainState,
  type RoomSimClientSlot,
  serverDomainHash,
} from './settle';
import type {
  OpenWorldAppArgs,
  OpenWorldArgs,
  OpenWorldModuleArgs,
  RoomSimAuthorize,
  RoomSimClientHandle,
  World,
} from './world-api';
import {
  attachClient,
  buildClientHandle,
  crashClientSync,
  destroyClient,
  rebindLiveConnections,
  restartClient,
  softDisconnectClient,
  softReconnectClient,
  type WorldKernel,
} from './world-clients';
import { assembleWorld } from './world-facade';

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
> = OpenWorldModuleArgs<S, C, E> & {
  readonly authorize?: RoomSimAuthorize;
};

type BoundSchedule = ReturnType<typeof createTimerScheduleStack>;

function tripScheduleWakeCrashes<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(k: WorldKernel<S, C, E>): void {
  for (const slot of k.slots.values()) {
    if (k.boundary.takeCrash(slot.key, 'onNextScheduleWake')) {
      k.onBoundaryCrash?.(slot.key);
    }
  }
}

function bindScheduleInjectFor<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(schedule: BoundSchedule): (server: RoomServer<S, C, E, string>) => void {
  return (s) => {
    schedule.bindInject((cmd) =>
      s.injectCommand({
        id: cmd.id,
        payload: cmd.payload as C,
        identity: cmd.identity,
      })
    );
  };
}

function createWorldServer<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(args: {
  readonly topic: string;
  readonly module: WorldKernel<S, C, E>['module'];
  readonly storage: WorldKernel<S, C, E>['storage'];
  readonly clock: WorldKernel<S, C, E>['clock'];
  readonly handler: BoundSchedule['handler'];
  readonly authorize?: RoomSimAuthorize;
}): RoomServer<S, C, E, string> {
  return new RoomServer<S, C, E, string>({
    topic: args.topic,
    module: args.module,
    storage: args.storage,
    clock: args.clock,
    effectHandlers: [args.handler],
    ...(args.authorize !== undefined ? { authorize: args.authorize } : {}),
  });
}

function createWorldNetwork(
  now: () => number,
  netRng: SeededRng,
  mildFaults?: boolean
): SimRoomNetwork {
  const network = new SimRoomNetwork(now, netRng);
  if (mildFaults === true) {
    network.setDefaultFaults(MILD_ROOM_FAULTS);
  }
  return network;
}

function wireBoundaryCrash<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(k: WorldKernel<S, C, E>): void {
  k.onBoundaryCrash = (clientKey) => {
    const slot = k.slots.get(clientKey);
    if (slot === undefined || slot.crashed) return;
    // Sync: next dispatch must see room === null (no race with void crashClient).
    crashClientSync(k, slot);
  };
}

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
        if (holder.k !== null) tripScheduleWakeCrashes(holder.k);
        await work();
      });
    },
  });
  const server = createWorldServer({
    topic,
    module: args.module,
    storage,
    clock: adapters.clock,
    handler: schedule.handler,
    ...(args.authorize !== undefined ? { authorize: args.authorize } : {}),
  });
  const bindScheduleInject = bindScheduleInjectFor<S, C, E>(schedule);
  bindScheduleInject(server);
  await server.hydrateFromStorage();
  const network = createWorldNetwork(
    () => adapters.clock.now(),
    adapters.rng.fork('net'),
    args.mildFaults
  );
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
  };
  wireBoundaryCrash(k);
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
      slot.connectionId = '';
    }
    slot.transport?.softDisconnect();
  }
  k.serverCrashed = true;
  await drainRoomSim(makeDrainCtx(k)());
}

async function recreateWorldServer<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(k: WorldKernel<S, C, E>, boot: KernelBootArgs<S, C, E>): Promise<void> {
  const schedule = createTimerScheduleStack({
    clock: k.clock,
    timers: k.timers,
    createId: k.createId,
    topic: k.topic,
    enqueueWake: (work) => {
      void k.serverQueue.enqueue(async () => {
        tripScheduleWakeCrashes(k);
        await work();
      });
    },
  });
  k.scheduleDispose();
  k.scheduleDispose = schedule.dispose;
  const server = createWorldServer({
    topic: k.topic,
    module: boot.module,
    storage: k.storage,
    clock: k.clock,
    handler: schedule.handler,
    ...(boot.authorize !== undefined ? { authorize: boot.authorize } : {}),
  });
  k.bindScheduleInject = bindScheduleInjectFor(schedule);
  k.bindScheduleInject(server);
  await server.hydrateFromStorage();
  k.server = server;
  k.serverCrashed = false;
  rebindLiveConnections(k);
}

async function prepareWorldForSettle<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(k: WorldKernel<S, C, E>, recreateServer: () => Promise<void>): Promise<void> {
  k.boundary.clearCrashArms();
  if (k.serverCrashed) {
    await recreateServer();
  }
  for (const slot of k.slots.values()) {
    if (slot.crashed || slot.room === null) {
      await restartClient(k, slot);
    }
  }
}

function makeWorldDispose<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(k: WorldKernel<S, C, E>): () => Promise<void> {
  let disposed = false;
  return async () => {
    if (disposed) return;
    disposed = true;
    for (const slot of [...k.slots.values()]) {
      await destroyClient(k, slot);
    }
    k.slots.clear();
    k.handles.clear();
    k.scheduleDispose();
  };
}

function worldDomainQueries<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(k: WorldKernel<S, C, E>) {
  return {
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
    checkInvariants: async () => {
      for (const slot of k.slots.values()) {
        if (slot.room !== null) await slot.room.flushIo();
      }
      return checkRoomInvariants({
        module: k.module,
        storage: k.storage,
        topic: k.topic,
        server: k.server,
        seed: k.seed,
        clients: [...k.slots.values()].map((s) => ({
          key: s.key,
          room: s.room,
          clientStorage: s.clientStorage,
          crashed: s.crashed,
        })),
      });
    },
  };
}

async function ensureWorldClientConnected<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(k: WorldKernel<S, C, E>, key: string): Promise<void> {
  const slot = k.slots.get(key);
  if (slot === undefined) return;
  if (slot.crashed || slot.room === null) {
    await restartClient(k, slot);
    return;
  }
  // Soft cycle so a welcome is resent after heal (e.g. takeOver under down).
  await softDisconnectClient(k, slot);
  await softReconnectClient(k, slot);
}

async function assertWorldConverged<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(
  k: WorldKernel<S, C, E>,
  prepareForSettle: () => Promise<void>
): Promise<void> {
  await assertRoomConverged({
    ...makeDrainCtx(k)(),
    module: k.module,
    storage: k.storage,
    topic: k.topic,
    getServer: () => k.server,
    prepareForSettle,
    ensureConnected: (key) => ensureWorldClientConnected(k, key),
  });
}

function isAppArgs(args: OpenWorldArgs): args is {
  readonly seed: number | bigint | string;
  readonly app: RoomDstApp;
  readonly knobs?: RoomWorldKnobs;
  readonly topic?: string;
  readonly startMs?: number;
  readonly storage?: InMemoryRoomStorage;
} {
  return 'app' in args && args.app !== undefined;
}

function resolveModuleBoot(
  args: OpenWorldArgs
): OpenWorldModuleArgs<RoomState, RoomCommandPayload, RoomEvent> {
  if (isAppArgs(args)) {
    const knobs = args.knobs ?? { clientCount: 2, mildFaults: false };
    return {
      seed: args.seed,
      module: args.app.module,
      mildFaults: knobs.mildFaults,
      ...(args.topic !== undefined ? { topic: args.topic } : {}),
      ...(args.startMs !== undefined ? { startMs: args.startMs } : {}),
      ...(args.storage !== undefined ? { storage: args.storage } : {}),
      ...(args.app.authorize !== undefined
        ? { authorize: args.app.authorize }
        : {}),
    };
  }
  if (!('module' in args) || args.module === undefined) {
    throw new Error('openWorld requires module or app');
  }
  return args;
}

/**
 * Open a multi-client deterministic room world (TigerBeetle-style DST).
 * Pass `app` for PBT/DST (boots `c0…` + playActions / runCommands).
 * One seed → identical timeline. Use `await using` for cleanup.
 */
export async function openWorld<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(args: OpenWorldModuleArgs<S, C, E>): Promise<World<S, C, E>>;
export async function openWorld(args: OpenWorldAppArgs): Promise<World>;
export async function openWorld(args: OpenWorldArgs): Promise<World> {
  const boot = resolveModuleBoot(args);
  const k = await createWorldKernel(boot);
  const recreateServer = (): Promise<void> => recreateWorldServer(k, boot);
  const prepareForSettle = (): Promise<void> =>
    prepareWorldForSettle(k, recreateServer);
  const clientIds: string[] = [];
  const knobs: RoomWorldKnobs | null = isAppArgs(args)
    ? (args.knobs ?? { clientCount: 2, mildFaults: false })
    : null;
  const world = assembleWorld(k, {
    ...(isAppArgs(args) ? { dstApp: args.app } : {}),
    knobs,
    clientIds,
    addClient: (a) => addWorldClient(k, a),
    recreateServer,
    prepareForSettle,
    assertConverged: () => assertWorldConverged(k, prepareForSettle),
    serverCrash: () => serverCrashImpl(k),
    dispose: makeWorldDispose(k),
    domainQueries: worldDomainQueries(k),
    drainCtx: makeDrainCtx(k),
  });
  if (isAppArgs(args)) {
    const count = knobs?.clientCount ?? 2;
    for (let i = 0; i < count; i += 1) {
      const id = `c${i}`;
      await world.addClient({ id, identity: id, clientId: id });
      clientIds.push(id);
    }
  }
  return world;
}
