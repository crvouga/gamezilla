import { expect, test } from 'bun:test';
import type { Page } from '@playwright/test';
import {
  type Samples,
  withSokobanTiming,
} from '../storybook/sokoban-timing-probe';

function observer<T>(callbacks: Set<T>) {
  return class {
    constructor(readonly callback: T) {}
    observe() {
      callbacks.add(this.callback);
    }
    disconnect() {
      callbacks.delete(this.callback);
    }
  };
}

function browserProbe() {
  const mutations = new Set<() => void>();
  const tasks = new Set<(list: { getEntries: () => unknown[] }) => void>();
  const frames = new Map<number, () => void>();
  let nextFrame = 0;
  let now = 0;
  const ports = {
    MutationObserver: observer(mutations),
    PerformanceObserver: observer(tasks),
    requestAnimationFrame: (callback: () => void) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    },
    cancelAnimationFrame: (id: number) => frames.delete(id),
    performance: { now: () => ++now, timeOrigin: 0 },
  };
  const descriptors = Object.keys(ports).map(
    (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const
  );
  for (const [key, value] of Object.entries(ports)) {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  const counts = document.createElement('div');
  counts.setAttribute('data-testid', 'sokoban-counts');
  document.body.append(counts);
  return {
    mutations,
    tasks,
    frames,
    move() {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight' })
      );
      for (const callback of mutations) callback();
    },
    restore() {
      counts.remove();
      for (const [key, descriptor] of descriptors) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

// Evaluates the same self-contained functions Playwright sends to the browser.
const page = {
  evaluate: (callback: () => unknown) => Promise.resolve().then(callback),
} as unknown as Pick<Page, 'evaluate'>;
const scope = window as unknown as { sokobanSamples?: Samples };

// regression: sokoban-timing-observers-survive-measurement
for (const fails of [false, true]) {
  test(`three timing passes dispose observers and pending frames (failure=${fails})`, async () => {
    const probe = browserProbe();
    const previousKeydown = window.onkeydown;
    const forwarding = () => {};
    window.onkeydown = forwarding;
    const completed: Samples[] = [];
    const failure = new Error('timing assertion failed');
    try {
      for (let pass = 0; pass < 3; pass++) {
        const run = withSokobanTiming(page, () => {
          expect(window.onkeydown).toBeNull();
          expect(probe.mutations.size).toBe(1);
          expect(probe.tasks.size).toBe(1);
          const samples = scope.sokobanSamples;
          if (!samples) throw new Error('Missing samples');
          completed.push(samples);
          probe.move();
          expect(probe.frames.size).toBe(1);
          for (const [id, callback] of probe.frames) {
            probe.frames.delete(id);
            callback();
          }
          expect(samples.inputToFrameMs).toEqual([1]);
          const task = { duration: 60, toJSON: () => ({ duration: 60 }) };
          for (const callback of probe.tasks)
            callback({ getEntries: () => [task] });
          expect(samples.longTaskMs).toEqual([60]);
          // Leave a pending frame: even a failed measurement must cancel it.
          probe.move();
          return fails ? Promise.reject(failure) : Promise.resolve();
        });
        if (fails)
          expect(await run.catch((error: unknown) => error)).toBe(failure);
        else await run;
        expect(probe.mutations.size).toBe(0);
        expect(probe.tasks.size).toBe(0);
        expect(probe.frames.size).toBe(0);
        expect(scope.sokobanSamples).toBeUndefined();
        expect(window.onkeydown).toBe(forwarding);
        // A later input cannot append to samples owned by a finished pass.
        probe.move();
        document.dispatchEvent(new Event('pointerdown'));
        expect(completed.map((samples) => samples.inputs.length)).toEqual(
          Array.from({ length: pass + 1 }, () => 2)
        );
      }
    } finally {
      probe.restore();
      window.onkeydown = previousKeydown;
    }
  });
}
