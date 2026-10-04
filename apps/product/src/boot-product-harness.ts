import type { Harness } from '@libs/harness/create-harness';
import type { ProductHarness } from '@libs/harness/harness';
import { productExtra } from '@libs/harness/harness';
import { APP_SYSTEM } from '@libs/runtime-harness/app-composition';
import type { Clock, Timers } from '@pkgs/clock-shared/types';
import type { ProductHarnessSession } from '@pkgs/harness-console-shared/ports';
import { createProductHarnessLogBuffer } from '@pkgs/harness-console-shared/product-harness-log-buffer';
import { defineAction } from '@pkgs/harness-shared/define-action';
import type { Run } from '@pkgs/harness-shared/run-types';
import type { ObjectStore } from '@pkgs/object-store-shared/interface';
import type { BootProductHarnessOptions } from './product-harness-session';
import { buildProductHarnessSession } from './product-harness-session';

export type ProductHarnessBootEnv = {
  readonly clock: Clock;
  readonly timers: Timers;
  readonly snapshotStore: ObjectStore;
};

function startHarnessClockTick(
  harness: Harness,
  env: ProductHarnessBootEnv
): {
  readonly disposeTick: () => void;
  readonly getClockPaused: () => boolean;
  readonly setClockPaused: (paused: boolean) => void;
} {
  let clockPaused = false;
  let lastWall = env.clock.now();
  const tickHandle = env.timers.setInterval(() => {
    if (clockPaused) {
      lastWall = env.clock.now();
      return;
    }
    const now = env.clock.now();
    const delta = now - lastWall;
    lastWall = now;
    if (delta > 0) {
      void harness.scheduler.runFor(delta).catch(() => {
        // ignore disposed harness
      });
    }
  }, 16);
  return {
    disposeTick: () => env.timers.clearInterval(tickHandle),
    getClockPaused: () => clockPaused,
    setClockPaused: (paused) => {
      clockPaused = paused;
    },
  };
}

async function pinHarness(s: Run<ProductHarness>): Promise<ProductHarness> {
  let pinned: ProductHarness | null = null;
  const capture = defineAction({
    name: 'bootProductHarness.pinHarness',
    report: false,
    act: (surface: ProductHarness) => {
      pinned = surface;
    },
  });
  await s.apply(capture);
  if (pinned === null) {
    throw new Error('bootProductHarness: surface pin did not run');
  }
  return pinned;
}

/**
 * Boot the shared product System and adapt it to a ProductHarnessSession.
 * Default host `in-process` (Solid DOM). Optional `bun-webview`
 * embeds actor URLs against localhost when a web sidecar is up.
 * Console must not open a Session / createHarness itself.
 */
export async function bootProductHarnessSession(
  env: ProductHarnessBootEnv,
  opts?: BootProductHarnessOptions
): Promise<ProductHarnessSession> {
  const host: 'in-process' | 'bun-webview' = opts?.runtime ?? 'in-process';
  const run = await APP_SYSTEM.run({ seed: 1, runtime: host });
  const surface = await pinHarness(run);
  const extra = productExtra(surface);
  const harness = surface.harness;
  let httpListener: { stop(): Promise<void> } | null = null;
  let actorWebOrigin: string | undefined;
  if (extra.http.kind === 'localhost') {
    const { listenHarnessHttpServer } = await import(
      '@libs/harness/localhost-http'
    );
    httpListener = await listenHarnessHttpServer(harness);
  }
  if (extra.ui.kind === 'bun-webview') {
    actorWebOrigin = extra.ui.webOrigin;
  }
  const clock = startHarnessClockTick(harness, env);
  const domainWake: { fire: (label: string) => void } = {
    fire() {},
  };
  const session = await buildProductHarnessSession({
    harness,
    balancerLogs: createProductHarnessLogBuffer(),
    pubsubLogs: createProductHarnessLogBuffer(),
    roomLogs: createProductHarnessLogBuffer(),
    snapshotStore: env.snapshotStore,
    disposeTick: () => {
      clock.disposeTick();
      if (httpListener !== null) {
        void httpListener.stop();
      }
      void run[Symbol.asyncDispose]();
    },
    getClockPaused: clock.getClockPaused,
    setClockPaused: clock.setClockPaused,
    skipSnapshotLoad: opts?.skipSnapshotLoad === true,
    bindDomainWake: (fire) => {
      domainWake.fire = fire;
    },
    ...(actorWebOrigin !== undefined ? { actorWebOrigin } : {}),
  });
  return session;
}
