import type { SeededRng } from '@pkgs/uuid';
import type { Scheduler } from '../internals/scheduler';
import type { TraceRecorder } from '../internals/trace';
import { networkSend, releaseHeldKey } from './network-send';
import {
  effectiveFaults,
  isPartitioned,
  type Network,
  type NetworkFaults,
  type NetworkState,
  RELIABLE_NETWORK,
  setPartition,
  validateFaults,
  validatePartialFaults,
} from './network-state';

export type {
  Deliver,
  EndpointId,
  FlowKey,
  Network,
  NetworkFaults,
  NodeId,
} from './network-state';
export { RELIABLE_NETWORK } from './network-state';

export type CreateNetworkArgs = {
  readonly scheduler: Scheduler;
  readonly rng: SeededRng;
  readonly faults?: NetworkFaults;
  readonly trace?: TraceRecorder;
};

function createNetworkState(args: CreateNetworkArgs): NetworkState {
  const defaults: NetworkFaults = {
    ...(args.faults ?? RELIABLE_NETWORK),
  };
  validateFaults(defaults, 'defaults');
  return {
    scheduler: args.scheduler,
    rng: args.rng,
    trace: args.trace,
    endpoints: new Map(),
    partitioned: new Set(),
    heldKeys: new Set(),
    holdQueues: new Map(),
    overrides: new Map(),
    defaults,
    nextMessageId: 0,
    inFlight: 0,
  };
}

function buildNetworkApi(state: NetworkState): Network {
  return {
    register(id, deliver) {
      state.endpoints.set(id, deliver);
    },
    unregister(id) {
      state.endpoints.delete(id);
    },
    send(from, to, payload, opts) {
      networkSend({
        state,
        from,
        to,
        payload,
        ...(opts !== undefined ? { opts } : {}),
      });
    },
    partition(a, b) {
      setPartition(state, a, b, true);
    },
    heal(a, b) {
      setPartition(state, a, b, false);
    },
    healAll() {
      state.partitioned.clear();
    },
    isPartitioned(a, b) {
      return isPartitioned(state, a, b);
    },
    hold(key) {
      state.heldKeys.add(key);
    },
    release(key) {
      releaseHeldKey(state, key);
    },
    releaseAll() {
      for (const key of [...state.heldKeys]) releaseHeldKey(state, key);
    },
    isHeld(key) {
      return state.heldKeys.has(key);
    },
    held() {
      return [...state.heldKeys].sort();
    },
    faults(key) {
      if (key === undefined) return { ...state.defaults };
      return effectiveFaults(state, key);
    },
    setFaults(partial, key) {
      if (key === undefined) {
        validateFaults({ ...state.defaults, ...partial }, 'defaults');
        state.defaults = { ...state.defaults, ...partial };
        return;
      }
      validatePartialFaults(partial, `key:${key}`);
      const prev = state.overrides.get(key) ?? {};
      state.overrides.set(key, { ...prev, ...partial });
    },
    clearFaults(key) {
      if (key === undefined) state.overrides.clear();
      else state.overrides.delete(key);
    },
    inFlight() {
      return state.inFlight;
    },
    partitions() {
      const out: (readonly [string, string])[] = [];
      for (const key of [...state.partitioned].sort()) {
        const [a, b] = key.split('\0');
        if (a !== undefined && b !== undefined) out.push([a, b]);
      }
      return out;
    },
  };
}

export function createNetwork(args: CreateNetworkArgs): Network {
  return buildNetworkApi(createNetworkState(args));
}
