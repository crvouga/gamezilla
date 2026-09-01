import { describe, expect, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/pbt';
import { isPrefixCovered } from '../../core/consolidate';
import { fingerprintSql } from '../../core/fingerprint';
import { definitionsEqual, ownedIndexName } from '../../core/naming';
import type { Candidate, IndexDefinition } from '../../core/types';

const arbCol = fc
  .stringMatching(/^[a-z][a-z0-9_]{0,15}$/)
  .filter((s) => s.length > 0);

const arbDef: fc.Arbitrary<IndexDefinition> = fc
  .record({
    table: fc.constantFrom('notes', 'users', 'spaces', 'friends_requests'),
    col: arbCol,
    include: fc.array(arbCol, { maxLength: 2 }),
    predicate: fc.constantFrom(null, 'deleted_at IS NULL'),
  })
  .map(({ table, col, include, predicate }) => ({
    table,
    columns: [{ name: col, order: 'asc' as const }],
    include: [...new Set(include)].sort(),
    predicate,
  }));

describe('naming PBT', () => {
  test('equal canonical → equal name; unequal → unequal name', () => {
    assertProperty(
      'naming collision',
      fc.property(arbDef, arbDef, (a, b) => {
        const na = ownedIndexName(a);
        const nb = ownedIndexName(b);
        if (definitionsEqual(a, b)) {
          expect(na).toBe(nb);
        } else {
          expect(na).not.toBe(nb);
        }
        expect(na.startsWith('autoidx_')).toBe(true);
      }),
      { numRuns: 50 }
    );
  });
});

describe('fingerprint PBT', () => {
  test('whitespace perturbation stable', () => {
    assertProperty(
      'fingerprint stable',
      fc.property(
        fc.constantFrom(
          'SELECT id FROM notes WHERE user_id = ?',
          'SELECT a, b FROM t WHERE x = ? AND y > ?',
          'SELECT id FROM friends_requests WHERE from_user_id = ? OR to_user_id = ?'
        ),
        (sql) => {
          const padded = `  ${sql}  \n`;
          const commented = `${sql}\n-- trailing`;
          expect(fingerprintSql(sql)).toBe(fingerprintSql(padded));
          expect(fingerprintSql(sql)).toBe(fingerprintSql(commented));
        }
      ),
      { numRuns: 20 }
    );
  });
});

describe('consolidation PBT', () => {
  test('prefix coverage reflexive and longer-covers-shorter', () => {
    const short: Candidate = {
      name: ownedIndexName({
        table: 'notes',
        columns: [{ name: 'user_id', order: 'asc' }],
        include: [],
        predicate: null,
      }),
      definition: {
        table: 'notes',
        columns: [{ name: 'user_id', order: 'asc' }],
        include: [],
        predicate: null,
      },
      sourceQuery: 'q',
      sourceStatementIndex: 0,
      weight: 1,
    };
    const longer: Candidate = {
      name: ownedIndexName({
        table: 'notes',
        columns: [
          { name: 'user_id', order: 'asc' },
          { name: 'created_at', order: 'asc' },
        ],
        include: [],
        predicate: null,
      }),
      definition: {
        table: 'notes',
        columns: [
          { name: 'user_id', order: 'asc' },
          { name: 'created_at', order: 'asc' },
        ],
        include: [],
        predicate: null,
      },
      sourceQuery: 'q',
      sourceStatementIndex: 0,
      weight: 1,
    };
    expect(isPrefixCovered(short, short)).toBe(true);
    expect(isPrefixCovered(longer, short)).toBe(true);
    expect(isPrefixCovered(short, longer)).toBe(false);
  });
});
