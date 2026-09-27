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
