import type { InMemoryClientStorage } from '../client/adapters/storage/memory';
import type { RoomClient } from '../client/core/room-client';
import { RoomMetaAttr, roomAttrNamespace } from '../client/core/room-meta';
import type { InMemoryRoomStorage } from '../server/adapters/memory';
import type { RoomServer } from '../server/core/room-server';
import type {
  RoomCommandPayload,
  RoomEvent,
  RoomModule,
  RoomState,
} from '../types';

import type { SimRoomNetwork } from './network';
import type { SerialQueue } from './serial-queue';
import type { SimLoopbackRoomTransport } from './sim-loopback-transport';

const MAX_DRAIN_ROUNDS = 500;

export type RoomSimClientSlot<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
> = {
  readonly key: string;
  room: RoomClient<S, C, E, string> | null;
  transport: SimLoopbackRoomTransport<S, C, E> | null;
  /** Persisted across crash/restart so offline queues survive process death. */
  clientStorage: InMemoryClientStorage;
  connectionId: string;
  identity: string;
  clientId: string;
  crashed: boolean;
  scheduleDispose?: () => void;
};

function stripRoomMeta(state: RoomState): RoomState {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(state)) {
    if (!roomAttrNamespace.ownsKey(k)) out[k] = v;
  }
  return out as RoomState;
}

export function clientDomainHash<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(
  module: RoomModule<S, C, E, string>,
  room: RoomClient<S, C, E, string>
): string {
  return module.hash(stripRoomMeta(room.getSnapshot()) as S);
}

/** Fold the committed log from storage into domain state (log truth). */
export async function foldServerDomainState<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(args: {
  readonly module: RoomModule<S, C, E, string>;
  readonly storage: InMemoryRoomStorage;
  readonly topic: string;
}): Promise<S> {
  const entries = await args.storage.loadEventsAfter(args.topic, 0);
  let state = args.module.initialState();
  for (const e of entries) {
    state = args.module.reduce(state, e.event as E);
  }
  return state;
}

export async function serverDomainHash<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(args: {
  readonly module: RoomModule<S, C, E, string>;
  readonly storage: InMemoryRoomStorage;
  readonly topic: string;
}): Promise<string> {
  const state = await foldServerDomainState(args);
  return args.module.hash(state);
}

export type DrainCtx<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
> = {
  readonly seed: bigint;
  readonly now: () => number;
  readonly network: SimRoomNetwork;
  readonly serverQueue: SerialQueue;
  readonly clockAdvance: (ms: number) => void;
  readonly clients: ReadonlyMap<string, RoomSimClientSlot<S, C, E>>;
};

async function flushClientIoAndTransports<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(clients: ReadonlyMap<string, RoomSimClientSlot<S, C, E>>): Promise<void> {
  const flushes: Promise<void>[] = [];
  for (const slot of clients.values()) {
    if (slot.transport !== null) {
      flushes.push(slot.transport.flushSendChain());
    }
    if (slot.room !== null) {
      flushes.push(slot.room.flushIo());
    }
  }
  await Promise.all(flushes);
}

async function flushClientIoOnly<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(clients: ReadonlyMap<string, RoomSimClientSlot<S, C, E>>): Promise<void> {
  for (const slot of clients.values()) {
    if (slot.room !== null) await slot.room.flushIo();
  }
}

/** Pump microtasks + net deliveries until idle (or cap). */
export async function drainRoomSim<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(ctx: DrainCtx<S, C, E>): Promise<void> {
  for (let round = 0; round < MAX_DRAIN_ROUNDS; round += 1) {
    await Promise.resolve();
    ctx.network.flushDue(ctx.now());
    await flushClientIoAndTransports(ctx.clients);
    await ctx.serverQueue.flush();
    await Promise.resolve();
    const delivered = ctx.network.flushDue(ctx.now());
    if (delivered === 0 && ctx.network.scheduledCount() === 0) {
      // One more microtask wave for welcome IIFEs scheduled after flush.
      await Promise.resolve();
      await Promise.resolve();
      ctx.network.flushDue(ctx.now());
      // Drain client IO that welcome delivery may have enqueued.
      await flushClientIoOnly(ctx.clients);
      if (ctx.network.scheduledCount() === 0) return;
    }
    if (ctx.network.scheduledCount() > 0) {
      ctx.clockAdvance(1);
    }
  }
  throw new Error(
    `drain timeout seed=${ctx.seed.toString(16)} now=${String(ctx.now())} scheduled=${String(ctx.network.scheduledCount())} pending=${String(ctx.network.pendingCount())}`
  );
}

