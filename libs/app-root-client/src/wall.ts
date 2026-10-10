// @io-wall-ok — browser Performance / rAF / web-vitals wall adapter.
/**
 * Web performance sampler: FPS via rAF, Core Web Vitals via web-vitals
 * attribution (INP + LoAF longestScript), longtask observer, optional heap.
 * Snapshots are emitted at ~1 Hz from the injected {@link Timers} — never on
 * every frame or long task.
 */

import type {
  PerfListener,
  PerfSampler,
  PerfSnapshot,
} from '@libs/app-root-shared/types';
import {
  createNoopPerfSampler,
  EMPTY_PERF_SNAPSHOT,
} from '@libs/app-root-shared/types';
import type { Timers } from '@pkgs/clock-shared/types';
import { createMetric } from '@pkgs/observability-root-shared/metric-contract';
import { onCLS, onINP, onLCP } from 'web-vitals/attribution';

const FRAME_BUDGET_MS = 1000 / 60;
const SLOW_FRAME_MS = FRAME_BUDGET_MS;
const FROZEN_FRAME_MS = 700;
const EMIT_INTERVAL_MS = 1000;

type MutableSnapshot = {
  -readonly [K in keyof PerfSnapshot]: PerfSnapshot[K];
};

type FrameBucket = {
  frames: number;
  slowFrames: number;
  frozenFrames: number;
  lastTs: number;
  bucketStarted: number;
};

type FrameScheduler = {
  readonly requestAnimationFrame: (cb: (ts: number) => void) => number;
  readonly cancelAnimationFrame: (id: number) => void;
};

function readFrameScheduler(): FrameScheduler | null {
  const g = globalThis as Partial<FrameScheduler>;
  if (
    typeof g.requestAnimationFrame !== 'function' ||
    typeof g.cancelAnimationFrame !== 'function'
  ) {
    return null;
  }
  return {
    requestAnimationFrame: g.requestAnimationFrame.bind(globalThis),
    cancelAnimationFrame: g.cancelAnimationFrame.bind(globalThis),
  };
}

function readHeapMb(): number | null {
  const perf = globalThis.performance as Performance & {
    memory?: { usedJSHeapSize: number };
  };
  const used = perf.memory?.usedJSHeapSize;
  if (typeof used !== 'number' || !Number.isFinite(used)) return null;
  return Math.round((used / (1024 * 1024)) * 10) / 10;
}

function resetBucket(bucket: FrameBucket): void {
  bucket.frames = 0;
  bucket.slowFrames = 0;
  bucket.frozenFrames = 0;
  bucket.lastTs = 0;
  bucket.bucketStarted = 0;
}

function countFrame(bucket: FrameBucket, ts: number): void {
  if (bucket.lastTs > 0) {
    const delta = ts - bucket.lastTs;
    bucket.frames += 1;
    if (delta > SLOW_FRAME_MS) bucket.slowFrames += 1;
    if (delta > FROZEN_FRAME_MS) bucket.frozenFrames += 1;
  }
  bucket.lastTs = ts;
  if (bucket.bucketStarted === 0) bucket.bucketStarted = ts;
}

/** Fold the frame bucket into the snapshot and start a fresh bucket. */
function flushBucket(bucket: FrameBucket, snap: MutableSnapshot): void {
  const elapsed = bucket.lastTs - bucket.bucketStarted;
  if (elapsed <= 0) {
    snap.fps = 0;
  } else {
    const secs = elapsed / 1000;
    snap.fps = Math.round(bucket.frames / secs);
    const total = Math.max(bucket.frames, 1);
    snap.slowFramePct = Math.round((bucket.slowFrames / total) * 1000) / 10;
    snap.frozenFramePct = Math.round((bucket.frozenFrames / total) * 1000) / 10;
  }
  bucket.frames = 0;
  bucket.slowFrames = 0;
  bucket.frozenFrames = 0;
  bucket.bucketStarted = bucket.lastTs;
  snap.heapMb = readHeapMb();
}

