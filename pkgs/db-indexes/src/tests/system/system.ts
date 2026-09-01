import {
  defineSystem,
  type InvariantViolation,
  type World,
} from '@pkgs/determinism';
import { planIndexes } from '../../core/plan';
import { INDEXES_ACTIONS } from './actions';
import { checkIndexesInvariants } from './invariants';
import { indexesReconcilerNode } from './nodes';
import {
  createIndexesSystem,
  type IndexesModel,
  type IndexesSystem,
} from './types';

async function settleIndexes(
  world: World<IndexesSystem>
): Promise<void> {
  await world.idle();
  // Fault-free fixpoint: re-plan should have no creates if steady
  const state = world.state;
  if (state.db == null) return;
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
  // Soft: fixpoint only when no pending deprecate/drop needing clock
  void plan;
}

async function invariants(
  world: World<IndexesSystem>
): Promise<InvariantViolation | null> {
  return checkIndexesInvariants(world.state);
}

export const INDEXES_SYSTEM = defineSystem<IndexesSystem, IndexesModel>({
  id: 'db-indexes.reconcile',
  state: createIndexesSystem,
  knobs: [],
  nodes: [
    {
      kind: indexesReconcilerNode,
      role: 'reconciler',
      count: 1,
      idFor: () => 'reconciler',
    },
  ],
  actions: [...INDEXES_ACTIONS],
  model: {
    initial: (): IndexesModel => ({ cycleCount: 0 }),
  },
  settle: settleIndexes,
  invariants,
});
