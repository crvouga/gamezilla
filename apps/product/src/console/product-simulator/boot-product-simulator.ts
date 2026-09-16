import {
  type BootProductSimulatorOptions,
  buildProductSimulatorSession,
} from '@apps/product/product-simulator/product-simulator-session';
import {
  type ProductSim,
  product,
  productExtra,
  type Sim,
} from '@apps/product/sim';
import type { Clock, Timers } from '@pkgs/clock';
import type { ObjectStore } from '@pkgs/object-store/interface';
import { defineAction, type Run } from '@pkgs/sim';
import {
  createProductSimulatorLogBuffer,
  type ProductSimulatorSession,
} from '@pkgs/sim-console/client';

export type ProductSimulatorBootEnv = {
  readonly clock: Clock;
  readonly timers: Timers;
  readonly snapshotStore: ObjectStore;
};

function startSimClockTick(
  sim: Sim,
  env: ProductSimulatorBootEnv
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
      void sim.scheduler.runFor(delta).catch(() => {
        // ignore disposed sim
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

async function pinSim(s: Run<ProductSim>): Promise<ProductSim> {
  let pinned: ProductSim | null = null;
  const capture = defineAction({
    name: 'bootProductSimulator.pinSim',
    report: false,
    act: (surface: ProductSim) => {
      pinned = surface;
    },
  });
  await s.apply(capture);
  if (pinned === null) {
    throw new Error('bootProductSimulator: surface pin did not run');
  }
  return pinned;
}

/**
 * Boot the shared product System and adapt it to a ProductSimulatorSession.
 * Default host `in-process` (Solid DOM). Optional `bun-webview`
 * embeds actor URLs against localhost when a web sidecar is up.
 * Console must not open a Session / createSim itself.
 */
export async function bootProductSimulatorSession(
  env: ProductSimulatorBootEnv,
  opts?: BootProductSimulatorOptions
): Promise<ProductSimulatorSession> {
  const host: 'in-process' | 'bun-webview' = opts?.runtime ?? 'in-process';
  const run = await product.run({ seed: 1, runtime: host });
  const surface = await pinSim(run);
  const extra = productExtra(surface);
  const sim = surface.sim;
  let httpListener: { stop(): Promise<void> } | null = null;
  let actorWebOrigin: string | undefined;
  if (extra.http.kind === 'localhost') {
    const { listenSimHttpServer } = await import(
      '@apps/product/sim/hosts/localhost-http'
    );
    httpListener = await listenSimHttpServer(sim);
  }
  if (extra.ui.kind === 'bun-webview') {
    actorWebOrigin = extra.ui.webOrigin;
  }
  const clock = startSimClockTick(sim, env);
  const domainWake: { fire: (label: string) => void } = {
    fire() {},
  };
  const session = await buildProductSimulatorSession({
    sim,
    balancerLogs: createProductSimulatorLogBuffer(),
    pubsubLogs: createProductSimulatorLogBuffer(),
    roomLogs: createProductSimulatorLogBuffer(),
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