function attachWebVitals(snap: MutableSnapshot): void {
  const recordInp = vitalMetric('inp', 'ms');
  const recordLcp = vitalMetric('lcp', 'ms');
  const recordCls = vitalMetric('cls', '1');
  try {
    onINP(
      (metric) => {
        recordInp(metric.value, {});
        snap.inpMs = Math.round(metric.value);
        const attr = metric.attribution;
        snap.inpTarget =
          typeof attr.interactionTarget === 'string'
            ? attr.interactionTarget
            : null;
        const longest = attr.longestScript;
        if (longest?.entry) {
          const name =
            longest.entry.sourceFunctionName ||
            longest.entry.sourceURL ||
            'unknown';
          snap.longestScript = `${name} (${Math.round(longest.entry.duration)}ms)`;
        } else {
          snap.longestScript = null;
        }
      },
      { reportAllChanges: true }
    );
    onLCP((metric) => {
      recordLcp(metric.value, {});
      snap.lcpMs = Math.round(metric.value);
    });
    onCLS((metric) => {
      recordCls(metric.value, {});
      snap.cls = Math.round(metric.value * 1000) / 1000;
    });
  } catch {
    // Hosts without the Performance Timeline (test DOMs) keep the fields null.
  }
}

function vitalMetric(name: 'inp' | 'lcp' | 'cls', unit: 'ms' | '1') {
  return createMetric({
    name: `web.vital.${name}`,
    description: `Reported ${name.toUpperCase()} observations`,
    unit,
    type: 'histogram',
    dimensions: {},
  });
}

function attachLongTasks(snap: MutableSnapshot): PerformanceObserver | null {
  if (typeof PerformanceObserver === 'undefined') return null;
  try {
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        snap.longTaskCount += 1;
        snap.maxLongTaskMs = Math.max(
          snap.maxLongTaskMs,
          Math.round(entry.duration)
        );
      }
    });
    obs.observe({ type: 'longtask', buffered: true });
    return obs;
  } catch {
    return null;
  }
}

class WallPerfSampler implements PerfSampler {
  private readonly listeners = new Set<PerfListener>();
  private readonly snap: MutableSnapshot = { ...EMPTY_PERF_SNAPSHOT };
  private readonly bucket: FrameBucket = {
    frames: 0,
    slowFrames: 0,
    frozenFrames: 0,
    lastTs: 0,
    bucketStarted: 0,
  };
  private running = false;
  private rafId = 0;
  private emitTimer: unknown = null;
  private longTaskObs: PerformanceObserver | null = null;
  private vitalsAttached = false;

  constructor(
    private readonly timers: Timers,
    private readonly frames: FrameScheduler
  ) {}

  readonly start = (): void => {
    if (this.running) return;
    this.running = true;
    resetBucket(this.bucket);
    if (!this.vitalsAttached) {
      attachWebVitals(this.snap);
      this.vitalsAttached = true;
    }
    this.longTaskObs = attachLongTasks(this.snap);
    this.rafId = this.frames.requestAnimationFrame(this.onFrame);
    this.emitTimer = this.timers.setInterval(this.tick, EMIT_INTERVAL_MS);
  };

  readonly stop = (): void => {
    this.running = false;
    if (this.rafId !== 0) {
      this.frames.cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    if (this.emitTimer !== null) {
      this.timers.clearInterval(this.emitTimer);
      this.emitTimer = null;
    }
    this.longTaskObs?.disconnect();
    this.longTaskObs = null;
  };

  readonly getSnapshot = (): PerfSnapshot => ({ ...this.snap });

  readonly subscribe = (listener: PerfListener): (() => void) => {
    this.listeners.add(listener);
    listener({ ...this.snap });
    return () => {
      this.listeners.delete(listener);
    };
  };

  private readonly onFrame = (ts: number): void => {
    if (!this.running) return;
    countFrame(this.bucket, ts);
    this.rafId = this.frames.requestAnimationFrame(this.onFrame);
  };

  private readonly tick = (): void => {
    if (!this.running) return;
    flushBucket(this.bucket, this.snap);
    const next: PerfSnapshot = { ...this.snap };
    for (const listener of this.listeners) listener(next);
  };
}

/**
 * Browser sampler; falls back to the no-op sampler when the host has no frame
 * scheduler (server / bare test runtimes).
 */
export function createWallPerfSampler(args: {
  readonly timers: Timers;
}): PerfSampler {
  const frames = readFrameScheduler();
  if (frames === null) return createNoopPerfSampler();
  return new WallPerfSampler(args.timers, frames);
}
