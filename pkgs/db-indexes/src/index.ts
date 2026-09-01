export type { Config } from './core/config';
export { DEFAULT_CONFIG, resolveConfig } from './core/config';
export { fingerprintSql, normalizeSql } from './core/fingerprint';
export { LIMITS } from './core/limits';
export {
  assertIsOwnedName,
  canonicalDefinition,
  definitionsEqual,
  isOwnedName,
  ownedIndexName,
} from './core/naming';
export { planIndexes } from './core/plan';
export { reconcileIndexes } from './core/reconcile';
export { renderPlanMarkdown } from './core/render';
export type {
  AccessPath,
  ActionResult,
  Candidate,
  DbPort,
  Eval,
  IndexDefinition,
  IndexInfo,
  IndexPlan,
  OwnedIndexName,
  OwnedMeta,
  ParsedStatement,
  PlanAction,
  ReconcileReport,
  SkippedItem,
  SkipReason,
  Stmt,
  TableInfo,
  UsageInfo,
  WorkloadManifest,
  WorkloadQuery,
  WorkloadStatement,
} from './core/types';
export { asOwnedIndexName } from './core/types';
