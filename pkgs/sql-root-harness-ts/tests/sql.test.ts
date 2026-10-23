import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { inspect } from 'node:util';
import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import sql, {
  bulk,
  empty,
  ident,
  join,
  raw,
  Sql,
  unsafe,
} from '@pkgs/sql-root-shared-ts/sql';

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

describe('sql template tag', () => {
  it('should generate sql', () => {
    const query = sql<void>`SELECT * FROM books`;

    expect(query.sql).toEqual('SELECT * FROM books');
    expect(query.text).toEqual('SELECT * FROM books');
    expect(query.statement).toEqual('SELECT * FROM books');
    expect(query.values).toEqual([]);
  });

  it('should embed sql in sql', () => {
    const tableName = sql<void>`books`;
    const query = sql<void>`SELECT * FROM ${tableName}`;

    expect(query.sql).toEqual('SELECT * FROM books');
    expect(query.text).toEqual('SELECT * FROM books');
    expect(query.statement).toEqual('SELECT * FROM books');
    expect(query.values).toEqual([]);
  });

  it('should store values', () => {
    const name = 'Blake';
    const query = sql<void>`SELECT * FROM books WHERE author = ${name}`;

    expect(query.sql).toEqual('SELECT * FROM books WHERE author = ?');
    expect(query.text).toEqual('SELECT * FROM books WHERE author = $1');
    expect(query.statement).toEqual('SELECT * FROM books WHERE author = :1');
    expect(query.values).toEqual([name]);
  });

  it('should build sql with child sql statements', () => {
    const subquery = sql<void>`SELECT id FROM authors WHERE name = ${'Blake'}`;
    const query = sql<void>`SELECT * FROM books WHERE author_id IN (${subquery})`;

    expect(query.sql).toEqual(
      'SELECT * FROM books WHERE author_id IN (SELECT id FROM authors WHERE name = ?)'
    );
    expect(query.text).toEqual(
      'SELECT * FROM books WHERE author_id IN (SELECT id FROM authors WHERE name = $1)'
    );
    expect(query.statement).toEqual(
      'SELECT * FROM books WHERE author_id IN (SELECT id FROM authors WHERE name = :1)'
    );
    expect(query.values).toEqual(['Blake']);
  });

  it('should not cache values for mysql compatibility', () => {
    const ids = [1, 2, 3];
    const query = sql<void>`SELECT * FROM books WHERE id IN (${join(
      ids
    )}) OR author_id IN (${join(ids)})`;

    expect(query.sql).toEqual(
      'SELECT * FROM books WHERE id IN (?,?,?) OR author_id IN (?,?,?)'
    );
    expect(query.text).toEqual(
      'SELECT * FROM books WHERE id IN ($1,$2,$3) OR author_id IN ($4,$5,$6)'
    );
    expect(query.statement).toEqual(
      'SELECT * FROM books WHERE id IN (:1,:2,:3) OR author_id IN (:4,:5,:6)'
    );
    expect(query.values).toEqual([1, 2, 3, 1, 2, 3]);
  });

  it('should provide "empty" helper', () => {
    const query = sql<void>`SELECT * FROM books ${empty}`;

    expect(query.sql).toEqual('SELECT * FROM books ');
    expect(query.text).toEqual('SELECT * FROM books ');
    expect(query.statement).toEqual('SELECT * FROM books ');
    expect(query.values).toEqual([]);
  });

  it('should throw in constructor with no strings', () => {
    expect(() => new Sql([], [])).toThrow('Sql: expected at least 1 string');
  });

  it('should throw when values is less than expected', () => {
    expect(() => new Sql(['', ''], [])).toThrow(
      'Sql: expected 2 strings to have 1 values'
    );
  });

  it('should inspect sql instance', () => {
    expect(inspect(sql<void>`SELECT * FROM test`)).toContain(
      `'SELECT * FROM test'`
    );
  });

  it('should handle escaped back ticks', () => {
    const query = sql<void>`UPDATE user SET \`name\` = 'Taylor'`;

    expect(query.text).toEqual("UPDATE user SET `name` = 'Taylor'");
  });

  describe('injection safety', () => {
    const payloads = [
      "' OR 1=1--",
      "'; DROP TABLE users;--",
      '1; DROP TABLE books',
      "x' OR '1'='1",
    ];

    it.each(payloads)(
      'should bind classic payload %j (never splice into SQL text)',
      (payload) => {
        const query = sql<void>`SELECT * FROM books WHERE author = ${payload}`;
        expect(query.sql).toEqual('SELECT * FROM books WHERE author = ?');
        expect(query.values).toEqual([payload]);
        expect(query.sql.includes(payload)).toBe(false);
      }
    );

    it('should bind nested classic payloads', () => {
      const payload = "' OR 1=1--";
      const inner = sql<void>`SELECT id FROM authors WHERE name = ${payload}`;
      const query = sql<void>`SELECT * FROM books WHERE author_id IN (${inner})`;
      expect(query.values).toEqual([payload]);
      expect(query.sql.includes(payload)).toBe(false);
      expect(query.sql).toContain('name = ?');
    });

    it('should freeze strings and values', () => {
      const query = sql<void>`SELECT * FROM books WHERE id = ${1}`;
      expect(Object.isFrozen(query.strings)).toBe(true);
      expect(Object.isFrozen(query.values)).toBe(true);
    });
  });

  describe('join', () => {
    it('should join list', () => {
      const query = join([1, 2, 3]);

      expect(query.text).toEqual('$1,$2,$3');
      expect(query.values).toEqual([1, 2, 3]);
    });

    it('should error joining an empty list', () => {
      expect(() => join([])).toThrow(
        'Sql: join([]) expected a non-empty array of elements'
      );
    });

    it('should join sql', () => {
      const query = join(
        [
          sql<void>`user.first_name LIKE ${'Test'}`,
          sql<void>`user.last_name LIKE ${'User'}`,
        ],
        ' AND '
      );

      expect(query.text).toEqual(
        'user.first_name LIKE $1 AND user.last_name LIKE $2'
      );
      expect(query.values).toEqual(['Test', 'User']);
    });

    it('should support one term without separators', () => {
      const query = join([sql<void>`user.first_name LIKE ${'Test'}`], ' AND ');

      expect(query.text).toEqual('user.first_name LIKE $1');
      expect(query.values).toEqual(['Test']);
    });

    it('should configure prefix and suffix characters', () => {
      const query = join([1, 2, 3], ',', '(', ')');

      expect(query.text).toEqual('($1,$2,$3)');
      expect(query.values).toEqual([1, 2, 3]);
    });

    it('should reject malicious glue separator', () => {
      expect(() => join([1], ' OR 1=1;-- ')).toThrow(
        'Sql: join/bulk separator forbids semicolons'
      );
    });
  });

  describe('ident', () => {
    it('should accept a valid identifier', () => {
      const query = sql<void>`SELECT * FROM ${ident('books')}`;
      expect(query.sql).toEqual('SELECT * FROM books');
      expect(query.values).toEqual([]);
    });

    it('should reject injection-shaped identifiers', () => {
      expect(() => ident('users; DROP')).toThrow();
      expect(() => ident('x--y')).toThrow();
      expect(() => ident("'x'")).toThrow();
    });
  });

  describe('raw', () => {
    it('should accept trusted multi-token SQL without boundaries', () => {
      const query = raw('PRAGMA foreign_keys = ON');
      expect(query.sql).toEqual('PRAGMA foreign_keys = ON');
      expect(query.values).toEqual([]);
    });

    it('should reject statement-boundary markers', () => {
      expect(() => raw('SELECT 1; DROP TABLE t')).toThrow(
        'Sql: raw() forbids semicolons'
      );
      expect(() => raw('a -- b')).toThrow('Sql: raw() forbids line comments');
      expect(() => raw('a /* b */')).toThrow(
        'Sql: raw() forbids block comments'
      );
    });
  });

  describe('unsafe', () => {
    it('should allow full SQL text including statement boundaries', () => {
      const value = 'SELECT 1; DROP TABLE t';
      const query = unsafe(value);
      expect(query.sql).toEqual(value);
      expect(query.values).toEqual([]);
    });
  });

  describe('value typing', () => {
    it.each([
      ['string', 'Blake'],
      ['number', 123],
      ['boolean', true],
      ['Date', new Date('2010-01-01T00:00:00Z')],
      ['null', null],
      ['undefined', undefined],
      ['string array', ['Blake', 'Taylor']],
      ['object', { name: 'Blake' }],
    ])('should allow using %s as a value', (_type, value) => {
      const query = sql<void>`UPDATE user SET any_value = ${value}`;
      expect(query.values).toEqual([value]);
    });
  });

  describe('bulk', () => {
    it('should join nested list', () => {
      const query = bulk([
        [1, 2, 3],
        [5, 2, 3],
      ]);

      expect(query.text).toEqual('($1,$2,$3),($4,$5,$6)');
      expect(query.values).toEqual([1, 2, 3, 5, 2, 3]);
    });

    it('should error joining an empty list', () => {
      expect(() => bulk([])).toThrow(
        'Sql: bulk([]) expected a non-empty nested array'
      );
    });

    it('should error joining an nested empty list', () => {
      expect(() => bulk([[]])).toThrow(
        'Sql: bulk([[]]) expected nested arrays of multiple elements'
      );
    });

    it('should error joining an nested non uniform list', () => {
      expect(() => bulk([[1, 2], [1, 3], [1]])).toThrow(
        'Sql: bulk([2][]) column count mismatch'
      );
    });
  });
});
