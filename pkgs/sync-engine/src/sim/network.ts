import {
  createSimNetwork as createDstNetwork,
  type SimNetwork as DstNetwork,
  type SimDeliver,
  type SimEndpointId,
  type SimNetKey,
  type SimScheduler,
} from '@pkgs/dst';
import type { SeededRng } from '@pkgs/uuid';

import type { SimFaultOptions } from './faults';
import { RELIABLE_FAULTS } from './faults';
import { type ClientTraffic, clientForHop, type SimTraffic } from './traffic';

export type { SimDeliver, SimEndpointId };

/**
 * Sync-domain network: hold/faults keyed by node + {@link SimTraffic}.
 * Mechanics (delay/loss/dup/partition/hold queues) live in `@pkgs/dst`.
 */
export type SimNetwork = {
  readonly register: (id: SimEndpointId, deliver: SimDeliver) => void;
  readonly unregister: (id: SimEndpointId) => void;
  /** Schedule delivery (fire-and-forget). Drops when partitioned / lost. */
  readonly send: (
    from: SimEndpointId,
    to: SimEndpointId,
    payload: unknown
  ) => void;
  readonly partition: (a: SimEndpointId, b: SimEndpointId) => void;
  readonly heal: (a: SimEndpointId, b: SimEndpointId) => void;
  readonly healAll: () => void;
  /** World default fault profile (fallback when no per-node override). */
  readonly setDefaultFaults: (faults: SimFaultOptions) => void;
  readonly faults: () => SimFaultOptions;
  readonly hold: (nodeId: string, traffic: SimTraffic) => void;
  readonly release: (nodeId: string, traffic: SimTraffic) => void;
  readonly releaseAll: () => void;
  readonly setNodeFaults: (
    nodeId: string,
    traffic: SimTraffic,
    faults: SimFaultOptions
  ) => void;
  readonly clearNodeFaults: (nodeId?: string) => void;
  readonly clearNodeFaultsForTraffic: (
    nodeId: string,
    traffic: SimTraffic
  ) => void;
  readonly getNodeFaults: (
    nodeId: string,
    traffic: SimTraffic
  ) => SimFaultOptions | undefined;
  readonly isHeld: (nodeId: string, traffic: SimTraffic) => boolean;
  readonly isEdgePartitioned: (a: SimEndpointId, b: SimEndpointId) => boolean;
  readonly heldSummary: () => readonly string[];
};

/** Opaque key: `nodeId\\0traffic` — never parsed by the kernel. */
export function syncNetKey(nodeId: string, traffic: SimTraffic): SimNetKey {
  return `${nodeId}\0${traffic}`;
}

/** Map sync fault field names → kernel profile. */
export function toKernelFaults(f: SimFaultOptions) {
  return {
    oneWayDelayMeanMs: f.oneWayDelayMeanMs,
    oneWayDelayJitterMs: f.oneWayDelayJitterMs,
    packetLossProbability: f.packetLossProbability,
    duplicateProbability: f.packetReplayProbability,
    reorderWindowMs: f.reorderWindow,
    partitionProbability: f.partitionProbability,
    unpartitionProbability: f.unpartitionProbability,
  };
}

/** Map kernel profile → sync fault field names. */
export function fromKernelFaults(
  p: ReturnType<DstNetwork['getDefaultFaults']>
): SimFaultOptions {
  return {
    oneWayDelayMeanMs: p.oneWayDelayMeanMs,
    oneWayDelayJitterMs: p.oneWayDelayJitterMs,
    packetLossProbability: p.packetLossProbability,
    packetReplayProbability: p.duplicateProbability,
    reorderWindow: p.reorderWindowMs,
    partitionProbability: p.partitionProbability,
    unpartitionProbability: p.unpartitionProbability,
  };
}

function resolveSendKey(
  kernel: DstNetwork,
  overrides: Map<SimNetKey, SimFaultOptions>,
  nodeId: string,
  traffic: ClientTraffic
): SimNetKey {
  const specific = syncNetKey(nodeId, traffic);
  const all = syncNetKey(nodeId, 'all');
  if (kernel.isHeld(specific)) return specific;
  if (kernel.isHeld(all)) return all;
  if (overrides.has(specific)) return specific;
  if (overrides.has(all)) return all;
  return specific;
}

