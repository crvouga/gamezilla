export type { Config } from './core/config';
export { DEFAULT_CONFIG, resolveConfig } from './core/config';
export { fingerprintSql, normalizeSql } from './core/fingerprint';
export {
  type AnalyzeIndexabilityArgs,
  analyzeIndexability,
  assertIndexableWorkload,
  type IndexabilityGap,
  type IndexabilityGapReason,
  type IndexabilityReport,
} from './core/indexability';
export { LIMITS } from './core/limits';
export {
  assertIsOwnedName,
  canonicalDefinition,
  definitionsEqual,
  isOwnedName,
  ownedIndexName,
} from './core/naming';
export { parseWithNodeSqlParser } from './core/parse-node-sql';
export { planIndexes } from './core/plan';
export { reconcileIndexes } from './core/reconcile';
export { renderPlanMarkdown } from './core/render';
export {
  anySchemaCoversPath,
  isPkOnlyPath,
  pathKeyColumns,
  pkSchemaIndexes,
  type SchemaIndex,
  schemaCoversPath,
} from './core/schema-coverage';
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
