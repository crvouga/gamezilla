import type { Scheduler as VirtualScheduler } from '@pkgs/harness-root-shared/scheduler';
import type { InMemoryClientStorage } from '@pkgs/room-adapter-memory-shared/client-storage';
import type { InMemoryRoomStorage } from '@pkgs/room-adapter-memory-shared/room-storage';
import type { RoomClient } from '@pkgs/room-root-client/room-client';
import {
  RoomMetaAttr,
  roomAttrNamespace,
} from '@pkgs/room-root-client/room-meta';
import type { RoomServer } from '@pkgs/room-root-server/room-server';
import {
  entriesFor,
  RoomEventWithheld,
} from '@pkgs/room-root-shared/private-events';
import type {
  RoomCommandPayload,
  RoomEvent,
  RoomModule,
  RoomState,
} from '@pkgs/room-root-shared/types';
import type { HarnessLoopbackRoomTransport } from './loopback-transport';
import type { HarnessRoomNetwork } from './network';
import type { SerialQueue } from './serial-queue';

const MAX_DRAIN_ROUNDS = 500;

export type RoomHarnessClientSlot<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
> = {
  readonly key: string;
  room: RoomClient<S, C, E, string> | null;
  transport: HarnessLoopbackRoomTransport<S, C, E> | null;
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

/**
 * The domain hash of the log as `viewer` receives it: what a client of that
 * actor must converge to when the module keeps some events private.
 */
export async function viewerDomainHash<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(args: {
  readonly module: RoomModule<S, C, E, string>;
  readonly storage: InMemoryRoomStorage;
  readonly topic: string;
  readonly viewer: string;
}): Promise<string> {
  const entries = await args.storage.loadEventsAfter(args.topic, 0);
  let state = args.module.initialState();
  for (const e of entriesFor(args.module, entries, args.viewer)) {
    if (!RoomEventWithheld.is(e.event))
      state = args.module.reduce(state, e.event as E);
  }
  return args.module.hash(state);
}

export type DrainCtx<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
> = {
  readonly seed: bigint;
  readonly now: () => number;
  readonly network: HarnessRoomNetwork;
  readonly scheduler: VirtualScheduler;
  readonly serverQueue: SerialQueue;
  readonly clients: ReadonlyMap<string, RoomHarnessClientSlot<S, C, E>>;
};

async function flushClientIoAndTransports<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(clients: ReadonlyMap<string, RoomHarnessClientSlot<S, C, E>>): Promise<void> {
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
>(clients: ReadonlyMap<string, RoomHarnessClientSlot<S, C, E>>): Promise<void> {
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
export async function drainRoomHarness<
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
    // Nudge 1ms so delayed frames become due (legacy HarnessRoomNetwork behavior).
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
>(clients: ReadonlyMap<string, RoomHarnessClientSlot<S, C, E>>): boolean {
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
    await drainRoomHarness(ctx);
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
  await drainRoomHarness(ctx);
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
    const expected =
      ctx.module.audience === undefined
        ? serverHash
        : await viewerDomainHash({
            module: ctx.module,
            storage: ctx.storage,
            topic: ctx.topic,
            viewer: slot.identity,
          });
    if (clientDomainHash(ctx.module, slot.room) !== expected) return false;
    if (slot.room.getLastSeq() !== serverTip) return false;
    const memory = slot.room.getPendingQueueIds();
    const durable = await slot.clientStorage.loadQueued();
    if (memory.length > 0 || durable.length > 0) return false;
  }
  return true;
}
