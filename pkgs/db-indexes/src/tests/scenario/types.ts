import type { World } from '@pkgs/dst';

import type { ReconcileReport, WorkloadManifest } from '../../core/types';
import type { SimDb } from '../../sim/sim-db';
import type { IndexesReconcilerHandle, indexesReconcilerNode } from './nodes';

export type IndexesKnobs = Record<string, never>;

export type IndexesNodes = {
  readonly reconciler: typeof indexesReconcilerNode & {
    readonly id: () => 'reconciler';
  };
};

export type IndexesSurface = World<IndexesKnobs, IndexesNodes>;

export type IndexesModel = {
  cycleCount: number;
};

export function reconcilerOf(world: IndexesSurface): IndexesReconcilerHandle {
  return world.nodes['reconciler'] as IndexesReconcilerHandle;
}

export type {
  IndexesReconcilerHandle,
  ReconcileReport,
  SimDb,
  WorkloadManifest,
};
