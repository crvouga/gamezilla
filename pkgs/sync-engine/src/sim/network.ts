import type {
  Deliver,
  EndpointId,
  FlowKey,
  Network as KernelNetwork,
} from '@pkgs/determinism';

import type { SimFaultOptions } from './faults';
import { type ClientTraffic, clientForHop, type SimTraffic } from './traffic';

export type { Deliver, EndpointId };

/**
 * Sync-domain network: hold/faults keyed by node + {@link SimTraffic}.
 * Mechanics (delay/loss/dup/partition/hold queues) live in `@pkgs/determinism`.
 */
export type SyncNetwork = {
  readonly register: (id: EndpointId, deliver: Deliver) => void;
  readonly unregister: (id: EndpointId) => void;
  /** Schedule delivery (fire-and-forget). Drops when partitioned / lost. */
  readonly send: (from: EndpointId, to: EndpointId, payload: unknown) => void;
  readonly partition: (a: EndpointId, b: EndpointId) => void;
  readonly heal: (a: EndpointId, b: EndpointId) => void;
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
  readonly isEdgePartitioned: (a: EndpointId, b: EndpointId) => boolean;
  readonly heldSummary: () => readonly string[];
};

/** Opaque key: `nodeId\\0traffic` — never parsed by the kernel. */
export function syncNetKey(nodeId: string, traffic: SimTraffic): FlowKey {
  return `${nodeId}\0${traffic}`;
}

/** Map sync fault field names → kernel profile. */
export function toKernelFaults(f: SimFaultOptions) {
  return {
    latencyMeanMs: f.latencyMeanMs,
    latencyJitterMs: f.latencyJitterMs,
    dropProbability: f.dropProbability,
    duplicateProbability: f.packetReplayProbability,
    reorderWindowMs: f.reorderWindow,
    partitionProbability: f.partitionProbability,
    healProbability: f.healProbability,
  };
}

/** Map kernel profile → sync fault field names. */
export function fromKernelFaults(
  p: ReturnType<KernelNetwork['faults']>
): SimFaultOptions {
  return {
    latencyMeanMs: p.latencyMeanMs,
    latencyJitterMs: p.latencyJitterMs,
    dropProbability: p.dropProbability,
    packetReplayProbability: p.duplicateProbability,
    reorderWindow: p.reorderWindowMs,
    partitionProbability: p.partitionProbability,
    healProbability: p.healProbability,
  };
}

function resolveSendKey(
  kernel: KernelNetwork,
  overrides: Map<FlowKey, SimFaultOptions>,
  nodeId: string,
  traffic: ClientTraffic
): FlowKey {
  const specific = syncNetKey(nodeId, traffic);
  const all = syncNetKey(nodeId, 'all');
  if (kernel.isHeld(specific)) return specific;
  if (kernel.isHeld(all)) return all;
  if (overrides.has(specific)) return specific;
  if (overrides.has(all)) return all;
  return specific;
}

function isHeldTraffic(
  kernel: KernelNetwork,
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
  kernel: KernelNetwork,
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
  kernel: KernelNetwork,
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
  kernel: KernelNetwork,
  overrides: Map<FlowKey, SimFaultOptions>,
  nodeId?: string
): void {
  if (nodeId === undefined) {
    overrides.clear();
    kernel.clearFaults();
    return;
  }
  for (const key of [...overrides.keys()]) {
    if (key.startsWith(`${nodeId}\0`)) {
      overrides.delete(key);
      kernel.clearFaults(key);
    }
  }
}

/**
 * Adapt a framework-owned `@pkgs/determinism` network kernel to the sync-domain
 * traffic-keyed surface. Framework worlds pass `ctx.network`.
 */
export function wrapSimNetwork(
  kernel: KernelNetwork,
  initialFaults?: SimFaultOptions
): SyncNetwork {
  if (initialFaults !== undefined) {
    kernel.setFaults(toKernelFaults(initialFaults));
  }
  const overrides = new Map<FlowKey, SimFaultOptions>();

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
      kernel.setFaults(toKernelFaults(next));
    },
    faults: () => fromKernelFaults(kernel.faults()),
    hold: (nodeId, traffic) => holdTraffic(kernel, nodeId, traffic),
    release: (nodeId, traffic) => releaseTraffic(kernel, nodeId, traffic),
    releaseAll: () => kernel.releaseAll(),
    setNodeFaults(nodeId, traffic, faults) {
      const key = syncNetKey(nodeId, traffic);
      overrides.set(key, faults);
      kernel.setFaults(toKernelFaults(faults), key);
    },
    clearNodeFaults: (nodeId) => clearNodeOverrides(kernel, overrides, nodeId),
    clearNodeFaultsForTraffic(nodeId, traffic) {
      const key = syncNetKey(nodeId, traffic);
      overrides.delete(key);
      kernel.clearFaults(key);
    },
    getNodeFaults(nodeId, traffic) {
      return overrides.get(syncNetKey(nodeId, traffic));
    },
    isHeld: (nodeId, traffic) => isHeldTraffic(kernel, nodeId, traffic),
    isEdgePartitioned: (a, b) => kernel.isPartitioned(a, b),
    heldSummary() {
      return kernel
        .held()
        .map((k: string) => k.replace('\0', ':'))
        .sort();
    },
  };
}