export type ConvergeCtx<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
> = DrainCtx<S, C, E> & {
  readonly module: RoomModule<S, C, E, string>;
  readonly storage: InMemoryRoomStorage;
  readonly topic: string;
  /** Live server lookup — must not capture a pre-restart reference. */
  readonly getServer: () => RoomServer<S, C, E, string>;
  readonly ensureConnected: (key: string) => Promise<void>;
  /** Clear one-shot arms + revive crashed nodes before hash settle. */
  readonly prepareForSettle?: () => Promise<void>;
};

function clientsAllSynced<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(clients: ReadonlyMap<string, RoomSimClientSlot<S, C, E>>): boolean {
  for (const slot of clients.values()) {
    if (slot.room === null) return false;
    if (!RoomMetaAttr.isSynced.from(slot.room.getSnapshot())) return false;
  }
  return true;
}

async function nudgeUntilSynced<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(ctx: DrainCtx<S, C, E>): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await drainRoomSim(ctx);
    if (clientsAllSynced(ctx.clients)) return;
    ctx.clockAdvance(25);
  }
}

function assertSlotMatchesServer<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(
  ctx: ConvergeCtx<S, C, E>,
  slot: RoomSimClientSlot<S, C, E>,
  serverHash: string,
  serverTip: number
): void {
  if (slot.room === null) {
    throw new Error(
      `assertConverged: missing room key=${slot.key} seed=${ctx.seed.toString(16)}`
    );
  }
  if (!RoomMetaAttr.isSynced.from(slot.room.getSnapshot())) {
    throw new Error(
      `assertConverged: client not synced key=${slot.key} seed=${ctx.seed.toString(16)} now=${String(ctx.now())}`
    );
  }
  const clientHash = clientDomainHash(ctx.module, slot.room);
  if (clientHash !== serverHash) {
    throw new Error(
      `assertConverged: hash mismatch key=${slot.key} client=${clientHash} server=${serverHash} seed=${ctx.seed.toString(16)} now=${String(ctx.now())}`
    );
  }
  if (slot.room.getLastSeq() !== serverTip) {
    throw new Error(
      `assertConverged: client-lastseq-equals-server-tip key=${slot.key} client=${String(slot.room.getLastSeq())} tip=${String(serverTip)} seed=${ctx.seed.toString(16)}`
    );
  }
}

async function assertHealedQueueDrained<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(ctx: ConvergeCtx<S, C, E>, slot: RoomSimClientSlot<S, C, E>): Promise<void> {
  if (slot.room === null) return;
  await slot.room.flushIo();
  const memory = slot.room.getPendingQueueIds();
  const durable = await slot.clientStorage.loadQueued();
  if (memory.length > 0 || durable.length > 0) {
    throw new Error(
      `assertConverged: healed-queue-drained key=${slot.key} memory=${String(memory.length)} durable=${String(durable.length)} seed=${ctx.seed.toString(16)}`
    );
  }
}

export async function assertRoomConverged<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(ctx: ConvergeCtx<S, C, E>): Promise<void> {
  if (ctx.prepareForSettle !== undefined) {
    await ctx.prepareForSettle();
  }
  ctx.network.healAll();
  // Deliver frames released from hold/delay BEFORE soft-cycling connections
  // (otherwise pending deliver callbacks see a stale/missing connectionId).
  await drainRoomSim(ctx);
  for (const key of ctx.clients.keys()) {
    await ctx.ensureConnected(key);
  }

  // Nudge a few drain rounds so welcome/sync can complete after soft cycles.
  await nudgeUntilSynced(ctx);

  const serverHash = await serverDomainHash({
    module: ctx.module,
    storage: ctx.storage,
    topic: ctx.topic,
  });
  const liveHash = ctx.module.hash(ctx.getServer().getCommittedState());
  if (liveHash !== serverHash) {
    throw new Error(
      `assertConverged: live committed diverged from log fold live=${liveHash} log=${serverHash} seed=${ctx.seed.toString(16)} now=${String(ctx.now())}`
    );
  }

  const serverTip = await ctx.storage.getLastSeq(ctx.topic);
  for (const slot of ctx.clients.values()) {
    assertSlotMatchesServer(ctx, slot, serverHash, serverTip);
    await assertHealedQueueDrained(ctx, slot);
  }
}
