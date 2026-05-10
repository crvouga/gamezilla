export type { IndexDialect } from './dialect';
export {
  normalizeIndexSpec,
  normalizeIndexSpecs,
  PATCH_DB_INDEX_NAME_PREFIX,
  type NormalizedIndexField as NormalizedIndexColumn,
  type NormalizedIndexSpec,
  type NormalizedIndexWhere,
  type PatchDbIndexAttributeRef,
  type PatchDbIndexField as PatchDbIndexColumn,
  type PatchDbIndexSpec,
  type PatchDbIndexWhere,
} from './index-spec';
export {
  reconcileSnapshotIndexes,
  type ReconcileSnapshotIndexesArgs,
  type ReconcileSnapshotIndexesResult,
} from './reconcile';
