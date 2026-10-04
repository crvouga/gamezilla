import { assert } from '@pkgs/assert-root-shared/singleton';
import { compareNames, compareSkipped } from './compare';
import type { Config } from './config';
import { assertWithinLimit, LIMITS } from './limits';
import { ownedIndexName } from './naming';
import type { Candidate, Eval, SkippedItem, TableInfo } from './types';

/**
 * Left-prefix coverage: kept covers cand iff same table, same-or-longer key
 * that shares cand's key as a prefix, and predicate equal.
 *
 * Complexity: O(C log C) sort + O(C * K) greedy where K ≤ maxIndexesPerTable
 * (bounded). Not O(C²) over unbounded C.
 */
export function isPrefixCovered(kept: Candidate, cand: Candidate): boolean {
  assert.ok(kept !== undefined && cand !== undefined, 'candidates required');
  if (kept.definition.table !== cand.definition.table) return false;
  const kp = kept.definition.predicate ?? '';
  const cp = cand.definition.predicate ?? '';
  if (kp !== cp) return false;
  const kc = kept.definition.columns;
  const cc = cand.definition.columns;
  if (kc.length < cc.length) return false;
  for (let i = 0; i < cc.length; i++) {
    if (kc[i]!.name !== cc[i]!.name) return false;
    if (kc[i]!.order !== cc[i]!.order) return false;
  }
  return true;
}

function score(cand: Candidate, evals: ReadonlyMap<string, Eval>): number {
  const ev = evals.get(cand.name);
  const improvement = ev?.improvement ?? 1;
  return improvement * cand.weight;
}

function mergeInclude(a: Candidate, b: Candidate): Candidate {
  assert.ok(a.definition.table === b.definition.table, 'same table');
  const set = new Set([...a.definition.include, ...b.definition.include]);
  const include = [...set].sort();
  assertWithinLimit(include.length, LIMITS.maxIncludeColumns, 'merged include');
  const definition = { ...a.definition, include };
  return {
    ...a,
    name: ownedIndexName(definition),
    definition,
    weight: Math.max(a.weight, b.weight),
  };
}

export type ConsolidateResult = {
  readonly kept: readonly Candidate[];
  readonly skipped: readonly SkippedItem[];
};

function buildEvalMap(evals: readonly Eval[]): Map<string, Eval> {
  const evalMap = new Map<string, Eval>();
  for (let i = 0; i < evals.length; i++) {
    const e = evals[i]!;
    evalMap.set(e.candidateName, e);
  }
  return evalMap;
}

function buildRowMap(tables: readonly TableInfo[]): Map<string, number> {
  const rowMap = new Map<string, number>();
  for (let i = 0; i < tables.length; i++) {
    const t = tables[i]!;
    rowMap.set(t.name, t.estimatedRows);
  }
  return rowMap;
}

function filterCandidates(
  candidates: readonly Candidate[],
  evalMap: ReadonlyMap<string, Eval>,
  rowMap: ReadonlyMap<string, number>,
  config: Config
): { readonly filtered: Candidate[]; readonly skipped: SkippedItem[] } {
  const filtered: Candidate[] = [];
  const skipped: SkippedItem[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]!;
    const rows = rowMap.get(c.definition.table) ?? 0;
    const ev = evalMap.get(c.name);
    if (rows < config.minTableRows) {
      skipped.push({
        reason: 'below_min_rows',
        detail: `${c.definition.table} has ${String(rows)} rows`,
        candidateName: c.name,
        queryName: c.sourceQuery,
      });
      continue;
    }
    if (
      config.requireEvalImprovement &&
      (ev === undefined || ev.improvement < config.minImprovementFactor)
    ) {
      skipped.push({
        reason: 'low_improvement',
        detail: `improvement ${String(ev?.improvement ?? 0)}`,
        candidateName: c.name,
        queryName: c.sourceQuery,
      });
      continue;
    }
    filtered.push(c);
  }
  return { filtered, skipped };
}

function tryCoverOrKeep(list: Candidate[], c: Candidate): void {
  for (let k = 0; k < list.length; k++) {
    if (!isPrefixCovered(list[k]!, c)) continue;
    if (list[k]!.definition.columns.length === c.definition.columns.length) {
      list[k] = mergeInclude(list[k]!, c);
    }
    return;
  }
  list.push(c);
}

function greedyByPrefix(
  filtered: readonly Candidate[],
  evalMap: ReadonlyMap<string, Eval>
): Map<string, Candidate[]> {
  const sorted = [...filtered];
  sorted.sort((a, b) => {
    const lenDiff = b.definition.columns.length - a.definition.columns.length;
    if (lenDiff !== 0) return lenDiff;
    return score(b, evalMap) - score(a, evalMap);
  });
  const byTable = new Map<string, Candidate[]>();
  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i]!;
    let list = byTable.get(c.definition.table);
    if (list === undefined) {
      list = [];
      byTable.set(c.definition.table, list);
    }
    tryCoverOrKeep(list, c);
  }
  return byTable;
}

function applyTableBudgets(
  byTable: Map<string, Candidate[]>,
  evalMap: ReadonlyMap<string, Eval>,
  config: Config
): { readonly kept: Candidate[]; readonly skipped: SkippedItem[] } {
  const kept: Candidate[] = [];
  const skipped: SkippedItem[] = [];
  assertWithinLimit(
    config.maxIndexesPerTable,
    LIMITS.maxCandidatesPerStatement,
    'maxIndexesPerTable'
  );
  for (const [table, list] of byTable) {
    list.sort((a, b) => score(b, evalMap) - score(a, evalMap));
    for (let i = 0; i < list.length; i++) {
      if (i < config.maxIndexesPerTable) {
        kept.push(list[i]!);
      } else {
        skipped.push({
          reason: 'over_budget',
          detail: `table ${table} exceeds maxIndexesPerTable`,
          candidateName: list[i]!.name,
          queryName: list[i]!.sourceQuery,
        });
      }
    }
  }
  return { kept, skipped };
}

/**
 * Global consolidation + per-table budget.
 * Sort longest-key first O(C log C); greedy keep if not prefix-covered.
 */
export function consolidateCandidates(
  candidates: readonly Candidate[],
  evals: readonly Eval[],
  tables: readonly TableInfo[],
  config: Config
): ConsolidateResult {
  assert.ok(Array.isArray(candidates), 'candidates array');
  assert.ok(Array.isArray(evals), 'evals array');
  const evalMap = buildEvalMap(evals);
  const rowMap = buildRowMap(tables);
  const { filtered, skipped: filterSkipped } = filterCandidates(
    candidates,
    evalMap,
    rowMap,
    config
  );
  const byTable = greedyByPrefix(filtered, evalMap);
  const { kept, skipped: budgetSkipped } = applyTableBudgets(
    byTable,
    evalMap,
    config
  );
  kept.sort((a, b) => compareNames(a.name, b.name));
  const skipped = [...filterSkipped, ...budgetSkipped].sort(compareSkipped);
  for (let i = 0; i < kept.length; i++) {
    const c = kept[i]!;
    assert.ok(c.name.startsWith('autoidx_'), 'kept must be owned');
    assert.ok(
      c.name === ownedIndexName(c.definition),
      'kept name matches definition'
    );
  }
  return { kept, skipped };
}
