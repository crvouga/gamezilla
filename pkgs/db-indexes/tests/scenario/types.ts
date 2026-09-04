import type { Session } from '@pkgs/dst';
import type { ReconcileReport, WorkloadManifest } from '../../core/types';
import type { SimDb } from '../../sim/sim-db';
import type { IndexesReconcilerHandle } from './nodes';

export type IndexesSurface = {
  readonly session: Session;
  readonly reconciler: IndexesReconcilerHandle;
};

export function reconcilerOf(s: IndexesSurface): IndexesReconcilerHandle {
  return s.reconciler;
}

export type {
  IndexesReconcilerHandle,
  ReconcileReport,
  SimDb,
  WorkloadManifest,
};
