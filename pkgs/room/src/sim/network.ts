import {
  createSimNetwork as createDstNetwork,
  createNetEffect,
  type SimNetwork as DstNetwork,
  type NetEffect,
  RELIABLE_NET_FAULTS,
  type SimEndpointId,
  type SimNetFaultProfile,
  type SimNetKey,
  type SimScheduler,
} from '@pkgs/dst';
import type { SeededRng } from '@pkgs/uuid';

/** VOPR-style one-way link knobs for room loopback frames. */
export type RoomFaultProfile = {
  readonly oneWayDelayMeanMs: number;
  readonly oneWayDelayJitterMs: number;
  readonly packetLossProbability: number;
  /** Probability a frame is delivered out of FIFO order (extra delay). */
  readonly reorderProbability?: number;
  /** Probability a frame is delivered twice. */
  readonly duplicateProbability?: number;
};

export const RELIABLE_ROOM_FAULTS: RoomFaultProfile = {
  oneWayDelayMeanMs: 0,
  oneWayDelayJitterMs: 0,
  packetLossProbability: 0,
};

/** Mild fixed delay/loss for deterministic fault scenarios. */
export const MILD_ROOM_FAULTS: RoomFaultProfile = {
  oneWayDelayMeanMs: 5,
  oneWayDelayJitterMs: 5,
  packetLossProbability: 0.02,
};

export type RoomNetLinkState = 'ok' | 'hold' | 'down';

/** Per-direction link override; omit a side to use the shared link state. */
export type RoomNetDirectionalState = {
  readonly toServer?: RoomNetLinkState;
  readonly toClient?: RoomNetLinkState;
};

export type RoomNetSetArg =
  | RoomNetLinkState
  | RoomFaultProfile
  | RoomNetDirectionalState;

export type RoomNetDirection = 'toServer' | 'toClient';

export type RoomNetEffect = NetEffect;

export type RoomServerIngress = {
  readonly connectionId: string;
  readonly identity: string;
  readonly payload: unknown;
};

/** Opaque key: `clientKey\\0direction` — never parsed by the kernel. */
export function roomNetKey(
  clientKey: string,
  direction: RoomNetDirection
): SimNetKey {
  return `${clientKey}\0${direction}`;
}

export const ROOM_SERVER_ENDPOINT: SimEndpointId = 'room:server';

export function roomClientEndpoint(clientKey: string): SimEndpointId {
  return `room:client:${clientKey}`;
}

function isFaultProfile(v: RoomNetSetArg): v is RoomFaultProfile {
  return typeof v === 'object' && v !== null && 'oneWayDelayMeanMs' in v;
}

function isDirectional(v: RoomNetSetArg): v is RoomNetDirectionalState {
  return (
    typeof v === 'object' &&
    v !== null &&
    !('oneWayDelayMeanMs' in v) &&
    ('toServer' in v || 'toClient' in v)
  );
}

/** Map room fault fields → kernel profile. */
export function toKernelFaults(f: RoomFaultProfile): SimNetFaultProfile {
  const reorderP = f.reorderProbability ?? 0;
  return {
    oneWayDelayMeanMs: f.oneWayDelayMeanMs,
    oneWayDelayJitterMs: f.oneWayDelayJitterMs,
    packetLossProbability: f.packetLossProbability,
    duplicateProbability: f.duplicateProbability ?? 0,
    reorderWindowMs: reorderP > 0 ? 20 : 0,
    partitionProbability: 0,
    unpartitionProbability: 0,
  };
}

type LinkSnapshot = {
  readonly shared: RoomNetLinkState;
  readonly toServer: RoomNetLinkState | undefined;
  readonly toClient: RoomNetLinkState | undefined;
  readonly faults: RoomFaultProfile | undefined;
};

type RoomNetMaps = {
  readonly link: Map<string, RoomNetLinkState>;
  readonly dirToServer: Map<string, RoomNetLinkState>;
  readonly dirToClient: Map<string, RoomNetLinkState>;
  readonly nodeFaults: Map<string, RoomFaultProfile>;
};

