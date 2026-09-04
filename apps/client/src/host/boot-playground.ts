// @io-wall-ok — composition root: createSim + wall-driven sim clock advance.

import {
  type BootPlaygroundOptions,
  buildPlaygroundSession,
} from '@apps/client/host/playground-session';
import { createPlaygroundSnapshotStore } from '@apps/client/host/playground-snapshot-store';
import { createSim, type Sim } from '@apps/client/sim/create-sim';
import { wallClock, wallTimers } from '@pkgs/clock';
import { createPlaygroundLogBuffer } from '@pkgs/system-console/client';

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
): Promise<import('@pkgs/system-console/client').PlaygroundSession> {
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
    snapshotStore: createPlaygroundSnapshotStore(wallTimers),
    disposeTick: clock.disposeTick,
    getClockPaused: clock.getClockPaused,
    setClockPaused: clock.setClockPaused,
    skipSnapshotLoad: opts?.skipSnapshotLoad === true,
    bindDomainWake: (fire) => {
      domainWake.fire = fire;
    },
  });
}
