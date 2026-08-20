// @io-wall-ok — composition root: createSim + wall-driven sim clock advance.

import { wallClock, wallTimers } from '@pkgs/clock';
import {
  createPlaygroundLogBuffer,
  type PlaygroundSession,
} from '@pkgs/sim-console/client';
import {
  type BootPlaygroundOptions,
  buildPlaygroundSession,
} from '@sim/console/playground/playground-session';
import { createPlaygroundSnapshotStore } from '@sim/console/playground/playground-snapshot-store';
import { createSim, type Sim } from '@sim/console/sim/create-sim';

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
    if (delta > 0) sim.clock.advance(delta);
  }, 16);
  return {
    disposeTick: () => wallTimers.clearInterval(tickHandle),
    getClockPaused: () => clockPaused,
    setClockPaused: (paused) => {
      clockPaused = paused;
    },
  };
}

export async function bootPlaygroundSession(
  opts?: BootPlaygroundOptions
): Promise<PlaygroundSession> {
  const sim = await createSim({ seed: 1, startMs: wallClock.now() });
  await sim.spawnServer();
  const clock = startSimClockTick(sim);
  const domainWake: { fire: (label: string) => void } = {
    fire() {},
  };
  return buildPlaygroundSession({
    sim,
    serverLogs: createPlaygroundLogBuffer(),
    pubsubLogs: createPlaygroundLogBuffer(),
    roomLogs: createPlaygroundLogBuffer(),
    snapshotStore: createPlaygroundSnapshotStore(wallTimers, {
      fetch: (input, init) => globalThis.fetch(input, init),
    }),
    disposeTick: clock.disposeTick,
    getClockPaused: clock.getClockPaused,
    setClockPaused: clock.setClockPaused,
    skipSnapshotLoad: opts?.skipSnapshotLoad === true,
    bindDomainWake: (fire) => {
      domainWake.fire = fire;
    },
  });
}
