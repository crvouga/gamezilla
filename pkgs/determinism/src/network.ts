import type { SeededRng } from '@pkgs/uuid';
import { networkSend, releaseHeldKey } from './network-send';
import {
  effectiveFaults,
  isPartitioned,
  RELIABLE_NET_FAULTS,
  type SimNetFaultProfile,
  type SimNetwork,
  type SimNetworkState,
  setPartition,
  validatePartial,
  validateProfile,
} from './network-state';
import type { SimScheduler } from './scheduler';
import type { SimTrace } from './trace';

export type {
  SimDeliver,
  SimEndpointId,
  SimNetFaultProfile,
  SimNetKey,
  SimNetwork,
  SimNodeId,
} from './network-state';
export { RELIABLE_NET_FAULTS } from './network-state';

export type CreateSimNetworkArgs = {
  readonly scheduler: SimScheduler;
  readonly rng: SeededRng;
  readonly faults?: SimNetFaultProfile;
  readonly trace?: SimTrace;
};

function createNetworkState(args: CreateSimNetworkArgs): SimNetworkState {
  const defaults: SimNetFaultProfile = {
    ...(args.faults ?? RELIABLE_NET_FAULTS),
  };
  validateProfile(defaults, 'defaults');
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
    nextPacketId: 0,
    inFlight: 0,
  };
}

function buildSimNetworkApi(state: SimNetworkState): SimNetwork {
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
        validateProfile({ ...state.defaults, ...partial }, 'defaults');
        state.defaults = { ...state.defaults, ...partial };
        return;
      }
      validatePartial(partial, `key:${key}`);
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
  };
}

export function createSimNetwork(args: CreateSimNetworkArgs): SimNetwork {
  return buildSimNetworkApi(createNetworkState(args));
}
