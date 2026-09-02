import type { SeededRng } from './rng';

/** VOPR-style network fault knobs derived from a seed stream. */
export type SimFaultOptions = {
  readonly latencyMeanMs: number;
  readonly latencyJitterMs: number;
  readonly dropProbability: number;
  readonly packetReplayProbability: number;
  readonly reorderWindow: number;
  readonly partitionProbability: number;
  readonly healProbability: number;
};

export const RELIABLE_FAULTS: SimFaultOptions = {
  latencyMeanMs: 0,
  latencyJitterMs: 0,
  dropProbability: 0,
  packetReplayProbability: 0,
  reorderWindow: 0,
  partitionProbability: 0,
  healProbability: 0,
};

/**
 * Mild fixed faults for system scenarios that should exercise reorder/loss
 * without sampling (still fully deterministic for a given seed stream on
 * delay draws). Prefer {@link sampleFaultOptions} for fuzz corpora.
 */
export const DST_FAULTS: SimFaultOptions = {
  latencyMeanMs: 5,
  latencyJitterMs: 5,
  dropProbability: 0.02,
  packetReplayProbability: 0.01,
  reorderWindow: 2,
  partitionProbability: 0.01,
  healProbability: 0.05,
};

/** Sample fault options from RNG (bounded ranges suitable for sync tests). */
export function sampleFaultOptions(rng: SeededRng): SimFaultOptions {
  return {
    latencyMeanMs: rng.int(80),
    latencyJitterMs: rng.int(40),
    dropProbability: rng.int(31) / 100,
    packetReplayProbability: rng.int(21) / 100,
    reorderWindow: rng.int(5),
    partitionProbability: rng.int(6) / 100,
    healProbability: (1 + rng.int(10)) / 100,
  };
}
