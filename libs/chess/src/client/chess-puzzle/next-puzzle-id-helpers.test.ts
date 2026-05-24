import { isSubqueryRef } from '@pkgs/patch-db/interface';
import { describe, expect, test } from 'bun:test';

import { ChessPuzzleAttr } from '../../shared/chess-puzzle-entities';
import {
  CHESS_PUZZLE_INTERACTION_ENTITY_TYPE,
  ChessPuzzleInteractionAttr,
} from '../../shared/chess-puzzle-interaction-entities';
import {
  buildPuzzleWhere,
  pickPuzzleIdFromPool,
} from './next-puzzle-id-helpers';

type AnyClause = ReturnType<typeof buildPuzzleWhere>;

function flattenAndClauses(clause: AnyClause): readonly AnyClause[] {
  if (clause.type === 'and') {
    const acc: AnyClause[] = [];
    for (const c of clause.clauses) acc.push(...flattenAndClauses(c));
    return acc;
  }
  return [clause];
}

describe('buildPuzzleWhere (Phase 3: chess subquery wiring)', () => {
  test('rating band lower / upper bounds always present', () => {
    const w = buildPuzzleWhere(1500, 200, '', null);
    const flat = flattenAndClauses(w);
    const gte = flat.find(
      (c) =>
        c.type === 'gte' &&
        (c as { attribute: string }).attribute === ChessPuzzleAttr.rating.key
    );
    const lte = flat.find(
      (c) =>
        c.type === 'lte' &&
        (c as { attribute: string }).attribute === ChessPuzzleAttr.rating.key
    );
    expect(gte).toBeTruthy();
    expect(lte).toBeTruthy();
    expect((gte as { value: number }).value).toBe(1300);
    expect((lte as { value: number }).value).toBe(1700);
  });

  test('clamps rating lower bound at 0 when window dips below', () => {
    const w = buildPuzzleWhere(50, 500, '', null);
    const flat = flattenAndClauses(w);
    const gte = flat.find((c) => c.type === 'gte');
    expect(gte && (gte as { value: number }).value).toBe(0);
  });

  test('with ownerId, emits exactly one not_in clause whose values is a SubqueryRef', () => {
    const w = buildPuzzleWhere(1500, 200, 'user_123', null);
    const flat = flattenAndClauses(w);
    const notIns = flat.filter((c) => c.type === 'not_in');
    expect(notIns.length).toBe(1);
    const notIn = notIns[0] as {
      attribute: string;
      values: unknown;
    };
    expect(notIn.attribute).toBe(ChessPuzzleAttr.id.key);
    expect(Array.isArray(notIn.values)).toBe(false);
    expect(isSubqueryRef(notIn.values as never)).toBe(true);
    const sub = notIn.values as {
      entityType: string;
      attribute: string;
      where: { type: string; attribute: string; value: string };
    };
    expect(sub.entityType).toBe(CHESS_PUZZLE_INTERACTION_ENTITY_TYPE);
    expect(sub.attribute).toBe(ChessPuzzleInteractionAttr.puzzleId.key);
    expect(sub.where.type).toBe('=');
    expect(sub.where.value).toBe('user_123');
  });

  test('without ownerId, no not_in clause is emitted (subquery would be unbounded)', () => {
    const w = buildPuzzleWhere(1500, 200, '', null);
    const flat = flattenAndClauses(w);
    expect(flat.find((c) => c.type === 'not_in')).toBe(undefined);
  });

  test('currentPuzzleId emits an additional `!=` clause separate from the subquery', () => {
    const w = buildPuzzleWhere(1500, 200, 'user_123', 'puzzle_99');
    const flat = flattenAndClauses(w);
    const neq = flat.find(
      (c) =>
        c.type === '!=' &&
        (c as { attribute: string }).attribute === ChessPuzzleAttr.id.key
    );
    expect(neq).toBeTruthy();
    expect((neq as { value: string }).value).toBe('puzzle_99');
    // The subquery is still there.
    expect(flat.find((c) => c.type === 'not_in')).toBeTruthy();
  });

  test('empty currentPuzzleId is treated as null (no `!=` clause emitted)', () => {
    const w = buildPuzzleWhere(1500, 200, '', '');
    const flat = flattenAndClauses(w);
    expect(flat.find((c) => c.type === '!=')).toBe(undefined);
  });
});

describe('pickPuzzleIdFromPool (deterministic seed selection)', () => {
  test('returns null on empty pool', () => {
    expect(
      pickPuzzleIdFromPool({
        entities: [],
        rating: 1500,
        preferredBand: 100,
        seed: 'anything',
      })
    ).toBe(null);
  });

  test('seeded selection is stable across runs', () => {
    const entities = ['p1', 'p2', 'p3', 'p4'].map((id) => ({
      entityId: id,
      attributes: { [ChessPuzzleAttr.rating.key]: 1500 } as never,
    }));
    const a = pickPuzzleIdFromPool({
      entities,
      rating: 1500,
      preferredBand: 100,
      seed: 'sess-1',
    });
    const b = pickPuzzleIdFromPool({
      entities,
      rating: 1500,
      preferredBand: 100,
      seed: 'sess-1',
    });
    expect(a).toBe(b);
    expect(a).not.toBe(null);
  });

  test('falls back to the full entity list when band is empty', () => {
    const entities = [
      {
        entityId: 'too-low',
        attributes: { [ChessPuzzleAttr.rating.key]: 800 } as never,
      },
      {
        entityId: 'too-high',
        attributes: { [ChessPuzzleAttr.rating.key]: 2400 } as never,
      },
    ];
    const picked = pickPuzzleIdFromPool({
      entities,
      rating: 1500,
      preferredBand: 100,
      seed: 'fallback-seed',
    });
    expect(picked).not.toBe(null);
    expect(['too-low', 'too-high']).toContain(picked as string);
  });
});
