import { afterAll, afterEach, beforeAll, expect, test } from 'bun:test';
import { trace } from '@opentelemetry/api';
import { InMemorySpanExporter } from '@opentelemetry/sdk-trace-base';
import type { BrowserTelemetry } from '@pkgs/observability-root-client/browser';
import { createBrowserTelemetry } from '@pkgs/observability-root-client/browser';
import {
  installMainThreadStallWatch,
  STALL_PROBE_MS,
  STALL_THRESHOLD_MS,
} from '@pkgs/observability-root-client/main-thread-stall';
import { ATTR } from '@pkgs/observability-root-shared/attributes';

const START_MS = 1_700_000_000_000;

let exporter: InMemorySpanExporter;
let runtime: BrowserTelemetry;

beforeAll(() => {
  exporter = new InMemorySpanExporter();
  runtime = createBrowserTelemetry({
    serviceName: 'main-thread-stall',
    serviceVersion: '1',
    environment: 'test',
    buildSha: 'abc',
    registerGlobal: true,
    exporter,
    instrumentFetch: false,
  });
});

afterEach(() => exporter.reset());

afterAll(async () => {
  await runtime.shutdown();
  trace.disable();
});

/** A page whose clock, probe timer and visibility the test drives. */
function page() {
  const state = { nowMs: START_MS, visibility: 'visible' };
  let probe: (() => void) | null = null;
  const listeners = new Set<() => void>();
  const remove = installMainThreadStallWatch({
    now: () => state.nowMs,
    timers: {
      setInterval(fn, ms) {
        expect(ms).toBe(STALL_PROBE_MS);
        probe = fn;
        return fn;
      },
      clearInterval() {
        probe = null;
      },
    },
    document: {
      get visibilityState() {
        return state.visibility;
      },
      addEventListener: (_type, listener) => listeners.add(listener),
      removeEventListener: (_type, listener) => listeners.delete(listener),
    },
  });
  return {
    remove,
    watching: () => probe !== null,
    /** The probe runs after `ms`: on time, or late when the page was held. */
    probeAfter(ms: number) {
      state.nowMs += ms;
      probe?.();
    },
    show(visibility: 'visible' | 'hidden') {
      state.visibility = visibility;
      for (const listener of [...listeners]) listener();
    },
    elapse(ms: number) {
      state.nowMs += ms;
    },
  };
}

async function stalls() {
  await runtime.forceFlush();
  return exporter
    .getFinishedSpans()
    .filter((span) => span.name === 'main_thread.stall')
    .map((span) => ({
      startMs: span.startTime[0] * 1000 + Math.round(span.startTime[1] / 1e6),
      heldMs: span.attributes[ATTR.APP_MAIN_THREAD_STALL_MS],
    }));
}

test('a probe kept waiting half a second is one stall span covering the wait', async () => {
  const watched = page();
  watched.probeAfter(STALL_PROBE_MS);
  watched.probeAfter(STALL_PROBE_MS + 520);
  watched.probeAfter(STALL_PROBE_MS);

  expect(await stalls()).toEqual([
    { startMs: START_MS + 2 * STALL_PROBE_MS, heldMs: 520 },
  ]);
  watched.remove();
});

test('a probe that is only a little late is not a stall', async () => {
  const watched = page();
  watched.probeAfter(STALL_PROBE_MS + STALL_THRESHOLD_MS - 1);
  watched.probeAfter(STALL_PROBE_MS);

  expect(await stalls()).toEqual([]);
  watched.remove();
});

test('a hidden page is not watched, and time spent hidden is not a stall', async () => {
  const watched = page();
  watched.show('hidden');
  expect(watched.watching()).toBe(false);
  watched.elapse(60_000);
  watched.show('visible');
  expect(watched.watching()).toBe(true);
  watched.probeAfter(STALL_PROBE_MS);

  expect(await stalls()).toEqual([]);
  watched.remove();
  expect(watched.watching()).toBe(false);
});
