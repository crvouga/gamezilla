import { defineAction, type Rng } from '@pkgs/sim';
import { describeUiOp, performUiOp, type UiOp } from '@pkgs/ui-testing';

import { ensureActor } from './actor-ui';
import { caps, clientIds, partitioned } from './observations';
import type { ProductSim } from './sim';

export const spawnActor = defineAction({
  name: 'spawnActor',
  act: async (s: ProductSim, id: string) => {
    await ensureActor(s, id);
  },
});

export const resetActor = defineAction({
  name: 'resetActor',
  act: async (s: ProductSim, id: string) => {
    await s.runtime.resetActor(id);
  },
});

export const partition = defineAction({
  name: 'partition',
  enabled: (s: ProductSim) =>
    caps(s).includes('partition') && clientIds(s).length > 0,
  weight: (s: ProductSim) => (partitioned(s).length === 0 ? 2 : 1),
  sample: (s: ProductSim) => {
    const ids = clientIds(s);
    return (rng: Rng) => ids[Math.floor(rng.next() * ids.length)] ?? '';
  },
  act: (s: ProductSim, id: string) => {
    s.session.network.partition('server', id);
  },
});

export const restoreNetwork = defineAction({
  name: 'restoreNetwork',
  enabled: (s: ProductSim) => caps(s).includes('partition'),
  weight: (s: ProductSim) => Math.max(partitioned(s).length, 0),
  act: (s: ProductSim) => {
    s.session.network.healAll();
  },
});

export type { UiOp };

/** Explore-time UI stimulus (UI op as data); scenarios drive drivers directly. */
export const uiOp = defineAction({
  name: 'uiOp',
  describe: (op: UiOp) => describeUiOp(op),
  act: async (s: ProductSim, op: UiOp) => {
    const handle = s.actors.get(op.actorId);
    if (handle === undefined) return;
    await performUiOp(handle.ui, op);
  },
});
