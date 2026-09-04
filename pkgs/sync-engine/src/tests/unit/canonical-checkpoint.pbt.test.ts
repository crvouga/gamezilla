import { describe, expect, test } from 'bun:test';
import { arbJsonValue, assertProperty } from '@pkgs/dst/fast-check';
import fc from 'fast-check';

import {
  compareCheckpoint,
  isContiguousNext,
  isLegacyWallClockCheckpoint,
} from '../../client/push-applied';
import {
  canonicalJson,
  hashQueryTables,
  scopeHash,
} from '../../queries/shared/canonical';
import {
  arbCheckpoint,
  arbLegacyCheckpoint,
  arbQueryTables,
} from '../arbitraries/checkpoint';

function shuffleKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj).reverse()) out[k] = obj[k];
  return out;
}

describe('canonicalJson / scopeHash / hashQueryTables', () => {
  test('canonicalJson is independent of key insertion order', () => {
    assertProperty(
      'canonicalJson ignores key insertion order',
      fc.property(
        fc.dictionary(fc.stringMatching(/^[a-z]{1,6}$/), arbJsonValue(2), {
          minKeys: 2,
          maxKeys: 6,
        }),
        (obj) => {
          expect(canonicalJson(obj)).toBe(canonicalJson(shuffleKeys(obj)));
        }
      )
    );
  });

  test('scopeHash is stable under param key reorder', () => {
    assertProperty(
      'scopeHash ignores param key order',
      fc.property(
        fc.stringMatching(/^[a-z]{3,10}$/),
        fc.dictionary(fc.stringMatching(/^[a-z]{1,5}$/), arbJsonValue(1), {
          minKeys: 1,
          maxKeys: 4,
        }),
        (name, params) => {
          expect(scopeHash(name, params)).toBe(
            scopeHash(name, shuffleKeys(params))
          );
        }
      )
    );
  });

  test('hashQueryTables is stable under table/row/column reorder', () => {
    assertProperty(
      'hashQueryTables ignores reorder',
      fc.property(arbQueryTables(), (tables) => {
        const shuffled: Record<string, Record<string, unknown>[]> = {};
        for (const name of Object.keys(tables).reverse()) {
          shuffled[name] = [...tables[name]!].reverse().map((row) => {
            const out: Record<string, unknown> = {};
            for (const k of Object.keys(row).reverse()) out[k] = row[k];
            return out;
          });
        }
        expect(hashQueryTables(tables)).toBe(hashQueryTables(shuffled));
      })
    );
  });
});

describe('compareCheckpoint / isContiguousNext', () => {
  test('compareCheckpoint is a total order on bigint strings', () => {
    assertProperty(
      'compareCheckpoint total order',
      fc.property(
        arbCheckpoint(),
        arbCheckpoint(),
        arbCheckpoint(),
        (a, b, c) => {
          expect(compareCheckpoint(a, a)).toBe(0);
          expect(Math.sign(compareCheckpoint(a, b))).toBe(
            -Math.sign(compareCheckpoint(b, a)) || 0
          );
          if (compareCheckpoint(a, b) <= 0 && compareCheckpoint(b, c) <= 0) {
            expect(compareCheckpoint(a, c)).toBeLessThanOrEqual(0);
          }
        }
      )
    );
  });

  test('isContiguousNext iff next === last + 1 (non-legacy)', () => {
    assertProperty(
      'isContiguousNext matches +1',
      fc.property(arbCheckpoint(), (last) => {
        const next = (BigInt(last) + 1n).toString();
        const skip = (BigInt(last) + 2n).toString();
        expect(isContiguousNext(last, next)).toBe(true);
        expect(isContiguousNext(last, skip)).toBe(false);
        expect(isContiguousNext(null, next)).toBe(true);
      })
    );
  });

  test('legacy wall-clock checkpoints are detected', () => {
    assertProperty(
      'isLegacyWallClockCheckpoint',
      fc.property(arbLegacyCheckpoint(), arbCheckpoint(), (legacy, small) => {
        expect(isLegacyWallClockCheckpoint(legacy)).toBe(true);
        expect(isLegacyWallClockCheckpoint(small)).toBe(false);
        expect(isContiguousNext(legacy, '1')).toBe(true);
      })
    );
  });
});
