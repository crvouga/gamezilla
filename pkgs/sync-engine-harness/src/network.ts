import type { Deliver, EndpointId, FlowKey, Network as KernelNetwork } from '@pkgs/harness-shared/network-state';

import type { HarnessFaultOptions } from './faults';
import type { ClientTraffic, HarnessTraffic } from './traffic';
import { clientForHop } from './traffic';

/**
 * Sync-domain network: hold/faults keyed by node + {@link HarnessTraffic}.
 * Mechanics (delay/loss/dup/partition/hold queues) live in `@pkgs/harness-shared`.
 */
export type SyncNetwork = {
  readonly register: (id: EndpointId, deliver: Deliver) => void;
  readonly unregister: (id: EndpointId) => void;
  /** Schedule delivery (fire-and-forget). Drops when partitioned / lost. */
  readonly send: (from: EndpointId, to: EndpointId, payload: unknown) => void;
  readonly partition: (a: EndpointId, b: EndpointId) => void;
  readonly restoreNetwork: (a: EndpointId, b: EndpointId) => void;
  readonly restoreAllNetwork: () => void;
  /** SyncHarnessRuntime default fault profile (fallback when no per-node override). */
  readonly setDefaultFaults: (faults: HarnessFaultOptions) => void;
  readonly faults: () => HarnessFaultOptions;
  readonly hold: (nodeId: string, traffic: HarnessTraffic) => void;
  readonly release: (nodeId: string, traffic: HarnessTraffic) => void;
  readonly releaseAll: () => void;
  readonly setNodeFaults: (
    nodeId: string,
    traffic: HarnessTraffic,
    faults: HarnessFaultOptions
  ) => void;
  readonly clearNodeFaults: (nodeId?: string) => void;
  readonly clearNodeFaultsForTraffic: (
    nodeId: string,
    traffic: HarnessTraffic
  ) => void;
  readonly getNodeFaults: (
    nodeId: string,
    traffic: HarnessTraffic
  ) => HarnessFaultOptions | undefined;
  readonly isHeld: (nodeId: string, traffic: HarnessTraffic) => boolean;
  readonly isEdgePartitioned: (a: EndpointId, b: EndpointId) => boolean;
  readonly heldSummary: () => readonly string[];
};

/** Opaque key: `nodeId\\0traffic` — never parsed by the kernel. */
export function syncNetKey(nodeId: string, traffic: HarnessTraffic): FlowKey {
  return `${nodeId}\0${traffic}`;
}

/** Map sync fault field names → kernel profile. */
export function toKernelFaults(f: HarnessFaultOptions) {
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
): HarnessFaultOptions {
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
  overrides: Map<FlowKey, HarnessFaultOptions>,
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
  traffic: HarnessTraffic
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
  traffic: HarnessTraffic
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
  traffic: HarnessTraffic
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
  overrides: Map<FlowKey, HarnessFaultOptions>,
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
 * Adapt a framework-owned `@pkgs/harness-shared` network kernel to the sync-domain
 * traffic-keyed surface. Framework systems pass `ctx.network`.
 */
export function wrapHarnessNetwork(
  kernel: KernelNetwork,
  initialFaults?: HarnessFaultOptions
): SyncNetwork {
  if (initialFaults !== undefined) {
    kernel.setFaults(toKernelFaults(initialFaults));
  }
  const overrides = new Map<FlowKey, HarnessFaultOptions>();

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
    restoreNetwork: (a, b) => kernel.heal(a, b),
    restoreAllNetwork: () => kernel.healAll(),
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
