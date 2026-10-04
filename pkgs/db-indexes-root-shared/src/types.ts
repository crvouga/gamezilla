import { assert } from '@pkgs/assert-root-shared/singleton';
import { LIMITS } from './limits';

/** Owned auto-index name: `autoidx_<table>_<hash8>`. */
export type OwnedIndexName = string & { readonly __brand: 'OwnedIndexName' };

export type ColumnOrder = 'asc' | 'desc';

export type IndexColumn = {
  readonly name: string;
  readonly order: ColumnOrder;
  readonly collation?: string;
  readonly opclass?: string;
};

/**
 * Canonical index definition used for naming and ownership.
 * Never unique / PK / exclusion — those belong to db-schema.
 */
export type IndexDefinition = {
  readonly table: string;
  readonly columns: readonly IndexColumn[];
  readonly include: readonly string[];
  readonly predicate: string | null;
};

export type WorkloadStatement = {
  /** Stable id within the query (0-based). */
  readonly index: number;
  /** Normalized SQL fingerprint source (`?` placeholders). */
  readonly sql: string;
  /** Postgres `$n` text (optional). */
  readonly text?: string;
  /** sha256 hex of normalized sql. */
  readonly fingerprint: string;
  /** Statement weight (frequency). Default 1. */
  readonly weight: number;
};

export type WorkloadQuery = {
  readonly name: string;
  readonly statements: readonly WorkloadStatement[];
  readonly hydrates: readonly string[];
};

export type WorkloadManifest = {
  readonly version: 1;
  readonly queries: readonly WorkloadQuery[];
};

export type SkipReason =
  | 'parse_failed'
  | 'missing_table'
  | 'low_improvement'
  | 'below_min_rows'
  | 'over_budget'
  | 'pk_only'
  | 'empty_key'
  | 'unsupported'
  | 'zero_statements'
  | 'fingerprint_divergence';

export type SkippedItem = {
  readonly reason: SkipReason;
  readonly detail: string;
  readonly queryName?: string;
  readonly statementIndex?: number;
  readonly candidateName?: string;
};

export type Candidate = {
  readonly definition: IndexDefinition;
  readonly name: OwnedIndexName;
  readonly sourceQuery: string;
  readonly sourceStatementIndex: number;
  readonly weight: number;
};

export type Eval = {
  readonly candidateName: OwnedIndexName;
  readonly improvement: number;
  readonly baselineCost: number;
  readonly withIndexCost: number;
  readonly lowConfidence: boolean;
};

export type IndexInfo = {
  readonly name: string;
  readonly table: string;
  readonly columns: readonly string[];
  readonly include: readonly string[];
  readonly predicate: string | null;
  readonly isUnique: boolean;
  readonly isPrimary: boolean;
  readonly isValid: boolean;
  readonly isOwned: boolean;
};

export type TableInfo = {
  readonly name: string;
  readonly estimatedRows: number;
};

export type UsageInfo = {
  readonly name: string;
  /** idx_scan or dialect equivalent. */
  readonly scans: number;
};

export type OwnedMeta = {
  readonly name: OwnedIndexName;
  readonly deprecatedAt: number | null;
  readonly usageAtDeprecation: number | null;
  readonly payload: string;
};

export type PlanActionKind =
  | 'repair_invalid'
  | 'create'
  | 'deprecate'
  | 'clear_deprecation'
  | 'drop';

export type PlanAction = {
  readonly kind: PlanActionKind;
  readonly name: OwnedIndexName;
  readonly definition: IndexDefinition | null;
  /** Estimated wall-ms for budget checks. */
  readonly estimatedMs: number;
  readonly table: string;
  readonly priority: number;
};

export type IndexPlan = {
  readonly desired: readonly Candidate[];
  readonly actions: readonly PlanAction[];
  readonly skipped: readonly SkippedItem[];
  readonly kept: readonly OwnedIndexName[];
};

export type ActionResultStatus = 'ok' | 'deferred' | 'failed' | 'crashed';

export type ActionResult = {
  readonly status: ActionResultStatus;
  readonly reason?: string;
};

export type ReconcileReport = {
  readonly plan: IndexPlan;
  readonly completed: readonly PlanAction[];
  readonly deferred: readonly PlanAction[];
  readonly remaining: readonly PlanAction[];
  readonly failed: readonly {
    readonly action: PlanAction;
    readonly reason: string;
  }[];
  readonly notes: readonly string[];
};

export type Stmt = {
  readonly sql: string;
  readonly text?: string | undefined;
  readonly fingerprint: string;
};

/**
 * Dialect port — core NEVER touches the wall. Same inputs + same responses
 * ⇒ byte-identical outputs (tested property).
 */
export type DbPort = {
  readonly introspectIndexes: () => Promise<IndexInfo[]>;
  readonly introspectTables: () => Promise<TableInfo[]>;
  readonly readIndexUsage: () => Promise<UsageInfo[]>;
  readonly readOwnedMeta: () => Promise<OwnedMeta[]>;
  readonly writeOwnedMeta: (m: OwnedMeta) => Promise<void>;
  readonly evaluateCandidates: (
    stmts: readonly Stmt[],
    cands: readonly Candidate[]
  ) => Promise<Eval[]>;
  readonly execute: (
    action: PlanAction,
    deadline: number
  ) => Promise<ActionResult>;
  /** Dialect parse hook — returns tables + predicate access paths. */
  readonly parseStatement: (sql: string) => ParsedStatement;
};

export type AccessPath = {
  readonly table: string;
  readonly equality: readonly string[];
  readonly range: readonly string[];
  readonly orderBy: readonly string[];
  readonly selectList: readonly string[];
  readonly partialPredicate: string | null;
};

export type ParsedStatement = {
  readonly ok: boolean;
  readonly reason?: string;
  readonly tables: readonly string[];
  readonly paths: readonly AccessPath[];
};

export function assertOwnedIndexName(
  name: string
): asserts name is OwnedIndexName {
  assert.ok(typeof name === 'string', 'owned index name must be a string');
  assert.ok(name.length > 0, 'owned index name must be non-empty');
  assert.ok(
    name.length <= LIMITS.maxIndexNameLength,
    `owned index name exceeds ${String(LIMITS.maxIndexNameLength)}`
  );
}

export function asOwnedIndexName(name: string): OwnedIndexName {
  assertOwnedIndexName(name);
  return name as OwnedIndexName;
}
