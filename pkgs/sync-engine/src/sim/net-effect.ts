import type { SimFaultOptions } from './faults';
import { RELIABLE_FAULTS } from './faults';
import type { SyncNetwork } from './network';
import {
  BROKER,
  liveEndpoint,
  SERVER_HTTP,
  type SimTraffic,
  syncEndpoint,
} from './traffic';

export type NetState = 'ok' | 'hold' | 'down' | Partial<SimFaultOptions>;

export type NetEffect = Disposable & {
  restore(): void;
};

type NetSnapshot = {
  readonly held: boolean;
  readonly partitionedSync: boolean;
  readonly partitionedLive: boolean;
  readonly faults: SimFaultOptions | undefined;
};

type TrackedNetEffect = NetEffect & {
  inert: boolean;
};

export type NetEffectRegistry = {
  readonly track: (effect: TrackedNetEffect) => void;
  readonly neutralizeAll: () => void;
};

function readPartitioned(
  network: SyncNetwork,
  nodeId: string,
  traffic: SimTraffic
): { sync: boolean; live: boolean } {
  const sync =
    traffic === 'sync' || traffic === 'all'
      ? network.isEdgePartitioned(syncEndpoint(nodeId), SERVER_HTTP)
      : false;
  const live =
    traffic === 'live' || traffic === 'all'
      ? network.isEdgePartitioned(liveEndpoint(nodeId), BROKER)
      : false;
  return { sync, live };
}

function snapshot(
  network: SyncNetwork,
  nodeId: string,
  traffic: SimTraffic
): NetSnapshot {
  const part = readPartitioned(network, nodeId, traffic);
  return {
    held: network.isHeld(nodeId, traffic),
    partitionedSync: part.sync,
    partitionedLive: part.live,
    faults: network.getNodeFaults(nodeId, traffic),
  };
}

function applyPartition(args: {
  readonly network: SyncNetwork;
  readonly nodeId: string;
  readonly traffic: SimTraffic;
  readonly sync: boolean;
  readonly live: boolean;
}): void {
  const { network, nodeId, traffic, sync, live } = args;
  if (traffic === 'sync' || traffic === 'all') {
    if (sync) network.partition(syncEndpoint(nodeId), SERVER_HTTP);
    else network.heal(syncEndpoint(nodeId), SERVER_HTTP);
  }
  if (traffic === 'live' || traffic === 'all') {
    if (live) network.partition(liveEndpoint(nodeId), BROKER);
    else network.heal(liveEndpoint(nodeId), BROKER);
  }
}

function restoreSnapshot(
  network: SyncNetwork,
  nodeId: string,
  traffic: SimTraffic,
  prior: NetSnapshot
): void {
  if (prior.held) network.hold(nodeId, traffic);
  else network.release(nodeId, traffic);
  applyPartition({
    network,
    nodeId,
    traffic,
    sync: prior.partitionedSync,
    live: prior.partitionedLive,
  });
  if (prior.faults === undefined) {
    network.clearNodeFaultsForTraffic(nodeId, traffic);
  } else {
    network.setNodeFaults(nodeId, traffic, prior.faults);
  }
}

function applyState(
  network: SyncNetwork,
  nodeId: string,
  traffic: SimTraffic,
  state: NetState
): void {
  if (state === 'hold') {
    network.hold(nodeId, traffic);
    return;
  }
  if (state === 'down') {
    applyPartition({
      network,
      nodeId,
      traffic,
      sync: traffic === 'sync' || traffic === 'all',
      live: traffic === 'live' || traffic === 'all',
    });
    return;
  }
  if (state === 'ok') {
    network.release(nodeId, traffic);
    applyPartition({ network, nodeId, traffic, sync: false, live: false });
    network.clearNodeFaultsForTraffic(nodeId, traffic);
    return;
  }
  network.setNodeFaults(nodeId, traffic, {
    ...RELIABLE_FAULTS,
    ...state,
  });
}

export function createNetEffectRegistry(): NetEffectRegistry {
  const live = new Set<TrackedNetEffect>();
  return {
    track(effect) {
      live.add(effect);
    },
    neutralizeAll() {
      for (const effect of live) {
        effect.inert = true;
      }
      live.clear();
    },
  };
}

export type SimNetHandle = {
  set(state: NetState): NetEffect;
};

export function createSimNetHandle(args: {
  readonly network: SyncNetwork;
  readonly nodeId: string;
  readonly traffic: SimTraffic;
  readonly registry: NetEffectRegistry;
  /** Fired when a hold is released (restore or set('ok')). */
  readonly onHoldReleased?: (nodeId: string) => void;
}): SimNetHandle {
  const notifyRelease = (wasHeld: boolean, nowHeld: boolean) => {
    if (wasHeld && !nowHeld) args.onHoldReleased?.(args.nodeId);
  };
  return {
    set(state) {
      const prior = snapshot(args.network, args.nodeId, args.traffic);
      applyState(args.network, args.nodeId, args.traffic, state);
      const after = snapshot(args.network, args.nodeId, args.traffic);
      notifyRelease(prior.held, after.held);
      const tracked: TrackedNetEffect = {
        inert: false,
        restore() {
          if (tracked.inert) return;
          tracked.inert = true;
          const before = snapshot(args.network, args.nodeId, args.traffic);
          restoreSnapshot(args.network, args.nodeId, args.traffic, prior);
          const restored = snapshot(args.network, args.nodeId, args.traffic);
          notifyRelease(before.held, restored.held);
        },
        [Symbol.dispose]() {
          tracked.restore();
        },
      };
      args.registry.track(tracked);
      return tracked;
    },
  };
}
