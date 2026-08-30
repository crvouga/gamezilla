import type { SimFaultOptions } from './faults';
import { RELIABLE_FAULTS } from './faults';
import {
  clearNodeFaults as clearStateNodeFaults,
  clearNodeFaultsForTraffic as clearStateNodeFaultsForTraffic,
  edgeKey,
  faultKey,
  getNodeFaults as getStateNodeFaults,
  holdKey,
  isPartitioned,
  networkIsHeld,
  networkRelease,
  networkReleaseAll,
  networkSend,
  type SimDeliver,
  type SimEndpointId,
  type SimNetworkState,
  heldSummary as stateHeldSummary,
} from './network-parts';
import type { SeededRng } from './rng';
import type { SimScheduler } from './scheduler';
import type { SimTraffic } from './traffic';

export type { SimDeliver, SimEndpointId } from './network-parts';

/**
 * Lossy point-to-point mesh. `send` schedules delivery and returns immediately
 * so the discrete-event drain loop is never blocked waiting on itself.
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

function createNetworkState(args: {
  readonly scheduler: SimScheduler;
  readonly rng: SeededRng;
  readonly faults?: SimFaultOptions;
}): SimNetworkState {
  return {
    endpoints: new Map(),
    partitioned: new Set(),
    nodeFaults: new Map(),
    heldKeys: new Set(),
    holdQueues: new Map(),
    scheduler: args.scheduler,
    rng: args.rng,
    defaultFaults: args.faults ?? RELIABLE_FAULTS,
  };
}

export function createSimNetwork(args: {
  readonly scheduler: SimScheduler;
  readonly rng: SeededRng;
  readonly faults?: SimFaultOptions;
}): SimNetwork {
  const state = createNetworkState(args);
  return {
    register(id, deliver) {
      state.endpoints.set(id, deliver);
    },
    unregister(id) {
      state.endpoints.delete(id);
    },
    send(from, to, payload) {
      networkSend(state, from, to, payload);
    },
    partition(a, b) {
      state.partitioned.add(edgeKey(a, b));
      state.partitioned.add(edgeKey(b, a));
    },
    heal(a, b) {
      state.partitioned.delete(edgeKey(a, b));
      state.partitioned.delete(edgeKey(b, a));
    },
    healAll() {
      state.partitioned.clear();
    },
    setDefaultFaults(next) {
      state.defaultFaults = next;
    },
    faults: () => state.defaultFaults,
    hold(nodeId, traffic) {
      state.heldKeys.add(holdKey(nodeId, traffic));
    },
    release(nodeId, traffic) {
      networkRelease(state, nodeId, traffic);
    },
    releaseAll() {
      networkReleaseAll(state);
    },
    setNodeFaults(nodeId, traffic, faults) {
      state.nodeFaults.set(faultKey(nodeId, traffic), faults);
    },
    clearNodeFaults(nodeId) {
      clearStateNodeFaults(state, nodeId);
    },
    clearNodeFaultsForTraffic(nodeId, traffic) {
      clearStateNodeFaultsForTraffic(state, nodeId, traffic);
    },
    getNodeFaults(nodeId, traffic) {
      return getStateNodeFaults(state, nodeId, traffic);
    },
    isHeld(nodeId, traffic) {
      return networkIsHeld(state, nodeId, traffic);
    },
    isEdgePartitioned(a, b) {
      return isPartitioned(state, a, b);
    },
    heldSummary: () => stateHeldSummary(state),
  };
}
