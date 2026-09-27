import { defineAction } from '@pkgs/sim';
import { describeUiOp, performUiOp, type UiOp } from '@pkgs/ui-testing';

import { SIM_PRIMARY_SERVER_ID } from '../fabric/sim-server-nodes';
import { ensureActor } from './actor-ui';
import { caps, clientIds, partitioned } from './observations';
import type { ProductSim } from './sim';

export const spawnActor = defineAction({
  name: 'spawnActor',
  act: async (s: ProductSim, id: string) => {
    if (id === '') return;
    await ensureActor(s, id);
  },
});

export const resetActor = defineAction({
  name: 'resetActor',
  pool: false,
  act: async (s: ProductSim, id: string) => {
    await s.runtime.resetActor(id);
  },
});

/** App killed and reopened (same device, same storage). */
export const restartApp = defineAction({
  name: 'restartApp',
  pool: false,
  act: async (s: ProductSim, id: string) => {
    await s.runtime.restartActor(id);
    await ensureActor(s, id);
  },
});

export const partition = defineAction({
  name: 'partition',
  enabled: (s: ProductSim) =>
    caps(s).includes('partition') && clientIds(s).length > 0,
  act: (s: ProductSim, id: string) => {
    if (id === '') return;
    s.session.network.partition(SIM_PRIMARY_SERVER_ID, id);
  },
});

export const restoreNetwork = defineAction({
  name: 'restoreNetwork',
  enabled: (s: ProductSim) =>
    caps(s).includes('partition') && partitioned(s).length > 0,
  act: (s: ProductSim) => {
    s.session.network.healAll();
  },
});

/** How far one jump of {@link letTimePass} moves the world. */
const TIME_PASS_HOP_MS = 60 * 60 * 1000;
/** After each jump: long enough for the requests it set off to answer. */
const TIME_PASS_SETTLE_MS = 2_000;

/**
 * Days go by for everyone — devices, servers, the payment provider — in
 * hour-long jumps, as a sleeping machine sees them: each jump fires whatever
 * fell due once, then lets the answers land. Stepping every heartbeat through
 * a week of virtual time would take minutes; this takes a few seconds and
 * still wakes each device every hour. Needs virtual time.
 */
export const letTimePass = defineAction({
  name: 'letTimePass',
  pool: false,
  enabled: (s: ProductSim) => s.session.caps.has('virtualTime'),
  act: async (s: ProductSim, ms: number) => {
    const end = s.session.ports.clock.now() + ms;
    for (;;) {
      await s.session.waitForIdle();
      const left = end - s.session.ports.clock.now();
      if (left <= TIME_PASS_SETTLE_MS) break;
      const hop = Math.min(TIME_PASS_HOP_MS, left - TIME_PASS_SETTLE_MS);
      await s.session.scheduler.underlying.skip(hop);
      await s.session.advanceTime(TIME_PASS_SETTLE_MS);
    }
    const left = end - s.session.ports.clock.now();
    if (left > 0) await s.session.advanceTime(left);
  },
});

export type { UiOp };

/** Replay / report of a concrete UI op. */
export const uiOp = defineAction({
  name: 'uiOp',
  pool: false,
  describe: (op: UiOp) => describeUiOp(op),
  act: async (s: ProductSim, op: UiOp) => {
    const handle = s.actors.get(op.actorId);
    if (handle === undefined) return;
    await performUiOp(handle.ui, op);
  },
});
