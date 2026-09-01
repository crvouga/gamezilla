import { createSimDeps, type SimDeps } from '@pkgs/determinism';
import type { SeededRng } from '@pkgs/uuid';

import { InMemoryClientStorage } from '../client/adapters/storage/memory';
import { createTimerScheduleStack } from '../effects/timer-schedule-stack';
import { InMemoryRoomStorage } from '../server/adapters/memory';
import { RoomServer } from '../server/core/room-server';
import type { RoomCommandPayload, RoomEvent, RoomState } from '../types';

import { createRoomBoundaryFaultController } from './boundary-faults';
import { checkRoomInvariants } from './invariants';
import {
  createSimRoomNetwork,
  MILD_ROOM_FAULTS,
  type SimRoomNetwork,
} from './network';
import { SerialQueue } from './serial-queue';
import {
  assertRoomConverged,
  drainRoomSim,
  foldServerDomainState,
  type RoomSimClientSlot,
  serverDomainHash,
} from './settle';
import type {
  OpenWorldArgs,
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

const WORLD_START_MS = 1_700_000_000_000;

type KernelBootArgs<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
> = OpenWorldArgs<S, C, E>;

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
  scheduler: WorldKernel<RoomState, RoomCommandPayload, RoomEvent>['scheduler'],
  netRng: SeededRng,
  mildFaults?: boolean
): SimRoomNetwork {
  return createSimRoomNetwork({
    scheduler,
    rng: netRng,
    ...(mildFaults === true ? { faults: MILD_ROOM_FAULTS } : {}),
  });
}

function resolveWorldPorts<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(
  args: KernelBootArgs<S, C, E>
): { readonly deps: SimDeps; readonly network: SimRoomNetwork } {
  const injected = args.injected;
  if (injected !== undefined) return injected;
  const deps = createSimDeps({
    seed: args.seed,
    startMs: args.startMs ?? WORLD_START_MS,
  });
  return {
    deps,
    network: createWorldNetwork(
      deps.scheduler,
      deps.rng.fork('net'),
      args.mildFaults
    ),
  };
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
  const { deps, network } = resolveWorldPorts(args);
  const topic = args.topic ?? `sim:${deps.createId()}`;
  const storage = args.storage ?? new InMemoryRoomStorage();
  const serverQueue = new SerialQueue();
  const boundary = createRoomBoundaryFaultController();
  // Holder so schedule wake can see the kernel before assignment completes.
  const holder: { k: WorldKernel<S, C, E> | null } = { k: null };
  const schedule = createTimerScheduleStack({
    clock: deps.clock,
    timers: deps.timers,
    createId: deps.createId,
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
    clock: deps.clock,
    handler: schedule.handler,
    ...(args.authorize !== undefined ? { authorize: args.authorize } : {}),
  });
  const bindScheduleInject = bindScheduleInjectFor<S, C, E>(schedule);
  bindScheduleInject(server);
  await server.hydrateFromStorage();
  network.registerServer(async (msg) => {
    await serverQueue.enqueue(() =>
      (holder.k?.server ?? server).handleClientMessage(
        msg.connectionId,
        msg.identity,
        msg.payload
      )
    );
  });
  const k: WorldKernel<S, C, E> = {
    seed: deps.seed,
    topic,
    module: args.module,
    clock: deps.clock,
    scheduler: deps.scheduler,
    timers: deps.timers,
    createId: deps.createId,
    rng: deps.rng,
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
    scheduler: k.scheduler,
    serverQueue: k.serverQueue,
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

/**
 * Boot the multi-client kit room world (TigerBeetle-style deterministic sim).
 * Internal — framework worlds use `openWorld` from `@pkgs/determinism` +
 * {@link defineRoomSystem}; node kinds and module conformance call this.
 *
 * Clients are added explicitly via {@link World.addClient}. Generated system
 * topologies come from `defineRoomSystem` (`sim/system`), which boots `room.server`
 * / `room.client` node kinds on top of this function.
 */
export async function bootRoomKitWorld<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(args: OpenWorldArgs<S, C, E>): Promise<World<S, C, E>> {
  const k = await createWorldKernel(args);
  const recreateServer = (): Promise<void> => recreateWorldServer(k, args);
  const prepareForSettle = (): Promise<void> =>
    prepareWorldForSettle(k, recreateServer);
  return assembleWorld(k, {
    addClient: (a) => addWorldClient(k, a),
    recreateServer,
    prepareForSettle,
    assertConverged: () => assertWorldConverged(k, prepareForSettle),
    serverCrash: () => serverCrashImpl(k),
    dispose: makeWorldDispose(k),
    domainQueries: worldDomainQueries(k),
    drainCtx: makeDrainCtx(k),
  });
}
