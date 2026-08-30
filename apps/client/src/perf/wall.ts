// @io-wall-ok — native / non-web: no PerformanceObserver / web-vitals.

export type { PerfSampler, PerfSnapshot } from './types';
export {
  createNoopPerfSampler as createWallPerfSampler,
  createNoopPerfSampler,
} from './types';
