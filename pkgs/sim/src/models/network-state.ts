import type { SeededRng } from '@pkgs/uuid';
import type { Scheduler } from '../internals/scheduler';
import type { TraceRecorder } from '../internals/trace';

export type NodeId = string;
export type EndpointId = string;
/** Opaque per-flow key: selects a fault overlay and a hold queue. */
export type FlowKey = string;
export type Deliver = (payload: unknown) => void | Promise<void>;

/** Weighted network hazards: latency, drop, duplication, reorder, partition. */
export type NetworkFaults = {
  readonly latencyMeanMs: number;
  readonly latencyJitterMs: number;
  readonly dropProbability: number;
  readonly duplicateProbability: number;
  readonly reorderWindowMs: number;
  readonly partitionProbability: number;
  readonly healProbability: number;
};

export const RELIABLE_NETWORK: NetworkFaults = {
  latencyMeanMs: 0,
  latencyJitterMs: 0,
  dropProbability: 0,
  duplicateProbability: 0,
  reorderWindowMs: 0,
  partitionProbability: 0,
  healProbability: 0,
};

export type Network = {
  readonly register: (id: EndpointId, deliver: Deliver) => void;
  readonly unregister: (id: EndpointId) => void;
  readonly send: (
    from: EndpointId,
    to: EndpointId,
    payload: unknown,
    opts?: { readonly key?: FlowKey }
  ) => void;
  readonly partition: (a: EndpointId, b: EndpointId) => void;
  readonly heal: (a: EndpointId, b: EndpointId) => void;
  readonly healAll: () => void;
  readonly isPartitioned: (a: EndpointId, b: EndpointId) => boolean;
  readonly hold: (key: FlowKey) => void;
  readonly release: (key: FlowKey) => void;
  readonly releaseAll: () => void;
  readonly isHeld: (key: FlowKey) => boolean;
  readonly held: () => readonly string[];
  readonly faults: (key?: FlowKey) => NetworkFaults;
  readonly setFaults: (partial: Partial<NetworkFaults>, key?: FlowKey) => void;
  readonly clearFaults: (key?: FlowKey) => void;
  readonly inFlight: () => number;
  /** Current undirected partition edges as `[a, b]` pairs (sorted). */
  readonly partitions: () => readonly (readonly [EndpointId, EndpointId])[];
};

export type HeldMessage = {
  readonly from: EndpointId;
  readonly to: EndpointId;
  readonly payload: unknown;
  readonly messageId: number;
};

export type NetworkState = {
  readonly scheduler: Scheduler;
  readonly rng: SeededRng;
  readonly trace: TraceRecorder | undefined;
  readonly endpoints: Map<EndpointId, Deliver>;
  readonly partitioned: Set<string>;
  readonly heldKeys: Set<FlowKey>;
  readonly holdQueues: Map<FlowKey, HeldMessage[]>;
  readonly overrides: Map<FlowKey, Partial<NetworkFaults>>;
  defaults: NetworkFaults;
  nextMessageId: number;
  /** Scheduled deliveries not yet resolved (delivered or dropped at delivery). */
  inFlight: number;
};

export function edgeKey(a: EndpointId, b: EndpointId): string {
  return a < b ? `${a}\0${b}` : `${b}\0${a}`;
}

export function validateFaults(faults: NetworkFaults, path: string): void {
  const probs = [
    'dropProbability',
    'duplicateProbability',
    'partitionProbability',
    'healProbability',
  ] as const;
  for (const k of probs) {
    const v = faults[k];
    if (!Number.isFinite(v) || v < 0 || v > 1) {
      throw new Error(`Network: invalid ${path}.${k}=${String(v)}`);
    }
  }
  for (const k of [
    'latencyMeanMs',
    'latencyJitterMs',
    'reorderWindowMs',
  ] as const) {
    const v = faults[k];
    if (!Number.isFinite(v) || v < 0) {
      throw new Error(`Network: invalid ${path}.${k}=${String(v)}`);
    }
  }
  if (!Number.isInteger(faults.reorderWindowMs)) {
    throw new Error(
      `Network: reorderWindowMs must be integer, got ${faults.reorderWindowMs}`
    );
  }
}

export function validatePartialFaults(
  partial: Partial<NetworkFaults>,
  path: string
): void {
  validateFaults({ ...RELIABLE_NETWORK, ...partial }, path);
}

export function sampleLatencyMs(faults: NetworkFaults, rng: SeededRng): number {
  const mean = faults.latencyMeanMs;
  const jitter = faults.latencyJitterMs;
  if (mean === 0 && jitter === 0) return 0;
  if (jitter === 0) return mean;
  const delta = Math.floor((rng.random() * 2 - 1) * jitter);
  return Math.max(0, mean + delta);
}

export function isPartitioned(
  state: NetworkState,
  a: EndpointId,
  b: EndpointId
): boolean {
  return state.partitioned.has(edgeKey(a, b));
}

export function setPartition(
  state: NetworkState,
  a: EndpointId,
  b: EndpointId,
  on: boolean
): void {
  const k = edgeKey(a, b);
  if (on) state.partitioned.add(k);
  else state.partitioned.delete(k);
}

export function effectiveFaults(
  state: NetworkState,
  key: FlowKey | undefined
): NetworkFaults {
  if (key === undefined) return { ...state.defaults };
  const o = state.overrides.get(key);
  return o === undefined ? { ...state.defaults } : { ...state.defaults, ...o };
}

export function allocMessageId(state: NetworkState): number {
  return state.nextMessageId++;
}
