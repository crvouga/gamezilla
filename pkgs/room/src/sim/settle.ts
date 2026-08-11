import type { Room } from '../client/core/room';
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
  room: Room<S, C, E, string> | null;
  transport: SimLoopbackRoomTransport<S, C, E> | null;
  connectionId: string;
  identity: string;
  clientId: string;
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
>(module: RoomModule<S, C, E, string>, room: Room<S, C, E, string>): string {
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

/** Pump microtasks + net deliveries until idle (or cap). */
export async function drainRoomSim<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(ctx: DrainCtx<S, C, E>): Promise<void> {
  for (let round = 0; round < MAX_DRAIN_ROUNDS; round += 1) {
    await Promise.resolve();
    ctx.network.flushDue(ctx.now());
    const flushes: Promise<void>[] = [];
    for (const slot of ctx.clients.values()) {
      if (slot.transport !== null) {
        flushes.push(slot.transport.flushSendChain());
      }
    }
    await Promise.all(flushes);
    await ctx.serverQueue.flush();
    await Promise.resolve();
    const delivered = ctx.network.flushDue(ctx.now());
    if (delivered === 0 && ctx.network.scheduledCount() === 0) {
      // One more microtask wave for welcome IIFEs scheduled after flush.
      await Promise.resolve();
      await Promise.resolve();
      ctx.network.flushDue(ctx.now());
      if (ctx.network.scheduledCount() === 0) return;
    }
    if (ctx.network.scheduledCount() > 0) {
      // Advance to next pending frame time if delayed.
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
  readonly server: RoomServer<S, C, E, string>;
  readonly ensureConnected: (key: string) => Promise<void>;
};

export async function assertRoomConverged<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(ctx: ConvergeCtx<S, C, E>): Promise<void> {
  ctx.network.healAll();
  for (const key of ctx.clients.keys()) {
    await ctx.ensureConnected(key);
  }
  await drainRoomSim(ctx);

  const serverHash = await serverDomainHash({
    module: ctx.module,
    storage: ctx.storage,
    topic: ctx.topic,
  });
  const liveHash = ctx.module.hash(ctx.server.getCommittedState());
  if (liveHash !== serverHash) {
    throw new Error(
      `assertConverged: live committed diverged from log fold live=${liveHash} log=${serverHash} seed=${ctx.seed.toString(16)} now=${String(ctx.now())}`
    );
  }

  for (const slot of ctx.clients.values()) {
    if (slot.room === null) {
      throw new Error(
        `assertConverged: missing room key=${slot.key} seed=${ctx.seed.toString(16)}`
      );
    }
    const snap = slot.room.getSnapshot();
    if (!RoomMetaAttr.isSynced.from(snap)) {
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
  }
}
