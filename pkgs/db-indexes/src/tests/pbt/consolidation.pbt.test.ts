import { describe, expect, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/pbt';
import { resolveConfig } from '../../core/config';
import { consolidateCandidates, isPrefixCovered } from '../../core/consolidate';
import { ownedIndexName } from '../../core/naming';
import type { Candidate, Eval } from '../../core/types';
import { asOwnedIndexName } from '../../core/types';

function cand(
  table: string,
  cols: string[],
  include: string[] = []
): Candidate {
  const definition = {
    table,
    columns: cols.map((name) => ({ name, order: 'asc' as const })),
    include,
    predicate: null as string | null,
  };
  return {
    name: ownedIndexName(definition),
    definition,
    sourceQuery: 'q',
    sourceStatementIndex: 0,
    weight: 1,
  };
}

function evalOf(c: Candidate, improvement: number): Eval {
  return {
    candidateName: c.name,
    improvement,
    baselineCost: 1000,
    withIndexCost: 100,
    lowConfidence: false,
  };
}

describe('consolidation PBT', () => {
  test('prefix non-redundancy: kept set has no covered shorter', () => {
    assertProperty(
      'prefix',
      fc.property(
        fc.array(
          fc.constantFrom('user_id', 'created_at', 'space_id', 'owner_id'),
          { minLength: 1, maxLength: 3 }
        ),
        (cols) => {
          const uniq = [...new Set(cols)];
          if (uniq.length === 0) return;
          const short = cand('notes', [uniq[0]!]);
          const longer = cand('notes', uniq);
          expect(isPrefixCovered(longer, short)).toBe(true);
          const config = resolveConfig({
            minImprovementFactor: 1,
            minTableRows: 1,
            maxIndexesPerTable: 6,
          });
          const kept = consolidateCandidates(
            [short, longer],
            [evalOf(short, 10), evalOf(longer, 10)],
            [{ name: 'notes', estimatedRows: 50_000 }],
            config
          ).kept;
          const names = new Set(kept.map((k) => k.name));
          // Longer should survive; short may be dropped as covered
          expect(names.has(longer.name)).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('merged include recomputes owned name', () => {
    const a = cand('notes', ['user_id'], ['title']);
    const b = cand('notes', ['user_id'], ['body']);
    const config = resolveConfig({
      minImprovementFactor: 1,
      minTableRows: 0,
      requireEvalImprovement: false,
      maxIndexesPerTable: 6,
    });
    const kept = consolidateCandidates(
      [a, b],
      [evalOf(a, 10), evalOf(b, 10)],
      [{ name: 'notes', estimatedRows: 50_000 }],
      config
    ).kept;
    expect(kept.length).toBe(1);
    expect(kept[0]!.definition.include).toEqual(['body', 'title']);
    expect(kept[0]!.name).toBe(ownedIndexName(kept[0]!.definition));
    expect(kept[0]!.name).not.toBe(a.name);
    expect(kept[0]!.name).not.toBe(b.name);
  });

  test('budget gate drops excess per table', () => {
    const config = resolveConfig({
      minImprovementFactor: 1,
      minTableRows: 1,
      maxIndexesPerTable: 2,
    });
    const cands = [
      cand('notes', ['user_id']),
      cand('notes', ['owner_id']),
      cand('notes', ['space_id']),
    ];
    const result = consolidateCandidates(
      cands,
      cands.map((c) => evalOf(c, 10)),
      [{ name: 'notes', estimatedRows: 50_000 }],
      config
    );
    expect(result.kept.length).toBeLessThanOrEqual(2);
    expect(result.skipped.some((s) => s.reason === 'over_budget')).toBe(true);
  });
});

describe('naming extend PBT', () => {
  test('predicate formatting is part of name', () => {
    const a = ownedIndexName({
      table: 'notes',
      columns: [{ name: 'user_id', order: 'asc' }],
      include: [],
      predicate: 'deleted_at IS NULL',
    });
    const b = ownedIndexName({
      table: 'notes',
      columns: [{ name: 'user_id', order: 'asc' }],
      include: [],
      predicate: null,
    });
    expect(a).not.toBe(b);
    expect(a).toBe(asOwnedIndexName(a));
  });
});