function isHeldTraffic(
  kernel: DstNetwork,
  nodeId: string,
  traffic: SimTraffic
): boolean {
  if (traffic === 'all') {
    return (
      kernel.isHeld(syncNetKey(nodeId, 'all')) ||
      kernel.isHeld(syncNetKey(nodeId, 'live')) ||
      kernel.isHeld(syncNetKey(nodeId, 'sync'))
    );
  }
  return (
    kernel.isHeld(syncNetKey(nodeId, traffic)) ||
    kernel.isHeld(syncNetKey(nodeId, 'all'))
  );
}

function holdTraffic(
  kernel: DstNetwork,
  nodeId: string,
  traffic: SimTraffic
): void {
  if (traffic === 'all') {
    kernel.hold(syncNetKey(nodeId, 'all'));
    return;
  }
  kernel.hold(syncNetKey(nodeId, traffic));
}

function releaseTraffic(
  kernel: DstNetwork,
  nodeId: string,
  traffic: SimTraffic
): void {
  if (traffic === 'all') {
    kernel.release(syncNetKey(nodeId, 'all'));
    kernel.release(syncNetKey(nodeId, 'live'));
    kernel.release(syncNetKey(nodeId, 'sync'));
    return;
  }
  kernel.release(syncNetKey(nodeId, traffic));
}

function clearNodeOverrides(
  kernel: DstNetwork,
  overrides: Map<SimNetKey, SimFaultOptions>,
  nodeId?: string
): void {
  if (nodeId === undefined) {
    overrides.clear();
    kernel.clearKeyFaults();
    return;
  }
  for (const key of [...overrides.keys()]) {
    if (key.startsWith(`${nodeId}\0`)) {
      overrides.delete(key);
      kernel.clearKeyFaults(key);
    }
  }
}

/**
 * Adapt a framework-owned `@pkgs/dst` network kernel to the sync-domain
 * traffic-keyed surface. DST worlds pass `ctx.network`; `createSimNetwork`
 * passes a kernel it just made.
 */
export function wrapDstNetwork(
  kernel: DstNetwork,
  initialFaults?: SimFaultOptions
): SimNetwork {
  if (initialFaults !== undefined) {
    kernel.setDefaultFaults(toKernelFaults(initialFaults));
  }
  const overrides = new Map<SimNetKey, SimFaultOptions>();

  return {
    register: (id, deliver) => kernel.register(id, deliver),
    unregister: (id) => kernel.unregister(id),
    send(from, to, payload) {
      const client = clientForHop(from, to);
      if (client === null) {
        kernel.send(from, to, payload);
        return;
      }
      const key = resolveSendKey(
        kernel,
        overrides,
        client.nodeId,
        client.traffic
      );
      kernel.send(from, to, payload, { key });
    },
    partition: (a, b) => kernel.partition(a, b),
    heal: (a, b) => kernel.heal(a, b),
    healAll: () => kernel.healAll(),
    setDefaultFaults(next) {
      kernel.setDefaultFaults(toKernelFaults(next));
    },
    faults: () => fromKernelFaults(kernel.getDefaultFaults()),
    hold: (nodeId, traffic) => holdTraffic(kernel, nodeId, traffic),
    release: (nodeId, traffic) => releaseTraffic(kernel, nodeId, traffic),
    releaseAll: () => kernel.releaseAll(),
    setNodeFaults(nodeId, traffic, faults) {
      const key = syncNetKey(nodeId, traffic);
      overrides.set(key, faults);
      kernel.setKeyFaults(key, toKernelFaults(faults));
    },
    clearNodeFaults: (nodeId) => clearNodeOverrides(kernel, overrides, nodeId),
    clearNodeFaultsForTraffic(nodeId, traffic) {
      const key = syncNetKey(nodeId, traffic);
      overrides.delete(key);
      kernel.clearKeyFaults(key);
    },
    getNodeFaults(nodeId, traffic) {
      return overrides.get(syncNetKey(nodeId, traffic));
    },
    isHeld: (nodeId, traffic) => isHeldTraffic(kernel, nodeId, traffic),
    isEdgePartitioned: (a, b) => kernel.isEdgePartitioned(a, b),
    heldSummary() {
      return kernel
        .heldSummary()
        .map((k) => k.replace('\0', ':'))
        .sort();
    },
  };
}

export function createSimNetwork(args: {
  readonly scheduler: SimScheduler;
  readonly rng: SeededRng;
  readonly faults?: SimFaultOptions;
}): SimNetwork {
  const kernel = createDstNetwork({
    scheduler: args.scheduler,
    rng: args.rng,
    faults: toKernelFaults(args.faults ?? RELIABLE_FAULTS),
  });
  return wrapDstNetwork(kernel);
}
