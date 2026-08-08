import type { SeededRng } from '../../sim/rng';
import type { SimWorld } from '../../sim/world';
import {
  dispatchWorkloadAction,
  pickWorkloadAction,
  type WorkloadAction,
} from './workload-actions';

export type { WorkloadAction };

/** Seeded action stream for fuzz / swarm testing. */
export function* generateWorkload(
  rng: SeededRng,
  clientIds: readonly string[],
  steps: number
): Generator<WorkloadAction> {
  if (clientIds.length === 0) return;
  for (let i = 0; i < steps; i += 1) {
    yield pickWorkloadAction(rng, clientIds);
  }
}

export async function applyWorkloadAction(
  world: SimWorld,
  action: WorkloadAction
): Promise<void> {
  await dispatchWorkloadAction(world, action);
}
