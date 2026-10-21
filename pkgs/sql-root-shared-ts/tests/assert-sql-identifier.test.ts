import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import {
  assertSqlIdentifier,
  assertSqlPrefix,
} from '@pkgs/sql-root-shared-ts/assert-sql-identifier';

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

describe('assertSqlIdentifier', () => {
  test.each(['a', 'foo', 'foo_bar', '_x', 'x123', 'snake_case_99'])(
    'accepts %p',
    (id) => {
      expect(() => assertSqlIdentifier(id)).not.toThrow();
    }
  );

  test.each([
    '',
    '1foo',
    'foo bar',
    'foo-bar',
    'foo.bar',
    'foo;',
    'foo--',
    "foo'",
    'foo"',
    'foo)',
  ])('rejects %p', (id) => {
    expect(() => assertSqlIdentifier(id)).toThrow();
  });

  test('rejects non-string values', () => {
    expect(() => assertSqlIdentifier(undefined)).toThrow();
    expect(() => assertSqlIdentifier(null)).toThrow();
    expect(() => assertSqlIdentifier(42)).toThrow();
  });

  test('rejects identifiers longer than 64 chars', () => {
    expect(() => assertSqlIdentifier('a'.repeat(65))).toThrow();
  });
});

describe('assertSqlPrefix', () => {
  test.each(['', 'p.', 'foo.', '_p.', 'snake_case_99.'])(
    'accepts %p',
    (prefix) => {
      expect(() => assertSqlPrefix(prefix)).not.toThrow();
    }
  );

  test.each(['p', 'p..', '.p.', 'foo bar.', 'foo-.', "p'.", '1p.'])(
    'rejects %p',
    (prefix) => {
      expect(() => assertSqlPrefix(prefix)).toThrow();
    }
  );

  test('rejects non-string values', () => {
    expect(() => assertSqlPrefix(undefined)).toThrow();
    expect(() => assertSqlPrefix(null)).toThrow();
    expect(() => assertSqlPrefix(42)).toThrow();
  });
});
