import { assert } from '@pkgs/assert';
import { generateCandidates } from './candidates';
import { compareNames } from './compare';
import { DEFAULT_CONFIG, resolveConfig } from './config';
import { ingestManifest } from './ingest';
import { parseWithNodeSqlParser } from './parse-node-sql';
import {
  anySchemaCoversPath,
  assertSnakeCaseTable,
  isPkOnlyPath,
  pathKeyColumns,
  type SchemaIndex,
} from './schema-coverage';
import type {
  AccessPath,
  ParsedStatement,
  WorkloadManifest,
} from './types';

export type IndexabilityGapReason =
  | 'parse_failed'
  | 'no_from'
  | 'empty_key'
  | 'uncovered_path';

export type IndexabilityGap = {
  readonly queryName: string;
  readonly statementIndex: number;
  readonly reason: IndexabilityGapReason;
  readonly detail: string;
  readonly table?: string;
};

export type AnalyzeIndexabilityArgs = {
  readonly manifest: WorkloadManifest;
  readonly schemaIndexes: readonly SchemaIndex[];
  readonly catalogTables: ReadonlySet<string>;
  readonly parseStatement?: (sql: string) => ParsedStatement;
};

export type IndexabilityReport = {
  readonly gaps: readonly IndexabilityGap[];
  readonly classified: number;
};

function compareGaps(a: IndexabilityGap, b: IndexabilityGap): number {
  const q = compareNames(a.queryName, b.queryName);
  if (q !== 0) return q;
  if (a.statementIndex !== b.statementIndex) {
    return a.statementIndex < b.statementIndex ? -1 : 1;
  }
  return compareNames(a.reason, b.reason);
}

function pathCovered(
  path: AccessPath,
  schemaIndexes: readonly SchemaIndex[],
  catalogTables: ReadonlySet<string>
): { readonly ok: boolean; readonly detail: string } {
  const key = pathKeyColumns(path);
  const hasFilter = path.equality.length > 0 || path.range.length > 0;
  if (!hasFilter) {
    // Unfiltered snapshot (optional ORDER BY) — catalog allowlist only.
    if (catalogTables.has(path.table)) {
      return { ok: true, detail: 'catalog' };
    }
    return {
      ok: false,
      detail: `unfiltered access on non-catalog table ${path.table}`,
    };
  }
  if (isPkOnlyPath(path)) {
    return { ok: true, detail: 'pk_only' };
  }
  if (anySchemaCoversPath(schemaIndexes, path)) {
    return { ok: true, detail: 'schema' };
  }
  const gen = generateCandidates(
    {
      ok: true,
      tables: [path.table],
      paths: [path],
    },
    {
      queryName: '_indexability',
      statementIndex: 0,
      weight: 1,
      config: DEFAULT_CONFIG,
    }
  );
  if (gen.candidates.length > 0) {
    return { ok: true, detail: 'autoidx_candidate' };
  }
  return {
    ok: false,
    detail: `no covering index or candidate for ${path.table} key [${key.join(',')}]`,
  };
}

/**
 * Static indexability: every access path must be PK, schema leftmost-prefix,
 * an autoidx candidate, or a catalog full-scan. Does not require hypopg /
 * below_min_rows — only that a candidate *could* exist when the table grows.
 */
export function analyzeIndexability(
  args: AnalyzeIndexabilityArgs
): IndexabilityReport {
  assert.ok(args.manifest !== undefined, 'manifest required');
  assert.ok(Array.isArray(args.schemaIndexes), 'schemaIndexes array');
  assert.ok(args.catalogTables !== undefined, 'catalogTables required');
  resolveConfig(); // assert defaults still valid

  for (let i = 0; i < args.schemaIndexes.length; i++) {
    const ix = args.schemaIndexes[i]!;
    assertSnakeCaseTable(ix.table, `schemaIndexes[${String(i)}].table`);
    assert.ok(ix.columns.length > 0, 'schema index columns non-empty');
  }
  for (const name of args.catalogTables) {
    assertSnakeCaseTable(name, 'catalogTables entry');
  }

  // Workload SQL is `?`-normalized; Sqlite dialect matches RecordingPort and
  // accepts product identifiers that Postgres treats as reserved (e.g. `at`).
  const parse =
    args.parseStatement ??
    ((sql: string) => parseWithNodeSqlParser(sql, 'Sqlite'));

  const ingested = ingestManifest(args.manifest);
  const gaps: IndexabilityGap[] = [];
  let classified = 0;

  for (let i = 0; i < ingested.statements.length; i++) {
    const item = ingested.statements[i]!;
    classified += 1;
    const parsed = parse(item.normalizedSql);
    if (!parsed.ok) {
      gaps.push({
        queryName: item.queryName,
        statementIndex: item.statement.index,
        reason: 'parse_failed',
        detail: parsed.reason ?? 'parse failed',
      });
      continue;
    }
    if (parsed.tables.length === 0 || parsed.paths.length === 0) {
      gaps.push({
        queryName: item.queryName,
        statementIndex: item.statement.index,
        reason: 'no_from',
        detail: 'no from table / access paths',
      });
      continue;
    }

    for (let p = 0; p < parsed.paths.length; p++) {
      const path = parsed.paths[p]!;
      assert.ok(path.table.length > 0, 'path.table required');
      const cover = pathCovered(path, args.schemaIndexes, args.catalogTables);
      if (cover.ok) continue;
      const hasFilter = path.equality.length > 0 || path.range.length > 0;
      const reason: IndexabilityGapReason = !hasFilter
        ? 'empty_key'
        : 'uncovered_path';
      gaps.push({
        queryName: item.queryName,
        statementIndex: item.statement.index,
        reason,
        detail: cover.detail,
        table: path.table,
      });
    }
  }

  assert.ok(
    classified === ingested.statements.length,
    'every ingested statement must be classified exactly once'
  );
  for (let g = 0; g < gaps.length; g++) {
    const gap = gaps[g]!;
    assert.ok(gap.queryName.length > 0, 'gap.queryName required');
    assert.ok(
      Number.isFinite(gap.statementIndex) && gap.statementIndex >= 0,
      'gap.statementIndex >= 0'
    );
  }
  gaps.sort(compareGaps);
  return { gaps, classified };
}

/**
 * Throw if any statement is unindexable. Message lists all gaps.
 */
export function assertIndexableWorkload(args: AnalyzeIndexabilityArgs): void {
  const report = analyzeIndexability(args);
  if (report.gaps.length === 0) return;
  const lines = report.gaps.map(
    (g) =>
      `UNINDEXABLE: query "${g.queryName}" stmt ${String(g.statementIndex)}: ${g.reason}: ${g.detail}`
  );
  throw new Error(lines.join('\n'));
}
