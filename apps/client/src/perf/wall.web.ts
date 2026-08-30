// @io-wall-ok — browser Performance / rAF / web-vitals wall adapter.

import { onCLS, onINP, onLCP } from 'web-vitals/attribution';

import {
  createNoopPerfSampler,
  EMPTY_PERF_SNAPSHOT,
  type PerfListener,
  type PerfSampler,
  type PerfSnapshot,
} from './types';

const FRAME_BUDGET_MS = 1000 / 60;
const SLOW_FRAME_MS = FRAME_BUDGET_MS;
const FROZEN_FRAME_MS = 700;

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

function readHeapMb(): number | null {
  const perf = globalThis.performance as Performance & {
    memory?: { usedJSHeapSize: number };
  };
  const used = perf.memory?.usedJSHeapSize;
  if (typeof used !== 'number' || !Number.isFinite(used)) return null;
  return Math.round((used / (1024 * 1024)) * 10) / 10;
}

function createEmit(
  listeners: Set<PerfListener>,
  snap: MutableSnapshot
): () => void {
  return () => {
    const next: PerfSnapshot = { ...snap };
    for (const listener of listeners) listener(next);
  };
}

function createFrameLoop(args: {
  snap: MutableSnapshot;
  bucket: FrameBucket;
  isRunning: () => boolean;
  emit: () => void;
  setRafId: (id: number) => void;
}): (ts: number) => void {
  const { snap, bucket, isRunning, emit, setRafId } = args;
  const onFrame = (ts: number): void => {
    if (!isRunning()) return;
    if (bucket.lastTs > 0) {
      const delta = ts - bucket.lastTs;
      bucket.frames += 1;
      if (delta > SLOW_FRAME_MS) bucket.slowFrames += 1;
      if (delta > FROZEN_FRAME_MS) bucket.frozenFrames += 1;
    }
    bucket.lastTs = ts;
    if (bucket.bucketStarted === 0) bucket.bucketStarted = ts;
    const elapsed = ts - bucket.bucketStarted;
    if (elapsed >= 1000) {
      const secs = elapsed / 1000;
      snap.fps = Math.round(bucket.frames / secs);
      const total = Math.max(bucket.frames, 1);
      snap.slowFramePct = Math.round((bucket.slowFrames / total) * 1000) / 10;
      snap.frozenFramePct =
        Math.round((bucket.frozenFrames / total) * 1000) / 10;
      bucket.frames = 0;
      bucket.slowFrames = 0;
      bucket.frozenFrames = 0;
      bucket.bucketStarted = ts;
      snap.heapMb = readHeapMb();
      // Emit at most ~1Hz from the FPS bucket — never on every longtask.
      emit();
    }
    setRafId(globalThis.requestAnimationFrame(onFrame));
  };
  return onFrame;
}

function attachWebVitals(snap: MutableSnapshot): void {
  onINP(
    (metric) => {
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
      // Fields only — HUD paints on the next FPS tick.
    },
    { reportAllChanges: true }
  );
  onLCP((metric) => {
    snap.lcpMs = Math.round(metric.value);
  });
  onCLS((metric) => {
    snap.cls = Math.round(metric.value * 1000) / 1000;
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

/**
 * Web performance sampler: FPS via rAF, Core Web Vitals via web-vitals
 * attribution (INP + LoAF longestScript), longtask observer, optional heap.
 */
export function createWallPerfSampler(): PerfSampler {
  if (typeof globalThis.window === 'undefined') {
    return createNoopPerfSampler();
  }

  const listeners = new Set<PerfListener>();
  const snap: MutableSnapshot = { ...EMPTY_PERF_SNAPSHOT };
  const bucket: FrameBucket = {
    frames: 0,
    slowFrames: 0,
    frozenFrames: 0,
    lastTs: 0,
    bucketStarted: 0,
  };

  let running = false;
  let rafId = 0;
  let longTaskObs: PerformanceObserver | null = null;
  let vitalsAttached = false;
  const emit = createEmit(listeners, snap);
  const onFrame = createFrameLoop({
    snap,
    bucket,
    isRunning: () => running,
    emit,
    setRafId: (id) => {
      rafId = id;
    },
  });

  return {
    start() {
      if (running) return;
      running = true;
      bucket.frames = 0;
      bucket.slowFrames = 0;
      bucket.frozenFrames = 0;
      bucket.lastTs = 0;
      bucket.bucketStarted = 0;
      if (!vitalsAttached) {
        attachWebVitals(snap);
        vitalsAttached = true;
      }
      longTaskObs = attachLongTasks(snap);
      rafId = globalThis.requestAnimationFrame(onFrame);
    },
    stop() {
      running = false;
      if (rafId !== 0) {
        globalThis.cancelAnimationFrame(rafId);
        rafId = 0;
      }
      longTaskObs?.disconnect();
      longTaskObs = null;
    },
    getSnapshot: () => ({ ...snap }),
    subscribe(listener) {
      listeners.add(listener);
      listener({ ...snap });
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type { PerfSampler, PerfSnapshot } from './types';
export { createNoopPerfSampler } from './types';
