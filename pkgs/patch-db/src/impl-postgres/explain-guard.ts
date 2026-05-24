/**
 * Dev-time runtime guard that runs `EXPLAIN (FORMAT JSON)` on a Postgres
 * query and crashes when the plan contains a `Seq Scan` on a patch-db base
 * table (`snapshots` / `patches`).
 *
 * Pairs with `assertQueryAgainstSchema` (which is purely static): the
 * schema assert catches "this query has no chance of using an index because
 * none is declared"; the EXPLAIN guard catches "an index *is* declared but
 * the planner picked something else anyway" (often a data-skew / stats
 * problem after `ANALYZE` regressions or a bug where the index expression
 * doesn't exactly match the query expression).
 *
 * Default off; opt-in via {@link PatchDbExplainGuardOptions} or env
 * `PATCH_DB_EXPLAIN_GUARD=1`. Cost: one extra round-trip per guarded
 * query, plus JSON parsing; only enable in dev / CI.
 *
 * Tables checked by default: `snapshots`, `patches`.
 */
import { assert } from '@pkgs/assert';
import type { Logger } from '@pkgs/logger';
import type { SqlClient } from '@pkgs/sql-client/interface';

export type PatchDbExplainGuardMode = 'off' | 'warn' | 'crash';

export type PatchDbExplainGuardOptions = {
  readonly mode: PatchDbExplainGuardMode;
  /**
   * Base tables we own. A `Seq Scan` on any of these (or their LIST
   * partitions, prefixed with the parent name) fails the guard.
   */
  readonly guardedTables?: readonly string[];
  /**
   * Logger used in `warn` mode. Falls back to `console.warn` when omitted.
   */
  readonly logger?: Logger;
};

const DEFAULT_GUARDED_TABLES = ['snapshots', 'patches'] as const;

type PlanNode = {
  readonly 'Node Type'?: string;
  readonly 'Relation Name'?: string;
  readonly Plans?: readonly PlanNode[];
};

type ExplainRow = {
  readonly 'QUERY PLAN': string | ReadonlyArray<{ readonly Plan: PlanNode }>;
};

type SeqScanFinding = {
  readonly relation: string;
};

function parseExplainPlan(raw: unknown): PlanNode | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      return parseExplainPlan(parsed);
    } catch {
      return null;
    }
  }
  if (Array.isArray(raw)) {
    const first = raw[0] as { readonly Plan?: PlanNode } | undefined;
    return first?.Plan ?? null;
  }
  if (typeof raw === 'object') {
    const o = raw as { readonly Plan?: PlanNode };
    return o.Plan ?? null;
  }
  return null;
}

function walkForSeqScans(
  node: PlanNode,
  guarded: ReadonlySet<string>,
  out: SeqScanFinding[]
): void {
  const nodeType = node['Node Type'];
  const relation = node['Relation Name'];
  if (
    nodeType === 'Seq Scan' &&
    typeof relation === 'string' &&
    isGuardedRelation(relation, guarded)
  ) {
    out.push({ relation });
  }
  const children = node.Plans;
  if (Array.isArray(children)) {
    for (const c of children) walkForSeqScans(c, guarded, out);
  }
}

function isGuardedRelation(
  relation: string,
  guarded: ReadonlySet<string>
): boolean {
  if (guarded.has(relation)) return true;
  for (const t of guarded) {
    // Postgres LIST partitions inherit the parent name as a prefix
    // (e.g. `snapshots_chess_puzzle`). Treat partition relations as
    // guarded too so Phase 2 partitioning gets the same coverage.
    if (relation.startsWith(`${t}_`)) return true;
  }
  return false;
}

function summarizeFindings(findings: readonly SeqScanFinding[]): string {
  const relations = findings.map((f) => f.relation).join(', ');
  return `Seq Scan on patch-db relation(s): ${relations}`;
}

function reportFindings(
  findings: readonly SeqScanFinding[],
  sql: string,
  params: readonly unknown[],
  options: PatchDbExplainGuardOptions
): void {
  if (findings.length === 0) return;
  const summary = summarizeFindings(findings);
  const ctx = { findings, sql, paramCount: params.length };
  if (options.mode === 'warn') {
    if (options.logger !== undefined) {
      options.logger.warn(summary, ctx);
    } else {
      console.warn(`patch-db EXPLAIN guard: ${summary}`, ctx);
    }
    return;
  }
  assert.ok(false, `patch-db EXPLAIN guard: ${summary}`, ctx);
}

/**
 * Runs `EXPLAIN (FORMAT JSON) <sql>` against `sqlClient` and reports / crashes
 * when the plan tree contains a `Seq Scan` on any guarded relation.
 *
 * Caller is responsible for not invoking this for trivial SELECTs (point
 * lookups by primary key, etc.); we only ever apply it to the snapshot /
 * patches scan queries that are at risk of an unindexed table scan.
 */
export async function assertExplainHasNoSeqScan(
  sqlClient: SqlClient,
  sql: string,
  params: readonly unknown[],
  options: PatchDbExplainGuardOptions
): Promise<void> {
  if (options.mode === 'off') return;
  const guarded = new Set<string>(
    options.guardedTables ?? DEFAULT_GUARDED_TABLES
  );
  const rows = await sqlClient.query<ExplainRow>(
    `EXPLAIN (FORMAT JSON) ${sql}`,
    [...params]
  );
  if (rows.length === 0) return;
  const plan = parseExplainPlan(rows[0]?.['QUERY PLAN']);
  if (plan === null) return;
  const findings: SeqScanFinding[] = [];
  walkForSeqScans(plan, guarded, findings);
  reportFindings(findings, sql, params, options);
}

const EXPLAIN_GUARD_ENV_ALIASES: Readonly<
  Record<string, PatchDbExplainGuardMode>
> = {
  '1': 'crash',
  crash: 'crash',
  '0': 'off',
  off: 'off',
  warn: 'warn',
};

function readProcessEnv(): Record<string, string | undefined> {
  const proc = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process;
  return proc?.env ?? {};
}

/**
 * Resolves the active explain-guard mode from the engine option and the
 * `PATCH_DB_EXPLAIN_GUARD` env var (env takes precedence). Off in
 * production by default; opt-in everywhere else.
 *
 * Accepted env values: `off`, `warn`, `crash`, `1` (alias for `crash`),
 * `0` (alias for `off`).
 */
export function resolveExplainGuardMode(
  optionMode: PatchDbExplainGuardMode | undefined,
  env: { readonly [k: string]: string | undefined } = readProcessEnv()
): PatchDbExplainGuardMode {
  const raw = env['PATCH_DB_EXPLAIN_GUARD'];
  const fromEnv =
    raw === undefined ? undefined : EXPLAIN_GUARD_ENV_ALIASES[raw];
  return fromEnv ?? optionMode ?? 'off';
}
