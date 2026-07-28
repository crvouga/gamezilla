import { assert } from '@pkgs/assert';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import { col, honey } from './honey';
import sql, { Sql } from './sql';

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

describe('honey', () => {
  describe('SELECT', () => {
    it('compiles bare select with default star', () => {
      const q = honey({ from: 'books' });
      expect(q).toBeInstanceOf(Sql);
      expect(q.text).toEqual('SELECT * FROM books');
      expect(q.values).toEqual([]);
    });

    it('compiles columns, aliases, distinct, and aggregates', () => {
      const q = honey({
        select: ['id', 'name', [['count', '*'], 'n']],
        distinct: true,
        from: [['users', 'u']],
      });
      expect(q.text).toEqual(
        'SELECT DISTINCT id, name, COUNT(*) AS n FROM users AS u'
      );
      expect(q.values).toEqual([]);
    });

    it('compiles multi-table from', () => {
      const q = honey({
        select: ['t1.id'],
        from: [
          ['t1', 't1'],
          ['t2', 't2'],
        ],
      });
      expect(q.text).toEqual('SELECT t1.id FROM t1 AS t1, t2 AS t2');
    });

    it('compiles groupBy, having, orderBy, limit, offset', () => {
      const q = honey({
        select: [[['count', '*'], 'n']],
        from: 'users',
        groupBy: ['role'],
        having: ['>', ['count', '*'], 1],
        orderBy: [['n', 'desc'], 'role'],
        limit: 10,
        offset: 5,
      });
      expect(q.text).toEqual(
        'SELECT COUNT(*) AS n FROM users GROUP BY role HAVING COUNT(*) > $1 ORDER BY n DESC, role LIMIT $2 OFFSET $3'
      );
      expect(q.values).toEqual([1, 10, 5]);
    });
  });

  describe('JOINs', () => {
    it('compiles inner join (single JoinSpec)', () => {
      const q = honey({
        select: ['u.id'],
        from: [['users', 'u']],
        join: [
          ['orders', 'o'],
          ['=', 'o.user_id', col('u.id')],
        ],
      });
      expect(q.text).toEqual(
        'SELECT u.id FROM users AS u JOIN orders AS o ON o.user_id = u.id'
      );
    });

    it('compiles left and right joins (list form)', () => {
      const q = honey({
        select: ['u.id'],
        from: [['users', 'u']],
        leftJoin: [
          [
            ['profiles', 'p'],
            ['=', 'p.user_id', col('u.id')],
          ],
        ],
        rightJoin: [
          [
            ['accounts', 'a'],
            ['=', 'a.user_id', col('u.id')],
          ],
        ],
      });
      expect(q.text).toEqual(
        'SELECT u.id FROM users AS u LEFT JOIN profiles AS p ON p.user_id = u.id RIGHT JOIN accounts AS a ON a.user_id = u.id'
      );
    });
  });

  describe('WHERE / operators', () => {
    it('compiles and/or/not and infix ops', () => {
      const q = honey({
        select: ['id'],
        from: 'users',
        where: [
          'and',
          ['=', 'active', true],
          ['or', ['like', 'name', '%x%'], ['not', ['=', 'role', 'guest']]],
        ],
      });
      expect(q.text).toEqual(
        'SELECT id FROM users WHERE (active = $1 AND (name LIKE $2 OR NOT role = $3))'
      );
      expect(q.values).toEqual([true, '%x%', 'guest']);
    });

    it('compiles in / not-in list, empty, and subquery', () => {
      const list = honey({
        select: ['id'],
        from: 'users',
        where: ['in', 'role', ['admin', 'staff']],
      });
      expect(list.text).toEqual('SELECT id FROM users WHERE role IN ($1, $2)');
      expect(list.values).toEqual(['admin', 'staff']);

      const emptyIn = honey({
        select: ['id'],
        from: 'users',
        where: ['in', 'id', []],
      });
      expect(emptyIn.text).toEqual('SELECT id FROM users WHERE 1 = 0');

      const emptyNotIn = honey({
        select: ['id'],
        from: 'users',
        where: ['not-in', 'id', []],
      });
      expect(emptyNotIn.text).toEqual('SELECT id FROM users WHERE 1 = 1');

      const sub = honey({
        select: ['id'],
        from: 'users',
        where: [
          'in',
          'id',
          { select: ['user_id'], from: 'orders', where: ['=', 'paid', true] },
        ],
      });
      expect(sub.text).toEqual(
        'SELECT id FROM users WHERE id IN (SELECT user_id FROM orders WHERE paid = $1)'
      );
      expect(sub.values).toEqual([true]);
    });

    it('compiles between, is-null, is-not-null, exists', () => {
      const q = honey({
        select: ['id'],
        from: 'users',
        where: [
          'and',
          ['between', 'age', 18, 65],
          ['is-not-null', 'email'],
          ['is-null', 'deleted_at'],
          [
            'exists',
            {
              select: ['id'],
              from: 'orders',
              where: ['=', 'user_id', col('users.id')],
            },
          ],
        ],
      });
      expect(q.text).toEqual(
        'SELECT id FROM users WHERE (age BETWEEN $1 AND $2 AND email IS NOT NULL AND deleted_at IS NULL AND EXISTS (SELECT id FROM orders WHERE user_id = users.id))'
      );
      expect(q.values).toEqual([18, 65]);
    });

    it('compiles allowlisted functions', () => {
      const q = honey({
        select: [['lower', 'name'], ['coalesce', 'nickname', 'name'], ['now']],
        from: 'users',
      });
      expect(q.text).toEqual(
        'SELECT LOWER(name), COALESCE(nickname, name), NOW() FROM users'
      );
    });
  });

  describe('DML', () => {
    it('compiles insert single and multi-row with returning', () => {
      const single = honey({
        insertInto: 'users',
        values: { id: 1, name: 'Ada' },
        returning: ['id'],
      });
      expect(single.text).toEqual(
        'INSERT INTO users (id, name) VALUES ($1, $2) RETURNING id'
      );
      expect(single.values).toEqual([1, 'Ada']);

      const multi = honey({
        insertInto: 'users',
        values: [
          { id: 1, name: 'Ada' },
          { id: 2, name: 'Grace' },
        ],
      });
      expect(multi.text).toEqual(
        'INSERT INTO users (id, name) VALUES ($1, $2), ($3, $4)'
      );
      expect(multi.values).toEqual([1, 'Ada', 2, 'Grace']);
    });

    it('compiles update set with scalar, col, and op', () => {
      const q = honey({
        update: 'users',
        set: {
          name: 'Ada',
          updated_at: col('created_at'),
          visits: ['+', 'visits', 1],
        },
        where: ['=', 'id', 1],
        returning: ['id', 'name'],
      });
      expect(q.text).toEqual(
        'UPDATE users SET name = $1, updated_at = created_at, visits = visits + $2 WHERE id = $3 RETURNING id, name'
      );
      expect(q.values).toEqual(['Ada', 1, 1]);
    });

    it('compiles delete with where and returning', () => {
      const q = honey({
        deleteFrom: 'users',
        where: ['=', 'id', 9],
        returning: ['id'],
      });
      expect(q.text).toEqual('DELETE FROM users WHERE id = $1 RETURNING id');
      expect(q.values).toEqual([9]);
    });
  });

  describe('subqueries', () => {
    it('compiles subquery in from and select', () => {
      const q = honey({
        select: [
          [
            {
              select: [['count', '*']],
              from: 'orders',
              where: ['=', 'user_id', col('u.id')],
            },
            'order_count',
          ],
        ],
        from: [
          [
            { select: ['id'], from: 'users', where: ['=', 'active', true] },
            'u',
          ],
        ],
      });
      expect(q.text).toEqual(
        'SELECT (SELECT COUNT(*) FROM orders WHERE user_id = u.id) AS order_count FROM (SELECT id FROM users WHERE active = $1) AS u'
      );
      expect(q.values).toEqual([true]);
    });
  });

  describe('Sql integration', () => {
    it('exposes sql/text/statement placeholders and nests in sql`...`', () => {
      const q = honey({
        select: ['id'],
        from: 'users',
        where: ['=', 'name', 'Ada'],
      });
      expect(q.sql).toEqual('SELECT id FROM users WHERE name = ?');
      expect(q.text).toEqual('SELECT id FROM users WHERE name = $1');
      expect(q.statement).toEqual('SELECT id FROM users WHERE name = :1');
      expect(q.values).toEqual(['Ada']);

      const wrapped = sql`EXPLAIN ${q}`;
      expect(wrapped.text).toEqual(
        'EXPLAIN SELECT id FROM users WHERE name = $1'
      );
      expect(wrapped.values).toEqual(['Ada']);
    });

    it('col() works in value position', () => {
      const q = honey({
        select: ['id'],
        from: [['users', 'u']],
        where: ['=', 'u.id', col('u.owner_id')],
      });
      expect(q.text).toEqual(
        'SELECT id FROM users AS u WHERE u.id = u.owner_id'
      );
      expect(q.values).toEqual([]);
    });
  });

  describe('safety', () => {
    it('crashes on invalid identifiers', () => {
      expect(() => honey({ select: ['id;drop'], from: 'users' })).toThrow();
      expect(() => honey({ from: 'users--' })).toThrow();
    });

    it('crashes on unknown operators', () => {
      expect(() =>
        honey({ select: ['id'], from: 'users', where: ['weird', 'a', 1] })
      ).toThrow('honey: unknown operator');
    });

    it('crashes on empty insert / update and bad limit', () => {
      expect(() => honey({ insertInto: 'users' })).toThrow(
        'honey: insertInto requires values'
      );
      expect(() => honey({ update: 'users', set: {} })).toThrow(
        'honey: update requires set'
      );
      expect(() =>
        honey({ select: ['id'], from: 'users', limit: -1 })
      ).toThrow();
      expect(() =>
        honey({ select: ['id'], from: 'users', limit: 1.5 })
      ).toThrow();
      expect(() =>
        honey({
          select: ['id'],
          from: 'users',
          orderBy: [['id', 'sideways' as 'asc']],
        })
      ).toThrow('honey: bad sort dir');
    });
  });
});