type RoomNetCtx = RoomNetMaps & {
  readonly kernel: DstNetwork;
};

/**
 * Room-domain network: hold/down/faults keyed by client + direction.
 * Mechanics (delay/loss/dup/hold queues) live in `@pkgs/dst`.
 */
export type SimRoomNetwork = {
  readonly registerServer: (
    deliver: (msg: RoomServerIngress) => void | Promise<void>
  ) => void;
  readonly registerClient: (
    clientKey: string,
    deliver: (payload: unknown) => void | Promise<void>
  ) => void;
  readonly unregisterClient: (clientKey: string) => void;
  readonly sendToServer: (clientKey: string, msg: RoomServerIngress) => void;
  readonly sendToClient: (clientKey: string, payload: unknown) => void;
  readonly setDefaultFaults: (faults: RoomFaultProfile) => void;
  readonly set: (clientKey: string, next: RoomNetSetArg) => RoomNetEffect;
  readonly healAll: () => void;
  readonly linkState: (clientKey: string) => RoomNetLinkState;
  readonly heldSummary: () => readonly string[];
  readonly pendingCount: () => number;
  /** In-flight + held net work (excludes unrelated scheduler timers). */
  readonly netPendingCount: () => number;
};

export type SimRoomNetHandle = {
  readonly set: (next: RoomNetSetArg) => RoomNetEffect;
};

function linkStateOf(ctx: RoomNetCtx, clientKey: string): RoomNetLinkState {
  return ctx.link.get(clientKey) ?? 'ok';
}

function effectiveLink(
  ctx: RoomNetCtx,
  clientKey: string,
  direction: RoomNetDirection
): RoomNetLinkState {
  const dirMap = direction === 'toServer' ? ctx.dirToServer : ctx.dirToClient;
  return dirMap.get(clientKey) ?? linkStateOf(ctx, clientKey);
}

function applyKeyFaults(
  ctx: RoomNetCtx,
  clientKey: string,
  faults: RoomFaultProfile | undefined
): void {
  for (const direction of ['toServer', 'toClient'] as const) {
    const key = roomNetKey(clientKey, direction);
    if (faults === undefined) ctx.kernel.clearKeyFaults(key);
    else ctx.kernel.setKeyFaults(key, toKernelFaults(faults));
  }
}

function dropHeldWithoutDeliver(ctx: RoomNetCtx, clientKey: string): void {
  const client = roomClientEndpoint(clientKey);
  ctx.kernel.partition(client, ROOM_SERVER_ENDPOINT);
  ctx.kernel.release(roomNetKey(clientKey, 'toServer'));
  ctx.kernel.release(roomNetKey(clientKey, 'toClient'));
}

function releaseDirs(ctx: RoomNetCtx, clientKey: string): void {
  ctx.kernel.release(roomNetKey(clientKey, 'toServer'));
  ctx.kernel.release(roomNetKey(clientKey, 'toClient'));
}

function clearDirOverrides(ctx: RoomNetCtx, clientKey: string): void {
  ctx.dirToServer.delete(clientKey);
  ctx.dirToClient.delete(clientKey);
}

function syncHoldFromLink(ctx: RoomNetCtx, clientKey: string): void {
  for (const direction of ['toServer', 'toClient'] as const) {
    const key = roomNetKey(clientKey, direction);
    if (effectiveLink(ctx, clientKey, direction) === 'hold') {
      ctx.kernel.hold(key);
    } else {
      ctx.kernel.release(key);
    }
  }
}

function syncPartitionFromLink(ctx: RoomNetCtx, clientKey: string): void {
  const client = roomClientEndpoint(clientKey);
  const down =
    effectiveLink(ctx, clientKey, 'toServer') === 'down' ||
    effectiveLink(ctx, clientKey, 'toClient') === 'down' ||
    linkStateOf(ctx, clientKey) === 'down';
  if (down) ctx.kernel.partition(client, ROOM_SERVER_ENDPOINT);
  else ctx.kernel.heal(client, ROOM_SERVER_ENDPOINT);
}

