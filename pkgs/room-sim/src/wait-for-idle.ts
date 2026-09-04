import {
  type RoomClient,
  type RoomCommandPayload,
  type RoomEvent,
  RoomMetaAttr,
  type RoomModule,
  type RoomState,
  roomAttrNamespace,
} from '@pkgs/room';
import type { RoomServer } from '@pkgs/room/server';
import type {
  InMemoryClientStorage,
  InMemoryRoomStorage,
} from '@pkgs/room-adapter-memory';
import type { VirtualScheduler } from '@pkgs/sim';
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
  readonly scheduler: VirtualScheduler;
  readonly serverQueue: SerialQueue;
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

/** Flush promise-chain IO outside the scheduler heap (safe under drain gate). */
export async function flushRoomAux<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(ctx: Pick<DrainCtx<S, C, E>, 'clients' | 'serverQueue'>): Promise<void> {
  await flushClientIoAndTransports(ctx.clients);
  await ctx.serverQueue.flush();
}

/**
 * Pump client/server IO + due scheduler work until idle (or cap).
 * Advances virtual time only while network packets are in flight — not for
 * unrelated timers (match-clock FlagFall, etc.).
 */
export async function drainRoomSim<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(ctx: DrainCtx<S, C, E>): Promise<void> {
  for (let round = 0; round < MAX_DRAIN_ROUNDS; round += 1) {
    await Promise.resolve();
    await flushRoomAux(ctx);
    await Promise.resolve();
    await ctx.scheduler.runFor(0);
    await flushRoomAux(ctx);
    if (ctx.network.netPendingCount() === 0) {
      await Promise.resolve();
      await Promise.resolve();
      await flushClientIoOnly(ctx.clients);
      await ctx.scheduler.runFor(0);
      await flushRoomAux(ctx);
      if (ctx.network.netPendingCount() === 0) return;
      continue;
    }
    // Nudge 1ms so delayed frames become due (legacy SimRoomNetwork behavior).
    await ctx.scheduler.runFor(1);
  }
  throw new Error(
    `drain timeout seed=${ctx.seed.toString(16)} now=${String(ctx.now())} pending=${String(ctx.scheduler.pendingTaskCount())} net=${String(ctx.network.netPendingCount())} held=${ctx.network.heldSummary().join(',')}`
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
  /** Clear one-shot arms + recoverAll crashed nodes before hash settle. */
  readonly prepareForIdle?: () => Promise<void>;
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
    await ctx.scheduler.runFor(25);
  }
}

export async function recoverAllRoom<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(ctx: ConvergeCtx<S, C, E>): Promise<void> {
  if (ctx.prepareForIdle !== undefined) {
    await ctx.prepareForIdle();
  }
  ctx.network.restoreAllNetwork();
  // Deliver frames released from hold/delay BEFORE soft-cycling connections
  // (otherwise pending deliver callbacks see a stale/missing connectionId).
  await drainRoomSim(ctx);
  for (const key of ctx.clients.keys()) {
    await ctx.ensureConnected(key);
  }
  await nudgeUntilSynced(ctx);
}

/** Pure hash / seq / queue agreement check — never heals or reconnects. */
export async function checkRoomConverged<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(ctx: ConvergeCtx<S, C, E>): Promise<boolean> {
  const serverHash = await serverDomainHash({
    module: ctx.module,
    storage: ctx.storage,
    topic: ctx.topic,
  });
  const liveHash = ctx.module.hash(ctx.getServer().getCommittedState());
  if (liveHash !== serverHash) return false;

  const serverTip = await ctx.storage.getLastSeq(ctx.topic);
  for (const slot of ctx.clients.values()) {
    if (slot.room === null) return false;
    if (!RoomMetaAttr.isSynced.from(slot.room.getSnapshot())) return false;
    if (clientDomainHash(ctx.module, slot.room) !== serverHash) return false;
    if (slot.room.getLastSeq() !== serverTip) return false;
    const memory = slot.room.getPendingQueueIds();
    const durable = await slot.clientStorage.loadQueued();
    if (memory.length > 0 || durable.length > 0) return false;
  }
  return true;
}
