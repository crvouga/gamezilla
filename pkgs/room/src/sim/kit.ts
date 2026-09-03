import type { Session } from '@pkgs/dst';
import { asSeededRng } from '@pkgs/dst/kernel';

import { InMemoryClientStorage } from '../client/adapters/storage/memory';
import { createTimerScheduleStack } from '../effects/timer-schedule-stack';
import { InMemoryRoomStorage } from '../server/adapters/memory';
import { RoomServer } from '../server/core/room-server';
import type { RoomCommandPayload, RoomEvent, RoomState } from '../types';

import { createRoomBoundaryFaultController } from './boundary-faults';
import { checkRoomInvariants } from './invariants';
import type {
  OpenKitArgs,
  RoomKit,
  RoomKitDeps,
  RoomSimAuthorize,
  RoomSimClientHandle,
} from './kit-api';
import {
  attachClient,
  buildClientHandle,
  crashClientSync,
  destroyClient,
  type RoomKernel,
  restartClient,
  softDisconnectClient,
  softReconnectClient,
} from './kit-clients';
import { assembleKit } from './kit-facade';
import {
  MILD_ROOM_FAULTS,
  type SimRoomNetwork,
  wrapRoomNetwork,
} from './network';
import { SerialQueue } from './serial-queue';
import {
  drainRoomSim,
  foldServerDomainState,
  type RoomSimClientSlot,
  reviveRoom,
  serverDomainHash,
} from './settle';

type KernelBootArgs<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
> = OpenKitArgs<S, C, E>;

type BoundSchedule = ReturnType<typeof createTimerScheduleStack>;

function tripScheduleWakeCrashes<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(k: RoomKernel<S, C, E>): void {
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

function createKitServer<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(args: {
  readonly topic: string;
  readonly module: RoomKernel<S, C, E>['module'];
  readonly storage: RoomKernel<S, C, E>['storage'];
  readonly clock: RoomKernel<S, C, E>['clock'];
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

function resolveKitPorts(
  session: Session,
  mildFaults: boolean
): { readonly deps: RoomKitDeps; readonly network: SimRoomNetwork } {
  const node = session.fork('server');
  const rng = asSeededRng(node.ports.rng);
  const scheduler = session.scheduler.underlying;
  return {
    deps: {
      seed: rng.seed,
      clock: session.ports.clock,
      scheduler,
      timers: session.ports.timers,
      rng,
      createId: node.ports.createId,
    },
    network: wrapRoomNetwork({
      kernel: session.network,
      scheduler,
      ...(mildFaults ? { faults: MILD_ROOM_FAULTS } : {}),
    }),
  };
}

function wireBoundaryCrash<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(k: RoomKernel<S, C, E>): void {
  k.onBoundaryCrash = (clientKey) => {
    const slot = k.slots.get(clientKey);
    if (slot === undefined || slot.crashed) return;
    // Sync: next dispatch must see room === null (no race with void crashClient).
    crashClientSync(k, slot);
  };
}

async function createRoomKernel<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(args: KernelBootArgs<S, C, E>): Promise<RoomKernel<S, C, E>> {
  const { deps, network } = resolveKitPorts(
    args.session,
    args.mildFaults === true
  );
  const topic = args.topic ?? `sim:${deps.createId()}`;
  const storage = args.storage ?? new InMemoryRoomStorage();
  const serverQueue = new SerialQueue();
  const boundary = createRoomBoundaryFaultController();
  // Holder so schedule wake can see the kernel before assignment completes.
  const holder: { k: RoomKernel<S, C, E> | null } = { k: null };
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
  const server = createKitServer({
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
  const k: RoomKernel<S, C, E> = {
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
>(k: RoomKernel<S, C, E>) {
  return () => ({
    seed: k.seed,
    now: () => k.clock.now(),
    network: k.network,
    scheduler: k.scheduler,
    serverQueue: k.serverQueue,
    clients: k.slots,
  });
}

async function addKitClient<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(
  k: RoomKernel<S, C, E>,
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
>(k: RoomKernel<S, C, E>): Promise<void> {
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

async function recreateKitServer<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(k: RoomKernel<S, C, E>, boot: KernelBootArgs<S, C, E>): Promise<void> {
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
  const server = createKitServer({
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
  for (const slot of k.slots.values()) {
    if (slot.crashed || slot.room === null || slot.transport === null) continue;
    if (slot.connectionId.length === 0) {
      await softReconnectClient(k, slot);
      continue;
    }
    // Already had a live connection id (rare) — re-register on the new server.
    const transport = slot.transport;
    k.server.registerConnection(
      slot.connectionId,
      (msg) => {
        transport.enqueueFromServer(msg);
      },
      { id: slot.identity, clientId: slot.clientId },
      { silent: true }
    );
  }
}

async function prepareKitForSettle<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(k: RoomKernel<S, C, E>, recreateServer: () => Promise<void>): Promise<void> {
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

function makeKitDispose<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(k: RoomKernel<S, C, E>): () => Promise<void> {
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

function domainQueriesOf<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(k: RoomKernel<S, C, E>) {
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

async function ensureKitClientConnected<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(k: RoomKernel<S, C, E>, key: string): Promise<void> {
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

async function reviveKit<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(
  k: RoomKernel<S, C, E>,
  prepareForSettle: () => Promise<void>
): Promise<void> {
  await reviveRoom({
    ...makeDrainCtx(k)(),
    module: k.module,
    storage: k.storage,
    topic: k.topic,
    getServer: () => k.server,
    prepareForSettle,
    ensureConnected: (key) => ensureKitClientConnected(k, key),
  });
}

/**
 * Boot the multi-client kit room from a DST session.
 * Clients are added explicitly via {@link RoomKit.addClient}.
 */
export async function createRoomKit<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(args: OpenKitArgs<S, C, E>): Promise<RoomKit<S, C, E>> {
  const k = await createRoomKernel(args);
  const recreateServer = (): Promise<void> => recreateKitServer(k, args);
  const prepareForSettle = (): Promise<void> =>
    prepareKitForSettle(k, recreateServer);
  const kit = assembleKit(k, {
    addClient: (a) => addKitClient(k, a),
    recreateServer,
    prepareForSettle,
    revive: () => reviveKit(k, prepareForSettle),
    serverCrash: () => serverCrashImpl(k),
    dispose: makeKitDispose(k),
    domainQueries: domainQueriesOf(k),
    drainCtx: makeDrainCtx(k),
  });
  bindKitDispose(args.session, kit);
  return kit;
}

function bindKitDispose(
  session: Session,
  kit: { dispose: () => Promise<void> }
): void {
  const orig = session.dispose.bind(session);
  const bag = session as { dispose: () => Promise<void> };
  bag.dispose = async () => {
    await kit.dispose();
    await orig();
  };
}
