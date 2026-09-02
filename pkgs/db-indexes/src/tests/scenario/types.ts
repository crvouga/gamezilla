import type { ReconcileReport, WorkloadManifest } from '../../core/types';
import type { SimDb } from '../../sim/sim-db';
import type { IndexesReconcilerHandle } from './nodes';

export type IndexesModel = {
  cycleCount: number;
};

export type { IndexesReconcilerHandle };

export function reconcilerOf(
  world: import('@pkgs/determinism').World<
    Record<string, import('@pkgs/determinism').KnobDef>,
    Record<string, import('@pkgs/determinism').NodeEntry>
  >
): IndexesReconcilerHandle {
  return world.nodes['reconciler'] as IndexesReconcilerHandle;
}

export type { ReconcileReport, SimDb, WorkloadManifest };
