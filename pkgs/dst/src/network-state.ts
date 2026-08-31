import type { SeededRng } from '@pkgs/uuid';
import type { SimScheduler } from './scheduler';
import type { SimTrace } from './trace';

export type SimNodeId = string;
export type SimEndpointId = string;
export type SimNetKey = string;
export type SimDeliver = (payload: unknown) => void | Promise<void>;

export type SimNetFaultProfile = {
  readonly oneWayDelayMeanMs: number;
  readonly oneWayDelayJitterMs: number;
  readonly packetLossProbability: number;
  readonly duplicateProbability: number;
  readonly reorderWindowMs: number;
  readonly partitionProbability: number;
  readonly unpartitionProbability: number;
};

export const RELIABLE_NET_FAULTS: SimNetFaultProfile = {
  oneWayDelayMeanMs: 0,
  oneWayDelayJitterMs: 0,
  packetLossProbability: 0,
  duplicateProbability: 0,
  reorderWindowMs: 0,
  partitionProbability: 0,
  unpartitionProbability: 0,
};

export type SimNetwork = {
  readonly register: (id: SimEndpointId, deliver: SimDeliver) => void;
  readonly unregister: (id: SimEndpointId) => void;
  readonly send: (
    from: SimEndpointId,
    to: SimEndpointId,
    payload: unknown,
    opts?: { readonly key?: SimNetKey }
  ) => void;
  readonly partition: (a: SimEndpointId, b: SimEndpointId) => void;
  readonly heal: (a: SimEndpointId, b: SimEndpointId) => void;
  readonly healAll: () => void;
  readonly isEdgePartitioned: (a: SimEndpointId, b: SimEndpointId) => boolean;
  readonly hold: (key: SimNetKey) => void;
  readonly release: (key: SimNetKey) => void;
  readonly releaseAll: () => void;
  readonly isHeld: (key: SimNetKey) => boolean;
  readonly heldSummary: () => readonly string[];
  readonly setDefaultFaults: (profile: SimNetFaultProfile) => void;
  readonly setKeyFaults: (
    key: SimNetKey,
    overrides: Partial<SimNetFaultProfile>
  ) => void;
  readonly getKeyFaults: (key: SimNetKey) => SimNetFaultProfile;
  readonly getDefaultFaults: () => SimNetFaultProfile;
  readonly clearKeyFaults: (key?: SimNetKey) => void;
  /**
   * Scheduled frames not yet resolved (delivered, or dropped at delivery time).
   * Excludes held queues and unrelated scheduler timers, so drain loops can
   * wait on network quiescence without chasing intentionally parked frames.
   */
  readonly inFlightCount: () => number;
};

export type HeldPacket = {
  readonly from: SimEndpointId;
  readonly to: SimEndpointId;
  readonly payload: unknown;
  readonly packetId: number;
};

export type SimNetworkState = {
  readonly scheduler: SimScheduler;
  readonly rng: SeededRng;
  readonly trace: SimTrace | undefined;
  readonly endpoints: Map<SimEndpointId, SimDeliver>;
  readonly partitioned: Set<string>;
  readonly heldKeys: Set<SimNetKey>;
  readonly holdQueues: Map<SimNetKey, HeldPacket[]>;
  readonly overrides: Map<SimNetKey, Partial<SimNetFaultProfile>>;
  defaults: SimNetFaultProfile;
  nextPacketId: number;
  /** Scheduled frames not yet resolved (delivered or dropped at delivery). */
  inFlight: number;
};

export function edgeKey(a: SimEndpointId, b: SimEndpointId): string {
  return a < b ? `${a}\0${b}` : `${b}\0${a}`;
}

export function validateProfile(
  profile: SimNetFaultProfile,
  path: string
): void {
  const probs = [
    'packetLossProbability',
    'duplicateProbability',
    'partitionProbability',
    'unpartitionProbability',
  ] as const;
  for (const k of probs) {
    const v = profile[k];
    if (!Number.isFinite(v) || v < 0 || v > 1) {
      throw new Error(`SimNetwork: invalid ${path}.${k}=${String(v)}`);
    }
  }
  for (const k of [
    'oneWayDelayMeanMs',
    'oneWayDelayJitterMs',
    'reorderWindowMs',
  ] as const) {
    const v = profile[k];
    if (!Number.isFinite(v) || v < 0) {
      throw new Error(`SimNetwork: invalid ${path}.${k}=${String(v)}`);
    }
  }
  if (!Number.isInteger(profile.reorderWindowMs)) {
    throw new Error(
      `SimNetwork: reorderWindowMs must be integer, got ${profile.reorderWindowMs}`
    );
  }
}

export function validatePartial(
  partial: Partial<SimNetFaultProfile>,
  path: string
): void {
  validateProfile({ ...RELIABLE_NET_FAULTS, ...partial }, path);
}

export function sampleDelayMs(
  faults: SimNetFaultProfile,
  rng: SeededRng
): number {
  const mean = faults.oneWayDelayMeanMs;
  const jitter = faults.oneWayDelayJitterMs;
  if (mean === 0 && jitter === 0) return 0;
  if (jitter === 0) return mean;
  const delta = Math.floor((rng.random() * 2 - 1) * jitter);
  return Math.max(0, mean + delta);
}

export function isPartitioned(
  state: SimNetworkState,
  a: SimEndpointId,
  b: SimEndpointId
): boolean {
  return state.partitioned.has(edgeKey(a, b));
}

export function setPartition(
  state: SimNetworkState,
  a: SimEndpointId,
  b: SimEndpointId,
  on: boolean
): void {
  const k = edgeKey(a, b);
  if (on) state.partitioned.add(k);
  else state.partitioned.delete(k);
}

export function effectiveFaults(
  state: SimNetworkState,
  key: SimNetKey | undefined
): SimNetFaultProfile {
  if (key === undefined) return { ...state.defaults };
  const o = state.overrides.get(key);
  return o === undefined ? { ...state.defaults } : { ...state.defaults, ...o };
}

export function allocPacketId(state: SimNetworkState): number {
  return state.nextPacketId++;
}