function snapshotOf(ctx: RoomNetCtx, clientKey: string): LinkSnapshot {
  return {
    shared: linkStateOf(ctx, clientKey),
    toServer: ctx.dirToServer.get(clientKey),
    toClient: ctx.dirToClient.get(clientKey),
    faults: ctx.nodeFaults.get(clientKey),
  };
}

function applySnapshot(
  ctx: RoomNetCtx,
  clientKey: string,
  snap: LinkSnapshot
): void {
  ctx.link.set(clientKey, snap.shared);
  if (snap.toServer === undefined) ctx.dirToServer.delete(clientKey);
  else ctx.dirToServer.set(clientKey, snap.toServer);
  if (snap.toClient === undefined) ctx.dirToClient.delete(clientKey);
  else ctx.dirToClient.set(clientKey, snap.toClient);
  if (snap.faults === undefined) {
    ctx.nodeFaults.delete(clientKey);
    applyKeyFaults(ctx, clientKey, undefined);
  } else {
    ctx.nodeFaults.set(clientKey, snap.faults);
    applyKeyFaults(ctx, clientKey, snap.faults);
  }
  syncPartitionFromLink(ctx, clientKey);
  syncHoldFromLink(ctx, clientKey);
}

function applyFaultProfile(
  ctx: RoomNetCtx,
  clientKey: string,
  next: RoomFaultProfile
): void {
  ctx.nodeFaults.set(clientKey, next);
  ctx.link.set(clientKey, 'ok');
  clearDirOverrides(ctx, clientKey);
  applyKeyFaults(ctx, clientKey, next);
  syncPartitionFromLink(ctx, clientKey);
  releaseDirs(ctx, clientKey);
}

function applyDirectional(
  ctx: RoomNetCtx,
  clientKey: string,
  next: RoomNetDirectionalState
): void {
  if (next.toServer !== undefined) {
    ctx.dirToServer.set(clientKey, next.toServer);
    if (next.toServer === 'down') dropHeldWithoutDeliver(ctx, clientKey);
  }
  if (next.toClient !== undefined) {
    ctx.dirToClient.set(clientKey, next.toClient);
    if (next.toClient === 'down') dropHeldWithoutDeliver(ctx, clientKey);
  }
  syncPartitionFromLink(ctx, clientKey);
  syncHoldFromLink(ctx, clientKey);
}

function applyLinkState(
  ctx: RoomNetCtx,
  clientKey: string,
  next: RoomNetLinkState
): void {
  if (next === 'ok') {
    ctx.link.set(clientKey, 'ok');
    clearDirOverrides(ctx, clientKey);
    ctx.nodeFaults.delete(clientKey);
    applyKeyFaults(ctx, clientKey, undefined);
    ctx.kernel.heal(roomClientEndpoint(clientKey), ROOM_SERVER_ENDPOINT);
    releaseDirs(ctx, clientKey);
    return;
  }
  if (next === 'hold') {
    ctx.link.set(clientKey, 'hold');
    syncHoldFromLink(ctx, clientKey);
    return;
  }
  ctx.link.set(clientKey, 'down');
  dropHeldWithoutDeliver(ctx, clientKey);
  syncPartitionFromLink(ctx, clientKey);
}

function applySet(
  ctx: RoomNetCtx,
  clientKey: string,
  next: RoomNetSetArg
): void {
  if (isFaultProfile(next)) {
    applyFaultProfile(ctx, clientKey, next);
    return;
  }
  if (isDirectional(next)) {
    applyDirectional(ctx, clientKey, next);
    return;
  }
  applyLinkState(ctx, clientKey, next);
}

