import { defineScenario } from '@pkgs/dst';
import { planIndexes } from '../../core/plan';
import { INDEXES_ACTIONS } from './actions';
import { checkIndexesInvariants } from './invariants';
import { indexesReconcilerNode } from './nodes';
import type { IndexesModel } from './types';
import { reconcilerOf } from './types';

async function settleIndexes(
  world: import('@pkgs/dst').World<
    Record<string, import('@pkgs/dst').KnobDef>,
    Record<string, import('@pkgs/dst').NodeEntry>
  >
): Promise<void> {
  await world.quiesce();
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

export const INDEXES_SYSTEM = defineScenario({
  id: 'db-indexes.reconcile',
  knobs: {},
  nodes: {
    reconciler: {
      ...indexesReconcilerNode,
      id: () => 'reconciler',
    },
  },
  commands: INDEXES_ACTIONS,
  referenceModel: {
    initial: (): IndexesModel => ({ cycleCount: 0 }),
  },
  converge: settleIndexes,
  always: async (world) => {
    await checkIndexesInvariants(reconcilerOf(world));
  },
});
