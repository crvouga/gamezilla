import { assert } from '@pkgs/assert';
import type { Config } from './config';
import { assertWithinLimit, LIMITS } from './limits';
import { ownedIndexName } from './naming';
import type {
  AccessPath,
  Candidate,
  IndexColumn,
  IndexDefinition,
  ParsedStatement,
  SkippedItem,
} from './types';

const PK_COL = 'id';

function colAsc(name: string): IndexColumn {
  assert.ok(name.length > 0, 'column name required');
  return { name, order: 'asc' };
}

function buildKeyColumns(path: AccessPath): IndexColumn[] {
  const cols: IndexColumn[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < path.equality.length; i++) {
    const c = path.equality[i]!;
    if (seen.has(c)) continue;
    seen.add(c);
    cols.push(colAsc(c));
  }
  for (let i = 0; i < path.range.length; i++) {
    const c = path.range[i]!;
    if (seen.has(c)) continue;
    seen.add(c);
    cols.push(colAsc(c));
  }
  for (let i = 0; i < path.orderBy.length; i++) {
    const c = path.orderBy[i]!;
    if (seen.has(c)) continue;
    seen.add(c);
    cols.push(colAsc(c));
  }
  assertWithinLimit(cols.length, LIMITS.maxColumnsPerIndex, 'key columns');
  return cols;
}

function coveringInclude(
  path: AccessPath,
  keyCols: readonly IndexColumn[],
  maxInclude: number
): string[] {
  const keySet = new Set(keyCols.map((c) => c.name));
  const include: string[] = [];
  for (let i = 0; i < path.selectList.length; i++) {
    const c = path.selectList[i]!;
    if (keySet.has(c)) continue;
    if (c === '*') continue;
    include.push(c);
    if (include.length >= maxInclude) break;
  }
  return include;
}

function isPkOnly(cols: readonly IndexColumn[]): boolean {
  return cols.length === 1 && cols[0]!.name === PK_COL;
}

function candidateFromPath(
  path: AccessPath,
  args: {
    readonly queryName: string;
    readonly statementIndex: number;
    readonly weight: number;
    readonly config: Config;
  }
): Candidate | null {
  const columns = buildKeyColumns(path);
  if (columns.length === 0) return null;
  if (isPkOnly(columns) && path.partialPredicate === null) return null;

  const include =
    path.selectList.length > 0 &&
    path.selectList.length <= args.config.maxIncludeColumns + columns.length
      ? coveringInclude(path, columns, args.config.maxIncludeColumns)
      : [];

  const def: IndexDefinition = {
    table: path.table,
    columns,
    include,
    predicate: path.partialPredicate,
  };
  const name = ownedIndexName(def);
  return {
    definition: def,
    name,
    sourceQuery: args.queryName,
    sourceStatementIndex: args.statementIndex,
    weight: args.weight,
  };
}

export type CandidateGenResult = {
  readonly candidates: readonly Candidate[];
  readonly skipped: readonly SkippedItem[];
};

/**
 * Generate candidates from a parsed statement's access paths.
 * Bounded by maxCandidatesPerStatement.
 */
export function generateCandidates(
  parsed: ParsedStatement,
  args: {
    readonly queryName: string;
    readonly statementIndex: number;
    readonly weight: number;
    readonly config: Config;
  }
): CandidateGenResult {
  assert.ok(parsed !== undefined, 'parsed required');
  const skipped: SkippedItem[] = [];
  if (!parsed.ok) {
    skipped.push({
      reason: 'parse_failed',
      detail: parsed.reason ?? 'parse failed',
      queryName: args.queryName,
      statementIndex: args.statementIndex,
    });
    return { candidates: [], skipped };
  }
  assertWithinLimit(
    parsed.tables.length,
    LIMITS.maxTablesPerStatement,
    'tables per statement'
  );

  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < parsed.paths.length; i++) {
    if (out.length >= LIMITS.maxCandidatesPerStatement) break;
    const path = parsed.paths[i]!;
    assert.ok(path.table.length > 0, 'path.table required');
    const cand = candidateFromPath(path, args);
    if (cand === null) {
      skipped.push({
        reason: 'pk_only',
        detail: `path on ${path.table} is pk-only or empty`,
        queryName: args.queryName,
        statementIndex: args.statementIndex,
      });
      continue;
    }
    if (seen.has(cand.name)) continue;
    seen.add(cand.name);
    out.push(cand);
  }
  assertWithinLimit(
    out.length,
    LIMITS.maxCandidatesPerStatement,
    'candidates per statement'
  );
  return { candidates: out, skipped };
}