function buildRoomNetworkApi(args: {
  readonly scheduler: SimScheduler;
  readonly ctx: RoomNetCtx;
}): SimRoomNetwork {
  const { scheduler, ctx } = args;
  const { kernel } = ctx;
  return {
    registerServer(deliver) {
      kernel.register(ROOM_SERVER_ENDPOINT, (payload) =>
        deliver(payload as RoomServerIngress)
      );
    },
    registerClient(clientKey, deliver) {
      kernel.register(roomClientEndpoint(clientKey), deliver);
    },
    unregisterClient(clientKey) {
      kernel.unregister(roomClientEndpoint(clientKey));
    },
    sendToServer(clientKey, msg) {
      if (effectiveLink(ctx, clientKey, 'toServer') === 'down') return;
      const key = roomNetKey(clientKey, 'toServer');
      if (effectiveLink(ctx, clientKey, 'toServer') === 'hold') {
        kernel.hold(key);
      }
      kernel.send(roomClientEndpoint(clientKey), ROOM_SERVER_ENDPOINT, msg, {
        key,
      });
    },
    sendToClient(clientKey, payload) {
      if (effectiveLink(ctx, clientKey, 'toClient') === 'down') return;
      const key = roomNetKey(clientKey, 'toClient');
      if (effectiveLink(ctx, clientKey, 'toClient') === 'hold') {
        kernel.hold(key);
      }
      kernel.send(
        ROOM_SERVER_ENDPOINT,
        roomClientEndpoint(clientKey),
        payload,
        {
          key,
        }
      );
    },
    setDefaultFaults(faults) {
      kernel.setDefaultFaults(toKernelFaults(faults));
    },
    set(clientKey, next) {
      const prior = snapshotOf(ctx, clientKey);
      return createNetEffect(
        () => {
          applySet(ctx, clientKey, next);
        },
        () => {
          applySnapshot(ctx, clientKey, prior);
          if (prior.shared === 'ok' && prior.toServer === undefined) {
            releaseDirs(ctx, clientKey);
          }
        }
      );
    },
    healAll() {
      kernel.releaseAll();
      kernel.healAll();
      kernel.clearKeyFaults();
      kernel.setDefaultFaults(RELIABLE_NET_FAULTS);
      ctx.link.clear();
      ctx.dirToServer.clear();
      ctx.dirToClient.clear();
      ctx.nodeFaults.clear();
    },
    linkState: (clientKey) => linkStateOf(ctx, clientKey),
    heldSummary() {
      return kernel
        .heldSummary()
        .map((k) => k.replace('\0', ':'))
        .sort();
    },
    pendingCount() {
      return scheduler.pendingCount();
    },
    netPendingCount() {
      return kernel.inFlightCount();
    },
  };
}

/**
 * Adapt a framework-owned `@pkgs/dst` network kernel to the room-domain
 * client/direction-keyed surface. DST worlds pass `ctx.network`;
 * {@link createSimRoomNetwork} passes a kernel it just made.
 */
export function wrapDstRoomNetwork(args: {
  readonly kernel: DstNetwork;
  readonly scheduler: SimScheduler;
  readonly faults?: RoomFaultProfile;
}): SimRoomNetwork {
  if (args.faults !== undefined) {
    args.kernel.setDefaultFaults(toKernelFaults(args.faults));
  }
  const ctx: RoomNetCtx = {
    kernel: args.kernel,
    link: new Map(),
    dirToServer: new Map(),
    dirToClient: new Map(),
    nodeFaults: new Map(),
  };
  return buildRoomNetworkApi({ scheduler: args.scheduler, ctx });
}

export function createSimRoomNetwork(args: {
  readonly scheduler: SimScheduler;
  readonly rng: SeededRng;
  readonly faults?: RoomFaultProfile;
}): SimRoomNetwork {
  const initial = args.faults ?? RELIABLE_ROOM_FAULTS;
  return wrapDstRoomNetwork({
    kernel: createDstNetwork({
      scheduler: args.scheduler,
      rng: args.rng,
      faults: toKernelFaults(initial),
    }),
    scheduler: args.scheduler,
  });
}
