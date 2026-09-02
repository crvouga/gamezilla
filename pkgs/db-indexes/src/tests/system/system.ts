import { defineSystem } from '@pkgs/determinism';
import { planIndexes } from '../../core/plan';
import { INDEXES_ACTIONS } from './actions';
import { checkIndexesInvariants } from './invariants';
import { indexesReconcilerNode } from './nodes';
import type { IndexesModel } from './types';
import { reconcilerOf } from './types';

async function settleIndexes(
  world: import('@pkgs/determinism').World<
    Record<string, import('@pkgs/determinism').KnobDef>,
    Record<string, import('@pkgs/determinism').NodeSpecEntry>
  >
): Promise<void> {
  await world.idle();
  const state = reconcilerOf(world);
  const plan = await planIndexes({
    manifest: state.manifest,
    db: state.db,
    clock: state.clock,
    config: {
      minTableRows: 1,
      createEstimatedMs: 10,
      maxBuildsPerRun: 3,
      maxIndexesPerTable: state.maxPerTable,
      deprecationWindowDays: 1,
    },
  });
  void plan;
}

export const INDEXES_SYSTEM = defineSystem({
  id: 'db-indexes.reconcile',
  knobs: {},
  nodes: {
    reconciler: {
      ...indexesReconcilerNode,
      id: () => 'reconciler',
    },
  },
  actions: INDEXES_ACTIONS,
  model: {
    initial: (): IndexesModel => ({ cycleCount: 0 }),
  },
  settle: settleIndexes,
  invariants: async (world) => {
    await checkIndexesInvariants(reconcilerOf(world));
  },
});
