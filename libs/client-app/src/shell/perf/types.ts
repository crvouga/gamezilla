/**
 * Performance monitor ports — injected from the wall adapter (`wall.ts`).
 * Product / UI code never calls `performance.now` or rAF directly.
 */

export type PerfSnapshot = {
  readonly fps: number;
  readonly slowFramePct: number;
  readonly frozenFramePct: number;
  readonly longTaskCount: number;
  readonly maxLongTaskMs: number;
  readonly inpMs: number | null;
  readonly inpTarget: string | null;
  readonly longestScript: string | null;
  readonly lcpMs: number | null;
  readonly cls: number | null;
  readonly heapMb: number | null;
};

export type PerfListener = (snapshot: PerfSnapshot) => void;

export type PerfSampler = {
  readonly start: () => void;
  readonly stop: () => void;
  readonly getSnapshot: () => PerfSnapshot;
  readonly subscribe: (listener: PerfListener) => () => void;
};

export const EMPTY_PERF_SNAPSHOT: PerfSnapshot = {
  fps: 0,
  slowFramePct: 0,
  frozenFramePct: 0,
  longTaskCount: 0,
  maxLongTaskMs: 0,
  inpMs: null,
  inpTarget: null,
  longestScript: null,
  lcpMs: null,
  cls: null,
  heapMb: null,
};

/** No-op sampler for harness / hosts without a frame loop / tests. */
export function createNoopPerfSampler(): PerfSampler {
  return {
    start: () => undefined,
    stop: () => undefined,
    getSnapshot: () => EMPTY_PERF_SNAPSHOT,
    subscribe: () => () => undefined,
  };
}
