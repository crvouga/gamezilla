// @io-wall-ok — composition root: product.run + wall-driven sim clock advance.

import { wallClock, wallTimers } from '@pkgs/clock';
import { defineAction, type Run } from '@pkgs/sim';
import {
  createPlaygroundLogBuffer,
  type PlaygroundSession,
} from '@pkgs/sim-console/client';
import {
  type BootPlaygroundOptions,
  buildPlaygroundSession,
} from '@product/console/playground/playground-session';
import { createPlaygroundSnapshotStore } from '@product/console/playground/playground-snapshot-store';
import {
  listenSimHttpServer,
  type ProductSim,
  product,
  productExtra,
  type Sim,
  type SimHttpListener,
} from '@product/sim';

function startSimClockTick(sim: Sim): {
  readonly disposeTick: () => void;
  readonly getClockPaused: () => boolean;
  readonly setClockPaused: (paused: boolean) => void;
} {
  let clockPaused = false;
  let lastWall = wallClock.now();
  const tickHandle = wallTimers.setInterval(() => {
    if (clockPaused) {
      lastWall = wallClock.now();
      return;
    }
    const now = wallClock.now();
    const delta = now - lastWall;
    lastWall = now;
    if (delta > 0) {
      void sim.scheduler.runFor(delta).catch(() => {
        // ignore disposed sim
      });
    }
  }, 16);
  return {
    disposeTick: () => wallTimers.clearInterval(tickHandle),
    getClockPaused: () => clockPaused,
    setClockPaused: (paused) => {
      clockPaused = paused;
    },
  };
}

async function pinSim(s: Run<ProductSim>): Promise<ProductSim> {
  let pinned: ProductSim | null = null;
  const capture = defineAction({
    name: 'bootPlayground.pinSim',
    act: (surface: ProductSim) => {
      pinned = surface;
    },
  });
  await s.apply(capture);
  if (pinned === null) {
    throw new Error('bootPlayground: surface pin did not run');
  }
  return pinned;
}

/**
 * Boot the shared product System and adapt it to a PlaygroundSession.
 * Default host `in-process` (Expo Metro / Expo Go). Optional `bun-webview`
 * embeds actor URLs against localhost when a web sidecar is up.
 * Console must not open a Session / createSim itself.
 */
export async function bootPlaygroundSession(
  opts?: BootPlaygroundOptions
): Promise<PlaygroundSession> {
  const host: 'in-process' | 'bun-webview' = opts?.runtime ?? 'in-process';
  const run = await product.run({ seed: 1, runtime: host });
  const surface = await pinSim(run);
  const extra = productExtra(surface);
  const sim = surface.sim;
  let httpListener: SimHttpListener | null = null;
  let actorWebOrigin: string | undefined;
  if (extra.http.kind === 'localhost') {
    httpListener = await listenSimHttpServer(sim);
  }
  if (extra.ui.kind === 'bun-webview') {
    actorWebOrigin = extra.ui.webOrigin;
  }
  const clock = startSimClockTick(sim);
  const domainWake: { fire: (label: string) => void } = {
    fire() {},
  };
  const session = await buildPlaygroundSession({
    sim,
    serverLogs: createPlaygroundLogBuffer(),
    pubsubLogs: createPlaygroundLogBuffer(),
    roomLogs: createPlaygroundLogBuffer(),
    snapshotStore: createPlaygroundSnapshotStore(),
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
