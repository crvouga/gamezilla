import { defineAction } from '@pkgs/harness';
import { describeUiOp, performUiOp, type UiOp } from '@pkgs/ui-testing';

import { HARNESS_PRIMARY_SERVER_ID } from '../fabric/server-nodes';
import { ensureActor } from './actor-ui';
import type { ProductHarness } from './harness';
import { caps, partitioned } from './observations';

export const spawnActor = defineAction({
  name: 'spawnActor',
  act: async (s: ProductHarness, id: string) => {
    if (id === '') return;
    await ensureActor(s, id);
  },
});

export const resetActor = defineAction({
  name: 'resetActor',
  pool: false,
  act: async (s: ProductHarness, id: string) => {
    await s.runtime.resetActor(id);
  },
});

/** App killed and reopened (same device, same storage). */
export const restartApp = defineAction({
  name: 'restartApp',
  pool: false,
  act: async (s: ProductHarness, id: string) => {
    await s.runtime.restartActor(id);
    await ensureActor(s, id);
  },
});

export const partition = defineAction({
  name: 'partition',
  // Connectivity can change while every app is closed, before a later reopen.
  enabled: (s: ProductHarness) => caps(s).includes('partition'),
  act: (s: ProductHarness, id: string) => {
    if (id === '') return;
    s.session.network.partition(HARNESS_PRIMARY_SERVER_ID, id);
  },
});

export const restoreNetwork = defineAction({
  name: 'restoreNetwork',
  enabled: (s: ProductHarness) =>
    caps(s).includes('partition') && partitioned(s).length > 0,
  act: (s: ProductHarness) => {
    s.session.network.healAll();
  },
});

/** Restore one person's connection while others may remain away. */
export const restoreActorConnection = defineAction({
  name: 'restoreActorConnection',
  enabled: (s: ProductHarness) =>
    caps(s).includes('partition') && partitioned(s).length > 0,
  act: (s: ProductHarness, id: string) => {
    s.session.network.heal(HARNESS_PRIMARY_SERVER_ID, id);
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
  enabled: (s: ProductHarness) => s.session.caps.has('virtualTime'),
  act: async (s: ProductHarness, ms: number) => {
    const end = s.session.ports.clock.now() + ms;
    for (;;) {
      await s.session.waitForIdle();
      const left = end - s.session.ports.clock.now();
      if (left <= TIME_PASS_SETTLE_MS) break;
      const hop = Math.min(TIME_PASS_HOP_MS, left - TIME_PASS_SETTLE_MS);
      await s.session.scheduler.underlying.sleep(hop);
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
  act: async (s: ProductHarness, op: UiOp) => {
    const handle = s.actors.get(op.actorId);
    if (handle === undefined) return;
    await performUiOp(handle.ui, op);
  },
});
