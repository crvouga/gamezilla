import type { SeededRng } from './rng';

/** VOPR-style network fault knobs derived from a seed stream. */
export type SimFaultOptions = {
  readonly oneWayDelayMeanMs: number;
  readonly oneWayDelayJitterMs: number;
  readonly packetLossProbability: number;
  readonly packetReplayProbability: number;
  readonly reorderWindow: number;
  readonly partitionProbability: number;
  readonly unpartitionProbability: number;
};

export const RELIABLE_FAULTS: SimFaultOptions = {
  oneWayDelayMeanMs: 0,
  oneWayDelayJitterMs: 0,
  packetLossProbability: 0,
  packetReplayProbability: 0,
  reorderWindow: 0,
  partitionProbability: 0,
  unpartitionProbability: 0,
};

/**
 * Mild fixed faults for system scenarios that should exercise reorder/loss
 * without sampling (still fully deterministic for a given seed stream on
 * delay draws). Prefer {@link sampleFaultOptions} for fuzz corpora.
 */
export const DST_FAULTS: SimFaultOptions = {
  oneWayDelayMeanMs: 5,
  oneWayDelayJitterMs: 5,
  packetLossProbability: 0.02,
  packetReplayProbability: 0.01,
  reorderWindow: 2,
  partitionProbability: 0.01,
  unpartitionProbability: 0.05,
};

/** Sample fault options from RNG (bounded ranges suitable for sync tests). */
export function sampleFaultOptions(rng: SeededRng): SimFaultOptions {
  return {
    oneWayDelayMeanMs: rng.int(80),
    oneWayDelayJitterMs: rng.int(40),
    packetLossProbability: rng.int(31) / 100,
    packetReplayProbability: rng.int(21) / 100,
    reorderWindow: rng.int(5),
    partitionProbability: rng.int(6) / 100,
    unpartitionProbability: (1 + rng.int(10)) / 100,
  };
}
