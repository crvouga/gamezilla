import {
  type ActionCatalog,
  defineScenario,
  properties,
  property,
} from '@pkgs/dst';
import { planIndexes } from '../../core/plan';
import { INDEXES_ACTIONS } from './actions';
import { checkIndexesInvariants } from './invariants';
import { indexesReconcilerNode } from './nodes';
import type { IndexesSurface } from './types';
import { reconcilerOf } from './types';

async function settleIndexes(world: IndexesSurface): Promise<void> {
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
      id: (): 'reconciler' => 'reconciler',
    },
  },
  actions: INDEXES_ACTIONS as unknown as ActionCatalog<IndexesSurface>,
  properties: properties<IndexesSurface>()({
    invariants: property.always(async (surface: IndexesSurface) => {
      await checkIndexesInvariants(reconcilerOf(surface));
      return true;
    }),
  }),
  converge: settleIndexes,
} as unknown as import('@pkgs/dst').AnyScenarioDef);
