import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { assert } from '@gamezilla/assert';
import {
  assertWhereFragment,
  countSqlPlaceholders,
} from './assert-where-fragment';

/** Node crash handler calls `process.exit`; register one that throws so tests can assert failures. */
function registerThrowingCrashHandlerForTests(): () => void {
  return assert.registerCrashHandler({
    priority: 5,
    match: () => true,
    crash(message, context) {
      const err = new Error(message);
      Object.assign(err, { context });
      throw err;
    },
  });
}

let disposeCrash: () => void;
beforeAll(() => {
  disposeCrash = registerThrowingCrashHandlerForTests();
});
afterAll(() => {
  disposeCrash();
});

describe('countSqlPlaceholders', () => {
  test('counts top-level placeholders', () => {
    expect(countSqlPlaceholders('a = ? AND b = ?')).toBe(2);
  });

  test('ignores ? inside single-quoted string literal', () => {
    expect(countSqlPlaceholders("a = '?' AND b = ?")).toBe(1);
  });

  test('ignores ? inside double-quoted string literal', () => {
    expect(countSqlPlaceholders('a = "?" AND b = ?')).toBe(1);
  });

  test('handles doubled-quote escape inside single-quoted literal', () => {
    expect(countSqlPlaceholders("a = 'it''s ?' AND b = ?")).toBe(1);
  });

  test('handles doubled-quote escape inside double-quoted literal', () => {
    expect(countSqlPlaceholders('a = "say ""?""" AND b = ?')).toBe(1);
  });

  test('returns zero for an empty fragment', () => {
    expect(countSqlPlaceholders('')).toBe(0);
  });
});

describe('assertWhereFragment', () => {
  test('passes a balanced single-condition fragment', () => {
    expect(() =>
      assertWhereFragment({ sql: 'a = ?', params: [1] })
    ).not.toThrow();
  });

  test('passes IN list with matching placeholder/param counts', () => {
    expect(() =>
      assertWhereFragment({ sql: 'a IN (?, ?, ?)', params: [1, 2, 3] })
    ).not.toThrow();
  });

  test('passes nested boolean fragment', () => {
    expect(() =>
      assertWhereFragment({
        sql: '((a = ? AND b = ?) OR c = ?)',
        params: [1, 2, 3],
      })
    ).not.toThrow();
  });

  test('rejects placeholder/param mismatch (too few params)', () => {
    expect(() =>
      assertWhereFragment({ sql: 'a = ? AND b = ?', params: [1] })
    ).toThrow(/placeholder count/i);
  });

  test('rejects placeholder/param mismatch (too many params)', () => {
    expect(() => assertWhereFragment({ sql: 'a = ?', params: [1, 2] })).toThrow(
      /placeholder count/i
    );
  });

  test('rejects empty IN ()', () => {
    expect(() => assertWhereFragment({ sql: 'a IN ()', params: [] })).toThrow(
      /empty parentheses/i
    );
  });

  test('allows niladic call form COUNT(*) OVER()', () => {
    expect(() =>
      assertWhereFragment({
        sql: 'COUNT(*) OVER() AS total_count FROM t WHERE a = ?',
        params: [1],
      })
    ).not.toThrow();
  });

  test('allows other niladic functions like NOW() / random()', () => {
    expect(() =>
      assertWhereFragment({
        sql: 'a = ? AND ts < NOW() AND r = random()',
        params: [1],
      })
    ).not.toThrow();
  });

  test('rejects bare empty parens (with leading whitespace)', () => {
    expect(() => assertWhereFragment({ sql: 'a IN ( )', params: [] })).toThrow(
      /empty parentheses/i
    );
  });

  test('rejects double placeholder', () => {
    expect(() =>
      assertWhereFragment({ sql: 'a IN (??)', params: [1, 2] })
    ).toThrow(/adjacent \? placeholders/i);
  });

  test('rejects trailing comma', () => {
    expect(() =>
      assertWhereFragment({ sql: 'a IN (?, ?,)', params: [1, 2] })
    ).toThrow(/trailing comma/i);
  });

  test('rejects leading comma', () => {
    expect(() =>
      assertWhereFragment({ sql: 'a IN (, ?, ?)', params: [1, 2] })
    ).toThrow(/leading comma/i);
  });

  test('rejects doubled comma in expression list', () => {
    expect(() =>
      assertWhereFragment({ sql: 'a IN (?, , ?)', params: [1, 2] })
    ).toThrow(/doubled comma/i);
  });

  test('rejects unbalanced parentheses (unclosed)', () => {
    expect(() => assertWhereFragment({ sql: '(a = ?', params: [1] })).toThrow(
      /unbalanced parentheses/i
    );
  });

  test('rejects unbalanced parentheses (extra closing)', () => {
    expect(() => assertWhereFragment({ sql: 'a = ?)', params: [1] })).toThrow(
      /unbalanced parentheses/i
    );
  });

  test('rejects semicolon', () => {
    expect(() =>
      assertWhereFragment({ sql: 'a = ?; DROP TABLE x', params: [1] })
    ).toThrow(/semicolons forbidden/i);
  });

  test('rejects line comment', () => {
    expect(() =>
      assertWhereFragment({ sql: 'a = ? -- comment', params: [1] })
    ).toThrow(/line comments forbidden/i);
  });

  test('rejects block comment', () => {
    expect(() =>
      assertWhereFragment({ sql: 'a = ? /* comment */', params: [1] })
    ).toThrow(/block comments forbidden/i);
  });

  test('allows ()/?/, inside string literal', () => {
    expect(() =>
      assertWhereFragment({
        sql: "a LIKE '%(?,)%' AND b = ?",
        params: ['x'],
      })
    ).not.toThrow();
  });
});
